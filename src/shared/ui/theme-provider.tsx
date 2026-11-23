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

  const resolvedColorScheme: ResolvedColorScheme =
    colorScheme === "system" ? (systemColorScheme === "dark" ? "dark" : "light") : colorScheme;

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
      setNativeWindColorScheme(colorScheme);
    } catch {
      // Guard against non-interactive/SSR environments where NativeWind scheme sync is unavailable.
    }
  }, [colorScheme, setNativeWindColorScheme]);

  useEffect(() => {
    const backgroundColor = resolveThemeColor(preset, resolvedColorScheme, "background");
    if (Platform.OS !== "web" && typeof SystemUI.setBackgroundColorAsync === "function") {
      void SystemUI.setBackgroundColorAsync(backgroundColor).catch(() => {});
    }
  }, [preset, resolvedColorScheme]);

  const themeVars = useMemo(
    () => getThemeVars(preset, resolvedColorScheme),
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
      <View
        style={[themeVars, { flex: 1 }]}
        className={cn("bg-background", resolvedColorScheme === "dark" && "dark")}
      >
        <StatusBar style={resolvedColorScheme === "dark" ? "light" : "dark"} />
        {children}
      </View>
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
