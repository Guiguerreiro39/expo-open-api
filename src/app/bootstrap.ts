import { focusManager } from "@tanstack/react-query";
import * as SplashScreen from "expo-splash-screen";
import { useEffect, useState } from "react";
import { AppState, type AppStateStatus, Platform } from "react-native";
import type { AppComposition } from "@/app/composition";
import {
  createAuthSessionQueryOptions,
  hydrateBearerToken,
  registerAuthSessionBridge,
} from "@/features/auth/api/session";

export interface AppBootstrapState {
  readonly isBootstrapping: boolean;
  readonly isReady: boolean;
}

export interface UseAppBootstrapOptions {
  readonly loadFonts?: () => Promise<void>;
}

/**
 * Coordinates mobile application startup:
 * 1. Connects TanStack Query's `focusManager` to React Native's `AppState`
 * 2. Registers auth session query options in `auth-session-bridge`
 * 3. Hydrates the persisted Bearer token from `CredentialStorePort` into RAM
 * 4. Runs optional font loading and initial session verification
 * 5. Dismisses the native SplashScreen only once bootstrap completes
 */
export function useAppBootstrap(
  composition: AppComposition,
  options: UseAppBootstrapOptions = {},
): AppBootstrapState {
  const [isReady, setIsReady] = useState(false);
  const { loadFonts } = options;

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
    let cancelled = false;

    const bootstrap = async () => {
      const sessionDeps = {
        credentialStore: composition.credentialStore,
        observability: composition.observability,
      };
      registerAuthSessionBridge(sessionDeps);

      try {
        await Promise.all([
          hydrateBearerToken(composition.credentialStore),
          loadFonts ? loadFonts().catch(() => undefined) : Promise.resolve(),
        ]);

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
    };
  }, [composition, loadFonts]);

  return {
    isBootstrapping: !isReady,
    isReady,
  };
}
