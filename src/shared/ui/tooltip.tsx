import * as TooltipPrimitive from "@rn-primitives/tooltip";
import { forwardRef, type ReactNode } from "react";
import { Platform, StyleSheet } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  DEFAULT_THEME_PRESET,
  getThemeElevation,
  type ThemePreset,
} from "@/shared/lib/theme/presets";
import { cn } from "@/shared/lib/utils";
import { Text, TextClassContext } from "@/shared/ui/text";
import { useOptionalTheme } from "@/shared/ui/theme-provider";

const PRESET_TOOLTIP_RADIUS: Record<ThemePreset, string> = {
  "warm-tactile": "rounded-lg",
  "editorial-slate": "rounded-md",
  "neo-brutalist": "rounded-sm",
};

export const Tooltip = TooltipPrimitive.Root;
export const TooltipTrigger = TooltipPrimitive.Trigger;

export interface TooltipContentProps extends Omit<TooltipPrimitive.ContentProps, "children"> {
  className?: string;
  portalHost?: string;
  children?: ReactNode;
}

export const TooltipContent = forwardRef<TooltipPrimitive.ContentRef, TooltipContentProps>(
  ({ className, sideOffset = 6, insets: insetsProp, portalHost, children, ...props }, ref) => {
    const safeInsets = useSafeAreaInsets();
    const theme = useOptionalTheme();
    const preset = theme?.preset ?? DEFAULT_THEME_PRESET;
    const resolvedScheme = theme?.resolvedColorScheme ?? "light";
    const elevation = getThemeElevation(preset, resolvedScheme);
    const borderClass = elevation.borderWidth >= 2 ? "border-2" : "border";

    const contentInsets = insetsProp ?? {
      top: safeInsets.top + 8,
      bottom: safeInsets.bottom + 8,
      left: safeInsets.left + 12,
      right: safeInsets.right + 12,
    };

    const content = (
      <TextClassContext.Provider value="text-label-md text-inverse-on-surface">
        <TooltipPrimitive.Content
          ref={ref}
          sideOffset={sideOffset}
          insets={contentInsets}
          className={cn(
            PRESET_TOOLTIP_RADIUS[preset],
            borderClass,
            "bg-inverse-surface border-outline-variant z-50 px-3 py-1.5",
            className,
          )}
          {...props}
        >
          {typeof children === "string" || typeof children === "number" ? (
            <Text>{children}</Text>
          ) : (
            children
          )}
        </TooltipPrimitive.Content>
      </TextClassContext.Provider>
    );

    return (
      <TooltipPrimitive.Portal hostName={portalHost}>
        {Platform.OS === "web" ? (
          content
        ) : (
          <TooltipPrimitive.Overlay testID="tooltip-overlay" style={StyleSheet.absoluteFill}>
            {content}
          </TooltipPrimitive.Overlay>
        )}
      </TooltipPrimitive.Portal>
    );
  },
);

TooltipContent.displayName = "TooltipContent";
