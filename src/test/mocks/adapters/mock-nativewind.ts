import { useCallback, useState } from "react";

type ColorSchemeOption = "light" | "dark" | "system";

let currentScheme: "light" | "dark" = "light";

export function vars<T extends Record<string, string | number>>(variables: T): T {
  return variables;
}

export function cssInterop<T>(component: T, _mapping?: unknown): T {
  return component;
}

export function remapProps<T>(component: T, _mapping?: unknown): T {
  return component;
}

export const colorScheme = {
  get: () => currentScheme,
  set: (scheme: ColorSchemeOption) => {
    currentScheme = scheme === "dark" ? "dark" : "light";
  },
  toggle: () => {
    currentScheme = currentScheme === "dark" ? "light" : "dark";
  },
};

export function useColorScheme() {
  const [scheme, setSchemeState] = useState<"light" | "dark">(currentScheme);

  const setColorScheme = useCallback((next: ColorSchemeOption) => {
    const resolved = next === "dark" ? "dark" : "light";
    currentScheme = resolved;
    setSchemeState(resolved);
  }, []);

  const toggleColorScheme = useCallback(() => {
    const resolved = currentScheme === "dark" ? "light" : "dark";
    currentScheme = resolved;
    setSchemeState(resolved);
  }, []);

  return {
    colorScheme: scheme,
    setColorScheme,
    toggleColorScheme,
  };
}
