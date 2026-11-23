import { type QueryClient, queryOptions, useQuery } from "@tanstack/react-query";
import { Schema } from "effect";
import { EXPO_AUTH_STORAGE_PREFIX } from "@/features/auth/api/client";
import {
  type AuthEnvelope,
  AuthEnvelopeSchema,
  type AuthUser,
  type SignInInput,
  SignInSchema,
  type SignUpInput,
  SignUpSchema,
} from "@/features/auth/model/schemas";
import {
  createW3CTraceparent,
  customFetch,
  FetchError,
  type HonoErrorEnvelope,
} from "@/shared/api/fetch";
import { AUTH_QUERY_KEYS } from "@/shared/api/query-keys";
import { resolveApiUrl } from "@/shared/config/env";
import {
  BEARER_TOKEN_STORAGE_KEY,
  clearCachedBearerToken,
  getCachedBearerToken,
  purgePersistedQueryCaches,
  registerAuthSessionQueryOptions,
  resetAuthSessionCache,
  setCachedBearerToken,
} from "@/shared/lib/auth-session-bridge";
import type { ObservabilityService } from "@/shared/observability/port";
import type { CredentialStorePort } from "@/shared/storage/credential-store";
import type { KeyValueStorePort } from "@/shared/storage/kv-store";
import { QUERY_CACHE_STORAGE_KEY } from "@/shared/storage/query-persister";

export interface AuthSessionDependencies {
  readonly credentialStore?: CredentialStorePort;
  readonly observability?: ObservabilityService | null;
}

export interface AuthActionDependencies {
  readonly credentialStore: CredentialStorePort;
  readonly queryClient: QueryClient;
  readonly observability?: ObservabilityService | null;
  readonly kvStore?: KeyValueStorePort;
}

let activeDependencies: AuthSessionDependencies = {};

export function registerAuthSessionDependencies(deps: AuthSessionDependencies): void {
  activeDependencies = deps;
}

export function syncObservabilityUser(
  user: AuthUser | null,
  obs: ObservabilityService | null = activeDependencies.observability ?? null,
): void {
  if (!obs) return;

  if (user) {
    obs.setUserContext({
      id: user.id,
      email: user.email,
      role: user.role,
    });
  } else {
    obs.clearUserContext();
  }
}

/**
 * Reads the persisted bearer token from hardware-encrypted storage once during
 * app bootstrap into the synchronous in-memory cache (`cachedBearerToken`),
 * eliminating per-request Keychain IPC overhead on outbound fetches and SSE streams.
 */
export async function hydrateBearerToken(
  credentialStore: CredentialStorePort,
): Promise<string | null> {
  const token = await credentialStore.getItem(BEARER_TOKEN_STORAGE_KEY);
  setCachedBearerToken(token);
  return getCachedBearerToken();
}

export async function purgePersistedCredentials(
  credentialStore?: CredentialStorePort,
): Promise<void> {
  clearCachedBearerToken();
  if (!credentialStore) return;

  await Promise.all([
    credentialStore.deleteItem(BEARER_TOKEN_STORAGE_KEY),
    credentialStore.deleteItem(`${EXPO_AUTH_STORAGE_PREFIX}_cookie`),
    credentialStore.deleteItem(`${EXPO_AUTH_STORAGE_PREFIX}_session_data`),
  ]);
}

function decodeAuthEnvelopePayload(raw: unknown, fallbackToken?: string | null): AuthEnvelope {
  if (raw && typeof raw === "object" && "user" in raw && !("session" in raw)) {
    const candidate = raw as { user: Record<string, unknown>; token?: string };
    const token = candidate.token ?? fallbackToken ?? undefined;
    const normalized = {
      user: candidate.user,
      session: {
        id: `session-${String(candidate.user.id ?? "current")}`,
        userId: String(candidate.user.id ?? ""),
        ...(token ? { token } : {}),
      },
    };
    return Schema.decodeUnknownSync(AuthEnvelopeSchema)(normalized);
  }

  const envelope = Schema.decodeUnknownSync(AuthEnvelopeSchema)(raw);
  if (!envelope.session.token && fallbackToken) {
    return {
      ...envelope,
      session: {
        ...envelope.session,
        token: fallbackToken,
      },
    };
  }
  return envelope;
}

async function postAuthJson(
  path: string,
  payload: unknown,
): Promise<{ body: unknown; authTokenHeader: string | null }> {
  const { traceparent, traceId } = createW3CTraceparent();
  const headers = new Headers({
    "Content-Type": "application/json",
    traceparent,
  });

  const cachedToken = getCachedBearerToken();
  if (cachedToken) {
    headers.set("Authorization", `Bearer ${cachedToken}`);
  }

  const response = await fetch(resolveApiUrl(path), {
    method: "POST",
    headers,
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    let errorData: HonoErrorEnvelope | undefined;
    try {
      errorData = (await response.json()) as HonoErrorEnvelope;
    } catch {
      errorData = { message: response.statusText || `HTTP error ${response.status}` };
    }

    const requestId =
      errorData?.error?.requestId ?? response.headers.get("X-Request-Id") ?? undefined;
    const code = errorData?.error?.code;
    const message =
      errorData?.error?.message ||
      errorData?.message ||
      response.statusText ||
      `HTTP error ${response.status}`;

    throw new FetchError({
      status: response.status,
      code,
      message,
      requestId,
      traceId,
      details: errorData?.error?.details,
      data: errorData,
    });
  }

  let body: unknown = null;
  if (response.status !== 204) {
    try {
      body = await response.json();
    } catch {
      body = null;
    }
  }

  return {
    body,
    authTokenHeader: response.headers.get("set-auth-token"),
  };
}

export async function fetchAuthSession(
  deps: AuthSessionDependencies = activeDependencies,
): Promise<AuthEnvelope | null> {
  const credentialStore = deps.credentialStore ?? activeDependencies.credentialStore;
  const observability = deps.observability ?? activeDependencies.observability ?? null;

  try {
    const raw = await customFetch<unknown>("/api/auth/get-session", {
      method: "GET",
    });

    if (!raw || typeof raw !== "object" || !("user" in raw) || !(raw as { user?: unknown }).user) {
      syncObservabilityUser(null, observability);
      return null;
    }

    const envelope = decodeAuthEnvelopePayload(raw, getCachedBearerToken());
    if (envelope.session.token) {
      setCachedBearerToken(envelope.session.token);
      if (credentialStore) {
        await credentialStore.setItem(BEARER_TOKEN_STORAGE_KEY, envelope.session.token);
      }
    }

    syncObservabilityUser(envelope.user, observability);
    return envelope;
  } catch (error) {
    if (error instanceof FetchError && error.status === 401) {
      await purgePersistedCredentials(credentialStore);
      resetAuthSessionCache();
      syncObservabilityUser(null, observability);
      return null;
    }
    throw error;
  }
}

export function createAuthSessionQueryOptions(deps?: AuthSessionDependencies) {
  return queryOptions({
    queryKey: AUTH_QUERY_KEYS.session(),
    queryFn: () => fetchAuthSession(deps ?? activeDependencies),
    staleTime: 5 * 60_000,
    gcTime: 30 * 60_000,
  });
}

export const authSessionQueryOptions = createAuthSessionQueryOptions();

export function registerAuthSessionBridge(deps: AuthSessionDependencies = {}): void {
  registerAuthSessionDependencies(deps);
  registerAuthSessionQueryOptions(createAuthSessionQueryOptions(deps));
}

// Register default query options so shared UI (<Can />) always has a session fetcher
registerAuthSessionQueryOptions(authSessionQueryOptions);

export async function signInWithEmail(
  input: SignInInput,
  deps: AuthActionDependencies,
): Promise<AuthEnvelope> {
  const validated = Schema.decodeUnknownSync(SignInSchema)(input);
  const { body, authTokenHeader } = await postAuthJson("/api/auth/sign-in/email", validated);
  const envelope = decodeAuthEnvelopePayload(body, authTokenHeader);

  const token = authTokenHeader ?? envelope.session.token ?? null;
  if (token) {
    setCachedBearerToken(token);
    await deps.credentialStore.setItem(BEARER_TOKEN_STORAGE_KEY, token);
  }

  deps.queryClient.setQueryData(AUTH_QUERY_KEYS.session(), envelope);
  syncObservabilityUser(envelope.user, deps.observability ?? null);

  return envelope;
}

export async function signUpWithEmail(
  input: SignUpInput,
  deps: AuthActionDependencies,
): Promise<AuthEnvelope> {
  const validated = Schema.decodeUnknownSync(SignUpSchema)(input);
  const { body, authTokenHeader } = await postAuthJson("/api/auth/sign-up/email", validated);
  const envelope = decodeAuthEnvelopePayload(body, authTokenHeader);

  const token = authTokenHeader ?? envelope.session.token ?? null;
  if (token) {
    setCachedBearerToken(token);
    await deps.credentialStore.setItem(BEARER_TOKEN_STORAGE_KEY, token);
  }

  deps.queryClient.setQueryData(AUTH_QUERY_KEYS.session(), envelope);
  syncObservabilityUser(envelope.user, deps.observability ?? null);

  return envelope;
}

export async function signOut(deps: AuthActionDependencies): Promise<void> {
  try {
    await postAuthJson("/api/auth/sign-out", {});
  } catch {
    // Always complete local credential purge even when offline or token is already revoked
  }

  await purgePersistedCredentials(deps.credentialStore);
  deps.queryClient.setQueryData(AUTH_QUERY_KEYS.session(), null);
  deps.queryClient.clear();
  deps.kvStore?.delete(QUERY_CACHE_STORAGE_KEY);
  purgePersistedQueryCaches();
  syncObservabilityUser(null, deps.observability ?? null);
}

export function useAuthSession() {
  const query = useQuery(authSessionQueryOptions);

  return {
    session: query.data?.session ?? null,
    user: query.data?.user ?? null,
    isLoading: query.isLoading,
    isFetching: query.isFetching,
    isAuthenticated: Boolean(query.data?.user),
    error: query.error,
    refetch: query.refetch,
  };
}
