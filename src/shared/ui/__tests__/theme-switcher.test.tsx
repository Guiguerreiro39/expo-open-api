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

  it("preserves constant neo-brutalist border-2 and preset radius across selected and unselected preset and mode buttons", () => {
    const { observability } = renderWithProviders(<ThemeSwitcher />, {
      initialPreset: "neo-brutalist",
      initialColorScheme: "dark",
    });

    const selectedPreset = screen.getByRole("button", { name: /Neo-Brutalist Studio/i });
    const unselectedPreset = screen.getByRole("button", { name: /Warm Tactile Studio/i });
    const selectedMode = screen.getByRole("button", { name: /^Dark$/i });
    const unselectedMode = screen.getByRole("button", { name: /^Light$/i });

    for (const button of [selectedPreset, unselectedPreset, selectedMode, unselectedMode]) {
      const classes = String(button.props.className).split(/\s+/);
      expect(classes).toContain("border-2");
      expect(classes).not.toContain("border");
      expect(classes).toContain("rounded-sm");
    }

    // Selected preset uses contrast-safe semantic container tokens instead of low-contrast bg-primary-fixed/40
    const selectedPresetClass = String(selectedPreset.props.className);
    expect(selectedPresetClass).not.toContain("bg-primary-fixed");
    expect(selectedPresetClass).toContain("bg-primary-container");

    // Selected preset title and description both use on-primary-container for >= 4.5:1 dark/light contrast
    expect(String(screen.getByText("Neo-Brutalist Studio").props.className)).toContain(
      "text-on-primary-container",
    );
    expect(
      String(
        screen.getByText(
          "High-contrast graphic surfaces, bold borders, hard offset shadows, and deep press.",
        ).props.className,
      ),
    ).toContain("text-on-primary-container");

    // Selected color mode button uses bg-primary + text-primary-foreground (never text-foreground)
    const selectedModeClasses = String(selectedMode.props.className).split(/\s+/);
    expect(selectedModeClasses).toContain("bg-primary");
    const selectedModeTextClasses = String(screen.getByText("Dark").props.className).split(/\s+/);
    expect(selectedModeTextClasses).toContain("text-primary-foreground");
    expect(selectedModeTextClasses).not.toContain("text-foreground");

    const unselectedModeTextClasses = String(screen.getByText("Light").props.className).split(
      /\s+/,
    );
    expect(unselectedModeTextClasses).toContain("text-foreground");
    expect(unselectedModeTextClasses).not.toContain("text-primary-foreground");

    // Header and color-mode rows wrap cleanly on narrow 320-375px screens
    expect(String(screen.getByTestId("theme-switcher-header").props.className)).toContain(
      "flex-wrap",
    );
    expect(String(screen.getByTestId("theme-switcher-modes").props.className)).toContain(
      "flex-wrap",
    );

    observability.assertNoDefects();
  });
});
