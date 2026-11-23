import { type Href, Redirect, Stack, useLocalSearchParams } from "expo-router";
import { useAuthSession } from "@/features/auth/api/session";
import { sanitizeRedirect } from "@/features/auth/model/schemas";
import { ROUTES } from "@/shared/config/routes";
import { useIsAuthBootstrapping } from "@/shared/lib/auth-session-bridge";

export function AuthLayoutGuard() {
  const isBootstrapping = useIsAuthBootstrapping();
  const { isAuthenticated, isLoading } = useAuthSession();
  const params = useLocalSearchParams<{ redirect?: string | string[] }>();

  if (isBootstrapping || isLoading) {
    return null;
  }

  if (isAuthenticated) {
    const target = sanitizeRedirect(params.redirect) ?? ROUTES.APP_HOME;
    return <Redirect href={target as Href} />;
  }

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="login" options={{ headerShown: false }} />
      <Stack.Screen name="register" options={{ headerShown: false }} />
    </Stack>
  );
}
