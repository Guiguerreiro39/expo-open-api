import { type ComponentRef, forwardRef } from "react";
import { Platform, TextInput, type TextInputProps, type TextStyle } from "react-native";
import {
  DEFAULT_THEME_PRESET,
  getThemeElevation,
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

const WEB_OUTLINE_NONE_STYLE = {
  outlineStyle: "none",
  outlineWidth: 0,
} as unknown as TextStyle;

const ANDROID_SINGLE_LINE_STYLE: TextStyle = {
  includeFontPadding: false,
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
      multiline = false,
      textAlignVertical,
      placeholderTextColor,
      style,
      ...props
    },
    ref,
  ) => {
    const theme = useOptionalTheme();
    const preset = theme?.preset ?? DEFAULT_THEME_PRESET;
    const resolvedScheme = theme?.resolvedColorScheme ?? "light";
    const elevation = getThemeElevation(preset, resolvedScheme);
    const borderWidthClass = elevation.borderWidth >= 2 ? "border-2" : "border";

    const resolvedPlaceholderColor =
      placeholderTextColor ?? resolveThemeColor(preset, resolvedScheme, "on-surface-variant");

    const platformStyle =
      Platform.OS === "web"
        ? WEB_OUTLINE_NONE_STYLE
        : Platform.OS === "android" && !multiline
          ? ANDROID_SINGLE_LINE_STYLE
          : undefined;

    return (
      <TextInput
        ref={ref}
        editable={editable}
        multiline={multiline}
        textAlignVertical={textAlignVertical ?? (multiline ? "top" : "center")}
        placeholderTextColor={resolvedPlaceholderColor}
        style={platformStyle ? [platformStyle, style] : style}
        className={cn(
          PRESET_INPUT_RADIUS[preset],
          borderWidthClass,
          "bg-surface-container-lowest text-foreground min-h-12 px-4 py-3 font-sans text-[16px] outline-none",
          invalid
            ? "border-destructive focus:border-destructive"
            : "border-outline focus:border-primary",
          !editable && "opacity-50",
          className,
        )}
        {...props}
      />
    );
  },
);

Input.displayName = "Input";
