import { act, fireEvent, screen, waitFor } from "@testing-library/react-native";
import { useState } from "react";
import { Platform, Pressable, Text } from "react-native";
import { describe, expect, it, vi } from "vitest";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/shared/ui/sheet";
import { renderWithProviders, TEST_SAFE_AREA_METRICS } from "@/test/render";

function SheetHarness() {
  return (
    <Sheet>
      <SheetTrigger asChild>
        <Pressable accessibilityRole="button" accessibilityLabel="Open Sheet">
          <Text>Open Sheet</Text>
        </Pressable>
      </SheetTrigger>
      <SheetContent testID="test-sheet-content">
        <SheetHeader>
          <SheetTitle>Quick Actions</SheetTitle>
          <SheetDescription>Swipe down or tap close to dismiss.</SheetDescription>
        </SheetHeader>
        <SheetFooter>
          <Text>Footer Action</Text>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}

function GuardedSheetHarness() {
  const [blockedCount, setBlockedCount] = useState(0);
  return (
    <Sheet
      open
      onOpenChange={(next) => {
        if (!next) {
          setBlockedCount((count) => count + 1);
        }
      }}
    >
      <SheetContent testID="controlled-sheet">
        <SheetTitle>{`Unsaved Draft (${blockedCount})`}</SheetTitle>
      </SheetContent>
    </Sheet>
  );
}

describe("Sheet primitive", () => {
  it("renders with --scrim backdrop, safe-area bottom padding, and preset geometry", async () => {
    const { observability } = renderWithProviders(<SheetHarness />, {
      initialPreset: "neo-brutalist",
      initialColorScheme: "dark",
    });

    fireEvent.press(screen.getByRole("button", { name: "Open Sheet" }));

    const content = await screen.findByTestId("test-sheet-content");
    expect(content.props.className).toContain("w-full");
    expect(content.props.className).toContain("rounded-t-sm");
    expect(content.props.className).toContain("border-x-2");
    expect(content.props.className).toContain("border-t-2");

    const flattenedStyle = Array.isArray(content.props.style)
      ? Object.assign({}, ...content.props.style.filter(Boolean))
      : content.props.style;
    expect(flattenedStyle.paddingBottom).toBeGreaterThanOrEqual(
      TEST_SAFE_AREA_METRICS.insets.bottom + 12,
    );

    const overlay = screen.getByTestId("sheet-overlay");
    expect(overlay.props.className).toContain("bg-scrim/");
    expect(overlay.props.className).not.toContain("bg-foreground/");

    observability.assertNoDefects();
  });

  it("dismisses when swiping down past threshold on the grab handle and stays open on short drags", async () => {
    const { observability } = renderWithProviders(<SheetHarness />);

    fireEvent.press(screen.getByRole("button", { name: "Open Sheet" }));
    expect(await screen.findByText("Quick Actions")).toBeTruthy();

    const grabHandle = screen.getByTestId("sheet-grab-handle");
    expect(grabHandle.props.onResponderMove).toBeTypeOf("function");
    expect(grabHandle.props.onResponderRelease).toBeTypeOf("function");

    // Short drag (below threshold) should keep the sheet open
    act(() => {
      grabHandle.props.onResponderGrant?.({}, { dx: 0, dy: 0, vx: 0, vy: 0 });
      grabHandle.props.onResponderMove?.({}, { dx: 0, dy: 25, vx: 0, vy: 0.1 });
      grabHandle.props.onResponderRelease?.({}, { dx: 0, dy: 25, vx: 0, vy: 0.1 });
    });

    expect(screen.getByText("Quick Actions")).toBeTruthy();

    // Drag past dismiss threshold (>= 80px) closes the sheet
    act(() => {
      grabHandle.props.onResponderGrant?.({}, { dx: 0, dy: 0, vx: 0, vy: 0 });
      grabHandle.props.onResponderMove?.({}, { dx: 0, dy: 120, vx: 0, vy: 0.4 });
      grabHandle.props.onResponderRelease?.({}, { dx: 0, dy: 120, vx: 0, vy: 0.4 });
    });

    await waitFor(() => {
      expect(screen.queryByText("Quick Actions")).toBeNull();
    });

    // Re-open and verify fast downward flick (vy >= 0.6) also dismisses
    fireEvent.press(screen.getByRole("button", { name: "Open Sheet" }));
    expect(await screen.findByText("Quick Actions")).toBeTruthy();

    const reopenedHandle = screen.getByTestId("sheet-grab-handle");
    act(() => {
      reopenedHandle.props.onResponderGrant?.({}, { dx: 0, dy: 0, vx: 0, vy: 0 });
      reopenedHandle.props.onResponderMove?.({}, { dx: 0, dy: 30, vx: 0, vy: 0.8 });
      reopenedHandle.props.onResponderRelease?.({}, { dx: 0, dy: 30, vx: 0, vy: 0.8 });
    });

    await waitFor(() => {
      expect(screen.queryByText("Quick Actions")).toBeNull();
    });

    observability.assertNoDefects();
  });

  it("uses viewport-fixed overlay and guards Web trigger clicks", async () => {
    const originalOS = Platform.OS;
    Object.defineProperty(Platform, "OS", { configurable: true, value: "web" });

    try {
      const { observability } = renderWithProviders(<SheetHarness />);

      const trigger = screen.getByRole("button", { name: "Open Sheet" });
      const preventDefault = vi.fn();
      trigger.props.onClick?.({ preventDefault });
      expect(preventDefault).toHaveBeenCalledTimes(1);

      fireEvent.press(trigger);
      const overlay = await screen.findByTestId("sheet-overlay");
      const overlayStyle = Array.isArray(overlay.props.style)
        ? Object.assign({}, ...overlay.props.style.filter(Boolean))
        : overlay.props.style;
      expect(overlayStyle.position).toBe("fixed");

      observability.assertNoDefects();
    } finally {
      Object.defineProperty(Platform, "OS", { configurable: true, value: originalOS });
    }
  });

  it("springs translateY back to 0 when a controlled parent blocks swipe-down dismissal", () => {
    const { observability } = renderWithProviders(<GuardedSheetHarness />);
    const handle = screen.getByTestId("sheet-grab-handle");

    act(() => {
      handle.props.onResponderGrant?.({}, { dx: 0, dy: 0, vx: 0, vy: 0 });
      handle.props.onResponderMove?.({}, { dx: 0, dy: 140, vx: 0, vy: 0.4 });
      handle.props.onResponderRelease?.({}, { dx: 0, dy: 140, vx: 0, vy: 0.4 });
    });

    const updatedOverlay = screen.getByTestId("sheet-overlay");
    const updatedAnimatedWrapper = updatedOverlay.children[0] as { props?: { style?: unknown } };
    const serializedStyle = JSON.stringify(updatedAnimatedWrapper?.props?.style);
    expect(serializedStyle).not.toContain('"translateY":360');
    expect(serializedStyle).toContain('"translateY":0');
    observability.assertNoDefects();
  });
});
