import NetInfo from "@react-native-community/netinfo";
import { focusManager, onlineManager } from "@tanstack/react-query";
import {
  persistQueryClientRestore,
  persistQueryClientSubscribe,
} from "@tanstack/react-query-persist-client";
import * as SplashScreen from "expo-splash-screen";
import { useEffect, useState } from "react";
import { AppState, type AppStateStatus, Platform } from "react-native";
import type { AppComposition } from "@/app/composition";
import {
  createAuthSessionQueryOptions,
  hydrateBearerToken,
  registerAuthSessionBridge,
} from "@/features/auth/api/session";
import {
  createQueryPersister,
  DEFAULT_QUERY_CACHE_MAX_AGE_MS,
  shouldDehydrateAppQuery,
} from "@/shared/storage/query-persister";

export interface AppBootstrapState {
  readonly isBootstrapping: boolean;
  readonly isReady: boolean;
}

export interface UseAppBootstrapOptions {
  readonly loadFonts?: () => Promise<void>;
  readonly persistThrottleTimeMs?: number;
}

/**
 * Coordinates mobile application startup:
 * 1. Connects TanStack Query's `focusManager` to React Native's `AppState`
 * 2. Connects TanStack Query's `onlineManager` to NetInfo connectivity events
 * 3. Registers auth session query options in `auth-session-bridge`
 * 4. Hydrates the persisted Bearer token from `CredentialStorePort` into RAM
 * 5. Restores persisted offline query cache from `kvStore` (excluding auth queries) and subscribes
 * 6. Runs optional font loading and initial session verification
 * 7. Dismisses the native SplashScreen only once bootstrap completes
 */
export function useAppBootstrap(
  composition: AppComposition,
  options: UseAppBootstrapOptions = {},
): AppBootstrapState {
  const [isReady, setIsReady] = useState(false);
  const { loadFonts, persistThrottleTimeMs } = options;

  useEffect(() => {
    if (Platform.OS === "web") {
      return;
    }

    const handleAppStateChange = (status: AppStateStatus) => {
      focusManager.setFocused(status === "active");
    };

    const subscription = AppState.addEventListener("change", handleAppStateChange);
    return () => {
      subscription.remove();
    };
  }, []);

  useEffect(() => {
    if (Platform.OS === "web") {
      return;
    }

    let unsubscribeNetInfo: (() => void) | undefined;
    onlineManager.setEventListener((setOnline) => {
      unsubscribeNetInfo = NetInfo.addEventListener((state) => {
        const isOnline = Boolean(state.isConnected && state.isInternetReachable !== false);
        setOnline(isOnline);
      });
      return () => {
        unsubscribeNetInfo?.();
        unsubscribeNetInfo = undefined;
      };
    });

    return () => {
      unsubscribeNetInfo?.();
      unsubscribeNetInfo = undefined;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    let unsubscribePersist: (() => void) | undefined;

    const bootstrap = async () => {
      const sessionDeps = {
        credentialStore: composition.credentialStore,
        observability: composition.observability,
      };
      registerAuthSessionBridge(sessionDeps);

      const persister = createQueryPersister(composition.kvStore, {
        throttleTime: persistThrottleTimeMs,
      });

      try {
        await Promise.all([
          hydrateBearerToken(composition.credentialStore),
          persistQueryClientRestore({
            queryClient: composition.queryClient,
            persister,
            maxAge: DEFAULT_QUERY_CACHE_MAX_AGE_MS,
          }).catch(() => undefined),
          loadFonts ? loadFonts().catch(() => undefined) : Promise.resolve(),
        ]);

        if (!cancelled) {
          unsubscribePersist = persistQueryClientSubscribe({
            queryClient: composition.queryClient,
            persister,
            dehydrateOptions: {
              shouldDehydrateQuery: shouldDehydrateAppQuery,
            },
          });
        }

        const sessionQueryOpts = createAuthSessionQueryOptions(sessionDeps);
        await composition.queryClient.prefetchQuery(sessionQueryOpts);
      } catch {
        // Bootstrap must never strand the splash screen on transient network errors
      } finally {
        if (!cancelled) {
          setIsReady(true);
          try {
            await SplashScreen.hideAsync();
          } catch {
            // Safe no-op if splash screen was already hidden
          }
        }
      }
    };

    void bootstrap();

    return () => {
      cancelled = true;
      unsubscribePersist?.();
    };
  }, [composition, loadFonts, persistThrottleTimeMs]);

  return {
    isBootstrapping: !isReady,
    isReady,
  };
}
