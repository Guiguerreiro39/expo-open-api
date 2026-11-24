import { useQueryClient } from "@tanstack/react-query";
import { type Href, Redirect, Tabs, usePathname, useRouter } from "expo-router";
import { CheckSquare, FolderOpen, Home, LogOut, Palette } from "lucide-react-native";
import { useCallback, useEffect, useRef, useState } from "react";
import { ActivityIndicator, Pressable, View } from "react-native";
import { signOut, useAuthSession } from "@/features/auth/api/session";
import { sanitizeRedirect } from "@/features/auth/model/schemas";
import { ROUTES } from "@/shared/config/routes";
import { onAuthUnauthorized, useIsAuthBootstrapping } from "@/shared/lib/auth-session-bridge";
import {
  DEFAULT_THEME_PRESET,
  getThemeElevation,
  resolveThemeColor,
} from "@/shared/lib/theme/presets";
import { cn } from "@/shared/lib/utils";
import { useObservability } from "@/shared/observability/observability-context";
import { recordErrorOrDefect } from "@/shared/observability/port";
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
  const signingOutRef = useRef(false);
  const [isSigningOut, setIsSigningOut] = useState(false);
  const [hasSignedOut, setHasSignedOut] = useState(false);
  const { isAuthenticated, isLoading } = useAuthSession({
    enabled: !isSigningOut && !hasSignedOut,
  });
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
    if (signingOutRef.current) return;
    signingOutRef.current = true;
    setIsSigningOut(true);
    try {
      await signOut({
        credentialStore,
        queryClient,
        observability,
      });
    } catch (error) {
      recordErrorOrDefect(observability, error, {
        source: "AppLayoutGuard.handleSignOut",
      });
      queryClient.clear();
    } finally {
      setHasSignedOut(true);
      router.replace(ROUTES.AUTH_LOGIN as Href);
      signingOutRef.current = false;
      setIsSigningOut(false);
    }
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
  const elevation = getThemeElevation(preset, scheme);

  return (
    <Tabs
      screenOptions={{
        sceneStyle: {
          backgroundColor,
        },
        headerStyle: {
          backgroundColor: surfaceBg,
          borderBottomWidth: elevation.borderWidth,
          borderBottomColor: borderColor,
        },
        headerTintColor: foregroundColor,
        headerShadowVisible: false,
        tabBarActiveTintColor: activeTint,
        tabBarInactiveTintColor: inactiveTint,
        tabBarStyle: {
          backgroundColor: surfaceBg,
          borderTopWidth: elevation.borderWidth,
          borderTopColor: borderColor,
        },
        headerRight: () => (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Sign out"
            accessibilityState={{ disabled: isSigningOut, busy: isSigningOut }}
            disabled={isSigningOut}
            hitSlop={4}
            onPress={() => void handleSignOut()}
            className={cn(
              "mr-3 min-h-11 min-w-11 flex-row items-center justify-center gap-1.5 rounded-lg px-2.5",
              isSigningOut && "opacity-50",
            )}
          >
            <Icon as={LogOut} size={16} className="text-on-surface-variant" />
            <Text variant="caption" className="text-on-surface-variant font-semibold">
              {isSigningOut ? "Signing out..." : "Sign out"}
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
