import { useQueryClient } from "@tanstack/react-query";
import { type Href, Redirect, Tabs, usePathname, useRouter } from "expo-router";
import { CheckSquare, FolderOpen, Home, LogOut, Palette } from "lucide-react-native";
import { useCallback, useEffect } from "react";
import { ActivityIndicator, Pressable, View } from "react-native";
import { signOut, useAuthSession } from "@/features/auth/api/session";
import { sanitizeRedirect } from "@/features/auth/model/schemas";
import { ROUTES } from "@/shared/config/routes";
import { onAuthUnauthorized, useIsAuthBootstrapping } from "@/shared/lib/auth-session-bridge";
import { DEFAULT_THEME_PRESET, resolveThemeColor } from "@/shared/lib/theme/presets";
import { useObservability } from "@/shared/observability/observability-context";
import { useCredentialStore } from "@/shared/storage/credential-store-context";
import { Icon } from "@/shared/ui/icon";
import { Text } from "@/shared/ui/text";
import { useOptionalTheme } from "@/shared/ui/theme-provider";

function buildLoginRedirectHref(pathname: string): Href {
  const safeRedirect = sanitizeRedirect(pathname);
  if (safeRedirect && safeRedirect !== ROUTES.ROOT) {
    return {
      pathname: ROUTES.AUTH_LOGIN,
      params: { redirect: safeRedirect },
    } as Href;
  }
  return ROUTES.AUTH_LOGIN as Href;
}

export function AppLayoutGuard() {
  const isBootstrapping = useIsAuthBootstrapping();
  const { isAuthenticated, isLoading } = useAuthSession();
  const pathname = usePathname();
  const router = useRouter();
  const queryClient = useQueryClient();
  const credentialStore = useCredentialStore();
  const observability = useObservability();
  const theme = useOptionalTheme();

  const preset = theme?.preset ?? DEFAULT_THEME_PRESET;
  const scheme = theme?.resolvedColorScheme ?? "light";

  useEffect(() => {
    return onAuthUnauthorized(() => {
      router.replace(buildLoginRedirectHref(pathname));
    });
  }, [pathname, router]);

  const handleSignOut = useCallback(async () => {
    await signOut({
      credentialStore,
      queryClient,
      observability,
    });
    router.replace(ROUTES.AUTH_LOGIN as Href);
  }, [credentialStore, observability, queryClient, router]);

  const activeTint = resolveThemeColor(preset, scheme, "primary");
  const backgroundColor = resolveThemeColor(preset, scheme, "background");

  if (isBootstrapping || isLoading) {
    return (
      <View
        testID="layout-guard-loading"
        className="bg-background flex-1 items-center justify-center"
      >
        <ActivityIndicator size="large" color={activeTint} accessibilityLabel="Loading" />
      </View>
    );
  }

  if (!isAuthenticated) {
    return <Redirect href={buildLoginRedirectHref(pathname)} />;
  }

  const inactiveTint = resolveThemeColor(preset, scheme, "on-surface-variant");
  const surfaceBg = resolveThemeColor(preset, scheme, "surface-container-low");
  const borderColor = resolveThemeColor(preset, scheme, "outline-variant");
  const foregroundColor = resolveThemeColor(preset, scheme, "foreground");

  return (
    <Tabs
      screenOptions={{
        sceneStyle: {
          backgroundColor,
        },
        headerStyle: {
          backgroundColor: surfaceBg,
        },
        headerTintColor: foregroundColor,
        headerShadowVisible: false,
        tabBarActiveTintColor: activeTint,
        tabBarInactiveTintColor: inactiveTint,
        tabBarStyle: {
          backgroundColor: surfaceBg,
          borderTopColor: borderColor,
        },
        headerRight: () => (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Sign out"
            onPress={() => void handleSignOut()}
            className="mr-4 flex-row items-center gap-1.5 px-2 py-1"
          >
            <Icon as={LogOut} size={16} className="text-on-surface-variant" />
            <Text variant="caption" className="text-on-surface-variant font-semibold">
              Sign out
            </Text>
          </Pressable>
        ),
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Home",
          tabBarIcon: ({ color, size }) => <Home color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="tasks"
        options={{
          title: "Tasks",
          tabBarIcon: ({ color, size }) => <CheckSquare color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="files"
        options={{
          title: "Files",
          tabBarIcon: ({ color, size }) => <FolderOpen color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="showcase"
        options={{
          title: "Showcase",
          tabBarIcon: ({ color, size }) => <Palette color={color} size={size} />,
        }}
      />
    </Tabs>
  );
}
