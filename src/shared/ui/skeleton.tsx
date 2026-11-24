import { type ComponentRef, forwardRef, useEffect } from "react";
import type { StyleProp, View, ViewProps, ViewStyle } from "react-native";
import Animated, {
  cancelAnimation,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from "react-native-reanimated";
import { DEFAULT_THEME_PRESET, type ThemePreset } from "@/shared/lib/theme/presets";
import { cn } from "@/shared/lib/utils";
import { useOptionalTheme } from "@/shared/ui/theme-provider";

const PRESET_SKELETON_RADIUS: Record<ThemePreset, string> = {
  "warm-tactile": "rounded-lg",
  "editorial-slate": "rounded-lg",
  "neo-brutalist": "rounded-sm",
};

export interface SkeletonProps extends Omit<ViewProps, "style"> {
  className?: string;
  style?: StyleProp<ViewStyle>;
  animate?: boolean;
}

export const Skeleton = forwardRef<ComponentRef<typeof View>, SkeletonProps>(
  ({ className, style, animate = true, ...props }, ref) => {
    const theme = useOptionalTheme();
    const preset = theme?.preset ?? DEFAULT_THEME_PRESET;
    const opacity = useSharedValue(1);

    useEffect(() => {
      if (!animate) {
        cancelAnimation(opacity);
        opacity.value = 1;
        return;
      }

      opacity.value = withRepeat(
        withSequence(withTiming(0.45, { duration: 750 }), withTiming(1, { duration: 750 })),
        -1,
        false,
      );

      return () => {
        cancelAnimation(opacity);
      };
    }, [animate, opacity]);

    const animatedStyle = useAnimatedStyle(() => ({
      opacity: opacity.value,
    }));

    return (
      <Animated.View
        ref={ref}
        className={cn("bg-surface-container-high", PRESET_SKELETON_RADIUS[preset], className)}
        style={[animatedStyle, style]}
        {...props}
      />
    );
  },
);

Skeleton.displayName = "Skeleton";
