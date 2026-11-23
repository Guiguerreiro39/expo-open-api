import { forwardRef, useCallback, useState } from "react";
import {
  type NativeSyntheticEvent,
  TextInput,
  type TextInputFocusEventData,
  type TextInputProps,
} from "react-native";
import {
  DEFAULT_THEME_PRESET,
  resolveThemeColor,
  type ThemePreset,
} from "@/shared/lib/theme/presets";
import { cn } from "@/shared/lib/utils";
import { useOptionalTheme } from "@/shared/ui/theme-provider";

const PRESET_TEXTAREA_RADIUS: Record<ThemePreset, string> = {
  "warm-tactile": "rounded-xl",
  "editorial-slate": "rounded-lg",
  "neo-brutalist": "rounded-sm",
};

export interface TextareaProps extends TextInputProps {
  className?: string;
  invalid?: boolean;
}

export const Textarea = forwardRef<TextInput, TextareaProps>(
  (
    {
      className,
      invalid = false,
      editable = true,
      multiline = true,
      numberOfLines = 4,
      textAlignVertical = "top",
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
      (event: NativeSyntheticEvent<TextInputFocusEventData>) => {
        setFocused(true);
        onFocus?.(event);
      },
      [onFocus],
    );

    const handleBlur = useCallback(
      (event: NativeSyntheticEvent<TextInputFocusEventData>) => {
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
        multiline={multiline}
        numberOfLines={numberOfLines}
        textAlignVertical={textAlignVertical}
        placeholderTextColor={resolvedPlaceholderColor}
        onFocus={handleFocus}
        onBlur={handleBlur}
        className={cn(
          PRESET_TEXTAREA_RADIUS[preset],
          "bg-surface-container-lowest text-body-md text-foreground min-h-24 border px-4 py-3 font-sans",
          invalid ? "border-destructive" : focused ? "border-primary" : "border-outline-variant",
          !editable && "opacity-50",
          className,
        )}
        {...props}
      />
    );
  },
);

Textarea.displayName = "Textarea";
