import * as DialogPrimitive from "@rn-primitives/dialog";
import { X } from "lucide-react-native";
import { forwardRef, type ReactNode, useEffect, useMemo, useRef, useState } from "react";
import { PanResponder, View, type ViewProps } from "react-native";
import Animated, {
  cancelAnimation,
  SlideInDown,
  SlideOutDown,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  DEFAULT_THEME_PRESET,
  getThemeElevation,
  type ThemePreset,
} from "@/shared/lib/theme/presets";
import { cn } from "@/shared/lib/utils";
import { Icon } from "@/shared/ui/icon";
import { useOptionalTheme } from "@/shared/ui/theme-provider";
import { getOverlayFillStyle, getWebClickGuardProps } from "@/shared/ui/web-overlay";

const PRESET_SHEET_TOP_RADIUS: Record<ThemePreset, string> = {
  "warm-tactile": "rounded-t-3xl",
  "editorial-slate": "rounded-t-2xl",
  "neo-brutalist": "rounded-t-sm",
};

const PRESET_CLOSE_RADIUS: Record<ThemePreset, string> = {
  "warm-tactile": "rounded-lg",
  "editorial-slate": "rounded-md",
  "neo-brutalist": "rounded-sm",
};

const SWIPE_DISMISS_THRESHOLD = 80;
const SWIPE_DISMISS_VELOCITY = 0.6;
const SHEET_DISMISS_DISTANCE = 360;

/**
 * Bottom-slide Sheet built on headless `@rn-primitives/dialog` (per ADR-0007 and ADR-0014 — zero extra native deps).
 */
export const Sheet = DialogPrimitive.Root;
export const SheetPortal = DialogPrimitive.Portal;

export const SheetTrigger = forwardRef<DialogPrimitive.TriggerRef, DialogPrimitive.TriggerProps>(
  (props, ref) => {
    const webProps = getWebClickGuardProps(props);

    return <DialogPrimitive.Trigger ref={ref} {...props} {...webProps} />;
  },
);

SheetTrigger.displayName = "SheetTrigger";

export const SheetClose = forwardRef<DialogPrimitive.CloseRef, DialogPrimitive.CloseProps>(
  (props, ref) => {
    const webProps = getWebClickGuardProps(props);

    return <DialogPrimitive.Close ref={ref} {...props} {...webProps} />;
  },
);

SheetClose.displayName = "SheetClose";

export interface SheetContentProps extends Omit<DialogPrimitive.ContentProps, "children"> {
  className?: string;
  portalHost?: string;
  showHandle?: boolean;
  showCloseButton?: boolean;
  children?: ReactNode;
}

export const SheetContent = forwardRef<DialogPrimitive.ContentRef, SheetContentProps>(
  (
    { className, style, children, portalHost, showHandle = true, showCloseButton = true, ...props },
    ref,
  ) => {
    const insets = useSafeAreaInsets();
    const theme = useOptionalTheme();
    const preset = theme?.preset ?? DEFAULT_THEME_PRESET;
    const resolvedScheme = theme?.resolvedColorScheme ?? "light";
    const elevation = getThemeElevation(preset, resolvedScheme);
    const borderClass = elevation.borderWidth >= 2 ? "border-x-2 border-t-2" : "border-x border-t";
    const { open, onOpenChange } = DialogPrimitive.useRootContext();

    const onOpenChangeRef = useRef(onOpenChange);
    onOpenChangeRef.current = onOpenChange;

    const dragY = useSharedValue(0);
    const [pendingSwipeDismiss, setPendingSwipeDismiss] = useState(false);

    useEffect(() => {
      if (open) {
        dragY.value = 0;
      }
      return () => {
        cancelAnimation(dragY);
      };
    }, [open, dragY]);

    useEffect(() => {
      if (open && pendingSwipeDismiss) {
        dragY.value = withSpring(0, { damping: 20, stiffness: 260 });
        setPendingSwipeDismiss(false);
      }
    }, [open, pendingSwipeDismiss, dragY]);

    const animatedDragStyle = useAnimatedStyle(() => ({
      transform: [{ translateY: dragY.value }],
    }));

    const panResponder = useMemo(
      () =>
        PanResponder.create({
          onStartShouldSetPanResponder: () => true,
          onMoveShouldSetPanResponder: (_event, gestureState) => gestureState.dy > 4,
          onPanResponderMove: (_event, gestureState) => {
            dragY.value = Math.max(0, gestureState.dy);
          },
          onPanResponderRelease: (_event, gestureState) => {
            if (
              gestureState.dy >= SWIPE_DISMISS_THRESHOLD ||
              gestureState.vy >= SWIPE_DISMISS_VELOCITY
            ) {
              dragY.value = withTiming(SHEET_DISMISS_DISTANCE, { duration: 180 });
              onOpenChangeRef.current(false);
              setPendingSwipeDismiss(true);
            } else {
              dragY.value = withSpring(0, { damping: 20, stiffness: 260 });
            }
          },
          onPanResponderTerminate: () => {
            dragY.value = withSpring(0, { damping: 20, stiffness: 260 });
          },
        }),
      [dragY],
    );

    const paddingBottom = Math.max(insets.bottom, 16) + 12;

    return (
      <SheetPortal hostName={portalHost}>
        <DialogPrimitive.Overlay
          testID="sheet-overlay"
          style={getOverlayFillStyle()}
          className="bg-scrim/50 web:fixed web:inset-0 z-50 flex justify-end"
        >
          <Animated.View
            entering={SlideInDown.duration(240)}
            exiting={SlideOutDown.duration(180)}
            style={animatedDragStyle}
            className="w-full"
          >
            <DialogPrimitive.Content
              ref={ref}
              className={cn(
                PRESET_SHEET_TOP_RADIUS[preset],
                borderClass,
                "border-outline-variant bg-surface-container-highest web:max-w-full relative w-full gap-4 px-6 pt-3",
                className,
              )}
              style={[{ boxShadow: elevation.boxShadow, paddingBottom }, style]}
              {...props}
            >
              {showHandle ? (
                <View
                  testID="sheet-grab-handle"
                  accessibilityLabel="Drag down to close sheet"
                  className="-mt-1 items-center py-2"
                  {...panResponder.panHandlers}
                >
                  <View className="bg-outline-variant h-1.5 w-12 rounded-full" />
                </View>
              ) : null}
              {children}
              {showCloseButton ? (
                <SheetClose
                  accessibilityLabel="Close sheet"
                  hitSlop={8}
                  className={cn(
                    PRESET_CLOSE_RADIUS[preset],
                    "bg-surface-container absolute top-4 right-4 p-1.5",
                  )}
                >
                  <Icon as={X} size={16} className="text-on-surface-variant" />
                </SheetClose>
              ) : null}
            </DialogPrimitive.Content>
          </Animated.View>
        </DialogPrimitive.Overlay>
      </SheetPortal>
    );
  },
);

SheetContent.displayName = "SheetContent";

export function SheetHeader({ className, ...props }: ViewProps & { className?: string }) {
  return <View className={cn("flex-col gap-1.5 pr-8", className)} {...props} />;
}

export function SheetFooter({ className, ...props }: ViewProps & { className?: string }) {
  return <View className={cn("flex-row items-center justify-end gap-2", className)} {...props} />;
}

export interface SheetTitleProps extends DialogPrimitive.TitleProps {
  className?: string;
}

export const SheetTitle = forwardRef<DialogPrimitive.TitleRef, SheetTitleProps>(
  ({ className, ...props }, ref) => (
    <DialogPrimitive.Title
      ref={ref}
      className={cn("text-title-md text-foreground font-sans-bold", className)}
      {...props}
    />
  ),
);

SheetTitle.displayName = "SheetTitle";

export interface SheetDescriptionProps extends DialogPrimitive.DescriptionProps {
  className?: string;
}

export const SheetDescription = forwardRef<DialogPrimitive.DescriptionRef, SheetDescriptionProps>(
  ({ className, ...props }, ref) => (
    <DialogPrimitive.Description
      ref={ref}
      className={cn("text-body-sm text-on-surface-variant font-sans", className)}
      {...props}
    />
  ),
);

SheetDescription.displayName = "SheetDescription";
