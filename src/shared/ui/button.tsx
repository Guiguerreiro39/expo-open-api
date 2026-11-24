import { cva, type VariantProps } from "class-variance-authority";
import { type ComponentRef, forwardRef, type ReactNode } from "react";
import { Pressable, type PressableProps, type StyleProp, type ViewStyle } from "react-native";
import {
  DEFAULT_THEME_PRESET,
  getThemeElevation,
  type ThemePreset,
} from "@/shared/lib/theme/presets";
import { cn, resolvePresetBorderOverride } from "@/shared/lib/utils";
import { Text, TextClassContext } from "@/shared/ui/text";
import { useOptionalTheme } from "@/shared/ui/theme-provider";

const PRESET_BUTTON_RADIUS: Record<ThemePreset, string> = {
  "warm-tactile": "rounded-xl",
  "editorial-slate": "rounded-lg",
  "neo-brutalist": "rounded-sm",
};

export const buttonVariants = cva("flex-row items-center justify-center gap-2", {
  variants: {
    variant: {
      default: "border-primary-container bg-primary",
      secondary: "border-outline-variant bg-secondary-container",
      outline: "border-outline-variant bg-surface-container-lowest border",
      destructive: "border-destructive bg-destructive",
      ghost: "bg-transparent",
      link: "bg-transparent",
    },
    size: {
      default: "min-h-12 px-5 py-3",
      sm: "min-h-9 px-3.5 py-2",
      lg: "min-h-14 px-6 py-3.5",
      icon: "h-11 w-11",
    },
  },
  defaultVariants: {
    variant: "default",
    size: "default",
  },
});

export const buttonTextVariants = cva("text-body-sm text-center", {
  variants: {
    variant: {
      default: "text-primary-foreground font-sans-bold",
      secondary: "text-on-secondary-container font-sans-semibold",
      outline: "text-foreground font-sans-semibold",
      destructive: "text-destructive-foreground font-sans-bold",
      ghost: "text-foreground font-sans-semibold",
      link: "text-primary font-sans-semibold underline",
    },
    size: {
      default: "text-body-md",
      sm: "text-body-sm",
      lg: "text-body-lg",
      icon: "text-body-sm",
    },
  },
  defaultVariants: {
    variant: "default",
    size: "default",
  },
});

export interface ButtonProps
  extends Omit<PressableProps, "children" | "style">,
    VariantProps<typeof buttonVariants> {
  children?: ReactNode;
  className?: string;
  style?: StyleProp<ViewStyle>;
  textClassName?: string;
  elevated?: boolean;
  hapticFeedback?: boolean;
}

export const Button = forwardRef<ComponentRef<typeof Pressable>, ButtonProps>(
  (
    {
      className,
      textClassName,
      variant = "default",
      size = "default",
      elevated,
      hapticFeedback: _hapticFeedback,
      disabled,
      children,
      ...props
    },
    ref,
  ) => {
    const theme = useOptionalTheme();
    const preset = theme?.preset ?? DEFAULT_THEME_PRESET;
    const scheme = theme?.resolvedColorScheme ?? "light";
    const elevation = getThemeElevation(preset, scheme);
    const isElevated = elevated ?? (variant !== "ghost" && variant !== "link");
    const resolvedTextClass = cn(buttonTextVariants({ variant, size }), textClassName);
    const baseClassName = cn(
      PRESET_BUTTON_RADIUS[preset],
      buttonVariants({ variant, size }),
      className,
    );
    const enforcedBorderClass = resolvePresetBorderOverride(baseClassName, elevation.borderWidth, {
      applyDefault: isElevated,
    });

    const renderedChildren =
      typeof children === "string" || typeof children === "number" ? (
        <Text>{children}</Text>
      ) : (
        children
      );

    return (
      <TextClassContext.Provider value={resolvedTextClass}>
        <Pressable
          ref={ref}
          accessibilityRole="button"
          disabled={disabled}
          className={cn(
            baseClassName,
            enforcedBorderClass,
            "active:opacity-80",
            disabled && "opacity-50",
          )}
          {...props}
        >
          {renderedChildren}
        </Pressable>
      </TextClassContext.Provider>
    );
  },
);

Button.displayName = "Button";
