import { type ComponentRef, forwardRef, useEffect } from "react";
import type { StyleProp, View, ViewProps, ViewStyle } from "react-native";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from "react-native-reanimated";
import { cn } from "@/shared/lib/utils";

export interface SkeletonProps extends Omit<ViewProps, "style"> {
  className?: string;
  style?: StyleProp<ViewStyle>;
  animate?: boolean;
}

export const Skeleton = forwardRef<ComponentRef<typeof View>, SkeletonProps>(
  ({ className, style, animate = true, ...props }, ref) => {
    const opacity = useSharedValue(1);

    useEffect(() => {
      if (!animate) {
        opacity.value = 1;
        return;
      }

      opacity.value = withRepeat(
        withSequence(withTiming(0.45, { duration: 750 }), withTiming(1, { duration: 750 })),
        -1,
        false,
      );
    }, [animate, opacity]);

    const animatedStyle = useAnimatedStyle(() => ({
      opacity: opacity.value,
    }));

    return (
      <Animated.View
        ref={ref}
        className={cn("bg-surface-container-high rounded-lg", className)}
        style={[animatedStyle, style]}
        {...props}
      />
    );
  },
);

Skeleton.displayName = "Skeleton";
