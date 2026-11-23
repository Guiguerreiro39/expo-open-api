import { useMutation, useQueryClient } from "@tanstack/react-query";
import { act, fireEvent, waitFor } from "@testing-library/react-native";
import { Schema } from "effect";
import { HttpResponse, http } from "msw";
import { AppState, type AppStateStatus, Pressable, Text, View } from "react-native";
import { describe, expect, it } from "vitest";
import { defineContract } from "@/shared/api/contracts";
import { AUTH_QUERY_KEYS } from "@/shared/api/query-keys";
import { getCachedBearerToken, setCachedBearerToken } from "@/shared/lib/auth-session-bridge";
import {
  computeBackoffDelayMs,
  type UseLiveQueryOptions,
  useLiveQuery,
} from "@/shared/lib/hooks/use-live-query";
import { emitMockNetInfoState } from "@/test/mocks/adapters/mock-netinfo";
import { honoErrorResponse, server, TEST_API_BASE } from "@/test/msw-server";
import { renderWithProviders } from "@/test/render";

const TestItemSchema = Schema.Struct({
  id: Schema.String,
  name: Schema.String,
});

const TestListSchema = Schema.Struct({
  data: Schema.Array(TestItemSchema),
  meta: Schema.Struct({
    nextCursor: Schema.NullOr(Schema.String),
    hasMore: Schema.Boolean,
  }),
});

type TestList = Schema.Schema.Type<typeof TestListSchema>;

const testListDescriptor = defineContract({
  path: "/api/v1/test-items",
  dataSchema: TestListSchema,
  errors: [400, 401, 403, 429, 500, 503],
});

interface StreamControllerHandle {
  send: (chunk: string) => void;
  close: () => void;
  error: (err: unknown) => void;
}

function createControlledSseStream(): {
  stream: ReadableStream<Uint8Array>;
  handle: StreamControllerHandle;
} {
  const encoder = new TextEncoder();
  let controllerRef: ReadableStreamDefaultController<Uint8Array> | null = null;
  const queued: string[] = [];

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      controllerRef = controller;
      for (const chunk of queued) {
        controller.enqueue(encoder.encode(chunk));
      }
      queued.length = 0;
    },
  });

  const handle: StreamControllerHandle = {
    send(chunk: string) {
      if (controllerRef) {
        controllerRef.enqueue(encoder.encode(chunk));
      } else {
        queued.push(chunk);
      }
    },
    close() {
      controllerRef?.close();
    },
    error(err: unknown) {
      controllerRef?.error(err);
    },
  };

  return { stream, handle };
}

function LiveQueryProbe({
  liveUrl = "/api/v1/test-items/live",
  baseDelayMs = 20,
  maxDelayMs = 200,
  enabled = true,
  queryKey = ["/api/v1/test-items"],
  mutationKey = ["test-items", "mutation"],
}: Partial<
  Pick<
    UseLiveQueryOptions<TestList, TestList, unknown>,
    "liveUrl" | "baseDelayMs" | "maxDelayMs" | "enabled" | "mutationKey"
  >
> & { queryKey?: readonly unknown[] }) {
  const result = useLiveQuery({
    queryOptions: {
      queryKey,
      queryFn: async () => {
        const res = await fetch(`${TEST_API_BASE}/api/v1/test-items`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return (await res.json()) as TestList;
      },
    },
    descriptor: testListDescriptor,
    liveUrl,
    baseDelayMs,
    maxDelayMs,
    enabled,
    mutationKey,
  });

  return (
    <View>
      <Text testID="live-status">{result.liveStatus}</Text>
      <Text testID="last-ping">{result.lastPingAt ? String(result.lastPingAt) : "none"}</Text>
      <Text testID="stream-error">{result.streamError ? result.streamError._tag : "none"}</Text>
      <Text testID="items-json">{JSON.stringify(result.data?.data ?? [])}</Text>
    </View>
  );
}

function MutationBufferProbe({
  onCreateRequest,
}: {
  onCreateRequest: (resolve: (item: { id: string; name: string }) => void) => void;
}) {
  const queryClient = useQueryClient();
  const live = useLiveQuery({
    queryOptions: {
      queryKey: ["/api/v1/test-items"],
      queryFn: async () => {
        const res = await fetch(`${TEST_API_BASE}/api/v1/test-items`);
        return (await res.json()) as TestList;
      },
    },
    descriptor: testListDescriptor,
    liveUrl: "/api/v1/test-items/live",
    mutationKey: ["test-items", "mutation"],
  });

  const createMutation = useMutation({
    mutationKey: ["test-items", "mutation", "create"],
    mutationFn: (_name: string) =>
      new Promise<{ id: string; name: string }>((resolve) => {
        onCreateRequest(resolve);
      }),
    onMutate: async (name: string) => {
      const optimisticId = "optimistic-local-1";
      queryClient.setQueryData<TestList>(["/api/v1/test-items"], (old) => ({
        data: [{ id: optimisticId, name }, ...(old?.data ?? [])],
        meta: old?.meta ?? { nextCursor: null, hasMore: false },
      }));
      return { optimisticId };
    },
    onSuccess: (serverItem, _vars, context) => {
      queryClient.setQueryData<TestList>(["/api/v1/test-items"], (old) => {
        if (!old) return old;
        return {
          ...old,
          data: old.data.map((item) => (item.id === context?.optimisticId ? serverItem : item)),
        };
      });
    },
  });

  return (
    <View>
      <Pressable testID="create-btn" onPress={() => createMutation.mutate("My New Item")}>
        <Text>Create</Text>
      </Pressable>
      <Text testID="items-json">{JSON.stringify(live.data?.data ?? [])}</Text>
    </View>
  );
}

describe("computeBackoffDelayMs", () => {
  it("applies exponential backoff with jitter and respects ceiling", () => {
    // randomFn = 0.5 => jitter factor = 1.0 (exact base * 2^attempt)
    expect(computeBackoffDelayMs(0, 1000, 30_000, () => 0.5)).toBe(1000);
    expect(computeBackoffDelayMs(1, 1000, 30_000, () => 0.5)).toBe(2000);
    expect(computeBackoffDelayMs(5, 1000, 30_000, () => 0.5)).toBe(30_000);

    // jitter bounds: 0.8x to 1.2x
    expect(computeBackoffDelayMs(0, 1000, 30_000, () => 0)).toBe(800);
    expect(computeBackoffDelayMs(0, 1000, 30_000, () => 1)).toBe(1200);
    // never exceeds maxDelayMs even with upper jitter
    expect(computeBackoffDelayMs(10, 1000, 30_000, () => 1)).toBe(30_000);
  });
});

describe("useLiveQuery", () => {
  it("streams init, update, and ping frames with Bearer + W3C trace headers (never token in query params)", async () => {
    setCachedBearerToken("tok_live_secret_123");

    let capturedUrl = "";
    let capturedHeaders: Record<string, string | null> = {};
    const { stream, handle } = createControlledSseStream();

    server.use(
      http.get(`${TEST_API_BASE}/api/v1/test-items`, () =>
        HttpResponse.json({
          data: [{ id: "initial-1", name: "Initial" }],
          meta: { nextCursor: null, hasMore: false },
        }),
      ),
      http.get(`${TEST_API_BASE}/api/v1/test-items/live`, ({ request }) => {
        capturedUrl = request.url;
        capturedHeaders = {
          authorization: request.headers.get("authorization"),
          accept: request.headers.get("accept"),
          requestId: request.headers.get("x-request-id"),
          traceparent: request.headers.get("traceparent"),
        };
        return new HttpResponse(stream, {
          status: 200,
          headers: { "Content-Type": "text/event-stream" },
        });
      }),
    );

    const { getByTestId, unmount } = renderWithProviders(<LiveQueryProbe />);

    await waitFor(() => {
      expect(capturedHeaders.authorization).toBe("Bearer tok_live_secret_123");
    });

    expect(capturedUrl).not.toContain("tok_live_secret_123");
    expect(capturedHeaders.accept).toBe("text/event-stream");
    expect(capturedHeaders.requestId).toMatch(/^req_/);
    expect(capturedHeaders.traceparent).toMatch(/^00-[0-9a-f]{32}-[0-9a-f]{16}-01$/);

    await act(async () => {
      handle.send(
        `event: init\nretry: 500\ndata: ${JSON.stringify({
          data: [{ id: "sse-1", name: "From Init" }],
          meta: { nextCursor: null, hasMore: false },
        })}\n\n`,
      );
    });

    await waitFor(() => {
      expect(getByTestId("live-status").props.children).toBe("connected");
      expect(getByTestId("items-json").props.children).toBe(
        JSON.stringify([{ id: "sse-1", name: "From Init" }]),
      );
    });

    await act(async () => {
      handle.send(`event: ping\ndata: ${JSON.stringify({ timestamp: 1735000000000 })}\n\n`);
    });

    await waitFor(() => {
      expect(getByTestId("last-ping").props.children).toBe("1735000000000");
    });

    await act(async () => {
      handle.send(
        `event: update\ndata: ${JSON.stringify({
          data: [
            { id: "sse-2", name: "Second" },
            { id: "sse-1", name: "From Init" },
          ],
          meta: { nextCursor: null, hasMore: false },
        })}\n\n`,
      );
    });

    await waitFor(() => {
      expect(getByTestId("items-json").props.children).toBe(
        JSON.stringify([
          { id: "sse-2", name: "Second" },
          { id: "sse-1", name: "From Init" },
        ]),
      );
    });

    handle.close();
    unmount();
  });

  it("captures SchemaDecodeError defect in observability on malformed snapshot and preserves prior cache", async () => {
    setCachedBearerToken("tok_live_schema");
    const { stream, handle } = createControlledSseStream();

    server.use(
      http.get(`${TEST_API_BASE}/api/v1/test-items`, () =>
        HttpResponse.json({
          data: [{ id: "good-1", name: "Valid Initial" }],
          meta: { nextCursor: null, hasMore: false },
        }),
      ),
      http.get(`${TEST_API_BASE}/api/v1/test-items/live`, () => {
        return new HttpResponse(stream, {
          status: 200,
          headers: { "Content-Type": "text/event-stream" },
        });
      }),
    );

    const { getByTestId, observability, unmount } = renderWithProviders(<LiveQueryProbe />);

    await waitFor(() => {
      expect(getByTestId("items-json").props.children).toBe(
        JSON.stringify([{ id: "good-1", name: "Valid Initial" }]),
      );
    });

    // Send malformed payload that violates TestListSchema
    await act(async () => {
      handle.send(`event: update\ndata: ${JSON.stringify({ data: "NOT_AN_ARRAY", meta: {} })}\n\n`);
    });

    await waitFor(() => {
      expect(getByTestId("stream-error").props.children).toBe("SchemaDecodeError");
      expect(observability.defects.length).toBeGreaterThanOrEqual(1);
    });

    // Prior valid cache must remain untouched!
    expect(getByTestId("items-json").props.children).toBe(
      JSON.stringify([{ id: "good-1", name: "Valid Initial" }]),
    );

    handle.close();
    unmount();
  });

  it("handles SSE error frame and halts retries on non-retryable 401 while resetting auth session cache", async () => {
    setCachedBearerToken("tok_expired_401");
    let liveHits = 0;

    server.use(
      http.get(`${TEST_API_BASE}/api/v1/test-items`, () =>
        HttpResponse.json({
          data: [],
          meta: { nextCursor: null, hasMore: false },
        }),
      ),
      http.get(`${TEST_API_BASE}/api/v1/test-items/live`, () => {
        liveHits += 1;
        return honoErrorResponse(401, "UNAUTHORIZED", "Token expired");
      }),
    );

    const { getByTestId, queryClient, unmount } = renderWithProviders(
      <LiveQueryProbe baseDelayMs={10} maxDelayMs={50} />,
      {
        user: { id: "u-1", name: "Alice", email: "alice@example.com", role: "member" },
      },
    );

    await waitFor(() => {
      expect(getByTestId("live-status").props.children).toBe("error");
      expect(getByTestId("stream-error").props.children).toBe("UnauthorizedError");
    });

    // Wait briefly to verify retries are halted on 401
    await new Promise((resolve) => setTimeout(resolve, 60));
    expect(liveHits).toBe(1);
    expect(getCachedBearerToken()).toBeNull();
    expect(queryClient.getQueryData(AUTH_QUERY_KEYS.session())).toBeNull();

    unmount();
  });

  it("suspends active stream on AppState background and reconnects immediately on active", async () => {
    setCachedBearerToken("tok_appstate");
    const listeners: Array<(state: AppStateStatus) => void> = [];
    const originalAddEventListener = AppState.addEventListener;
    AppState.addEventListener = ((_type: string, listener: (state: AppStateStatus) => void) => {
      listeners.push(listener);
      return { remove: () => {} };
    }) as typeof AppState.addEventListener;

    let connectionCount = 0;
    let firstAborted = false;
    const handles: StreamControllerHandle[] = [];

    server.use(
      http.get(`${TEST_API_BASE}/api/v1/test-items`, () =>
        HttpResponse.json({
          data: [],
          meta: { nextCursor: null, hasMore: false },
        }),
      ),
      http.get(`${TEST_API_BASE}/api/v1/test-items/live`, ({ request }) => {
        connectionCount += 1;
        const connNum = connectionCount;
        const { stream, handle } = createControlledSseStream();
        handles.push(handle);

        request.signal.addEventListener("abort", () => {
          if (connNum === 1) {
            firstAborted = true;
          }
        });

        return new HttpResponse(stream, {
          status: 200,
          headers: { "Content-Type": "text/event-stream" },
        });
      }),
    );

    try {
      const { getByTestId, unmount } = renderWithProviders(
        <LiveQueryProbe baseDelayMs={5000} maxDelayMs={10_000} />,
      );

      await waitFor(() => {
        expect(connectionCount).toBe(1);
      });

      await act(async () => {
        handles[0]?.send(
          `event: init\ndata: ${JSON.stringify({
            data: [{ id: "1", name: "Before BG" }],
            meta: { nextCursor: null, hasMore: false },
          })}\n\n`,
        );
      });

      await waitFor(() => {
        expect(getByTestId("live-status").props.children).toBe("connected");
      });

      // Transition app to background -> must abort active stream and NOT reconnect
      await act(async () => {
        for (const listener of listeners) {
          listener("background");
        }
      });

      await waitFor(() => {
        expect(firstAborted).toBe(true);
        expect(getByTestId("live-status").props.children).toBe("idle");
      });
      expect(connectionCount).toBe(1);

      // Return app to foreground -> must reconnect immediately
      await act(async () => {
        for (const listener of listeners) {
          listener("active");
        }
      });

      await waitFor(() => {
        expect(connectionCount).toBe(2);
      });

      for (const h of handles) {
        try {
          h.close();
        } catch {
          // ignore already closed
        }
      }
      unmount();
    } finally {
      AppState.addEventListener = originalAddEventListener;
    }
  });

  it("cancels backoff sleep and reconnects + invalidates queries immediately when NetInfo returns online", async () => {
    setCachedBearerToken("tok_netinfo");
    let liveAttempts = 0;
    let listFetches = 0;

    server.use(
      http.get(`${TEST_API_BASE}/api/v1/test-items`, () => {
        listFetches += 1;
        return HttpResponse.json({
          data: [{ id: `item-${listFetches}`, name: `Fetch ${listFetches}` }],
          meta: { nextCursor: null, hasMore: false },
        });
      }),
      http.get(`${TEST_API_BASE}/api/v1/test-items/live`, () => {
        liveAttempts += 1;
        if (liveAttempts === 1) {
          return honoErrorResponse(503, "SERVICE_UNAVAILABLE", "Temporary outage");
        }
        const { stream, handle } = createControlledSseStream();
        handle.send(
          `event: init\ndata: ${JSON.stringify({
            data: [{ id: "recovered-1", name: "Recovered" }],
            meta: { nextCursor: null, hasMore: false },
          })}\n\n`,
        );
        return new HttpResponse(stream, {
          status: 200,
          headers: { "Content-Type": "text/event-stream" },
        });
      }),
    );

    // Long backoff (30s) so only NetInfo reconnection can wake it within the test timeout!
    const { getByTestId, unmount } = renderWithProviders(
      <LiveQueryProbe baseDelayMs={30_000} maxDelayMs={30_000} />,
    );

    await waitFor(() => {
      expect(liveAttempts).toBe(1);
      expect(getByTestId("live-status").props.children).toBe("reconnecting");
    });

    const fetchesBeforeReconnect = listFetches;

    // Simulate offline -> online transition
    await act(async () => {
      emitMockNetInfoState({ isConnected: false, isInternetReachable: false });
      emitMockNetInfoState({ isConnected: true, isInternetReachable: true });
    });

    await waitFor(() => {
      expect(liveAttempts).toBe(2);
      expect(getByTestId("live-status").props.children).toBe("connected");
      expect(listFetches).toBeGreaterThan(fetchesBeforeReconnect);
    });

    unmount();
  });

  it("buffers SSE snapshots during active mutation and merges newly-created items without clobbering", async () => {
    setCachedBearerToken("tok_buffer");
    const { stream, handle } = createControlledSseStream();

    let resolveCreate: ((item: { id: string; name: string }) => void) | null = null;

    server.use(
      http.get(`${TEST_API_BASE}/api/v1/test-items`, () =>
        HttpResponse.json({
          data: [{ id: "existing-1", name: "Existing" }],
          meta: { nextCursor: null, hasMore: false },
        }),
      ),
      http.get(`${TEST_API_BASE}/api/v1/test-items/live`, () => {
        return new HttpResponse(stream, {
          status: 200,
          headers: { "Content-Type": "text/event-stream" },
        });
      }),
    );

    const { getByTestId, unmount } = renderWithProviders(
      <MutationBufferProbe
        onCreateRequest={(resolve) => {
          resolveCreate = resolve;
        }}
      />,
    );

    await waitFor(() => {
      expect(getByTestId("items-json").props.children).toBe(
        JSON.stringify([{ id: "existing-1", name: "Existing" }]),
      );
    });

    // Start mutation -> optimistic item inserted
    fireEvent.press(getByTestId("create-btn"));

    await waitFor(() => {
      expect(getByTestId("items-json").props.children).toContain("optimistic-local-1");
    });

    // While mutation is in flight, a concurrent peer SSE update arrives (without our newly created item!)
    await act(async () => {
      handle.send(
        `event: update\ndata: ${JSON.stringify({
          data: [
            { id: "peer-1", name: "Peer Item" },
            { id: "existing-1", name: "Existing" },
          ],
          meta: { nextCursor: null, hasMore: false },
        })}\n\n`,
      );
    });

    // Buffered: optimistic item must STILL be visible and NOT clobbered while mutation is active
    await new Promise((resolve) => setTimeout(resolve, 25));
    expect(getByTestId("items-json").props.children).toContain("optimistic-local-1");
    expect(getByTestId("items-json").props.children).not.toContain("peer-1");

    // Settle the create mutation -> onSuccess swaps optimistic-local-1 -> server-created-1,
    // THEN microtask flushes buffered SSE snapshot preserving server-created-1 AND merging peer-1!
    await act(async () => {
      resolveCreate?.({ id: "server-created-1", name: "My New Item" });
    });

    await waitFor(() => {
      const items = JSON.parse(getByTestId("items-json").props.children as string) as Array<{
        id: string;
        name: string;
      }>;
      const ids = items.map((i) => i.id);
      expect(ids).toContain("server-created-1");
      expect(ids).toContain("peer-1");
      expect(ids).toContain("existing-1");
      expect(ids).not.toContain("optimistic-local-1");
    });

    handle.close();
    unmount();
  });

  it("handles SSE event: error frame and captures 5xx server stream errors as defects", async () => {
    setCachedBearerToken("tok_sse_err_frame");
    const { stream, handle } = createControlledSseStream();

    server.use(
      http.get(`${TEST_API_BASE}/api/v1/test-items`, () =>
        HttpResponse.json({
          data: [],
          meta: { nextCursor: null, hasMore: false },
        }),
      ),
      http.get(`${TEST_API_BASE}/api/v1/test-items/live`, () => {
        return new HttpResponse(stream, {
          status: 200,
          headers: { "Content-Type": "text/event-stream" },
        });
      }),
    );

    const { getByTestId, observability, unmount } = renderWithProviders(<LiveQueryProbe />);

    await act(async () => {
      handle.send(
        `event: error\ndata: ${JSON.stringify({
          error: {
            code: "INTERNAL_SERVER_ERROR",
            message: "Database watcher failed",
            requestId: "req_err_1",
          },
        })}\n\n`,
      );
    });

    await waitFor(() => {
      expect(getByTestId("stream-error").props.children).toBe("InternalServerError");
      expect(observability.defects.length).toBeGreaterThanOrEqual(1);
    });

    handle.close();
    unmount();
  });
});
