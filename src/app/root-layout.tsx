import "../../global.css";
import { PortalHost } from "@rn-primitives/portal";
import { QueryClientProvider } from "@tanstack/react-query";
import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { useEffect, useState } from "react";
import { useAppBootstrap } from "@/app/bootstrap";
import { createAppComposition } from "@/app/composition";
import { AppRuntimeContext } from "@/app/runtime";
import { AuthBootstrapContext } from "@/shared/lib/auth-session-bridge";
import { loadAppFonts } from "@/shared/lib/theme/fonts";
import { resolveThemeColor } from "@/shared/lib/theme/presets";
import { ObservabilityContext } from "@/shared/observability/observability-context";
import { createSecureStoreCredentialStore } from "@/shared/storage/credential-store";
import { CredentialStoreContext } from "@/shared/storage/credential-store-context";
import { createMmkvKvStore } from "@/shared/storage/kv-store";
import { ThemeProvider, useTheme } from "@/shared/ui/theme-provider";
import { TOAST_PORTAL_HOST, ToastProvider } from "@/shared/ui/toast";

void SplashScreen.preventAutoHideAsync();

function RootNavigator() {
  const { preset, resolvedColorScheme } = useTheme();
  const backgroundColor = resolveThemeColor(preset, resolvedColorScheme, "background");
  const surfaceBg = resolveThemeColor(preset, resolvedColorScheme, "surface-container-low");
  const foregroundColor = resolveThemeColor(preset, resolvedColorScheme, "foreground");

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: {
          backgroundColor,
        },
      }}
    >
      <Stack.Screen name="(app)" options={{ headerShown: false }} />
      <Stack.Screen name="(auth)" options={{ headerShown: false }} />
      <Stack.Screen
        name="+not-found"
        options={{
          headerShown: true,
          title: "Not Found",
          headerStyle: {
            backgroundColor: surfaceBg,
          },
          headerTintColor: foregroundColor,
          headerShadowVisible: false,
          contentStyle: {
            backgroundColor,
          },
        }}
      />
    </Stack>
  );
}

export function RootLayout() {
  const [composition] = useState(() =>
    createAppComposition({
      credentialStore: createSecureStoreCredentialStore(),
      kvStore: createMmkvKvStore(),
    }),
  );
  const { isBootstrapping } = useAppBootstrap(composition, {
    loadFonts: loadAppFonts,
  });

  useEffect(() => {
    return () => {
      void composition.dispose();
    };
  }, [composition]);

  return (
    <QueryClientProvider client={composition.queryClient}>
      <AppRuntimeContext.Provider value={composition.runtime}>
        <ObservabilityContext.Provider value={composition.observability}>
          <CredentialStoreContext.Provider value={composition.credentialStore}>
            <AuthBootstrapContext.Provider value={isBootstrapping}>
              <ThemeProvider storage={composition.kvStore}>
                <ToastProvider>
                  <RootNavigator />
                  <PortalHost />
                  <PortalHost name={TOAST_PORTAL_HOST} />
                </ToastProvider>
              </ThemeProvider>
            </AuthBootstrapContext.Provider>
          </CredentialStoreContext.Provider>
        </ObservabilityContext.Provider>
      </AppRuntimeContext.Provider>
    </QueryClientProvider>
  );
}
