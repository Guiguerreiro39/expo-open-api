import * as Haptics from "expo-haptics";
import { type ComponentRef, forwardRef, useCallback, useMemo, useRef, useState } from "react";
import {
  type GestureResponderEvent,
  type LayoutChangeEvent,
  PanResponder,
  type PanResponderGestureState,
  Platform,
  View,
  type ViewProps,
} from "react-native";
import {
  DEFAULT_THEME_PRESET,
  getThemeElevation,
  type ThemePreset,
} from "@/shared/lib/theme/presets";
import { cn } from "@/shared/lib/utils";
import { useOptionalTheme } from "@/shared/ui/theme-provider";

const THUMB_SIZE = 20;
const THUMB_RADIUS = THUMB_SIZE / 2;

const PRESET_SLIDER_RADIUS: Record<ThemePreset, string> = {
  "warm-tactile": "rounded-full",
  "editorial-slate": "rounded-full",
  "neo-brutalist": "rounded-sm",
};

interface WebPointerEventLike {
  readonly pointerId?: number;
  readonly clientX?: number;
  readonly currentTarget?: {
    getBoundingClientRect?: () => { readonly left: number; readonly width: number };
    setPointerCapture?: (pointerId: number) => void;
    releasePointerCapture?: (pointerId: number) => void;
    hasPointerCapture?: (pointerId: number) => boolean;
  };
}

interface WebKeyDownEventLike {
  readonly key?: string;
  preventDefault?: () => void;
}

function getStepPrecision(step: number): number {
  const stepText = String(step).toLowerCase();
  if (stepText.includes("e-")) {
    const [mantissa = "", exp = "0"] = stepText.split("e-");
    const dotIndex = mantissa.indexOf(".");
    const mantissaDecimals = dotIndex >= 0 ? mantissa.length - dotIndex - 1 : 0;
    return mantissaDecimals + (Number(exp) || 0);
  }
  const dotIndex = stepText.indexOf(".");
  return dotIndex >= 0 ? stepText.length - dotIndex - 1 : 0;
}

function roundToStepPrecision(value: number, precision: number): number {
  if (precision <= 0 || !Number.isFinite(value)) {
    return value;
  }
  if (precision <= 100) {
    return Number(value.toFixed(precision));
  }
  return Number(value.toPrecision(15));
}

function snapSliderValue(
  raw: number,
  min: number,
  max: number,
  step: number,
  fallback: number,
): number {
  if (!Number.isFinite(raw)) {
    return fallback;
  }
  if (max <= min) {
    return min;
  }
  if (raw <= min) {
    return min;
  }
  if (raw >= max) {
    return max;
  }
  const stepped = Math.round((raw - min) / step) * step + min;
  const rounded = roundToStepPrecision(stepped, getStepPrecision(step));
  return Math.min(max, Math.max(min, rounded));
}

function stepSliderUp(current: number, min: number, max: number, step: number): number {
  if (max <= min) {
    return min;
  }
  const nextIndex = Math.floor((current - min) / step + 1e-9) + 1;
  return snapSliderValue(min + nextIndex * step, min, max, step, current);
}

function stepSliderDown(current: number, min: number, max: number, step: number): number {
  if (max <= min) {
    return min;
  }
  const prevIndex = Math.ceil((current - min) / step - 1e-9) - 1;
  return snapSliderValue(min + prevIndex * step, min, max, step, current);
}

function projectRelativeX(
  relativeX: number,
  trackWidth: number,
  min: number,
  max: number,
  step: number,
  fallback: number,
): number | null {
  if (!Number.isFinite(relativeX) || !Number.isFinite(trackWidth) || trackWidth <= 0) {
    return null;
  }
  const usableSpan = trackWidth - THUMB_SIZE;
  const ratio =
    usableSpan > 0
      ? Math.min(1, Math.max(0, (relativeX - THUMB_RADIUS) / usableSpan))
      : Math.min(1, Math.max(0, relativeX / trackWidth));
  return snapSliderValue(min + ratio * (max - min), min, max, step, fallback);
}

export interface SliderProps extends Omit<ViewProps, "children"> {
  value: number;
  onValueChange: (value: number) => void;
  min?: number;
  max?: number;
  step?: number;
  disabled?: boolean;
  hapticFeedback?: boolean;
  className?: string;
  trackClassName?: string;
  rangeClassName?: string;
  thumbClassName?: string;
  accessibilityLabel?: string;
}

export const Slider = forwardRef<ComponentRef<typeof View>, SliderProps>(
  (
    {
      value,
      onValueChange,
      min = 0,
      max = 100,
      step = 1,
      disabled = false,
      hapticFeedback = true,
      className,
      trackClassName,
      rangeClassName,
      thumbClassName,
      accessibilityLabel = "Slider",
      testID,
      onLayout,
      ...props
    },
    forwardedRef,
  ) => {
    const theme = useOptionalTheme();
    const preset = theme?.preset ?? DEFAULT_THEME_PRESET;
    const resolvedScheme = theme?.resolvedColorScheme ?? "light";
    const elevation = getThemeElevation(preset, resolvedScheme);
    const radiusClass = PRESET_SLIDER_RADIUS[preset];
    const trackBorderClass = elevation.borderWidth >= 2 ? "border-2" : "border";

    const safeMin = Number.isFinite(min) ? min : 0;
    const safeMax = Number.isFinite(max) ? Math.max(safeMin, max) : safeMin;
    const safeRange = safeMax - safeMin;
    const safeStep = Number.isFinite(step) && step > 0 ? step : 1;
    const clampedValue = Number.isFinite(value)
      ? Math.min(safeMax, Math.max(safeMin, value))
      : safeMin;
    const ratio =
      safeRange > 0 ? Math.min(1, Math.max(0, (clampedValue - safeMin) / safeRange)) : 0;

    const [trackWidth, setTrackWidth] = useState(0);
    const trackNodeRef = useRef<ComponentRef<typeof View> | null>(null);
    const trackLayoutRef = useRef<{ pageX: number | null; width: number }>({
      pageX: null,
      width: 0,
    });
    const isWebDraggingRef = useRef(false);
    const gestureSeqRef = useRef(0);
    const lastEmittedValueRef = useRef(clampedValue);
    lastEmittedValueRef.current = clampedValue;

    const latestRef = useRef({
      clampedValue,
      disabled,
      hapticFeedback,
      onValueChange,
      safeMax,
      safeMin,
      safeRange,
      safeStep,
    });
    latestRef.current = {
      clampedValue,
      disabled,
      hapticFeedback,
      onValueChange,
      safeMax,
      safeMin,
      safeRange,
      safeStep,
    };

    const setComposedRef = useCallback(
      (node: ComponentRef<typeof View> | null) => {
        trackNodeRef.current = node;
        if (typeof forwardedRef === "function") {
          forwardedRef(node);
        } else if (forwardedRef) {
          forwardedRef.current = node;
        }
      },
      [forwardedRef],
    );

    const commitValue = useCallback((nextValue: number | null) => {
      const current = latestRef.current;
      if (current.disabled || nextValue === null || !Number.isFinite(nextValue)) {
        return;
      }
      if (nextValue === lastEmittedValueRef.current) {
        return;
      }
      lastEmittedValueRef.current = nextValue;

      if (
        current.hapticFeedback &&
        Platform.OS !== "web" &&
        typeof Haptics.impactAsync === "function"
      ) {
        void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
      }

      current.onValueChange(nextValue);
    }, []);

    const updateFromRelativeX = useCallback(
      (relativeX: number, widthOverride?: number) => {
        const current = latestRef.current;
        const width = widthOverride ?? trackLayoutRef.current.width;
        const next = projectRelativeX(
          relativeX,
          width,
          current.safeMin,
          current.safeMax,
          current.safeStep,
          current.clampedValue,
        );
        commitValue(next);
      },
      [commitValue],
    );

    const updateFromTouchEvent = useCallback(
      (
        event: GestureResponderEvent,
        gestureState?: PanResponderGestureState,
        measureFirst = false,
      ) => {
        if (latestRef.current.disabled) return;
        gestureSeqRef.current += 1;
        const capturedSeq = gestureSeqRef.current;
        const nativeEvent = event?.nativeEvent;
        const pageX =
          typeof nativeEvent?.pageX === "number" && Number.isFinite(nativeEvent.pageX)
            ? nativeEvent.pageX
            : typeof gestureState?.moveX === "number" && Number.isFinite(gestureState.moveX)
              ? gestureState.moveX
              : Number.NaN;
        const locationX =
          typeof nativeEvent?.locationX === "number" && Number.isFinite(nativeEvent.locationX)
            ? nativeEvent.locationX
            : Number.NaN;

        const projectWithCurrentMetrics = () => {
          const { pageX: trackPageX, width } = trackLayoutRef.current;
          if (width <= 0) return;

          if (trackPageX !== null && Number.isFinite(pageX)) {
            updateFromRelativeX(pageX - trackPageX, width);
          } else if (
            typeof trackNodeRef.current?.measureInWindow !== "function" &&
            Number.isFinite(pageX) &&
            !Number.isFinite(locationX)
          ) {
            updateFromRelativeX(pageX, width);
          } else if (Number.isFinite(locationX)) {
            updateFromRelativeX(locationX, width);
          }
        };

        if (measureFirst && typeof trackNodeRef.current?.measureInWindow === "function") {
          trackNodeRef.current.measureInWindow((x, _y, measuredWidth) => {
            if (Number.isFinite(measuredWidth) && measuredWidth > 0) {
              const resolvedPageX = Number.isFinite(x) ? x : 0;
              trackLayoutRef.current = {
                pageX: resolvedPageX,
                width: measuredWidth,
              };
              if (gestureSeqRef.current === capturedSeq) {
                if (Number.isFinite(pageX)) {
                  updateFromRelativeX(pageX - resolvedPageX, measuredWidth);
                } else if (Number.isFinite(locationX)) {
                  updateFromRelativeX(locationX, measuredWidth);
                }
              }
            }
          });
          return;
        }

        projectWithCurrentMetrics();
      },
      [updateFromRelativeX],
    );

    const panResponder = useMemo(
      () =>
        PanResponder.create({
          onStartShouldSetPanResponder: () => !latestRef.current.disabled,
          onStartShouldSetPanResponderCapture: () => !latestRef.current.disabled,
          onMoveShouldSetPanResponder: (_event, gestureState) => {
            if (latestRef.current.disabled) return false;
            const dx = Math.abs(gestureState?.dx ?? 0);
            const dy = Math.abs(gestureState?.dy ?? 0);
            return dx >= dy;
          },
          onMoveShouldSetPanResponderCapture: (_event, gestureState) => {
            if (latestRef.current.disabled) return false;
            const dx = Math.abs(gestureState?.dx ?? 0);
            const dy = Math.abs(gestureState?.dy ?? 0);
            return dx > dy;
          },
          onPanResponderTerminationRequest: () => false,
          onShouldBlockNativeResponder: () => true,
          onPanResponderGrant: (event, gestureState) => {
            updateFromTouchEvent(event, gestureState, true);
          },
          onPanResponderMove: (event, gestureState) => {
            updateFromTouchEvent(event, gestureState, false);
          },
        }),
      [updateFromTouchEvent],
    );

    const handleLayout = useCallback(
      (event: LayoutChangeEvent) => {
        const width = event.nativeEvent.layout.width;
        if (Number.isFinite(width) && width >= 0) {
          trackLayoutRef.current.width = width;
          setTrackWidth(width);
        }
        if (typeof trackNodeRef.current?.measureInWindow === "function") {
          trackNodeRef.current.measureInWindow((x, _y, measuredWidth) => {
            if (Number.isFinite(measuredWidth) && measuredWidth > 0) {
              trackLayoutRef.current = {
                pageX: Number.isFinite(x) ? x : 0,
                width: measuredWidth,
              };
            }
          });
        }
        onLayout?.(event);
      },
      [onLayout],
    );

    const handleAccessibilityAction = useCallback(
      (event: { nativeEvent: { actionName: string } }) => {
        const current = latestRef.current;
        if (current.disabled) return;
        if (event.nativeEvent.actionName === "increment") {
          commitValue(
            stepSliderUp(current.clampedValue, current.safeMin, current.safeMax, current.safeStep),
          );
        } else if (event.nativeEvent.actionName === "decrement") {
          commitValue(
            stepSliderDown(
              current.clampedValue,
              current.safeMin,
              current.safeMax,
              current.safeStep,
            ),
          );
        }
      },
      [commitValue],
    );

    const handleWebPointerDown = useCallback(
      (event: WebPointerEventLike) => {
        if (latestRef.current.disabled) return;
        const rect = event.currentTarget?.getBoundingClientRect?.();
        if (rect && Number.isFinite(rect.width) && rect.width > 0) {
          trackLayoutRef.current = { pageX: rect.left, width: rect.width };
        }
        if (typeof event.pointerId === "number") {
          try {
            event.currentTarget?.setPointerCapture?.(event.pointerId);
          } catch {
            // Ignore synthetic or detached pointer capture errors
          }
        }
        isWebDraggingRef.current = true;
        if (typeof event.clientX === "number" && Number.isFinite(event.clientX)) {
          const left = rect?.left ?? trackLayoutRef.current.pageX ?? 0;
          const width = rect?.width ?? trackLayoutRef.current.width;
          updateFromRelativeX(event.clientX - left, width);
        }
      },
      [updateFromRelativeX],
    );

    const handleWebPointerMove = useCallback(
      (event: WebPointerEventLike) => {
        if (!isWebDraggingRef.current || latestRef.current.disabled) return;
        const rect = event.currentTarget?.getBoundingClientRect?.();
        if (rect && Number.isFinite(rect.width) && rect.width > 0) {
          trackLayoutRef.current = { pageX: rect.left, width: rect.width };
        }
        if (typeof event.clientX === "number" && Number.isFinite(event.clientX)) {
          const left = rect?.left ?? trackLayoutRef.current.pageX ?? 0;
          const width = rect?.width ?? trackLayoutRef.current.width;
          updateFromRelativeX(event.clientX - left, width);
        }
      },
      [updateFromRelativeX],
    );

    const handleWebPointerUp = useCallback((event: WebPointerEventLike) => {
      const wasDragging = isWebDraggingRef.current;
      isWebDraggingRef.current = false;
      if (wasDragging && typeof event.pointerId === "number") {
        try {
          const target = event.currentTarget;
          if (!target?.hasPointerCapture || target.hasPointerCapture(event.pointerId)) {
            target?.releasePointerCapture?.(event.pointerId);
          }
        } catch {
          // Ignore NotFoundError if pointer capture was already released
        }
      }
    }, []);

    const handleWebLostPointerCapture = useCallback(() => {
      isWebDraggingRef.current = false;
    }, []);

    const handleWebKeyDown = useCallback(
      (event: WebKeyDownEventLike) => {
        const current = latestRef.current;
        if (current.disabled) return;

        const key = event.key;
        if (key === " " || key === "Enter") {
          event.preventDefault?.();
          return;
        }

        const rawPageStep = current.safeRange * 0.1;
        const pageStep = Math.max(
          current.safeStep,
          Math.round(rawPageStep / current.safeStep) * current.safeStep,
        );

        let nextValue: number | null = null;
        if (key === "ArrowRight" || key === "ArrowUp") {
          nextValue = stepSliderUp(
            current.clampedValue,
            current.safeMin,
            current.safeMax,
            current.safeStep,
          );
        } else if (key === "ArrowLeft" || key === "ArrowDown") {
          nextValue = stepSliderDown(
            current.clampedValue,
            current.safeMin,
            current.safeMax,
            current.safeStep,
          );
        } else if (key === "PageUp") {
          nextValue = snapSliderValue(
            current.clampedValue + pageStep,
            current.safeMin,
            current.safeMax,
            current.safeStep,
            current.clampedValue,
          );
        } else if (key === "PageDown") {
          nextValue = snapSliderValue(
            current.clampedValue - pageStep,
            current.safeMin,
            current.safeMax,
            current.safeStep,
            current.clampedValue,
          );
        } else if (key === "Home") {
          nextValue = current.safeMin;
        } else if (key === "End") {
          nextValue = current.safeMax;
        }

        if (nextValue !== null) {
          event.preventDefault?.();
          commitValue(nextValue);
        }
      },
      [commitValue],
    );

    const usableSpan = Math.max(0, trackWidth - THUMB_SIZE);
    const thumbLeft = trackWidth > THUMB_SIZE ? ratio * usableSpan : 0;
    const rangeStyle =
      trackWidth > THUMB_SIZE
        ? {
            width: ratio === 0 ? 0 : ratio === 1 ? trackWidth : thumbLeft + THUMB_RADIUS,
          }
        : { width: `${ratio * 100}%` as const };

    const webInteractionProps =
      Platform.OS === "web"
        ? ({
            tabIndex: disabled ? -1 : 0,
            role: "slider",
            "aria-label": accessibilityLabel,
            "aria-valuemin": safeMin,
            "aria-valuemax": safeMax,
            "aria-valuenow": clampedValue,
            "aria-disabled": disabled,
            onPointerDown: handleWebPointerDown,
            onPointerMove: handleWebPointerMove,
            onPointerUp: handleWebPointerUp,
            onPointerCancel: handleWebPointerUp,
            onLostPointerCapture: handleWebLostPointerCapture,
            onKeyDown: handleWebKeyDown,
          } as Record<string, unknown>)
        : panResponder.panHandlers;

    return (
      <View
        ref={setComposedRef}
        testID={testID}
        accessible
        accessibilityRole="adjustable"
        accessibilityLabel={accessibilityLabel}
        accessibilityState={{ disabled }}
        accessibilityValue={{ min: safeMin, max: safeMax, now: clampedValue }}
        accessibilityActions={[{ name: "increment" }, { name: "decrement" }]}
        onAccessibilityAction={handleAccessibilityAction}
        onLayout={handleLayout}
        className={cn("min-h-11 justify-center select-none", disabled && "opacity-50", className)}
        {...webInteractionProps}
        {...props}
      >
        <View
          testID={testID ? `${testID}-track` : undefined}
          pointerEvents="none"
          className={cn(
            "bg-surface-container-high border-outline h-2.5 w-full overflow-hidden",
            radiusClass,
            trackBorderClass,
            trackClassName,
          )}
        >
          <View
            testID={testID ? `${testID}-range` : undefined}
            pointerEvents="none"
            className={cn("bg-primary h-full", radiusClass, rangeClassName)}
            style={rangeStyle}
          />
        </View>
        <View
          testID={testID ? `${testID}-thumb` : undefined}
          pointerEvents="none"
          className={cn(
            "border-primary bg-surface-container-lowest absolute h-5 w-5 border-2",
            radiusClass,
            thumbClassName,
          )}
          style={{ left: thumbLeft }}
        />
      </View>
    );
  },
);

Slider.displayName = "Slider";
