import { DarkTheme, DefaultTheme, ThemeProvider as NavigationThemeProvider } from "expo-router";
import { StatusBar } from "expo-status-bar";
import * as SystemUI from "expo-system-ui";
import { useColorScheme as useNativeWindColorScheme } from "nativewind";
import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { Platform, useColorScheme as useSystemColorScheme, View } from "react-native";
import {
  DEFAULT_THEME_PRESET,
  getThemeTokenMap,
  getThemeVars,
  isThemeMode,
  isThemePreset,
  type ResolvedColorScheme,
  resolveThemeColor,
  THEME_PRESETS,
  type ThemeMode,
  type ThemePreset,
  type ThemePresetDefinition,
} from "@/shared/lib/theme/presets";
import { cn } from "@/shared/lib/utils";

export const THEME_PRESET_STORAGE_KEY = "theme.preset";
export const THEME_MODE_STORAGE_KEY = "theme.colorScheme";

export interface ThemeStorage {
  getString(key: string): string | undefined;
  set(key: string, value: string): void;
}

export interface ThemeContextValue {
  preset: ThemePreset;
  presetDefinition: ThemePresetDefinition;
  setPreset: (preset: ThemePreset) => void;
  colorScheme: ThemeMode;
  resolvedColorScheme: ResolvedColorScheme;
  setColorScheme: (mode: ThemeMode) => void;
  toggleColorScheme: () => void;
}

export interface ThemeProviderProps {
  children: ReactNode;
  storage?: ThemeStorage;
  initialPreset?: ThemePreset;
  initialColorScheme?: ThemeMode;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

function readInitialPreset(storage: ThemeStorage | undefined, fallback?: ThemePreset): ThemePreset {
  if (fallback) {
    return fallback;
  }
  const stored = storage?.getString(THEME_PRESET_STORAGE_KEY);
  return isThemePreset(stored) ? stored : DEFAULT_THEME_PRESET;
}

function readInitialColorScheme(
  storage: ThemeStorage | undefined,
  fallback?: ThemeMode,
): ThemeMode {
  if (fallback) {
    return fallback;
  }
  const stored = storage?.getString(THEME_MODE_STORAGE_KEY);
  return isThemeMode(stored) ? stored : "system";
}

function readWebSystemPrefersDark(): boolean | null {
  if (
    Platform.OS !== "web" ||
    typeof window === "undefined" ||
    typeof window.matchMedia !== "function"
  ) {
    return null;
  }
  const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
  if (!mediaQuery || typeof mediaQuery.matches !== "boolean") {
    return null;
  }
  return mediaQuery.matches;
}

function syncWebDocumentTheme(preset: ThemePreset, resolvedColorScheme: ResolvedColorScheme): void {
  if (Platform.OS !== "web" || typeof document === "undefined") {
    return;
  }
  const root = document.documentElement;
  if (!root) {
    return;
  }

  root.classList.toggle("dark", resolvedColorScheme === "dark");

  const tokenMap = getThemeTokenMap(preset, resolvedColorScheme);
  for (const [cssVar, value] of Object.entries(tokenMap)) {
    root.style.setProperty(cssVar, value);
  }

  root.style.backgroundColor = resolveThemeColor(preset, resolvedColorScheme, "background");
  root.style.colorScheme = resolvedColorScheme;
}

export function buildNavigationTheme(preset: ThemePreset, scheme: ResolvedColorScheme) {
  const baseTheme = scheme === "dark" ? DarkTheme : DefaultTheme;
  return {
    ...baseTheme,
    dark: scheme === "dark",
    colors: {
      ...baseTheme.colors,
      primary: resolveThemeColor(preset, scheme, "primary"),
      background: resolveThemeColor(preset, scheme, "background"),
      card: resolveThemeColor(preset, scheme, "surface-container-low"),
      text: resolveThemeColor(preset, scheme, "foreground"),
      border: resolveThemeColor(preset, scheme, "outline-variant"),
      notification: resolveThemeColor(preset, scheme, "destructive"),
    },
  };
}

export function ThemeProvider({
  children,
  storage,
  initialPreset,
  initialColorScheme,
}: ThemeProviderProps) {
  const systemColorScheme = useSystemColorScheme();
  const { setColorScheme: setNativeWindColorScheme } = useNativeWindColorScheme();

  const [preset, setPresetState] = useState<ThemePreset>(() =>
    readInitialPreset(storage, initialPreset),
  );
  const [colorScheme, setColorSchemeState] = useState<ThemeMode>(() =>
    readInitialColorScheme(storage, initialColorScheme),
  );
  const [webPrefersDark, setWebPrefersDark] = useState<boolean | null>(() =>
    readWebSystemPrefersDark(),
  );

  useEffect(() => {
    if (
      Platform.OS !== "web" ||
      typeof window === "undefined" ||
      typeof window.matchMedia !== "function"
    ) {
      return;
    }

    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
    if (!mediaQuery) {
      return undefined;
    }
    if (typeof mediaQuery.matches === "boolean") {
      setWebPrefersDark(mediaQuery.matches);
    }

    const handleChange = (event: MediaQueryListEvent) => {
      setWebPrefersDark(event.matches);
    };

    if (typeof mediaQuery.addEventListener === "function") {
      mediaQuery.addEventListener("change", handleChange);
      return () => {
        mediaQuery.removeEventListener?.("change", handleChange);
      };
    }

    if (typeof mediaQuery.addListener === "function") {
      mediaQuery.addListener(handleChange);
      return () => {
        mediaQuery.removeListener?.(handleChange);
      };
    }
    return undefined;
  }, []);

  const resolvedSystemScheme: ResolvedColorScheme =
    Platform.OS === "web" && webPrefersDark !== null
      ? webPrefersDark
        ? "dark"
        : "light"
      : systemColorScheme === "dark"
        ? "dark"
        : "light";

  const resolvedColorScheme: ResolvedColorScheme =
    colorScheme === "system" ? resolvedSystemScheme : colorScheme;

  const setPreset = useCallback(
    (nextPreset: ThemePreset) => {
      setPresetState(nextPreset);
      storage?.set(THEME_PRESET_STORAGE_KEY, nextPreset);
    },
    [storage],
  );

  const setColorScheme = useCallback(
    (nextMode: ThemeMode) => {
      setColorSchemeState(nextMode);
      storage?.set(THEME_MODE_STORAGE_KEY, nextMode);
    },
    [storage],
  );

  const toggleColorScheme = useCallback(() => {
    const nextMode: ThemeMode = resolvedColorScheme === "dark" ? "light" : "dark";
    setColorSchemeState(nextMode);
    storage?.set(THEME_MODE_STORAGE_KEY, nextMode);
  }, [resolvedColorScheme, storage]);

  useEffect(() => {
    try {
      // On Web, react-native-css-interop strips `.dark` when passed `"system"`;
      // always pass the resolved scheme on Web so OS dark mode is preserved.
      setNativeWindColorScheme(Platform.OS === "web" ? resolvedColorScheme : colorScheme);
    } catch {
      // Guard against non-interactive/SSR environments where NativeWind scheme sync is unavailable.
    }
  }, [colorScheme, resolvedColorScheme, setNativeWindColorScheme]);

  useEffect(() => {
    if (Platform.OS === "web") {
      syncWebDocumentTheme(preset, resolvedColorScheme);
      return;
    }
    const backgroundColor = resolveThemeColor(preset, resolvedColorScheme, "background");
    if (typeof SystemUI.setBackgroundColorAsync === "function") {
      void SystemUI.setBackgroundColorAsync(backgroundColor).catch(() => {});
    }
  }, [preset, resolvedColorScheme]);

  const themeVars = useMemo(
    () => getThemeVars(preset, resolvedColorScheme),
    [preset, resolvedColorScheme],
  );

  const navigationTheme = useMemo(
    () => buildNavigationTheme(preset, resolvedColorScheme),
    [preset, resolvedColorScheme],
  );

  const value = useMemo<ThemeContextValue>(
    () => ({
      preset,
      presetDefinition: THEME_PRESETS[preset],
      setPreset,
      colorScheme,
      resolvedColorScheme,
      setColorScheme,
      toggleColorScheme,
    }),
    [preset, setPreset, colorScheme, resolvedColorScheme, setColorScheme, toggleColorScheme],
  );

  return (
    <ThemeContext.Provider value={value}>
      <NavigationThemeProvider value={navigationTheme}>
        <View
          style={[themeVars, { flex: 1 }]}
          className={cn("bg-background", resolvedColorScheme === "dark" && "dark")}
        >
          <StatusBar style={resolvedColorScheme === "dark" ? "light" : "dark"} />
          {children}
        </View>
      </NavigationThemeProvider>
    </ThemeContext.Provider>
  );
}

export function useTheme(): ThemeContextValue {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error("useTheme must be used within a ThemeProvider");
  }
  return context;
}

export function useOptionalTheme(): ThemeContextValue | null {
  return useContext(ThemeContext);
}
