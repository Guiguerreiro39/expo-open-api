import fs from "node:fs";
import path from "node:path";
import { render, waitFor } from "@testing-library/react-native";
import { describe, expect, it } from "vitest";
import { RootLayout } from "@/app/root-layout";
import { resolveThemeColor } from "@/shared/lib/theme/presets";
import { THEME_MODE_STORAGE_KEY, THEME_PRESET_STORAGE_KEY } from "@/shared/ui/theme-provider";
import { mockExpoFont } from "@/test/mocks/adapters/mock-expo-font";
import { mockRouterState } from "@/test/mocks/adapters/mock-expo-router";
import { mockMmkv } from "@/test/mocks/adapters/mock-react-native-mmkv";

const ROOT = path.resolve(__dirname, "../../..");

describe("RootLayout startup chrome, fonts, and themed navigation", () => {
  it("hydrates bundled fonts and configures themed Stack and +not-found header chrome in dark mode", async () => {
    // Seed persisted dark editorial-slate preference in MMKV prior to mount
    const store = mockMmkv.getStore();
    store.set(THEME_PRESET_STORAGE_KEY, "editorial-slate");
    store.set(THEME_MODE_STORAGE_KEY, "dark");

    render(<RootLayout />);

    await waitFor(() => {
      expect(mockExpoFont.loadedFontMaps.length).toBeGreaterThanOrEqual(1);
    });

    expect(Object.keys(mockExpoFont.loadedFontMaps[0] ?? {}).sort()).toEqual([
      "JetBrainsMono-Bold",
      "JetBrainsMono-Regular",
      "Quicksand-Bold",
      "Quicksand-Medium",
      "Quicksand-Regular",
      "Quicksand-SemiBold",
    ]);

    expect(mockRouterState.stackScreenOptions).toMatchObject({
      headerShown: false,
      contentStyle: {
        backgroundColor: resolveThemeColor("editorial-slate", "dark", "background"),
      },
    });

    expect(mockRouterState.screenOptionsByName["+not-found"]).toMatchObject({
      headerShown: true,
      title: "Not Found",
      headerStyle: {
        backgroundColor: resolveThemeColor("editorial-slate", "dark", "surface-container-low"),
      },
      headerTintColor: resolveThemeColor("editorial-slate", "dark", "foreground"),
      headerShadowVisible: false,
      contentStyle: {
        backgroundColor: resolveThemeColor("editorial-slate", "dark", "background"),
      },
    });
  });

  it("removes redundant nested SafeAreaProvider from RootLayout", () => {
    const source = fs.readFileSync(path.join(ROOT, "src/app/root-layout.tsx"), "utf8");
    expect(source).not.toContain("SafeAreaProvider");
  });

  it("configures expo-splash-screen light and dark backgrounds aligned with warm-tactile", () => {
    const appJson = JSON.parse(fs.readFileSync(path.join(ROOT, "app.json"), "utf8")) as {
      expo: {
        plugins: Array<string | [string, Record<string, unknown>]>;
      };
    };

    const splashEntry = appJson.expo.plugins.find(
      (plugin) => Array.isArray(plugin) && plugin[0] === "expo-splash-screen",
    );
    expect(Array.isArray(splashEntry)).toBe(true);

    const splashConfig = (splashEntry as [string, Record<string, unknown>])[1];
    expect(splashConfig.backgroundColor).toBe("#fef8f4");
    expect(splashConfig.dark).toMatchObject({
      backgroundColor: "#120e0d",
      image: "./assets/images/splash-icon.png",
    });
  });
});
