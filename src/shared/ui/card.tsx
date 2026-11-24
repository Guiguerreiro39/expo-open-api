import { forwardRef } from "react";
import { View, type ViewProps } from "react-native";
import {
  DEFAULT_THEME_PRESET,
  getThemeElevation,
  type ThemePreset,
} from "@/shared/lib/theme/presets";
import { cn } from "@/shared/lib/utils";
import { Text, TextClassContext, type TextProps } from "@/shared/ui/text";
import { useOptionalTheme } from "@/shared/ui/theme-provider";

const PRESET_CARD_RADIUS: Record<ThemePreset, string> = {
  "warm-tactile": "rounded-2xl",
  "editorial-slate": "rounded-xl",
  "neo-brutalist": "rounded-sm",
};

export interface CardProps extends ViewProps {
  className?: string;
  elevated?: boolean;
}

export const Card = forwardRef<View, CardProps>(
  ({ className, style, elevated = true, ...props }, ref) => {
    const theme = useOptionalTheme();
    const preset = theme?.preset ?? DEFAULT_THEME_PRESET;
    const resolvedScheme = theme?.resolvedColorScheme ?? "light";
    const elevation = getThemeElevation(preset, resolvedScheme);

    const borderClass = elevation.borderWidth >= 2 ? "border-2" : "border";

    return (
      <TextClassContext.Provider value="text-card-foreground">
        <View
          ref={ref}
          className={cn(
            PRESET_CARD_RADIUS[preset],
            borderClass,
            "border-outline-variant bg-card",
            className,
          )}
          style={[elevated ? { boxShadow: elevation.boxShadow } : undefined, style]}
          {...props}
        />
      </TextClassContext.Provider>
    );
  },
);

Card.displayName = "Card";

export interface CardSectionProps extends ViewProps {
  className?: string;
}

export const CardHeader = forwardRef<View, CardSectionProps>(({ className, ...props }, ref) => (
  <View ref={ref} className={cn("flex-col gap-1.5 p-5", className)} {...props} />
));

CardHeader.displayName = "CardHeader";

export const CardTitle = forwardRef<React.ComponentRef<typeof Text>, TextProps>(
  ({ className, variant = "title", ...props }, ref) => (
    <Text
      ref={ref}
      variant={variant}
      className={cn("text-card-foreground", className)}
      {...props}
    />
  ),
);

CardTitle.displayName = "CardTitle";

export const CardDescription = forwardRef<React.ComponentRef<typeof Text>, TextProps>(
  ({ className, variant = "muted", ...props }, ref) => (
    <Text
      ref={ref}
      variant={variant}
      className={cn("text-on-surface-variant", className)}
      {...props}
    />
  ),
);

CardDescription.displayName = "CardDescription";

export const CardContent = forwardRef<View, CardSectionProps>(({ className, ...props }, ref) => (
  <View ref={ref} className={cn("px-5 pb-5", className)} {...props} />
));

CardContent.displayName = "CardContent";

export const CardFooter = forwardRef<View, CardSectionProps>(({ className, ...props }, ref) => (
  <View ref={ref} className={cn("flex-row items-center gap-3 px-5 pb-5", className)} {...props} />
));

CardFooter.displayName = "CardFooter";
