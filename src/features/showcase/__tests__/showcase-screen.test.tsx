import { fireEvent, screen, waitFor } from "@testing-library/react-native";
import { describe, expect, it, vi } from "vitest";
import { ShowcaseScreen } from "@/features/showcase/ui/showcase-screen";
import { ValidationError } from "@/shared/api/contracts";
import { THEME_MODE_STORAGE_KEY, THEME_PRESET_STORAGE_KEY } from "@/shared/ui/theme-provider";
import { renderWithProviders } from "@/test/render";

const MEASURABLE_NODE_MOCK = {
  createNodeMock: () => ({
    measure: (cb: (x: number, y: number, w: number, h: number, px: number, py: number) => void) => {
      cb(16, 120, 240, 48, 16, 120);
    },
    measureInWindow: (cb: (x: number, y: number, w: number, h: number) => void) => {
      cb(0, 120, 220, 44);
    },
    focus: vi.fn(),
  }),
};

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

  it("uses horizontal-only safe area edges, single-line tabs, adaptive swatches, and contrast-safe tactile demo", () => {
    const { observability } = renderWithProviders(<ShowcaseScreen />, {
      initialPreset: "warm-tactile",
      initialColorScheme: "dark",
    });

    const safeArea = screen.getByTestId("showcase-safe-area");
    expect(safeArea.props.edges).toEqual(["left", "right"]);

    for (const label of ["Tokens", "Primitives", "Overlays", "Form Demo"]) {
      const tabText = screen.getByText(label);
      expect(tabText.props.numberOfLines).toBe(1);
    }

    const brandSwatch = screen.getByTestId("showcase-swatch---primary");
    expect(brandSwatch.props.className).toContain("min-w-28");
    expect(brandSwatch.props.className).not.toContain("min-w-36");

    const tactileDemo = screen.getByRole("button", { name: "Test tactile spring press" });
    expect(tactileDemo.props.className).toContain("bg-primary-container");
    expect(tactileDemo.props.className).not.toContain("bg-primary-fixed");

    expect(screen.getByText("0")).toBeTruthy();
    fireEvent.press(tactileDemo);
    expect(screen.getByText("1")).toBeTruthy();

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

  it("triggers interactive feedback on button demos, wraps narrow-screen control rows, animates skeletons, and exercises slider drag/clamping", async () => {
    const { observability } = renderWithProviders(<ShowcaseScreen />, MEASURABLE_NODE_MOCK);

    fireEvent.press(screen.getByRole("tab", { name: "Primitives" }));

    // Button variant demos produce visible interactive feedback + toast
    fireEvent.press(screen.getByRole("button", { name: "Primary" }));
    expect(screen.getByTestId("showcase-button-feedback")).toHaveTextContent(/Primary/i);
    expect(await screen.findByText("Primary button pressed")).toBeTruthy();

    fireEvent.press(screen.getByRole("button", { name: "Destructive" }));
    expect(screen.getByTestId("showcase-button-feedback")).toHaveTextContent(/Destructive/i);

    // Narrow-screen wrap guarantees for Switch + Checkbox and DropdownMenu rows
    const toggleRow = screen.getByTestId("showcase-toggle-row");
    expect(toggleRow.props.className).toContain("flex-wrap");

    fireEvent.press(screen.getByRole("switch", { name: "Enable live sync" }));
    expect(screen.getByText("Live Sync (Off)")).toBeTruthy();

    const dropdownRow = screen.getByTestId("showcase-dropdown-row");
    expect(dropdownRow.props.className).toContain("flex-wrap");
    const dropdownStatus = screen.getByTestId("showcase-dropdown-status");
    expect(dropdownStatus.props.numberOfLines).toBe(1);

    fireEvent.press(screen.getByRole("button", { name: /Actions Menu/i }));
    fireEvent.press(await screen.findByText("Duplicate Item"));
    expect(screen.getByTestId("showcase-dropdown-status")).toHaveTextContent(
      "Last action: Duplicated",
    );

    // Skeleton previews animate cleanly
    const primarySkeleton = screen.getByTestId("showcase-skeleton-primary");
    const secondarySkeleton = screen.getByTestId("showcase-skeleton-secondary");
    expect(primarySkeleton.props.accessibilityHint).toBeUndefined();
    expect(primarySkeleton).toBeTruthy();
    expect(secondarySkeleton).toBeTruthy();

    // Slider exercises layout, tap/drag, and clamped bounds [0, 100]
    const slider = screen.getByTestId("showcase-slider");
    fireEvent(slider, "layout", {
      nativeEvent: { layout: { width: 220, height: 44, x: 0, y: 0 } },
    });
    fireEvent(slider, "accessibilityAction", { nativeEvent: { actionName: "increment" } });
    expect(screen.getByTestId("showcase-slider-value")).toHaveTextContent("70%");

    // Drag to far right clamps at 100%
    fireEvent(slider, "responderGrant", { nativeEvent: { locationX: 250, pageX: 250 } });
    expect(screen.getByTestId("showcase-slider-value")).toHaveTextContent("100%");

    // Drag to far left clamps at 0%
    fireEvent(slider, "responderMove", { nativeEvent: { locationX: -40, pageX: -40 } });
    expect(screen.getByTestId("showcase-slider-value")).toHaveTextContent("0%");

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

  it("splits Popover and Tooltip triggers horizontally without vertical flex distortion and opens both overlays", async () => {
    const { observability } = renderWithProviders(<ShowcaseScreen />, MEASURABLE_NODE_MOCK);

    fireEvent.press(screen.getByRole("tab", { name: "Overlays" }));

    const triggerRow = screen.getByTestId("showcase-floating-triggers");
    expect(triggerRow.props.className).toContain("flex-row");
    expect(triggerRow.props.className).toContain("flex-wrap");

    const popoverButton = screen.getByRole("button", { name: /Open Popover/i });
    const tooltipButton = screen.getByRole("button", { name: /Show Tooltip/i });
    expect(popoverButton.props.className).not.toContain("flex-1");
    expect(tooltipButton.props.className).not.toContain("flex-1");
    expect(popoverButton.props.className).toContain("w-full");
    expect(tooltipButton.props.className).toContain("w-full");

    fireEvent.press(popoverButton);
    expect(await screen.findByText("Anchored Popover")).toBeTruthy();

    fireEvent.press(tooltipButton);
    expect(await screen.findByText("Accessible semantic tooltip")).toBeTruthy();

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

  it("clears submit errors on Select, RadioGroup, and Checkbox label tap, chains title-to-description focus, and resets the feedback form", async () => {
    let rejectWithValidation = true;
    const onSubmitFeedback = vi.fn(async () => {
      if (rejectWithValidation) {
        rejectWithValidation = false;
        throw new ValidationError({
          status: 422,
          code: "VALIDATION_ERROR",
          message: "Validation failed",
          requestId: "req_showcase_422",
          issues: [
            { path: ["category"], message: "Choose a more specific category" },
            { path: ["priority"], message: "Escalate priority for triage" },
          ],
        });
      }
    });

    const { observability } = renderWithProviders(
      <ShowcaseScreen onSubmitFeedback={onSubmitFeedback} />,
      {
        createNodeMock: () => ({
          measure: (
            cb: (x: number, y: number, w: number, h: number, px: number, py: number) => void,
          ) => {
            cb(16, 120, 240, 48, 16, 120);
          },
          focus: vi.fn(),
        }),
      },
    );

    fireEvent.press(screen.getByRole("tab", { name: "Form Demo" }));

    // 1. Keyboard focus chaining: Feedback Title -> Description
    const titleInput = screen.getByLabelText("Feedback Title");
    const descriptionInput = screen.getByLabelText("Description");
    const descriptionRef = descriptionInput.props.ref as {
      current: { focus: ReturnType<typeof vi.fn> };
    };
    expect(titleInput.props.returnKeyType).toBe("next");
    expect(descriptionRef.current).toBeTruthy();
    fireEvent(titleInput, "submitEditing");
    expect(descriptionRef.current.focus).toHaveBeenCalledTimes(1);

    // 2. Empty submit -> tapping Checkbox Label clears agreeTerms submit error immediately
    fireEvent.press(screen.getByRole("button", { name: /Submit Feedback/i }));
    expect(await screen.findByText("You must agree to the feedback policy")).toBeTruthy();

    fireEvent.press(screen.getByText("I agree to share this feedback for design QA"));
    await waitFor(() => {
      expect(screen.queryByText("You must agree to the feedback policy")).toBeNull();
    });
    expect(
      screen.getByRole("checkbox", { name: /Agree to feedback policy/i }).props.accessibilityState
        ?.checked,
    ).toBe(true);

    // 3. Fill valid values -> server 422 marks category & priority invalid
    fireEvent.changeText(titleInput, "Polish showcase controls");
    fireEvent.changeText(
      screen.getByLabelText("Description"),
      "Verify FormControl clears submit errors across Select and RadioGroup.",
    );
    fireEvent.press(screen.getByRole("button", { name: /Submit Feedback/i }));

    expect(await screen.findByText("Choose a more specific category")).toBeTruthy();
    expect(await screen.findByText("Escalate priority for triage")).toBeTruthy();

    // Selecting a new Select option clears category submit error immediately
    fireEvent.press(screen.getByLabelText("Feedback Category"));
    fireEvent.press(await screen.findByText("Bug Report"));
    await waitFor(() => {
      expect(screen.queryByText("Choose a more specific category")).toBeNull();
    });

    // Selecting a RadioGroup option (via label tap) clears priority submit error immediately
    fireEvent.press(screen.getByText("High"));
    await waitFor(() => {
      expect(screen.queryByText("Escalate priority for triage")).toBeNull();
    });

    // 4. Resubmit succeeds, then Reset restores defaults and clears submitted summary
    fireEvent.press(screen.getByRole("button", { name: /Submit Feedback/i }));
    expect(await screen.findByTestId("showcase-submitted-summary")).toHaveTextContent(
      /Polish showcase controls/,
    );

    fireEvent.press(screen.getByRole("button", { name: /Reset/i }));
    await waitFor(() => {
      expect(screen.queryByTestId("showcase-submitted-summary")).toBeNull();
    });
    expect(screen.getByLabelText("Feedback Title").props.value).toBe("");
    expect(screen.getByLabelText("Description").props.value).toBe("");

    observability.assertNoDefects();
  });

  it("clears stale onBlur validation errors on Feedback Title and allows submitting without re-blurring", async () => {
    const onSubmitFeedback = vi.fn();
    const { observability } = renderWithProviders(
      <ShowcaseScreen onSubmitFeedback={onSubmitFeedback} />,
    );

    fireEvent.press(screen.getByRole("tab", { name: "Form Demo" }));
    fireEvent.changeText(screen.getByLabelText("Feedback Title"), "ab");
    fireEvent(screen.getByLabelText("Feedback Title"), "blur");
    expect(await screen.findByText("Title must be at least 3 characters")).toBeTruthy();

    fireEvent.changeText(screen.getByLabelText("Feedback Title"), "Valid Title Now");
    fireEvent.changeText(
      screen.getByLabelText("Description"),
      "Valid description with plenty of characters.",
    );
    fireEvent.press(screen.getByRole("checkbox", { name: /Agree to feedback policy/i }));
    fireEvent.press(screen.getByRole("button", { name: /Submit Feedback/i }));

    await waitFor(() => {
      expect(onSubmitFeedback).toHaveBeenCalledTimes(1);
    });
    expect(screen.queryByText("Title must be at least 3 characters")).toBeNull();
    observability.assertNoDefects();
  });
});
