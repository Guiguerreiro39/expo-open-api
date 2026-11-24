import * as Haptics from "expo-haptics";
import { cssInterop } from "nativewind";
import { type ComponentRef, forwardRef, useCallback } from "react";
import {
  type GestureResponderEvent,
  Platform,
  Pressable,
  type PressableProps,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from "react-native-reanimated";
import { DEFAULT_THEME_PRESET, getThemeElevation, THEME_PRESETS } from "@/shared/lib/theme/presets";
import { cn } from "@/shared/lib/utils";
import { useOptionalTheme } from "@/shared/ui/theme-provider";

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);
cssInterop(AnimatedPressable, { className: "style" });

const TACTILE_SPRING_CONFIG = {
  damping: 12,
  stiffness: 300,
} as const;

export interface TactilePressableProps extends Omit<PressableProps, "style"> {
  className?: string;
  style?: StyleProp<ViewStyle>;
  elevated?: boolean;
  hapticFeedback?: boolean;
}

export const TactilePressable = forwardRef<ComponentRef<typeof Pressable>, TactilePressableProps>(
  (
    {
      className,
      style,
      elevated = true,
      hapticFeedback = true,
      disabled,
      onPressIn,
      onPressOut,
      ...props
    },
    ref,
  ) => {
    const theme = useOptionalTheme();
    const presetId = theme?.preset ?? DEFAULT_THEME_PRESET;
    const resolvedScheme = theme?.resolvedColorScheme ?? "light";
    const presetDef = THEME_PRESETS[presetId];
    const elevation = getThemeElevation(presetId, resolvedScheme);

    const translateX = useSharedValue(0);
    const translateY = useSharedValue(0);

    const animatedStyle = useAnimatedStyle(() => ({
      transform: [{ translateX: translateX.value }, { translateY: translateY.value }],
    }));

    const handlePressIn = useCallback(
      (event: GestureResponderEvent) => {
        if (!disabled) {
          translateX.value = withSpring(presetDef.pressTranslate.x, TACTILE_SPRING_CONFIG);
          translateY.value = withSpring(presetDef.pressTranslate.y, TACTILE_SPRING_CONFIG);

          if (
            hapticFeedback &&
            Platform.OS !== "web" &&
            typeof Haptics.impactAsync === "function"
          ) {
            void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
          }
        }
        onPressIn?.(event);
      },
      [
        disabled,
        hapticFeedback,
        onPressIn,
        presetDef.pressTranslate.x,
        presetDef.pressTranslate.y,
        translateX,
        translateY,
      ],
    );

    const handlePressOut = useCallback(
      (event: GestureResponderEvent) => {
        translateX.value = withSpring(0, TACTILE_SPRING_CONFIG);
        translateY.value = withSpring(0, TACTILE_SPRING_CONFIG);
        onPressOut?.(event);
      },
      [onPressOut, translateX, translateY],
    );

    const elevationStyle: ViewStyle | undefined = elevated
      ? {
          boxShadow: elevation.boxShadow,
        }
      : undefined;

    const borderClass = elevated ? (elevation.borderWidth >= 2 ? "border-2" : "border") : undefined;

    return (
      <AnimatedPressable
        ref={ref}
        disabled={disabled}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        className={cn(borderClass, disabled && "opacity-50", className)}
        style={[elevationStyle, animatedStyle, style]}
        {...props}
      />
    );
  },
);

TactilePressable.displayName = "TactilePressable";
