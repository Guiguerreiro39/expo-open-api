import { fireEvent, screen } from "@testing-library/react-native";
import { View } from "react-native";
import { describe, expect, it } from "vitest";
import { Text } from "@/shared/ui/text";
import {
  THEME_MODE_STORAGE_KEY,
  THEME_PRESET_STORAGE_KEY,
  useTheme,
} from "@/shared/ui/theme-provider";
import { ThemeSwitcher } from "@/shared/ui/theme-switcher";
import { renderWithProviders } from "@/test/render";

function ThemeObserver() {
  const { preset, colorScheme, resolvedColorScheme } = useTheme();
  return (
    <View>
      <Text testID="active-preset">{preset}</Text>
      <Text testID="active-mode">{colorScheme}</Text>
      <Text testID="resolved-scheme">{resolvedColorScheme}</Text>
    </View>
  );
}

describe("ThemeSwitcher Widget", () => {
  it("switches canonical theme presets in real time and persists to storage", () => {
    const { kvStore } = renderWithProviders(
      <View>
        <ThemeSwitcher />
        <ThemeObserver />
      </View>,
      { initialPreset: "warm-tactile", initialColorScheme: "light" },
    );

    expect(screen.getByTestId("active-preset")).toHaveTextContent("warm-tactile");
    expect(
      screen.getByRole("button", { name: /Warm Tactile Studio/i }).props.accessibilityState,
    ).toMatchObject({ selected: true });

    fireEvent.press(screen.getByRole("button", { name: /Editorial Slate/i }));
    expect(screen.getByTestId("active-preset")).toHaveTextContent("editorial-slate");
    expect(kvStore.getString(THEME_PRESET_STORAGE_KEY)).toBe("editorial-slate");

    fireEvent.press(screen.getByRole("button", { name: /Neo-Brutalist Studio/i }));
    expect(screen.getByTestId("active-preset")).toHaveTextContent("neo-brutalist");
    expect(kvStore.getString(THEME_PRESET_STORAGE_KEY)).toBe("neo-brutalist");
  });

  it("switches color schemes (light, dark, system) in real time and persists to storage", () => {
    const { kvStore } = renderWithProviders(
      <View>
        <ThemeSwitcher />
        <ThemeObserver />
      </View>,
      { initialPreset: "warm-tactile", initialColorScheme: "light" },
    );

    expect(screen.getByTestId("active-mode")).toHaveTextContent("light");
    expect(screen.getByTestId("resolved-scheme")).toHaveTextContent("light");

    fireEvent.press(screen.getByRole("button", { name: /^Dark$/i }));
    expect(screen.getByTestId("active-mode")).toHaveTextContent("dark");
    expect(screen.getByTestId("resolved-scheme")).toHaveTextContent("dark");
    expect(kvStore.getString(THEME_MODE_STORAGE_KEY)).toBe("dark");

    fireEvent.press(screen.getByRole("button", { name: /^System$/i }));
    expect(screen.getByTestId("active-mode")).toHaveTextContent("system");
    expect(kvStore.getString(THEME_MODE_STORAGE_KEY)).toBe("system");

    fireEvent.press(screen.getByRole("button", { name: /^Light$/i }));
    expect(screen.getByTestId("active-mode")).toHaveTextContent("light");
    expect(screen.getByTestId("resolved-scheme")).toHaveTextContent("light");
    expect(kvStore.getString(THEME_MODE_STORAGE_KEY)).toBe("light");
  });

  it("preserves TactilePressable neo-brutalist border-2 on elevated preset and mode buttons", () => {
    renderWithProviders(<ThemeSwitcher />, {
      initialPreset: "neo-brutalist",
      initialColorScheme: "light",
    });

    const brutalistButton = screen.getByRole("button", { name: /Neo-Brutalist Studio/i });
    expect(brutalistButton.props.className).toContain("border-2");

    const lightModeButton = screen.getByRole("button", { name: /^Light$/i });
    expect(lightModeButton.props.className).toContain("border-2");
  });
});
