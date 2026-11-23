import { forwardRef, useCallback, useState } from "react";
import {
  type GestureResponderEvent,
  type LayoutChangeEvent,
  Pressable,
  View,
  type ViewProps,
} from "react-native";
import { cn } from "@/shared/lib/utils";

export interface SliderProps extends Omit<ViewProps, "children"> {
  value: number;
  onValueChange: (value: number) => void;
  min?: number;
  max?: number;
  step?: number;
  disabled?: boolean;
  className?: string;
  trackClassName?: string;
  rangeClassName?: string;
  thumbClassName?: string;
  accessibilityLabel?: string;
}

export const Slider = forwardRef<View, SliderProps>(
  (
    {
      value,
      onValueChange,
      min = 0,
      max = 100,
      step = 1,
      disabled = false,
      className,
      trackClassName,
      rangeClassName,
      thumbClassName,
      accessibilityLabel = "Slider",
      ...props
    },
    ref,
  ) => {
    const [trackWidth, setTrackWidth] = useState(0);
    const safeRange = max > min ? max - min : 1;
    const clampedValue = Math.min(max, Math.max(min, value));
    const percentage = ((clampedValue - min) / safeRange) * 100;

    const handleLayout = useCallback((event: LayoutChangeEvent) => {
      setTrackWidth(event.nativeEvent.layout.width);
    }, []);

    const snapValue = useCallback(
      (raw: number) => {
        const stepped = Math.round((raw - min) / step) * step + min;
        return Math.min(max, Math.max(min, stepped));
      },
      [max, min, step],
    );

    const handlePress = useCallback(
      (event: GestureResponderEvent) => {
        if (disabled || trackWidth <= 0) return;
        const ratio = Math.min(1, Math.max(0, event.nativeEvent.locationX / trackWidth));
        onValueChange(snapValue(min + ratio * safeRange));
      },
      [disabled, min, onValueChange, safeRange, snapValue, trackWidth],
    );

    const handleAccessibilityAction = useCallback(
      (event: { nativeEvent: { actionName: string } }) => {
        if (disabled) return;
        if (event.nativeEvent.actionName === "increment") {
          onValueChange(snapValue(clampedValue + step));
        } else if (event.nativeEvent.actionName === "decrement") {
          onValueChange(snapValue(clampedValue - step));
        }
      },
      [clampedValue, disabled, onValueChange, snapValue, step],
    );

    return (
      <View
        ref={ref}
        accessible
        accessibilityRole="adjustable"
        accessibilityLabel={accessibilityLabel}
        accessibilityValue={{ min, max, now: clampedValue }}
        accessibilityActions={[{ name: "increment" }, { name: "decrement" }]}
        onAccessibilityAction={handleAccessibilityAction}
        className={cn("h-9 justify-center", disabled && "opacity-50", className)}
        {...props}
      >
        <Pressable
          disabled={disabled}
          onLayout={handleLayout}
          onPress={handlePress}
          className="h-9 justify-center"
        >
          <View
            className={cn(
              "bg-surface-container-high border-outline-variant h-2.5 w-full overflow-hidden rounded-full border",
              trackClassName,
            )}
          >
            <View
              className={cn("bg-primary h-full rounded-full", rangeClassName)}
              style={{ width: `${percentage}%` }}
            />
          </View>
          <View
            pointerEvents="none"
            className={cn(
              "border-primary bg-surface-container-lowest absolute h-5 w-5 -translate-x-2.5 rounded-full border-2",
              thumbClassName,
            )}
            style={{ left: `${percentage}%` }}
          />
        </Pressable>
      </View>
    );
  },
);

Slider.displayName = "Slider";
