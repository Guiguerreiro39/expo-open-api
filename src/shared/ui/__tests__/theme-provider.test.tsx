import { fireEvent, screen, waitFor } from "@testing-library/react-native";
import * as SystemUI from "expo-system-ui";
import { Platform, Pressable, View } from "react-native";
import { afterEach, describe, expect, it } from "vitest";
import { getThemeTokenMap, resolveThemeColor } from "@/shared/lib/theme/presets";
import { Text } from "@/shared/ui/text";
import { useTheme } from "@/shared/ui/theme-provider";
import { mockRouterState } from "@/test/mocks/adapters/mock-expo-router";
import { mockNativeWindState } from "@/test/mocks/adapters/mock-nativewind";
import { renderWithProviders } from "@/test/render";

function ThemeControls() {
  const { preset, resolvedColorScheme, setPreset, setColorScheme } = useTheme();
  return (
    <View>
      <Text testID="probe-preset">{preset}</Text>
      <Text testID="probe-scheme">{resolvedColorScheme}</Text>
      <Pressable testID="btn-editorial" onPress={() => setPreset("editorial-slate")}>
        <Text>Editorial</Text>
      </Pressable>
      <Pressable testID="btn-brutalist" onPress={() => setPreset("neo-brutalist")}>
        <Text>Brutalist</Text>
      </Pressable>
      <Pressable testID="btn-dark" onPress={() => setColorScheme("dark")}>
        <Text>Dark</Text>
      </Pressable>
      <Pressable testID="btn-light" onPress={() => setColorScheme("light")}>
        <Text>Light</Text>
      </Pressable>
      <Pressable testID="btn-system" onPress={() => setColorScheme("system")}>
        <Text>System</Text>
      </Pressable>
    </View>
  );
}

function createFakeWebEnvironment(prefersDark: boolean) {
  const classes = new Set<string>();
  const cssProperties = new Map<string, string>();
  const listeners = new Set<(event: { matches: boolean }) => void>();
  let currentMatches = prefersDark;

  const styleObj = {
    backgroundColor: "",
    colorScheme: "",
    setProperty(name: string, value: string) {
      cssProperties.set(name, value);
    },
    getPropertyValue(name: string) {
      return cssProperties.get(name) ?? "";
    },
  };

  const documentElement = {
    classList: {
      add(cls: string) {
        classes.add(cls);
      },
      remove(cls: string) {
        classes.delete(cls);
      },
      toggle(cls: string, force?: boolean) {
        if (force === undefined) {
          if (classes.has(cls)) {
            classes.delete(cls);
            return false;
          }
          classes.add(cls);
          return true;
        }
        if (force) {
          classes.add(cls);
          return true;
        }
        classes.delete(cls);
        return false;
      },
      contains(cls: string) {
        return classes.has(cls);
      },
    },
    style: styleObj,
  };

  const fakeDocument = { documentElement };
  const fakeWindow = {
    matchMedia(_query: string) {
      return {
        get matches() {
          return currentMatches;
        },
        addEventListener(_type: string, listener: (event: { matches: boolean }) => void) {
          listeners.add(listener);
        },
        removeEventListener(_type: string, listener: (event: { matches: boolean }) => void) {
          listeners.delete(listener);
        },
      };
    },
  };

  return {
    fakeDocument,
    fakeWindow,
    classes,
    cssProperties,
    styleObj,
    setPrefersDark(next: boolean) {
      currentMatches = next;
      for (const listener of listeners) {
        listener({ matches: next });
      }
    },
  };
}

describe("ThemeProvider tri-layer theme mirroring", () => {
  const originalPlatformOs = Platform.OS;
  const originalDocumentDescriptor = Object.getOwnPropertyDescriptor(globalThis, "document");
  const originalWindowDescriptor = Object.getOwnPropertyDescriptor(globalThis, "window");

  afterEach(() => {
    Object.defineProperty(Platform, "OS", { value: originalPlatformOs, configurable: true });
    if (originalDocumentDescriptor) {
      Object.defineProperty(globalThis, "document", originalDocumentDescriptor);
    } else {
      Reflect.deleteProperty(globalThis, "document");
    }
    if (originalWindowDescriptor) {
      Object.defineProperty(globalThis, "window", originalWindowDescriptor);
    } else {
      Reflect.deleteProperty(globalThis, "window");
    }
    mockNativeWindState.lastSetColorScheme = null;
  });

  it("mirrors active preset and color scheme into React Navigation ThemeProvider and SystemUI", async () => {
    renderWithProviders(<ThemeControls />, {
      initialPreset: "warm-tactile",
      initialColorScheme: "light",
    });

    expect(mockRouterState.navigationTheme).toMatchObject({
      dark: false,
      colors: {
        primary: resolveThemeColor("warm-tactile", "light", "primary"),
        background: resolveThemeColor("warm-tactile", "light", "background"),
        card: resolveThemeColor("warm-tactile", "light", "surface-container-low"),
        text: resolveThemeColor("warm-tactile", "light", "foreground"),
        border: resolveThemeColor("warm-tactile", "light", "outline-variant"),
        notification: resolveThemeColor("warm-tactile", "light", "destructive"),
      },
    });
    expect(mockRouterState.navigationTheme?.fonts).toBeDefined();

    await waitFor(async () => {
      expect(await SystemUI.getBackgroundColorAsync()).toBe(
        resolveThemeColor("warm-tactile", "light", "background"),
      );
    });

    fireEvent.press(screen.getByTestId("btn-editorial"));
    fireEvent.press(screen.getByTestId("btn-dark"));

    expect(mockRouterState.navigationTheme).toMatchObject({
      dark: true,
      colors: {
        primary: resolveThemeColor("editorial-slate", "dark", "primary"),
        background: resolveThemeColor("editorial-slate", "dark", "background"),
        card: resolveThemeColor("editorial-slate", "dark", "surface-container-low"),
        text: resolveThemeColor("editorial-slate", "dark", "foreground"),
        border: resolveThemeColor("editorial-slate", "dark", "outline-variant"),
        notification: resolveThemeColor("editorial-slate", "dark", "destructive"),
      },
    });

    await waitFor(async () => {
      expect(await SystemUI.getBackgroundColorAsync()).toBe(
        resolveThemeColor("editorial-slate", "dark", "background"),
      );
    });
  });

  it("mirrors CSS variables, .dark class under system mode, and root background onto documentElement on Web", async () => {
    const webEnv = createFakeWebEnvironment(true);
    Object.defineProperty(Platform, "OS", { value: "web", configurable: true });
    Object.defineProperty(globalThis, "document", {
      value: webEnv.fakeDocument,
      configurable: true,
      writable: true,
    });
    Object.defineProperty(globalThis, "window", {
      value: webEnv.fakeWindow,
      configurable: true,
      writable: true,
    });

    renderWithProviders(<ThemeControls />, {
      initialPreset: "warm-tactile",
      initialColorScheme: "system",
    });

    await waitFor(() => {
      expect(screen.getByTestId("probe-scheme")).toHaveTextContent("dark");
      expect(webEnv.classes.has("dark")).toBe(true);
      expect(mockNativeWindState.lastSetColorScheme).toBe("dark");
    });

    const warmDarkTokens = getThemeTokenMap("warm-tactile", "dark");
    expect(webEnv.cssProperties.get("--background")).toBe(warmDarkTokens["--background"]);
    expect(webEnv.cssProperties.get("--primary")).toBe(warmDarkTokens["--primary"]);
    expect(webEnv.cssProperties.get("--scrim")).toBe("0 0% 0%");
    expect(webEnv.styleObj.backgroundColor).toBe(
      resolveThemeColor("warm-tactile", "dark", "background"),
    );

    // Switching presets on Web updates root document variables for Radix portals immediately
    fireEvent.press(screen.getByTestId("btn-brutalist"));
    await waitFor(() => {
      const brutalistDark = getThemeTokenMap("neo-brutalist", "dark");
      expect(webEnv.cssProperties.get("--primary")).toBe(brutalistDark["--primary"]);
      expect(webEnv.styleObj.backgroundColor).toBe(
        resolveThemeColor("neo-brutalist", "dark", "background"),
      );
    });

    // Switching to explicit light removes .dark class and updates CSS variables
    fireEvent.press(screen.getByTestId("btn-light"));
    await waitFor(() => {
      expect(webEnv.classes.has("dark")).toBe(false);
      expect(mockNativeWindState.lastSetColorScheme).toBe("light");
      expect(webEnv.cssProperties.get("--background")).toBe(
        getThemeTokenMap("neo-brutalist", "light")["--background"],
      );
    });
  });
});
