import NetInfo from "@react-native-community/netinfo";
import {
  type MutationKey,
  type QueryKey,
  type UseQueryOptions,
  useQueryClient,
} from "@tanstack/react-query";
import { Schema } from "effect";
import { createParser } from "eventsource-parser";
import { fetch as expoFetch } from "expo/fetch";
import { useEffect, useRef, useState } from "react";
import { AppState, type AppStateStatus, Platform } from "react-native";
import {
  type AnyApiError,
  decodeApiError,
  type FunctionDescriptor,
  SchemaDecodeError,
  type UseEffectQueryResult,
  useEffectQuery,
} from "@/shared/api/contracts";
import { createW3CTraceparent, FetchError, type HonoErrorEnvelope } from "@/shared/api/fetch";
import { resolveApiUrl } from "@/shared/config/env";
import { getCachedBearerToken, resetAuthSessionCache } from "@/shared/lib/auth-session-bridge";
import { useObservability } from "@/shared/observability/observability-context";
import { recordErrorOrDefect } from "@/shared/observability/port";

export type LiveConnectionStatus = "idle" | "connecting" | "connected" | "reconnecting" | "error";

export interface LiveFetchInit {
  readonly method: "GET";
  readonly headers: Record<string, string>;
  readonly signal: AbortSignal;
}

export interface LiveFetchResponse {
  readonly ok: boolean;
  readonly status: number;
  readonly statusText: string;
  readonly headers: {
    get(name: string): string | null;
  };
  readonly body: ReadableStream<Uint8Array> | null;
  json(): Promise<unknown>;
}

export type LiveFetchImpl = (url: string, init: LiveFetchInit) => Promise<LiveFetchResponse>;

export interface UseLiveQueryOptions<
  TQueryFnData extends I,
  A,
  E,
  I = unknown,
  TError = unknown,
  TQueryKey extends QueryKey = QueryKey,
> {
  readonly queryOptions: UseQueryOptions<TQueryFnData, TError, TQueryFnData, TQueryKey>;
  readonly descriptor: FunctionDescriptor<A, E, I>;
  /** Relative or absolute SSE path (e.g. Orval's `getGetApiV1TasksLiveUrl(params)`) */
  readonly liveUrl: string;
  /** Optional explicit Bearer token or getter; defaults to `getCachedBearerToken()` */
  readonly bearerToken?:
    | string
    | (() => string | null | undefined | Promise<string | null | undefined>);
  /** Injectable streaming fetch implementation; defaults to `expo/fetch` on native and `fetch` on web */
  readonly fetchImpl?: LiveFetchImpl;
  readonly enabled?: boolean;
  readonly baseDelayMs?: number;
  readonly maxDelayMs?: number;
  readonly mutationKey?: MutationKey;
  readonly onStreamError?: (error: AnyApiError | SchemaDecodeError) => void;
}

export type UseLiveQueryResult<A, E> = UseEffectQueryResult<A, E> & {
  readonly liveStatus: LiveConnectionStatus;
  readonly streamError: AnyApiError | SchemaDecodeError | null;
  readonly lastPingAt: number | null;
};

interface SseErrorEnvelope {
  readonly error?: {
    readonly code?: string;
    readonly message?: string;
    readonly requestId?: string;
    readonly details?: unknown;
  };
}

/**
 * Computes exponential backoff delay with +/-20% jitter, capped at `maxDelayMs`.
 */
export function computeBackoffDelayMs(
  attempt: number,
  baseDelayMs: number,
  maxDelayMs: number,
  randomFn: () => number = Math.random,
): number {
  const exponential = Math.min(maxDelayMs, baseDelayMs * 2 ** Math.max(0, attempt));
  const jitterFactor = 0.8 + randomFn() * 0.4;
  return Math.min(maxDelayMs, Math.max(0, Math.round(exponential * jitterFactor)));
}

function generateRequestId(): string {
  if (
    typeof globalThis.crypto !== "undefined" &&
    typeof globalThis.crypto.randomUUID === "function"
  ) {
    return `req_${globalThis.crypto.randomUUID()}`;
  }
  return `req_${Date.now()}_${Math.random().toString(16).slice(2, 10)}`;
}

function decodeSseErrorFrame(raw: string): AnyApiError {
  try {
    const parsed = JSON.parse(raw) as SseErrorEnvelope;
    if (parsed?.error) {
      const code = parsed.error.code ?? "INTERNAL_SERVER_ERROR";
      const status =
        code === "UNAUTHORIZED"
          ? 401
          : code === "FORBIDDEN"
            ? 403
            : code === "NOT_FOUND"
              ? 404
              : code === "INVALID_CURSOR" || code === "BAD_REQUEST"
                ? 400
                : code === "VALIDATION_ERROR"
                  ? 422
                  : code === "RATE_LIMIT_EXCEEDED"
                    ? 429
                    : code === "SERVICE_UNAVAILABLE"
                      ? 503
                      : 500;
      return decodeApiError(
        new FetchError({
          status,
          code,
          message: parsed.error.message ?? "SSE stream error",
          requestId: parsed.error.requestId ?? "unknown",
          data: parsed,
        }),
      );
    }
  } catch {
    // Fall through to generic error
  }
  return decodeApiError(new Error(raw || "SSE stream error"));
}

const defaultMobileFetch: LiveFetchImpl = (url, init) => {
  if (Platform.OS === "web") {
    return globalThis.fetch(url, init) as Promise<LiveFetchResponse>;
  }
  return expoFetch(url, {
    method: init.method,
    headers: init.headers,
    signal: init.signal,
  }) as unknown as Promise<LiveFetchResponse>;
};

export function useLiveQuery<
  TQueryFnData extends I,
  A,
  E,
  I = unknown,
  TError = unknown,
  TQueryKey extends QueryKey = QueryKey,
>(
  options: UseLiveQueryOptions<TQueryFnData, A, E, I, TError, TQueryKey>,
): UseLiveQueryResult<A, E> {
  const {
    queryOptions,
    descriptor,
    liveUrl,
    bearerToken,
    fetchImpl,
    enabled = true,
    baseDelayMs = 1_000,
    maxDelayMs = 30_000,
    mutationKey = ["tasks", "mutation"],
    onStreamError,
  } = options;

  const queryClient = useQueryClient();
  const contextObservability = useObservability();
  const observability = descriptor.observability ?? contextObservability;
  const isEnabled = queryOptions.enabled !== false && enabled;

  const [isAppActive, setIsAppActive] = useState<boolean>(
    Platform.OS === "web" ? true : AppState.currentState !== "background",
  );
  const [liveStatus, setLiveStatus] = useState<LiveConnectionStatus>(
    isEnabled && isAppActive ? "connecting" : "idle",
  );
  const [streamError, setStreamError] = useState<AnyApiError | SchemaDecodeError | null>(null);
  const [lastPingAt, setLastPingAt] = useState<number | null>(null);

  const effectiveDescriptor: FunctionDescriptor<A, E, I> = descriptor.observability
    ? descriptor
    : { ...descriptor, observability };

  const queryResult = useEffectQuery(
    {
      ...queryOptions,
      enabled: isEnabled,
      staleTime:
        liveStatus === "connected" ? Number.POSITIVE_INFINITY : (queryOptions.staleTime ?? 60_000),
    },
    effectiveDescriptor,
  );

  const queryKeyRef = useRef(queryOptions.queryKey);
  queryKeyRef.current = queryOptions.queryKey;
  const descriptorRef = useRef(effectiveDescriptor);
  descriptorRef.current = effectiveDescriptor;
  const observabilityRef = useRef(observability);
  observabilityRef.current = observability;
  const onStreamErrorRef = useRef(onStreamError);
  onStreamErrorRef.current = onStreamError;
  const bearerTokenRef = useRef(bearerToken);
  bearerTokenRef.current = bearerToken;
  const mutationKeyRef = useRef(mutationKey);
  mutationKeyRef.current = mutationKey;
  const fetchImplRef = useRef<LiveFetchImpl>(fetchImpl ?? defaultMobileFetch);
  fetchImplRef.current = fetchImpl ?? defaultMobileFetch;

  const bufferedSnapshotRef = useRef<unknown | null>(null);
  const wakeBackoffRef = useRef<(() => void) | null>(null);
  const resetAttemptRef = useRef<(() => void) | null>(null);

  // Suspend active SSE streams when mobile app goes to background/inactive; resume on active
  useEffect(() => {
    if (Platform.OS === "web") {
      return;
    }

    const handleAppStateChange = (nextState: AppStateStatus) => {
      const active = nextState === "active";
      setIsAppActive(active);
      if (!active) {
        setLiveStatus("idle");
      }
    };

    const subscription = AppState.addEventListener("change", handleAppStateChange);
    return () => {
      subscription.remove();
    };
  }, []);

  // Reconnect immediately and invalidate stale queries when NetInfo transitions offline -> online
  useEffect(() => {
    if (!isEnabled || Platform.OS === "web") {
      return;
    }

    let wasOffline = false;
    const unsubscribe = NetInfo.addEventListener((state) => {
      const isOnline = Boolean(state.isConnected && state.isInternetReachable !== false);
      if (!isOnline) {
        wasOffline = true;
        return;
      }

      if (wasOffline) {
        wasOffline = false;
        resetAttemptRef.current?.();
        wakeBackoffRef.current?.();
        void queryClient.invalidateQueries({ queryKey: queryKeyRef.current as QueryKey });
      }
    });

    return () => {
      unsubscribe();
    };
  }, [isEnabled, queryClient]);

  // Subscribe to MutationCache to flush buffered SSE snapshots after active mutations settle
  useEffect(() => {
    const unsubscribe = queryClient.getMutationCache().subscribe(() => {
      const activeMutations = queryClient.isMutating({
        mutationKey: mutationKeyRef.current,
      });

      if (activeMutations === 0 && bufferedSnapshotRef.current !== null) {
        queueMicrotask(() => {
          const stillActive = queryClient.isMutating({
            mutationKey: mutationKeyRef.current,
          });
          if (stillActive > 0 || bufferedSnapshotRef.current === null) {
            return;
          }
          const flushData = bufferedSnapshotRef.current;
          bufferedSnapshotRef.current = null;
          queryClient.setQueryData(queryKeyRef.current as QueryKey, (current: unknown) => {
            if (!current || !flushData) return flushData;
            const currentObj = current as { data?: Array<{ id?: string }> };
            const flushObj = flushData as { data?: Array<{ id?: string }> };
            if (Array.isArray(currentObj.data) && Array.isArray(flushObj.data)) {
              const flushItems = flushObj.data;
              const currentItems = currentObj.data;
              const flushIds = new Set(flushItems.map((item) => item.id));
              const newlyAdded = currentItems.filter(
                (item) => item.id && !flushIds.has(item.id) && !item.id.startsWith("optimistic-"),
              );
              return {
                ...(flushData as Record<string, unknown>),
                data: [...newlyAdded, ...flushItems],
              };
            }
            return flushData;
          });
        });
      }
    });

    return () => {
      unsubscribe();
    };
  }, [queryClient]);

  useEffect(() => {
    if (!isEnabled || !isAppActive) {
      setLiveStatus("idle");
      return;
    }

    const fullUrl = resolveApiUrl(liveUrl);
    setLiveStatus("connecting");
    setStreamError(null);

    const handleSnapshotData = (rawData: string) => {
      let parsed: unknown;
      try {
        parsed = JSON.parse(rawData);
      } catch (cause) {
        const err = new SchemaDecodeError({ path: descriptorRef.current.path, cause });
        setStreamError(err);
        onStreamErrorRef.current?.(err);
        recordErrorOrDefect(observabilityRef.current, err, { path: descriptorRef.current.path });
        return;
      }

      const validation = Schema.decodeUnknownEither(descriptorRef.current.dataSchema)(parsed);
      if (validation._tag === "Left") {
        const err = new SchemaDecodeError({
          path: descriptorRef.current.path,
          cause: validation.left,
        });
        setStreamError(err);
        onStreamErrorRef.current?.(err);
        recordErrorOrDefect(observabilityRef.current, err, { path: descriptorRef.current.path });
        return;
      }

      setStreamError(null);
      setLiveStatus("connected");

      const activeMutations = queryClient.isMutating({
        mutationKey: mutationKeyRef.current,
      });

      if (activeMutations > 0) {
        bufferedSnapshotRef.current = parsed;
      } else {
        bufferedSnapshotRef.current = null;
        queryClient.setQueryData(queryKeyRef.current as QueryKey, parsed);
      }
    };

    const handlePingData = (rawData: string) => {
      try {
        const parsed = JSON.parse(rawData) as { timestamp?: number };
        setLastPingAt(typeof parsed.timestamp === "number" ? parsed.timestamp : Date.now());
      } catch {
        setLastPingAt(Date.now());
      }
      setLiveStatus("connected");
    };

    const controller = new AbortController();
    const { signal } = controller;

    void (async () => {
      let attempt = 0;
      let serverRetryMs: number | undefined;
      resetAttemptRef.current = () => {
        attempt = 0;
      };

      while (!signal.aborted) {
        try {
          const tokenSource = bearerTokenRef.current;
          const resolvedToken =
            tokenSource !== undefined
              ? typeof tokenSource === "function"
                ? await tokenSource()
                : tokenSource
              : getCachedBearerToken();

          if (!resolvedToken) {
            const err = decodeApiError(
              new FetchError({
                status: 401,
                code: "UNAUTHORIZED",
                message: "Missing Bearer token for live stream",
                requestId: "unknown",
              }),
            );
            setStreamError(err);
            setLiveStatus("error");
            onStreamErrorRef.current?.(err);
            recordErrorOrDefect(observabilityRef.current, err, {
              path: descriptorRef.current.path,
            });
            return;
          }

          const { traceparent } = createW3CTraceparent();
          const requestId = generateRequestId();

          const response = await fetchImplRef.current(fullUrl, {
            method: "GET",
            headers: {
              Authorization: `Bearer ${resolvedToken}`,
              Accept: "text/event-stream",
              "X-Request-Id": requestId,
              traceparent,
            },
            signal,
          });

          if (!response.ok) {
            const headerRequestId = response.headers.get("x-request-id") ?? requestId;
            let rawBody: unknown;
            try {
              rawBody = await response.json();
            } catch {
              rawBody = undefined;
            }
            const env = (rawBody as SseErrorEnvelope | undefined)?.error;
            const fetchErr = new FetchError({
              status: response.status,
              code: env?.code ?? `HTTP_${response.status}`,
              message: env?.message ?? (response.statusText || `HTTP ${response.status}`),
              requestId: env?.requestId ?? headerRequestId,
              data: rawBody as HonoErrorEnvelope | undefined,
            });
            const decodedErr = decodeApiError(fetchErr);
            setStreamError(decodedErr);
            onStreamErrorRef.current?.(decodedErr);
            recordErrorOrDefect(observabilityRef.current, decodedErr, {
              path: descriptorRef.current.path,
            });

            if (response.status === 401) {
              resetAuthSessionCache();
            }

            // Halt retries on non-retryable 4xx (except 429 Too Many Requests)
            if (response.status >= 400 && response.status < 500 && response.status !== 429) {
              setLiveStatus("error");
              return;
            }
            throw fetchErr;
          }

          if (!response.body) {
            throw new Error("SSE response missing readable body");
          }

          attempt = 0;
          let haltedByErrorFrame = false;

          const parser = createParser({
            onRetry(retryMs) {
              serverRetryMs = retryMs;
            },
            onEvent(event) {
              if (event.event === "init" || event.event === "update") {
                handleSnapshotData(event.data);
              } else if (event.event === "ping") {
                handlePingData(event.data);
              } else if (event.event === "error") {
                const decoded = decodeSseErrorFrame(event.data);
                setStreamError(decoded);
                onStreamErrorRef.current?.(decoded);
                recordErrorOrDefect(observabilityRef.current, decoded, {
                  path: descriptorRef.current.path,
                });
                if (decoded.status === 401) {
                  resetAuthSessionCache();
                  setLiveStatus("error");
                  haltedByErrorFrame = true;
                }
              }
            },
          });

          const reader = response.body.getReader();
          const decoder = new TextDecoder();

          try {
            while (!signal.aborted && !haltedByErrorFrame) {
              const { done, value } = await reader.read();
              if (done) break;
              parser.feed(decoder.decode(value, { stream: true }));
            }
          } finally {
            try {
              await reader.cancel();
            } catch {
              // Reader may already be closed
            }
          }

          if (haltedByErrorFrame) {
            return;
          }
        } catch {
          if (signal.aborted) return;
        }

        if (signal.aborted) return;
        setLiveStatus("reconnecting");

        const base = serverRetryMs ?? baseDelayMs;
        const delayMs = computeBackoffDelayMs(attempt, base, maxDelayMs);
        attempt += 1;

        await new Promise<void>((resolve) => {
          let settled = false;
          const done = () => {
            if (settled) return;
            settled = true;
            clearTimeout(timer);
            wakeBackoffRef.current = null;
            signal.removeEventListener("abort", done);
            resolve();
          };

          const timer = setTimeout(done, delayMs);
          wakeBackoffRef.current = done;
          signal.addEventListener("abort", done, { once: true });
        });
      }
    })();

    return () => {
      wakeBackoffRef.current = null;
      resetAttemptRef.current = null;
      controller.abort();
    };
  }, [liveUrl, isEnabled, isAppActive, baseDelayMs, maxDelayMs, queryClient]);

  return {
    ...queryResult,
    liveStatus,
    streamError,
    lastPingAt,
  };
}
