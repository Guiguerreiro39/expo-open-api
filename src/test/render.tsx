import { PortalHost } from "@rn-primitives/portal";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { type RenderOptions, type RenderResult, render } from "@testing-library/react-native";
import type { ReactElement, ReactNode } from "react";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { type AppComposition, createAppComposition } from "@/app/composition";
import { type AppRuntime, AppRuntimeContext } from "@/app/runtime";

export { type AppComposition, createAppComposition as createTestComposition };

import { AUTH_QUERY_KEYS } from "@/shared/api/query-keys";
import { AuthBootstrapContext, setCachedBearerToken } from "@/shared/lib/auth-session-bridge";
import type { ThemeMode, ThemePreset } from "@/shared/lib/theme/presets";
import { ObservabilityContext } from "@/shared/observability/observability-context";
import {
  createSpyObservability,
  type SpyObservabilityAdapter,
} from "@/shared/observability/spy-adapter";
import {
  type CredentialStorePort,
  createInMemoryCredentialStore,
} from "@/shared/storage/credential-store";
import { CredentialStoreContext } from "@/shared/storage/credential-store-context";
import { createInMemoryKvStore, type KeyValueStorePort } from "@/shared/storage/kv-store";
import { ThemeProvider } from "@/shared/ui/theme-provider";
import { TOAST_PORTAL_HOST, ToastProvider } from "@/shared/ui/toast";
import { buildTestSessionPayload, type TestAuthUser } from "./mocks/handlers/auth";
import { mockAuthSession } from "./msw-server";

export const TEST_SAFE_AREA_METRICS = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 47, left: 0, right: 0, bottom: 34 },
};

export function createTestQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        gcTime: Number.POSITIVE_INFINITY,
        staleTime: 0,
      },
      mutations: {
        retry: false,
      },
    },
  });
}

export interface RenderWithProvidersOptions extends Omit<RenderOptions, "wrapper"> {
  readonly user?: TestAuthUser | null;
  readonly queryClient?: QueryClient;
  readonly observability?: SpyObservabilityAdapter;
  readonly credentialStore?: CredentialStorePort;
  readonly kvStore?: KeyValueStorePort;
  readonly initialPreset?: ThemePreset;
  readonly initialColorScheme?: ThemeMode;
  readonly isBootstrapping?: boolean;
}

export interface RenderWithProvidersResult extends RenderResult {
  readonly composition: AppComposition;
  readonly queryClient: QueryClient;
  readonly observability: SpyObservabilityAdapter;
  readonly credentialStore: CredentialStorePort;
  readonly kvStore: KeyValueStorePort;
  readonly runtime: AppRuntime;
}

interface TestProvidersProps {
  readonly composition: AppComposition;
  readonly initialPreset?: ThemePreset;
  readonly initialColorScheme?: ThemeMode;
  readonly isBootstrapping?: boolean;
  readonly children: ReactNode;
}

function TestProviders({
  composition,
  initialPreset,
  initialColorScheme,
  isBootstrapping = false,
  children,
}: TestProvidersProps) {
  return (
    <SafeAreaProvider initialMetrics={TEST_SAFE_AREA_METRICS}>
      <QueryClientProvider client={composition.queryClient}>
        <AppRuntimeContext.Provider value={composition.runtime}>
          <ObservabilityContext.Provider value={composition.observability}>
            <CredentialStoreContext.Provider value={composition.credentialStore}>
              <AuthBootstrapContext.Provider value={isBootstrapping}>
                <ThemeProvider
                  storage={composition.kvStore}
                  initialPreset={initialPreset}
                  initialColorScheme={initialColorScheme}
                >
                  <ToastProvider>
                    {children}
                    <PortalHost />
                    <PortalHost name={TOAST_PORTAL_HOST} />
                  </ToastProvider>
                </ThemeProvider>
              </AuthBootstrapContext.Provider>
            </CredentialStoreContext.Provider>
          </ObservabilityContext.Provider>
        </AppRuntimeContext.Provider>
      </QueryClientProvider>
    </SafeAreaProvider>
  );
}

export function renderWithProviders(
  ui: ReactElement,
  options: RenderWithProvidersOptions = {},
): RenderWithProvidersResult {
  const {
    user,
    queryClient: providedQueryClient,
    observability = createSpyObservability(),
    credentialStore = createInMemoryCredentialStore(),
    kvStore = createInMemoryKvStore(),
    initialPreset,
    initialColorScheme,
    isBootstrapping = false,
    ...renderOptions
  } = options;

  const composition = createAppComposition({
    queryClient: providedQueryClient,
    observability,
    credentialStore,
    kvStore,
    defaultQueryOptions: {
      retry: false,
      gcTime: Number.POSITIVE_INFINITY,
      staleTime: 0,
    },
    defaultMutationOptions: {
      retry: false,
    },
  });

  if (user !== undefined) {
    mockAuthSession(user);
    if (user) {
      const payload = buildTestSessionPayload(user);
      setCachedBearerToken(payload.session.token);
      composition.queryClient.setQueryData(AUTH_QUERY_KEYS.session(), payload);
    } else {
      setCachedBearerToken(null);
      composition.queryClient.setQueryData(AUTH_QUERY_KEYS.session(), null);
    }
  }

  const result = render(
    <TestProviders
      composition={composition}
      initialPreset={initialPreset}
      initialColorScheme={initialColorScheme}
      isBootstrapping={isBootstrapping}
    >
      {ui}
    </TestProviders>,
    renderOptions,
  );

  return {
    ...result,
    composition,
    queryClient: composition.queryClient,
    observability,
    credentialStore: composition.credentialStore,
    kvStore: composition.kvStore,
    runtime: composition.runtime,
  };
}
