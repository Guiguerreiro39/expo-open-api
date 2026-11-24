import type { ReactNode } from "react";
import { Pressable, Text, View } from "react-native";
import {
  type HrefObject,
  type MockNavigationTheme,
  mockRouterState,
  type NavigationEvent,
  resetMockExpoRouter,
} from "./mock-expo-router-state";

export {
  type HrefObject,
  type MockNavigationTheme,
  mockRouterState,
  type NavigationEvent,
  resetMockExpoRouter,
};

const DEFAULT_FONTS = {
  regular: { fontFamily: "System", fontWeight: "400" as const },
  medium: { fontFamily: "System", fontWeight: "500" as const },
  bold: { fontFamily: "System", fontWeight: "600" as const },
  heavy: { fontFamily: "System", fontWeight: "700" as const },
};

export const DefaultTheme: MockNavigationTheme = {
  dark: false,
  colors: {
    primary: "rgb(0, 122, 255)",
    background: "rgb(242, 242, 242)",
    card: "rgb(255, 255, 255)",
    text: "rgb(28, 28, 30)",
    border: "rgb(216, 216, 216)",
    notification: "rgb(255, 59, 48)",
  },
  fonts: DEFAULT_FONTS,
};

export const DarkTheme: MockNavigationTheme = {
  dark: true,
  colors: {
    primary: "rgb(10, 132, 255)",
    background: "rgb(1, 1, 1)",
    card: "rgb(18, 18, 18)",
    text: "rgb(229, 229, 231)",
    border: "rgb(39, 39, 41)",
    notification: "rgb(255, 69, 58)",
  },
  fonts: DEFAULT_FONTS,
};

export function ThemeProvider({
  value,
  children,
}: {
  value: MockNavigationTheme;
  children?: ReactNode;
}) {
  mockRouterState.setNavigationTheme(value);
  return <>{children}</>;
}

export const router = {
  push(href: HrefObject) {
    mockRouterState.history.push({ type: "push", href });
  },
  replace(href: HrefObject) {
    mockRouterState.history.push({ type: "replace", href });
  },
  back() {
    mockRouterState.history.push({ type: "back" });
  },
  canGoBack() {
    return mockRouterState.history.length > 0;
  },
};

export function useRouter() {
  return router;
}

export function usePathname(): string {
  return mockRouterState.pathname;
}

export function useSegments(): string[] {
  return mockRouterState.segments;
}

export function useLocalSearchParams<
  T extends Record<string, string | string[] | undefined> = Record<
    string,
    string | string[] | undefined
  >,
>(): T {
  return mockRouterState.params as T;
}

export function Redirect({ href }: { href: HrefObject }) {
  mockRouterState.history.push({ type: "redirect", href });
  const serialized = typeof href === "string" ? href : JSON.stringify(href);
  return (
    <View testID="expo-router-redirect">
      <Text testID="expo-router-redirect-href">{serialized}</Text>
    </View>
  );
}

export function Link({
  href,
  children,
  asChild,
}: {
  href: HrefObject;
  children?: ReactNode;
  asChild?: boolean;
}) {
  if (asChild) {
    return <View testID="expo-router-link">{children}</View>;
  }
  return (
    <Pressable testID="expo-router-link" onPress={() => router.push(href)}>
      {typeof children === "string" ? <Text>{children}</Text> : children}
    </Pressable>
  );
}

function Screen(props: { name?: string; options?: unknown }) {
  if (props.name) {
    mockRouterState.setScreenOptions(props.name, props.options);
  }
  return null;
}

export function Stack({
  children,
  screenOptions,
}: {
  children?: ReactNode;
  screenOptions?: unknown;
}) {
  mockRouterState.setStackScreenOptions(screenOptions);
  return <View testID="expo-router-stack">{children}</View>;
}
Stack.Screen = Screen;

export function Tabs({
  children,
  screenOptions,
}: {
  children?: ReactNode;
  screenOptions?: unknown;
}) {
  mockRouterState.setTabsScreenOptions(screenOptions);
  const headerRight =
    screenOptions &&
    typeof screenOptions === "object" &&
    "headerRight" in screenOptions &&
    typeof (screenOptions as { headerRight?: unknown }).headerRight === "function"
      ? (
          screenOptions as { headerRight: (props: { tintColor?: string }) => ReactNode }
        ).headerRight({})
      : null;
  return (
    <View testID="expo-router-tabs">
      {headerRight}
      {children}
    </View>
  );
}
Tabs.Screen = Screen;

export function Slot() {
  return <View testID="expo-router-slot" />;
}
