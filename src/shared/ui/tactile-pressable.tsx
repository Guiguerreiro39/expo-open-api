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
import { cn, resolvePresetBorderOverride } from "@/shared/lib/utils";
import { useOptionalTheme } from "@/shared/ui/theme-provider";

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);
cssInterop(AnimatedPressable, { className: "style" });

const TACTILE_SPRING_CONFIG = {
  damping: 12,
  stiffness: 300,
} as const;

const BOX_SHADOW_OFFSET_REGEX = /^(-?\d+(?:\.\d+)?)px\s+(-?\d+(?:\.\d+)?)px\s+(.+)$/;

interface ParsedBoxShadow {
  readonly offsetX: number;
  readonly offsetY: number;
  readonly tail: string;
}

function parseBoxShadow(boxShadow: string): ParsedBoxShadow | null {
  const match = boxShadow.trim().match(BOX_SHADOW_OFFSET_REGEX);
  if (!match?.[1] || !match[2] || !match[3]) {
    return null;
  }
  return {
    offsetX: Number(match[1]),
    offsetY: Number(match[2]),
    tail: match[3],
  };
}

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
    const parsedShadow = parseBoxShadow(elevation.boxShadow);
    const pressX = presetDef.pressTranslate.x;
    const pressY = presetDef.pressTranslate.y;
    const shadowOffsetX = parsedShadow?.offsetX ?? 0;
    const shadowOffsetY = parsedShadow?.offsetY ?? 0;
    const shadowTail = parsedShadow?.tail ?? "";
    const fallbackBoxShadow = elevation.boxShadow;
    const hasParsedShadow = parsedShadow !== null;

    const pressProgress = useSharedValue(0);

    const animatedStyle = useAnimatedStyle(() => {
      const progress = pressProgress.value;
      const transform = [{ translateX: progress * pressX }, { translateY: progress * pressY }];

      if (!elevated) {
        return { transform };
      }

      if (!hasParsedShadow) {
        return {
          transform,
          boxShadow: fallbackBoxShadow,
        };
      }

      const shadowFactor = Math.max(0, 1 - progress);
      const currentX = Math.round(shadowOffsetX * shadowFactor * 100) / 100;
      const currentY = Math.round(shadowOffsetY * shadowFactor * 100) / 100;

      return {
        transform,
        boxShadow: `${currentX}px ${currentY}px ${shadowTail}`,
      };
    }, [
      elevated,
      fallbackBoxShadow,
      hasParsedShadow,
      pressX,
      pressY,
      shadowOffsetX,
      shadowOffsetY,
      shadowTail,
    ]);

    const handlePressIn = useCallback(
      (event: GestureResponderEvent) => {
        if (!disabled) {
          pressProgress.value = withSpring(1, TACTILE_SPRING_CONFIG);

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
      [disabled, hapticFeedback, onPressIn, pressProgress],
    );

    const handlePressOut = useCallback(
      (event: GestureResponderEvent) => {
        pressProgress.value = withSpring(0, TACTILE_SPRING_CONFIG);
        onPressOut?.(event);
      },
      [onPressOut, pressProgress],
    );

    const enforcedBorderClass = resolvePresetBorderOverride(className, elevation.borderWidth, {
      applyDefault: elevated,
    });

    return (
      <AnimatedPressable
        ref={ref}
        disabled={disabled}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        className={cn(className, enforcedBorderClass, disabled && "opacity-50")}
        style={[animatedStyle, style]}
        {...props}
      />
    );
  },
);

TactilePressable.displayName = "TactilePressable";
