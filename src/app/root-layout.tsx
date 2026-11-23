import "../../global.css";
import { PortalHost } from "@rn-primitives/portal";
import { QueryClientProvider } from "@tanstack/react-query";
import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { useEffect, useState } from "react";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { createAppComposition } from "@/app/composition";
import { AppRuntimeContext } from "@/app/runtime";
import { ThemeProvider } from "@/shared/ui/theme-provider";

void SplashScreen.preventAutoHideAsync();

export function RootLayout() {
  const [composition] = useState(() => createAppComposition());

  useEffect(() => {
    void SplashScreen.hideAsync();
    return () => {
      void composition.dispose();
    };
  }, [composition]);

  return (
    <SafeAreaProvider>
      <QueryClientProvider client={composition.queryClient}>
        <AppRuntimeContext.Provider value={composition.runtime}>
          <ThemeProvider storage={composition.kvStore}>
            <Stack>
              <Stack.Screen name="index" options={{ headerShown: false }} />
              <Stack.Screen name="+not-found" />
            </Stack>
            <PortalHost />
          </ThemeProvider>
        </AppRuntimeContext.Provider>
      </QueryClientProvider>
    </SafeAreaProvider>
  );
}
