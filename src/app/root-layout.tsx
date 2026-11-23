import "../../global.css";
import { PortalHost } from "@rn-primitives/portal";
import { QueryClientProvider } from "@tanstack/react-query";
import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { useEffect, useState } from "react";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { useAppBootstrap } from "@/app/bootstrap";
import { createAppComposition } from "@/app/composition";
import { AppRuntimeContext } from "@/app/runtime";
import { AuthBootstrapContext } from "@/shared/lib/auth-session-bridge";
import { ObservabilityContext } from "@/shared/observability/observability-context";
import { createSecureStoreCredentialStore } from "@/shared/storage/credential-store";
import { CredentialStoreContext } from "@/shared/storage/credential-store-context";
import { createMmkvKvStore } from "@/shared/storage/kv-store";
import { ThemeProvider } from "@/shared/ui/theme-provider";
import { ToastProvider } from "@/shared/ui/toast";

void SplashScreen.preventAutoHideAsync();

export function RootLayout() {
  const [composition] = useState(() =>
    createAppComposition({
      credentialStore: createSecureStoreCredentialStore(),
      kvStore: createMmkvKvStore(),
    }),
  );
  const { isBootstrapping } = useAppBootstrap(composition);

  useEffect(() => {
    return () => {
      void composition.dispose();
    };
  }, [composition]);

  return (
    <SafeAreaProvider>
      <QueryClientProvider client={composition.queryClient}>
        <AppRuntimeContext.Provider value={composition.runtime}>
          <ObservabilityContext.Provider value={composition.observability}>
            <CredentialStoreContext.Provider value={composition.credentialStore}>
              <AuthBootstrapContext.Provider value={isBootstrapping}>
                <ThemeProvider storage={composition.kvStore}>
                  <ToastProvider>
                    <Stack screenOptions={{ headerShown: false }}>
                      <Stack.Screen name="(app)" options={{ headerShown: false }} />
                      <Stack.Screen name="(auth)" options={{ headerShown: false }} />
                      <Stack.Screen
                        name="+not-found"
                        options={{ headerShown: true, title: "Not Found" }}
                      />
                    </Stack>
                  </ToastProvider>
                  <PortalHost />
                </ThemeProvider>
              </AuthBootstrapContext.Provider>
            </CredentialStoreContext.Provider>
          </ObservabilityContext.Provider>
        </AppRuntimeContext.Provider>
      </QueryClientProvider>
    </SafeAreaProvider>
  );
}
