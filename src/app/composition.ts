import { type DefaultOptions, MutationCache, QueryCache, QueryClient } from "@tanstack/react-query";
import { decodeApiError } from "@/shared/api/contracts";
import {
  BEARER_TOKEN_STORAGE_KEY,
  onAuthUnauthorized,
  purgePersistedQueryCaches,
  registerCachePurge,
  registerQueryClient,
  resetAuthSessionCache,
} from "@/shared/lib/auth-session-bridge";
import { createObservabilityService } from "@/shared/observability/factory";
import { type ObservabilityService, recordErrorOrDefect } from "@/shared/observability/port";
import {
  type CredentialStorePort,
  createInMemoryCredentialStore,
} from "@/shared/storage/credential-store";
import { createInMemoryKvStore, type KeyValueStorePort } from "@/shared/storage/kv-store";
import { QUERY_CACHE_STORAGE_KEY } from "@/shared/storage/query-persister";
import { type AppRuntime, createAppRuntime } from "./runtime";

export interface AppCompositionOptions {
  readonly queryClient?: QueryClient;
  readonly observability?: ObservabilityService;
  readonly credentialStore?: CredentialStorePort;
  readonly kvStore?: KeyValueStorePort;
  readonly defaultQueryOptions?: DefaultOptions["queries"];
  readonly defaultMutationOptions?: DefaultOptions["mutations"];
}

export interface AppComposition {
  readonly queryClient: QueryClient;
  readonly runtime: AppRuntime;
  readonly observability: ObservabilityService;
  readonly credentialStore: CredentialStorePort;
  readonly kvStore: KeyValueStorePort;
  readonly dispose: () => Promise<void>;
}

function isUnauthorizedError(error: unknown): boolean {
  if (typeof error !== "object" || error === null) return false;
  const err = error as { status?: number; _tag?: string };
  return err.status === 401 || err._tag === "UnauthorizedError";
}

function createManagedQueryClient(
  observability: ObservabilityService,
  credentialStore: CredentialStorePort,
  options?: {
    defaultQueryOptions?: DefaultOptions["queries"];
    defaultMutationOptions?: DefaultOptions["mutations"];
  },
): QueryClient {
  let clientRef: QueryClient | null = null;

  const handleCacheError = (error: unknown) => {
    const decoded = decodeApiError(error);
    recordErrorOrDefect(observability, decoded);

    if (isUnauthorizedError(decoded)) {
      resetAuthSessionCache();
      void credentialStore.deleteItem(BEARER_TOKEN_STORAGE_KEY);
      observability.clearUserContext();
      clientRef?.clear();
      purgePersistedQueryCaches();
    }
  };

  const queryClient = new QueryClient({
    queryCache: new QueryCache({
      onError: handleCacheError,
    }),
    mutationCache: new MutationCache({
      onError: handleCacheError,
    }),
    defaultOptions: {
      queries: {
        staleTime: 60_000,
        gcTime: 1000 * 60 * 60 * 24,
        retry: (failureCount, error) => {
          const decoded = decodeApiError(error);
          if (typeof decoded.status === "number" && decoded.status >= 400 && decoded.status < 500) {
            return false;
          }
          return failureCount < 2;
        },
        ...options?.defaultQueryOptions,
      },
      mutations: {
        retry: false,
        ...options?.defaultMutationOptions,
      },
    },
  });

  clientRef = queryClient;
  return queryClient;
}

/**
 * Side-effect-free Composition Root factory.
 * Assembles isolated QueryClient, Effect ManagedRuntime, Observability, and Storage Ports
 * per app mount or test without any module-level singletons.
 */
export function createAppComposition(options: AppCompositionOptions = {}): AppComposition {
  const observability = options.observability ?? createObservabilityService();
  const credentialStore = options.credentialStore ?? createInMemoryCredentialStore();
  const kvStore = options.kvStore ?? createInMemoryKvStore();
  const queryClient =
    options.queryClient ??
    createManagedQueryClient(observability, credentialStore, {
      defaultQueryOptions: options.defaultQueryOptions,
      defaultMutationOptions: options.defaultMutationOptions,
    });

  const runtime = createAppRuntime(undefined, { observability });
  const unregisterQueryClient = registerQueryClient(queryClient);
  const unregisterCachePurge = registerCachePurge(() => {
    kvStore.delete(QUERY_CACHE_STORAGE_KEY);
  });
  const unregisterUnauthorized = onAuthUnauthorized(() => {
    void credentialStore.deleteItem(BEARER_TOKEN_STORAGE_KEY);
    observability.clearUserContext();
  });

  const dispose = async () => {
    unregisterUnauthorized();
    unregisterCachePurge();
    unregisterQueryClient();
    queryClient.clear();
    await runtime.dispose();
  };

  return {
    queryClient,
    runtime,
    observability,
    credentialStore,
    kvStore,
    dispose,
  };
}
