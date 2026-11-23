import { fireEvent, screen, waitFor } from "@testing-library/react-native";
import { describe, expect, it, vi } from "vitest";
import { ShowcaseScreen } from "@/features/showcase/ui/showcase-screen";
import { THEME_MODE_STORAGE_KEY, THEME_PRESET_STORAGE_KEY } from "@/shared/ui/theme-provider";
import { renderWithProviders } from "@/test/render";

describe("ShowcaseScreen Feature Slice", () => {
  it("renders Tokens tab by default with ThemeSwitcher and updates preset and color scheme in real time", () => {
    const { kvStore, observability } = renderWithProviders(<ShowcaseScreen />, {
      initialPreset: "warm-tactile",
      initialColorScheme: "light",
    });

    expect(screen.getByText("Design System Showcase")).toBeTruthy();
    expect(screen.getByText("Semantic Color Tokens")).toBeTruthy();
    expect(screen.getByText("Typography Scale")).toBeTruthy();
    expect(screen.getByText("Tactile Elevation Physics")).toBeTruthy();
    expect(screen.getByTestId("showcase-active-theme")).toHaveTextContent("warm-tactile · light");

    fireEvent.press(screen.getByRole("button", { name: /Neo-Brutalist Studio/i }));
    expect(screen.getByTestId("showcase-active-theme")).toHaveTextContent("neo-brutalist · light");
    expect(kvStore.getString(THEME_PRESET_STORAGE_KEY)).toBe("neo-brutalist");

    fireEvent.press(screen.getByRole("button", { name: /^Dark$/i }));
    expect(screen.getByTestId("showcase-active-theme")).toHaveTextContent("neo-brutalist · dark");
    expect(kvStore.getString(THEME_MODE_STORAGE_KEY)).toBe("dark");

    observability.assertNoDefects();
  });

  it("switches to Primitives tab and allows interacting with owned Reusables controls", () => {
    const { observability } = renderWithProviders(<ShowcaseScreen />);

    fireEvent.press(screen.getByRole("tab", { name: "Primitives" }));

    expect(screen.getByText("Buttons & Badges")).toBeTruthy();
    expect(screen.getByText("Selection & Form Controls")).toBeTruthy();
    expect(screen.getByText("Display & Feedback")).toBeTruthy();
    expect(screen.getByText("Accordion")).toBeTruthy();

    fireEvent.press(screen.getByText("What powers the tactile press feel?"));
    expect(
      screen.getByText(/TactilePressable pairs Reanimated spring physics with expo-haptics/i),
    ).toBeTruthy();

    observability.assertNoDefects();
  });

  it("switches to Overlays tab and opens Dialog and Bottom Sheet inside PortalHost", async () => {
    const { observability } = renderWithProviders(<ShowcaseScreen />);

    fireEvent.press(screen.getByRole("tab", { name: "Overlays" }));

    expect(screen.getByText("Overlays & Portals")).toBeTruthy();

    fireEvent.press(screen.getByRole("button", { name: /Open Standard Dialog/i }));
    expect(await screen.findByText("Portal-Anchored Dialog")).toBeTruthy();

    fireEvent.press(screen.getByRole("button", { name: "Close dialog" }));
    await waitFor(() => {
      expect(screen.queryByText("Portal-Anchored Dialog")).toBeNull();
    });

    fireEvent.press(screen.getByRole("button", { name: /Open Bottom Sheet/i }));
    expect(await screen.findByText("Bottom Slide Sheet")).toBeTruthy();

    fireEvent.press(screen.getByRole("button", { name: "Close sheet" }));
    await waitFor(() => {
      expect(screen.queryByText("Bottom Slide Sheet")).toBeNull();
    });

    fireEvent.press(screen.getByRole("button", { name: /Open Alert Confirmation/i }));
    expect(await screen.findByText("Confirm destructive action?")).toBeTruthy();
    fireEvent.press(screen.getByText("Cancel"));
    await waitFor(() => {
      expect(screen.queryByText("Confirm destructive action?")).toBeNull();
    });

    fireEvent.press(screen.getByRole("button", { name: /Success Toast/i }));
    expect(await screen.findByText("Synced")).toBeTruthy();
    fireEvent.press(screen.getByRole("button", { name: "Dismiss notification" }));
    await waitFor(() => {
      expect(screen.queryByText("Synced")).toBeNull();
    });

    observability.assertNoDefects();
  });

  it("validates feedback form via Effect Schema, enforces double-submit lock, and shows toast on valid submission", async () => {
    let resolveSubmission!: () => void;
    const onSubmitFeedback = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          resolveSubmission = resolve;
        }),
    );

    const { observability } = renderWithProviders(
      <ShowcaseScreen onSubmitFeedback={onSubmitFeedback} />,
    );

    fireEvent.press(screen.getByRole("tab", { name: "Form Demo" }));
    expect(screen.getByText("Effect Schema Feedback Form")).toBeTruthy();

    // Submit empty form -> Effect Schema errors appear
    fireEvent.press(screen.getByRole("button", { name: /Submit Feedback/i }));

    expect(await screen.findByText("Title is required")).toBeTruthy();
    expect(await screen.findByText("Description must be at least 10 characters")).toBeTruthy();
    expect(await screen.findByText("You must agree to the feedback policy")).toBeTruthy();
    expect(onSubmitFeedback).not.toHaveBeenCalled();

    // Fill valid form values
    fireEvent.changeText(screen.getByLabelText("Feedback Title"), "Improve dark contrast");
    fireEvent.changeText(
      screen.getByLabelText("Description"),
      "Increase border visibility in neo-brutalist dark mode.",
    );
    fireEvent.press(screen.getByRole("checkbox", { name: /Agree to feedback policy/i }));

    // Double-press submit while async submission is in flight -> guarded by isSubmittingRef
    const submitButton = screen.getByRole("button", { name: /Submit Feedback/i });
    fireEvent.press(submitButton);
    fireEvent.press(submitButton);

    await waitFor(() => {
      expect(onSubmitFeedback).toHaveBeenCalledTimes(1);
    });
    expect(onSubmitFeedback).toHaveBeenCalledWith({
      title: "Improve dark contrast",
      category: "feature",
      priority: "medium",
      description: "Increase border visibility in neo-brutalist dark mode.",
      agreeTerms: true,
    });

    resolveSubmission();

    expect(await screen.findByText("Feedback submitted")).toBeTruthy();
    expect(await screen.findByTestId("showcase-submitted-summary")).toHaveTextContent(
      /Improve dark contrast/,
    );

    observability.assertNoDefects();
  });
});
