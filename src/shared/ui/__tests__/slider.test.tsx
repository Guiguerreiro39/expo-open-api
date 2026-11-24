import { fireEvent, screen } from "@testing-library/react-native";
import { useState } from "react";
import { Platform, StyleSheet, type ViewStyle } from "react-native";
import { describe, expect, it, vi } from "vitest";
import { Slider } from "@/shared/ui/slider";
import { mockHaptics } from "@/test/mocks/adapters/mock-haptics";
import { renderWithProviders } from "@/test/render";

function flattenStyle(styleProp: unknown): ViewStyle {
  return (StyleSheet.flatten(styleProp as ViewStyle) ?? {}) as ViewStyle;
}

function ControlledSliderHarness({
  testID,
  initialValue,
  step = 5,
  accessibilityLabel = "Slider",
  onChangeSpy,
}: {
  readonly testID: string;
  readonly initialValue: number;
  readonly step?: number;
  readonly accessibilityLabel?: string;
  readonly onChangeSpy: (next: number) => void;
}) {
  const [val, setVal] = useState(initialValue);
  return (
    <Slider
      testID={testID}
      accessibilityLabel={accessibilityLabel}
      value={val}
      min={0}
      max={100}
      step={step}
      onValueChange={(next) => {
        setVal(next);
        onChangeSpy(next);
      }}
    />
  );
}

function HapticsSliderHarness() {
  const [v1, setV1] = useState(0);
  const [v2, setV2] = useState(0);
  return (
    <>
      <Slider testID="haptic-slider" value={v1} min={0} max={100} step={25} onValueChange={setV1} />
      <Slider
        testID="silent-slider"
        value={v2}
        min={0}
        max={100}
        step={25}
        hapticFeedback={false}
        onValueChange={setV2}
      />
    </>
  );
}

describe("Slider", () => {
  it("supports PanResponder horizontal drag, scroll-locking, and measureInWindow/pageX projection without child hit-test skew", () => {
    const onValueChange = vi.fn();
    const measureInWindowSpy = vi.fn(
      (callback: (x: number, y: number, width: number, height: number) => void) => {
        callback(40, 100, 220, 44);
      },
    );

    const { observability } = renderWithProviders(
      <ControlledSliderHarness
        testID="slider"
        accessibilityLabel="Volume"
        initialValue={20}
        step={5}
        onChangeSpy={onValueChange}
      />,
      {
        createNodeMock: (element) => {
          if ((element.props as { testID?: string })?.testID === "slider") {
            return { measureInWindow: measureInWindowSpy };
          }
          return null;
        },
      },
    );
    const slider = screen.getByTestId("slider");

    // Layout with width=220 (thumbSize=20 -> usable travel span=200, thumbRadius=10)
    fireEvent(slider, "layout", {
      nativeEvent: { layout: { x: 0, y: 0, width: 220, height: 44 } },
    });

    // Scroll-locking: captures horizontal drags, declines vertical scroll gestures, refuses termination
    expect(slider.props.onStartShouldSetResponder()).toBe(true);
    expect(slider.props.onMoveShouldSetResponder({}, { dx: 14, dy: 2 })).toBe(true);
    expect(slider.props.onMoveShouldSetResponder({}, { dx: 2, dy: 24 })).toBe(false);
    expect(slider.props.onResponderTerminationRequest()).toBe(false);

    // Tap on midpoint via pageX (40 + 10 + 100 = 150) even with skewed locationX: 0
    fireEvent(slider, "responderGrant", {
      nativeEvent: { pageX: 150, locationX: 0 },
    });
    expect(measureInWindowSpy).toHaveBeenCalled();
    expect(onValueChange).toHaveBeenLastCalledWith(50);

    // Drag smoothly to 75% (40 + 10 + 150 = 200)
    fireEvent(
      slider,
      "responderMove",
      { nativeEvent: { pageX: 200, locationX: 0 } },
      { moveX: 200, dx: 50, dy: 0 },
    );
    expect(onValueChange).toHaveBeenLastCalledWith(75);

    // Drag past right & left edges clamps strictly to [min, max]
    fireEvent(
      slider,
      "responderMove",
      { nativeEvent: { pageX: 400 } },
      { moveX: 400, dx: 250, dy: 0 },
    );
    expect(onValueChange).toHaveBeenLastCalledWith(100);

    fireEvent(
      slider,
      "responderMove",
      { nativeEvent: { pageX: -20 } },
      { moveX: -20, dx: -170, dy: 0 },
    );
    expect(onValueChange).toHaveBeenLastCalledWith(0);

    observability.assertNoDefects();
  });

  it("clamps thumb travel strictly inside track bounds with zero ±10px clipping and marks decorative children pointerEvents=none", () => {
    const { observability } = renderWithProviders(
      <>
        <Slider testID="slider-min" value={0} min={0} max={100} onValueChange={() => {}} />
        <Slider testID="slider-mid" value={50} min={0} max={100} onValueChange={() => {}} />
        <Slider testID="slider-max" value={100} min={0} max={100} onValueChange={() => {}} />
      </>,
    );

    for (const id of ["slider-min", "slider-mid", "slider-max"]) {
      fireEvent(screen.getByTestId(id), "layout", {
        nativeEvent: { layout: { x: 0, y: 0, width: 220, height: 44 } },
      });
    }

    const minThumbStyle = flattenStyle(screen.getByTestId("slider-min-thumb").props.style);
    const midThumbStyle = flattenStyle(screen.getByTestId("slider-mid-thumb").props.style);
    const maxThumbStyle = flattenStyle(screen.getByTestId("slider-max-thumb").props.style);

    // Thumb width is 20px inside 220px track -> left spans [0, 200] (never negative, never > 200)
    expect(minThumbStyle.left).toBe(0);
    expect(midThumbStyle.left).toBe(100);
    expect(maxThumbStyle.left).toBe(200);

    // Decorative track and thumb never intercept hit tests
    expect(screen.getByTestId("slider-min-track").props.pointerEvents).toBe("none");
    expect(screen.getByTestId("slider-min-thumb").props.pointerEvents).toBe("none");

    observability.assertNoDefects();
  });

  it("supports Web pointer dragging and keyboard navigation while ensuring Space and Enter never produce NaN", () => {
    const originalOS = Platform.OS;
    Object.defineProperty(Platform, "OS", { value: "web", configurable: true });
    try {
      const onValueChange = vi.fn();

      const { observability } = renderWithProviders(
        <ControlledSliderHarness
          testID="web-slider"
          initialValue={50}
          step={5}
          onChangeSpy={onValueChange}
        />,
      );
      const slider = screen.getByTestId("web-slider");

      fireEvent(slider, "layout", {
        nativeEvent: { layout: { x: 0, y: 0, width: 220, height: 44 } },
      });

      const preventDefault = vi.fn();

      fireEvent(slider, "keyDown", { key: "ArrowRight", preventDefault });
      expect(onValueChange).toHaveBeenLastCalledWith(55);

      fireEvent(slider, "keyDown", { key: "ArrowLeft", preventDefault });
      expect(onValueChange).toHaveBeenLastCalledWith(50);

      fireEvent(slider, "keyDown", { key: "PageUp", preventDefault });
      expect(onValueChange).toHaveBeenLastCalledWith(60);

      fireEvent(slider, "keyDown", { key: "PageDown", preventDefault });
      expect(onValueChange).toHaveBeenLastCalledWith(50);

      fireEvent(slider, "keyDown", { key: "Home", preventDefault });
      expect(onValueChange).toHaveBeenLastCalledWith(0);

      fireEvent(slider, "keyDown", { key: "End", preventDefault });
      expect(onValueChange).toHaveBeenLastCalledWith(100);

      // Space and Enter must NEVER corrupt value to NaN or call onValueChange
      const callsBeforeSpaceEnter = onValueChange.mock.calls.length;
      fireEvent(slider, "keyDown", { key: " ", preventDefault });
      fireEvent(slider, "keyDown", { key: "Enter", preventDefault });
      expect(onValueChange).toHaveBeenCalledTimes(callsBeforeSpaceEnter);
      for (const [emitted] of onValueChange.mock.calls) {
        expect(Number.isFinite(emitted)).toBe(true);
      }

      // Web pointer drag via pointerDown + pointerMove + pointerUp
      const target = {
        getBoundingClientRect: () => ({ left: 40, width: 220 }),
        setPointerCapture: vi.fn(),
        releasePointerCapture: vi.fn(),
      };

      fireEvent(slider, "pointerDown", {
        pointerId: 1,
        clientX: 90,
        currentTarget: target,
      });
      expect(onValueChange).toHaveBeenLastCalledWith(20);
      expect(target.setPointerCapture).toHaveBeenCalledWith(1);

      fireEvent(slider, "pointerMove", {
        pointerId: 1,
        clientX: 190,
        currentTarget: target,
      });
      expect(onValueChange).toHaveBeenLastCalledWith(70);

      fireEvent(slider, "pointerUp", {
        pointerId: 1,
        clientX: 190,
        currentTarget: target,
      });
      expect(target.releasePointerCapture).toHaveBeenCalledWith(1);

      observability.assertNoDefects();
    } finally {
      Object.defineProperty(Platform, "OS", { value: originalOS, configurable: true });
    }
  });

  it("guards against step <= 0, pre-layout trackWidth === 0, and disabled state without emitting NaN", () => {
    const onZeroStep = vi.fn();
    const onPreLayout = vi.fn();
    const onDisabled = vi.fn();

    const { observability } = renderWithProviders(
      <>
        <Slider
          testID="zero-step"
          value={10}
          min={0}
          max={100}
          step={0}
          onValueChange={onZeroStep}
        />
        <Slider
          testID="pre-layout"
          value={10}
          min={0}
          max={100}
          step={1}
          onValueChange={onPreLayout}
        />
        <Slider
          testID="disabled-slider"
          value={25}
          min={0}
          max={100}
          step={5}
          disabled
          onValueChange={onDisabled}
        />
      </>,
    );

    fireEvent(screen.getByTestId("zero-step"), "accessibilityAction", {
      nativeEvent: { actionName: "increment" },
    });
    expect(onZeroStep).toHaveBeenCalledWith(11);

    fireEvent(screen.getByTestId("pre-layout"), "responderGrant", {
      nativeEvent: { pageX: 100, locationX: 100 },
    });
    expect(onPreLayout).not.toHaveBeenCalled();

    const disabledSlider = screen.getByTestId("disabled-slider");
    expect(disabledSlider.props.onStartShouldSetResponder()).toBe(false);
    fireEvent(disabledSlider, "accessibilityAction", {
      nativeEvent: { actionName: "increment" },
    });
    expect(onDisabled).not.toHaveBeenCalled();

    observability.assertNoDefects();
  });

  it("emits optional light haptic ticks only on discrete step transitions", () => {
    const { observability } = renderWithProviders(<HapticsSliderHarness />, {
      createNodeMock: (element) => {
        const id = (element.props as { testID?: string })?.testID;
        if (id === "haptic-slider" || id === "silent-slider") {
          return {
            measureInWindow: (cb: (x: number, y: number, w: number, h: number) => void) =>
              cb(0, 0, 220, 44),
          };
        }
        return null;
      },
    });
    const hapticSlider = screen.getByTestId("haptic-slider");
    const silentSlider = screen.getByTestId("silent-slider");

    fireEvent(hapticSlider, "layout", {
      nativeEvent: { layout: { x: 0, y: 0, width: 220, height: 44 } },
    });
    fireEvent(silentSlider, "layout", {
      nativeEvent: { layout: { x: 0, y: 0, width: 220, height: 44 } },
    });

    // Move to step 25 (pageX=60 -> (60-10)/200 = 0.25 -> 25): 1 haptic tick
    fireEvent(hapticSlider, "responderGrant", { nativeEvent: { pageX: 60 } });
    // Small drag still snapping to 25 (pageX=62 -> 0.26 -> snaps to 25): NO duplicate haptic tick
    fireEvent(hapticSlider, "responderMove", { nativeEvent: { pageX: 62 } }, { moveX: 62 });
    // Move to step 50 (pageX=110 -> 0.5 -> 50): 2nd haptic tick
    fireEvent(hapticSlider, "responderMove", { nativeEvent: { pageX: 110 } }, { moveX: 110 });

    expect(mockHaptics.events).toEqual([
      { type: "impact", style: "light" },
      { type: "impact", style: "light" },
    ]);

    // Silent slider emits 0 haptics
    mockHaptics.reset();
    fireEvent(silentSlider, "responderGrant", { nativeEvent: { pageX: 110 } });
    expect(mockHaptics.events).toHaveLength(0);

    observability.assertNoDefects();
  });
});
