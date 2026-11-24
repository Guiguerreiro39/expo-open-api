import { act, fireEvent, screen } from "@testing-library/react-native";
import { Platform, Pressable, Text, View } from "react-native";
import { afterEach, describe, expect, it, vi } from "vitest";
import { Dialog, DialogContent, DialogTitle } from "@/shared/ui/dialog";
import { TOAST_PORTAL_HOST, useToast } from "@/shared/ui/toast";
import { renderWithProviders, TEST_SAFE_AREA_METRICS } from "@/test/render";

function ToastHarness() {
  const toast = useToast();

  return (
    <View>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Show Single Toast"
        onPress={() => toast.info("Saved changes", "All updates synced")}
      >
        <Text>Show Single Toast</Text>
      </Pressable>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Show Four Toasts"
        onPress={() => {
          toast.show({ title: "Toast 1", durationMs: 1000 });
          toast.show({ title: "Toast 2", durationMs: 5000 });
          toast.show({ title: "Toast 3", durationMs: 5000 });
          toast.show({ title: "Toast 4", durationMs: 5000 });
        }}
      >
        <Text>Show Four Toasts</Text>
      </Pressable>
    </View>
  );
}

function PinnedAndStackedHarness() {
  const toast = useToast();
  return (
    <>
      <Pressable
        testID="show-inf-toast"
        onPress={() => toast.show({ title: "Pinned", durationMs: Number.POSITIVE_INFINITY })}
      >
        <Text>Show Pinned</Text>
      </Pressable>
      <Dialog open>
        <DialogContent>
          <DialogTitle>Open Modal</DialogTitle>
        </DialogContent>
      </Dialog>
    </>
  );
}

describe("ToastViewport and ToastProvider", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("anchors ToastViewport below top safe-area inset with box-none pointer passthrough and preset geometry", async () => {
    const { observability } = renderWithProviders(<ToastHarness />, {
      initialPreset: "neo-brutalist",
      initialColorScheme: "dark",
    });

    expect(TOAST_PORTAL_HOST).toBeTruthy();

    fireEvent.press(screen.getByRole("button", { name: "Show Single Toast" }));

    expect(await screen.findByText("Saved changes")).toBeTruthy();

    const viewport = screen.getByTestId("toast-viewport");
    expect(viewport.props.pointerEvents).toBe("box-none");
    expect(viewport.props.className).not.toContain("bottom-6");

    const [alertNode] = screen.UNSAFE_getAllByProps({ accessibilityRole: "alert" });
    expect(alertNode).toBeDefined();
    expect(alertNode?.props.className).toContain("rounded-sm");
    expect(alertNode?.props.className).toContain("border-2");

    const flattenedStyle = Array.isArray(viewport.props.style)
      ? Object.assign({}, ...viewport.props.style)
      : viewport.props.style;
    expect(flattenedStyle.top).toBe(TEST_SAFE_AREA_METRICS.insets.top + 12);

    observability.assertNoDefects();
  });

  it("uses viewport-fixed positioning on Web so scrolled pages keep toasts anchored at the top", async () => {
    const originalOS = Platform.OS;
    Object.defineProperty(Platform, "OS", { configurable: true, value: "web" });

    try {
      const { observability } = renderWithProviders(<ToastHarness />);
      fireEvent.press(screen.getByRole("button", { name: "Show Single Toast" }));

      const viewport = await screen.findByTestId("toast-viewport");
      const flattenedStyle = Array.isArray(viewport.props.style)
        ? Object.assign({}, ...viewport.props.style)
        : viewport.props.style;
      expect(flattenedStyle.position).toBe("fixed");
      expect(flattenedStyle.top).toBe(TEST_SAFE_AREA_METRICS.insets.top + 12);

      observability.assertNoDefects();
    } finally {
      Object.defineProperty(Platform, "OS", { configurable: true, value: originalOS });
    }
  });

  it("evicts oldest toasts past max queue size and clears their pending timers immediately", () => {
    vi.useFakeTimers();
    const clearTimeoutSpy = vi.spyOn(globalThis, "clearTimeout");

    try {
      const { observability } = renderWithProviders(<ToastHarness />);

      fireEvent.press(screen.getByRole("button", { name: "Show Four Toasts" }));

      expect(screen.queryByText("Toast 1")).toBeNull();
      expect(screen.getByText("Toast 2")).toBeTruthy();
      expect(screen.getByText("Toast 3")).toBeTruthy();
      expect(screen.getByText("Toast 4")).toBeTruthy();
      // Evicted Toast 1's 1000ms timer must have been cleared on eviction
      expect(clearTimeoutSpy).toHaveBeenCalledTimes(1);

      act(() => {
        vi.advanceTimersByTime(1500);
      });

      // Remaining toasts (5000ms) are still visible
      expect(screen.getByText("Toast 2")).toBeTruthy();
      expect(screen.getByText("Toast 3")).toBeTruthy();
      expect(screen.getByText("Toast 4")).toBeTruthy();

      act(() => {
        vi.advanceTimersByTime(4000);
      });

      expect(screen.queryByText("Toast 2")).toBeNull();
      expect(screen.queryByText("Toast 3")).toBeNull();
      expect(screen.queryByText("Toast 4")).toBeNull();

      observability.assertNoDefects();
    } finally {
      clearTimeoutSpy.mockRestore();
    }
  });

  it("keeps toasts pinned when durationMs is Number.POSITIVE_INFINITY and stacks ToastViewport above Web Radix overlays", () => {
    const originalOS = Platform.OS;
    Object.defineProperty(Platform, "OS", { configurable: true, value: "web" });
    vi.useFakeTimers();

    try {
      const { observability } = renderWithProviders(<PinnedAndStackedHarness />);
      fireEvent.press(screen.getByTestId("show-inf-toast"));
      expect(screen.getByText("Pinned")).toBeTruthy();

      act(() => {
        vi.advanceTimersByTime(60_000);
      });
      expect(screen.getByText("Pinned")).toBeTruthy();

      const toastViewport = screen.getByTestId("toast-viewport");
      const dialogOverlay = screen.getByTestId("dialog-overlay");
      const toastZ = String(toastViewport.props.className).match(/\bz-(\[?\d+\]?)\b/)?.[1];
      const dialogZ = String(dialogOverlay.props.className).match(/\bz-(\[?\d+\]?)\b/)?.[1];
      expect(Number(toastZ?.replace(/\D/g, ""))).toBeGreaterThan(
        Number(dialogZ?.replace(/\D/g, "")),
      );
      observability.assertNoDefects();
    } finally {
      vi.useRealTimers();
      Object.defineProperty(Platform, "OS", { configurable: true, value: originalOS });
    }
  });
});
