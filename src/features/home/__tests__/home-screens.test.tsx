import { fireEvent } from "@testing-library/react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { describe, expect, it } from "vitest";
import { HomeScreen } from "@/features/home/ui/home-screen";
import { NotFoundScreen } from "@/features/home/ui/not-found-screen";
import { renderWithProviders } from "@/test/render";

describe("HomeScreen", () => {
  it("uses horizontal-only SafeAreaView edges under Tabs and renders updated SDK 58 stack copy", () => {
    const { getByText, queryByText, UNSAFE_getByType, observability } = renderWithProviders(
      <HomeScreen />,
    );

    const safeArea = UNSAFE_getByType(SafeAreaView);
    expect(safeArea.props.edges).toEqual(["left", "right"]);

    expect(getByText(/Expo SDK 58/i)).toBeTruthy();
    expect(queryByText(/Expo SDK 52/i)).toBeNull();
    expect(queryByText(/Expo Router v4/i)).toBeNull();
    observability.assertNoDefects();
  });

  it("embeds the shared ThemeSwitcher with Light, Dark, and System modes and updates theme state", () => {
    const { getByLabelText, getByText, observability } = renderWithProviders(<HomeScreen />, {
      initialPreset: "warm-tactile",
      initialColorScheme: "light",
    });

    expect(getByText("Theme Preset")).toBeTruthy();
    expect(getByLabelText("Light")).toBeTruthy();
    expect(getByLabelText("Dark")).toBeTruthy();
    expect(getByLabelText("System")).toBeTruthy();

    fireEvent.press(getByLabelText("Neo-Brutalist Studio"));
    expect(getByLabelText("Neo-Brutalist Studio").props.accessibilityState?.selected).toBe(true);

    fireEvent.press(getByLabelText("System"));
    expect(getByLabelText("System").props.accessibilityState?.selected).toBe(true);

    fireEvent.press(getByLabelText("Dark"));
    expect(getByLabelText("Dark").props.accessibilityState?.selected).toBe(true);

    observability.assertNoDefects();
  });

  it("keeps card title and footer safe against narrow-screen overflow", () => {
    const { getByText, getByTestId, observability } = renderWithProviders(<HomeScreen />);

    const cardTitle = getByText("Runtime Theme Presets");
    expect(String(cardTitle.props.className)).toContain("flex-1");
    expect(String(cardTitle.props.className)).toContain("min-w-0");

    const cardFooter = getByTestId("home-theme-card-footer");
    expect(String(cardFooter.props.className)).toContain("flex-wrap");
    observability.assertNoDefects();
  });
});

describe("NotFoundScreen", () => {
  it("applies bottom/horizontal safe-area edges under the stack header and flex-sizes the title", () => {
    const { getByText, UNSAFE_getByType, observability } = renderWithProviders(<NotFoundScreen />);

    const safeArea = UNSAFE_getByType(SafeAreaView);
    expect(safeArea.props.edges).toEqual(["bottom", "left", "right"]);

    const title = getByText("Screen not found");
    expect(String(title.props.className)).toContain("flex-1");
    expect(String(title.props.className)).toContain("min-w-0");
    expect(getByText("Go to home screen")).toBeTruthy();
    observability.assertNoDefects();
  });
});
