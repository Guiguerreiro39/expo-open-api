import { type Href, Redirect, Stack, useLocalSearchParams } from "expo-router";
import { ActivityIndicator, View } from "react-native";
import { useAuthSession } from "@/features/auth/api/session";
import { sanitizeRedirect } from "@/features/auth/model/schemas";
import { ROUTES } from "@/shared/config/routes";
import { useIsAuthBootstrapping } from "@/shared/lib/auth-session-bridge";
import { DEFAULT_THEME_PRESET, resolveThemeColor } from "@/shared/lib/theme/presets";
import { useOptionalTheme } from "@/shared/ui/theme-provider";

export function AuthLayoutGuard() {
  const isBootstrapping = useIsAuthBootstrapping();
  const { isAuthenticated, isLoading } = useAuthSession();
  const params = useLocalSearchParams<{ redirect?: string | string[] }>();
  const theme = useOptionalTheme();

  const preset = theme?.preset ?? DEFAULT_THEME_PRESET;
  const scheme = theme?.resolvedColorScheme ?? "light";
  const backgroundColor = resolveThemeColor(preset, scheme, "background");
  const primaryColor = resolveThemeColor(preset, scheme, "primary");

  if (isBootstrapping || isLoading) {
    return (
      <View
        testID="layout-guard-loading"
        className="bg-background flex-1 items-center justify-center"
      >
        <ActivityIndicator size="large" color={primaryColor} accessibilityLabel="Loading" />
      </View>
    );
  }

  if (isAuthenticated) {
    const target = sanitizeRedirect(params.redirect) ?? ROUTES.APP_HOME;
    return <Redirect href={target as Href} />;
  }

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: {
          backgroundColor,
        },
      }}
    >
      <Stack.Screen name="login" options={{ headerShown: false }} />
      <Stack.Screen name="register" options={{ headerShown: false }} />
    </Stack>
  );
}
