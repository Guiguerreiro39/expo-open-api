import type { ReactNode } from "react";
import { Pressable, Text, View } from "react-native";
import {
  type HrefObject,
  mockRouterState,
  type NavigationEvent,
  resetMockExpoRouter,
} from "./mock-expo-router-state";

export { type HrefObject, mockRouterState, type NavigationEvent, resetMockExpoRouter };

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

function Screen(_props: { name?: string; options?: unknown }) {
  return null;
}

export function Stack({ children }: { children?: ReactNode; screenOptions?: unknown }) {
  return <View testID="expo-router-stack">{children}</View>;
}
Stack.Screen = Screen;

export function Tabs({ children }: { children?: ReactNode; screenOptions?: unknown }) {
  return <View testID="expo-router-tabs">{children}</View>;
}
Tabs.Screen = Screen;

export function Slot() {
  return <View testID="expo-router-slot" />;
}
