import { type ComponentRef, forwardRef, useCallback, useState } from "react";
import {
  TextInput,
  type TextInputBlurEvent,
  type TextInputFocusEvent,
  type TextInputProps,
} from "react-native";
import {
  DEFAULT_THEME_PRESET,
  resolveThemeColor,
  type ThemePreset,
} from "@/shared/lib/theme/presets";
import { cn } from "@/shared/lib/utils";
import { useOptionalTheme } from "@/shared/ui/theme-provider";

const PRESET_INPUT_RADIUS: Record<ThemePreset, string> = {
  "warm-tactile": "rounded-xl",
  "editorial-slate": "rounded-lg",
  "neo-brutalist": "rounded-sm",
};

export interface InputProps extends TextInputProps {
  className?: string;
  invalid?: boolean;
}

export const Input = forwardRef<ComponentRef<typeof TextInput>, InputProps>(
  (
    {
      className,
      invalid = false,
      editable = true,
      placeholderTextColor,
      onFocus,
      onBlur,
      ...props
    },
    ref,
  ) => {
    const theme = useOptionalTheme();
    const preset = theme?.preset ?? DEFAULT_THEME_PRESET;
    const resolvedScheme = theme?.resolvedColorScheme ?? "light";
    const [focused, setFocused] = useState(false);

    const handleFocus = useCallback(
      (event: TextInputFocusEvent) => {
        setFocused(true);
        onFocus?.(event);
      },
      [onFocus],
    );

    const handleBlur = useCallback(
      (event: TextInputBlurEvent) => {
        setFocused(false);
        onBlur?.(event);
      },
      [onBlur],
    );

    const resolvedPlaceholderColor =
      placeholderTextColor ?? resolveThemeColor(preset, resolvedScheme, "on-surface-variant");

    return (
      <TextInput
        ref={ref}
        editable={editable}
        placeholderTextColor={resolvedPlaceholderColor}
        onFocus={handleFocus}
        onBlur={handleBlur}
        className={cn(
          PRESET_INPUT_RADIUS[preset],
          "bg-surface-container-lowest text-body-md text-foreground min-h-12 border px-4 py-3 font-sans",
          invalid ? "border-destructive" : focused ? "border-primary" : "border-outline-variant",
          !editable && "opacity-50",
          className,
        )}
        {...props}
      />
    );
  },
);

Input.displayName = "Input";
