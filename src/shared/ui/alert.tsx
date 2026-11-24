import { cva, type VariantProps } from "class-variance-authority";
import { type ComponentRef, forwardRef } from "react";
import { View, type ViewProps } from "react-native";
import {
  DEFAULT_THEME_PRESET,
  getThemeElevation,
  type ThemePreset,
} from "@/shared/lib/theme/presets";
import { cn } from "@/shared/lib/utils";
import { Text, TextClassContext, type TextProps } from "@/shared/ui/text";
import { useOptionalTheme } from "@/shared/ui/theme-provider";

const PRESET_ALERT_RADIUS: Record<ThemePreset, string> = {
  "warm-tactile": "rounded-xl",
  "editorial-slate": "rounded-lg",
  "neo-brutalist": "rounded-sm",
};

export const alertVariants = cva("w-full flex-col gap-1 rounded-xl border p-4", {
  variants: {
    variant: {
      default: "border-outline-variant bg-surface-container-low",
      destructive: "border-destructive bg-destructive-container",
      success: "border-success bg-success-container",
      warning: "border-warning bg-warning-container",
      info: "border-info bg-info-container",
    },
  },
  defaultVariants: {
    variant: "default",
  },
});

const alertTextVariants = cva("text-body-sm", {
  variants: {
    variant: {
      default: "text-foreground",
      destructive: "text-on-destructive-container",
      success: "text-on-success-container",
      warning: "text-on-warning-container",
      info: "text-on-info-container",
    },
  },
  defaultVariants: {
    variant: "default",
  },
});

export interface AlertProps extends ViewProps, VariantProps<typeof alertVariants> {
  className?: string;
}

export const Alert = forwardRef<ComponentRef<typeof View>, AlertProps>(
  ({ className, variant = "default", ...props }, ref) => {
    const theme = useOptionalTheme();
    const preset = theme?.preset ?? DEFAULT_THEME_PRESET;
    const resolvedScheme = theme?.resolvedColorScheme ?? "light";
    const elevation = getThemeElevation(preset, resolvedScheme);
    const borderClass = elevation.borderWidth >= 2 ? "border-2" : "border";

    return (
      <TextClassContext.Provider value={alertTextVariants({ variant })}>
        <View
          ref={ref}
          accessibilityRole="alert"
          className={cn(
            alertVariants({ variant }),
            PRESET_ALERT_RADIUS[preset],
            borderClass,
            className,
          )}
          {...props}
        />
      </TextClassContext.Provider>
    );
  },
);

Alert.displayName = "Alert";

export const AlertTitle = forwardRef<React.ComponentRef<typeof Text>, TextProps>(
  ({ className, ...props }, ref) => (
    <Text ref={ref} variant="label" className={cn("font-bold", className)} {...props} />
  ),
);

AlertTitle.displayName = "AlertTitle";

export const AlertDescription = forwardRef<React.ComponentRef<typeof Text>, TextProps>(
  ({ className, ...props }, ref) => (
    <Text ref={ref} variant="default" className={cn("text-body-sm", className)} {...props} />
  ),
);

AlertDescription.displayName = "AlertDescription";
