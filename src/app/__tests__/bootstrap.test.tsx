import { focusManager, onlineManager } from "@tanstack/react-query";
import { persistQueryClientSave } from "@tanstack/react-query-persist-client";
import { act, waitFor } from "@testing-library/react-native";
import { HttpResponse, http } from "msw";
import { AppState, type AppStateStatus, Text, View } from "react-native";
import { describe, expect, it } from "vitest";
import { useAppBootstrap } from "@/app/bootstrap";
import { type AppComposition, createAppComposition } from "@/app/composition";
import { AUTH_QUERY_KEYS } from "@/shared/api/query-keys";
import { BEARER_TOKEN_STORAGE_KEY, getCachedBearerToken } from "@/shared/lib/auth-session-bridge";
import { createSpyObservability } from "@/shared/observability/spy-adapter";
import { createInMemoryCredentialStore } from "@/shared/storage/credential-store";
import { createInMemoryKvStore } from "@/shared/storage/kv-store";
import {
  createQueryPersister,
  QUERY_CACHE_STORAGE_KEY,
  shouldDehydrateAppQuery,
} from "@/shared/storage/query-persister";
import { mockSplashScreen } from "@/test/mocks/adapters/mock-expo-splash-screen";
import { emitMockNetInfoState } from "@/test/mocks/adapters/mock-netinfo";
import { buildTestSessionPayload } from "@/test/mocks/handlers/auth";
import { server, TEST_API_BASE } from "@/test/msw-server";
import { renderWithProviders } from "@/test/render";

function BootstrapProbe({ composition }: { composition: AppComposition }) {
  const { isBootstrapping, isReady } = useAppBootstrap(composition);
  return (
    <View>
      <Text testID="bootstrap-status">{isBootstrapping ? "bootstrapping" : "complete"}</Text>
      <Text testID="bootstrap-ready">{isReady ? "ready" : "pending"}</Text>
    </View>
  );
}

describe("useAppBootstrap", () => {
  it("hydrates bearer token, fetches initial session, and hides splash screen only once complete", async () => {
    let resolveSession: (() => void) | null = null;
    const sessionGate = new Promise<void>((resolve) => {
      resolveSession = resolve;
    });

    let capturedAuthHeader: string | null = null;
    const payload = buildTestSessionPayload({
      id: "user-boot",
      name: "Bootstrap User",
      email: "boot@example.com",
      role: "member",
    });

    server.use(
      http.get(`${TEST_API_BASE}/api/auth/get-session`, async ({ request }) => {
        capturedAuthHeader = request.headers.get("authorization");
        await sessionGate;
        return HttpResponse.json(payload);
      }),
    );

    const credentialStore = createInMemoryCredentialStore({
      [BEARER_TOKEN_STORAGE_KEY]: "tok_persisted_boot",
    });
    const observability = createSpyObservability();
    const composition = createAppComposition({
      credentialStore,
      observability,
      defaultQueryOptions: { retry: false, gcTime: Number.POSITIVE_INFINITY, staleTime: 0 },
    });

    try {
      const { getByTestId } = renderWithProviders(<BootstrapProbe composition={composition} />, {
        credentialStore,
        observability,
        queryClient: composition.queryClient,
      });

      // Before session resolves, splash screen must remain visible
      expect(getByTestId("bootstrap-status").props.children).toBe("bootstrapping");
      expect(mockSplashScreen.hideCalls).toBe(0);

      await waitFor(() => {
        expect(getCachedBearerToken()).toBe("tok_persisted_boot");
        expect(capturedAuthHeader).toBe("Bearer tok_persisted_boot");
      });
      expect(mockSplashScreen.hideCalls).toBe(0);

      // Release initial session response
      await act(async () => {
        resolveSession?.();
      });

      await waitFor(() => {
        expect(getByTestId("bootstrap-status").props.children).toBe("complete");
        expect(getByTestId("bootstrap-ready").props.children).toBe("ready");
        expect(mockSplashScreen.hideCalls).toBe(1);
      });

      expect(composition.queryClient.getQueryData(AUTH_QUERY_KEYS.session())).toMatchObject({
        user: { id: "user-boot", email: "boot@example.com" },
      });
      expect(observability.currentUser?.id).toBe("user-boot");
    } finally {
      await composition.dispose();
    }
  });

  it("wires TanStack Query focusManager to React Native AppState transitions", async () => {
    const listeners: Array<(state: AppStateStatus) => void> = [];
    const originalAddEventListener = AppState.addEventListener;
    AppState.addEventListener = ((_type: string, listener: (state: AppStateStatus) => void) => {
      listeners.push(listener);
      return { remove: () => {} };
    }) as typeof AppState.addEventListener;

    const composition = createAppComposition({
      defaultQueryOptions: { retry: false, gcTime: Number.POSITIVE_INFINITY, staleTime: 0 },
    });

    try {
      const { getByTestId } = renderWithProviders(<BootstrapProbe composition={composition} />, {
        queryClient: composition.queryClient,
      });

      await waitFor(() => {
        expect(getByTestId("bootstrap-ready").props.children).toBe("ready");
      });

      expect(listeners.length).toBeGreaterThan(0);

      await act(async () => {
        for (const listener of listeners) {
          listener("background");
        }
      });
      expect(focusManager.isFocused()).toBe(false);

      await act(async () => {
        for (const listener of listeners) {
          listener("active");
        }
      });
      expect(focusManager.isFocused()).toBe(true);
    } finally {
      AppState.addEventListener = originalAddEventListener;
      await composition.dispose();
    }
  });

  it("restores persisted offline query cache from kvStore and persists new task cache without auth session", async () => {
    const kvStore = createInMemoryKvStore();
    const seedComposition = createAppComposition({
      kvStore,
      defaultQueryOptions: { retry: false, gcTime: Number.POSITIVE_INFINITY, staleTime: 0 },
    });

    const cachedTasks = {
      data: [
        {
          id: "22222222-2222-4222-8222-222222222222",
          name: "Restored on boot",
          done: false,
          userId: "user-boot",
          createdAt: "2026-03-01T10:00:00.000Z",
          updatedAt: "2026-03-01T10:00:00.000Z",
        },
      ],
      meta: { nextCursor: null, hasMore: false },
    };

    seedComposition.queryClient.setQueryData(["/api/v1/tasks"], cachedTasks);
    await persistQueryClientSave({
      queryClient: seedComposition.queryClient,
      persister: createQueryPersister(kvStore, { throttleTime: 0 }),
      dehydrateOptions: { shouldDehydrateQuery: shouldDehydrateAppQuery },
    });
    await new Promise((resolve) => setTimeout(resolve, 10));
    await seedComposition.dispose();

    const composition = createAppComposition({
      kvStore,
      defaultQueryOptions: { retry: false, gcTime: Number.POSITIVE_INFINITY, staleTime: 0 },
    });

    try {
      const { getByTestId } = renderWithProviders(<BootstrapProbe composition={composition} />, {
        kvStore,
        queryClient: composition.queryClient,
      });

      await waitFor(() => {
        expect(getByTestId("bootstrap-ready").props.children).toBe("ready");
      });

      expect(composition.queryClient.getQueryData(["/api/v1/tasks"])).toEqual(cachedTasks);

      // Update auth session and tasks after boot; ensure auth never leaks into kvStore
      await act(async () => {
        composition.queryClient.setQueryData(AUTH_QUERY_KEYS.session(), {
          user: { id: "user-boot", email: "hidden@example.com" },
          session: { token: "never-persist-this-token" },
        });
      });

      const persistedRaw = kvStore.getString(QUERY_CACHE_STORAGE_KEY);
      expect(persistedRaw).toBeDefined();
      expect(persistedRaw).not.toContain("never-persist-this-token");
      expect(persistedRaw).not.toContain("hidden@example.com");
    } finally {
      await composition.dispose();
    }
  });

  it("wires TanStack Query onlineManager to NetInfo connectivity transitions", async () => {
    const composition = createAppComposition({
      defaultQueryOptions: { retry: false, gcTime: Number.POSITIVE_INFINITY, staleTime: 0 },
    });

    try {
      const { getByTestId } = renderWithProviders(<BootstrapProbe composition={composition} />, {
        queryClient: composition.queryClient,
      });

      await waitFor(() => {
        expect(getByTestId("bootstrap-ready").props.children).toBe("ready");
      });

      await act(async () => {
        emitMockNetInfoState({ isConnected: false, isInternetReachable: false });
      });
      expect(onlineManager.isOnline()).toBe(false);

      await act(async () => {
        emitMockNetInfoState({ isConnected: true, isInternetReachable: true });
      });
      expect(onlineManager.isOnline()).toBe(true);
    } finally {
      onlineManager.setOnline(true);
      await composition.dispose();
    }
  });
});
