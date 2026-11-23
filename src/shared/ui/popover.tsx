import * as PopoverPrimitive from "@rn-primitives/popover";
import { forwardRef, type ReactNode } from "react";
import { StyleSheet, View } from "react-native";
import { DEFAULT_THEME_PRESET, getThemeElevation } from "@/shared/lib/theme/presets";
import { cn } from "@/shared/lib/utils";
import { Text, TextClassContext } from "@/shared/ui/text";
import { useOptionalTheme } from "@/shared/ui/theme-provider";

export const Popover = PopoverPrimitive.Root;
export const PopoverTrigger = PopoverPrimitive.Trigger;
export const PopoverClose = PopoverPrimitive.Close;

export interface PopoverContentProps extends Omit<PopoverPrimitive.ContentProps, "children"> {
  className?: string;
  portalHost?: string;
  children?: ReactNode;
}

export const PopoverContent = forwardRef<PopoverPrimitive.ContentRef, PopoverContentProps>(
  ({ className, style, align = "center", sideOffset = 6, portalHost, children, ...props }, ref) => {
    const theme = useOptionalTheme();
    const preset = theme?.preset ?? DEFAULT_THEME_PRESET;
    const resolvedScheme = theme?.resolvedColorScheme ?? "light";
    const elevation = getThemeElevation(preset, resolvedScheme);

    return (
      <PopoverPrimitive.Portal hostName={portalHost}>
        <PopoverPrimitive.Overlay style={StyleSheet.absoluteFill} className="bg-foreground/15">
          <View className="flex-1 items-center justify-center p-4">
            <TextClassContext.Provider value="text-body-sm text-popover-foreground">
              <PopoverPrimitive.Content
                ref={ref}
                align={align}
                sideOffset={sideOffset}
                className={cn(
                  "border-outline-variant bg-popover z-50 w-72 rounded-xl border p-4",
                  className,
                )}
                style={StyleSheet.flatten([{ boxShadow: elevation.boxShadow }, style])}
                {...props}
              >
                {typeof children === "string" || typeof children === "number" ? (
                  <Text>{children}</Text>
                ) : (
                  children
                )}
              </PopoverPrimitive.Content>
            </TextClassContext.Provider>
          </View>
        </PopoverPrimitive.Overlay>
      </PopoverPrimitive.Portal>
    );
  },
);

PopoverContent.displayName = "PopoverContent";
