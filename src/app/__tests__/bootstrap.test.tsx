import { focusManager } from "@tanstack/react-query";
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
import { mockSplashScreen } from "@/test/mocks/adapters/mock-expo-splash-screen";
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
});
