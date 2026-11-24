import * as PopoverPrimitive from "@rn-primitives/popover";
import { forwardRef, type ReactNode } from "react";
import { StyleSheet } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  DEFAULT_THEME_PRESET,
  getThemeElevation,
  type ThemePreset,
} from "@/shared/lib/theme/presets";
import { cn } from "@/shared/lib/utils";
import { Text, TextClassContext } from "@/shared/ui/text";
import { useOptionalTheme } from "@/shared/ui/theme-provider";
import { getOverlayFillStyle, getWebClickGuardProps } from "@/shared/ui/web-overlay";

const PRESET_POPOVER_RADIUS: Record<ThemePreset, string> = {
  "warm-tactile": "rounded-xl",
  "editorial-slate": "rounded-lg",
  "neo-brutalist": "rounded-sm",
};

export const Popover = PopoverPrimitive.Root;

export const PopoverTrigger = forwardRef<
  PopoverPrimitive.TriggerRef,
  PopoverPrimitive.TriggerProps
>((props, ref) => {
  const webProps = getWebClickGuardProps(props);

  return <PopoverPrimitive.Trigger ref={ref} {...props} {...webProps} />;
});

PopoverTrigger.displayName = "PopoverTrigger";

export const PopoverClose = forwardRef<PopoverPrimitive.CloseRef, PopoverPrimitive.CloseProps>(
  (props, ref) => {
    const webProps = getWebClickGuardProps(props);

    return <PopoverPrimitive.Close ref={ref} {...props} {...webProps} />;
  },
);

PopoverClose.displayName = "PopoverClose";

export interface PopoverContentProps extends Omit<PopoverPrimitive.ContentProps, "children"> {
  className?: string;
  portalHost?: string;
  children?: ReactNode;
}

export const PopoverContent = forwardRef<PopoverPrimitive.ContentRef, PopoverContentProps>(
  (
    {
      className,
      style,
      align = "center",
      sideOffset = 6,
      insets: insetsProp,
      portalHost,
      children,
      ...props
    },
    ref,
  ) => {
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

    return (
      <PopoverPrimitive.Portal hostName={portalHost}>
        <PopoverPrimitive.Overlay
          testID="popover-overlay"
          style={getOverlayFillStyle()}
          className="bg-scrim/20 web:fixed web:inset-0 z-50"
        >
          <TextClassContext.Provider value="text-body-sm text-popover-foreground">
            <PopoverPrimitive.Content
              ref={ref}
              align={align}
              sideOffset={sideOffset}
              insets={contentInsets}
              className={cn(
                PRESET_POPOVER_RADIUS[preset],
                borderClass,
                "border-outline-variant bg-popover z-50 w-72 p-4",
                className,
              )}
              style={StyleSheet.flatten([{ boxShadow: elevation.boxShadow }, style]) ?? undefined}
              {...props}
            >
              {typeof children === "string" || typeof children === "number" ? (
                <Text>{children}</Text>
              ) : (
                children
              )}
            </PopoverPrimitive.Content>
          </TextClassContext.Provider>
        </PopoverPrimitive.Overlay>
      </PopoverPrimitive.Portal>
    );
  },
);

PopoverContent.displayName = "PopoverContent";
