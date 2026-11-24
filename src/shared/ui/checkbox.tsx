import * as CheckboxPrimitive from "@rn-primitives/checkbox";
import { Check } from "lucide-react-native";
import { forwardRef } from "react";
import {
  DEFAULT_THEME_PRESET,
  getThemeElevation,
  type ThemePreset,
} from "@/shared/lib/theme/presets";
import { cn } from "@/shared/lib/utils";
import { Icon } from "@/shared/ui/icon";
import { useOptionalTheme } from "@/shared/ui/theme-provider";
import { getWebClickGuardProps, useWebToggleDedup } from "@/shared/ui/web-overlay";

const CHECKBOX_HIT_SLOP = { top: 10, bottom: 10, left: 10, right: 10 } as const;

const PRESET_CHECKBOX_RADIUS: Record<ThemePreset, string> = {
  "warm-tactile": "rounded-md",
  "editorial-slate": "rounded-sm",
  "neo-brutalist": "rounded-none",
};

export interface CheckboxProps extends CheckboxPrimitive.RootProps {
  className?: string;
  indicatorClassName?: string;
  invalid?: boolean;
}

export const Checkbox = forwardRef<CheckboxPrimitive.RootRef, CheckboxProps>(
  (
    {
      className,
      indicatorClassName,
      checked,
      disabled,
      invalid = false,
      hitSlop,
      accessibilityState,
      onCheckedChange,
      ...props
    },
    ref,
  ) => {
    const theme = useOptionalTheme();
    const preset = theme?.preset ?? DEFAULT_THEME_PRESET;
    const resolvedScheme = theme?.resolvedColorScheme ?? "light";
    const elevation = getThemeElevation(preset, resolvedScheme);
    const borderClass = elevation.borderWidth >= 2 ? "border-2" : "border";
    const handleCheckedChange = useWebToggleDedup(onCheckedChange);
    const webProps = getWebClickGuardProps(props);

    return (
      <CheckboxPrimitive.Root
        ref={ref}
        checked={checked}
        disabled={disabled}
        hitSlop={hitSlop ?? CHECKBOX_HIT_SLOP}
        onCheckedChange={handleCheckedChange}
        accessibilityState={{
          ...accessibilityState,
          checked: accessibilityState?.checked ?? checked,
          disabled: accessibilityState?.disabled ?? Boolean(disabled),
        }}
        className={cn(
          "border-outline bg-surface-container-lowest h-6 w-6 shrink-0 items-center justify-center",
          PRESET_CHECKBOX_RADIUS[preset],
          borderClass,
          checked && "border-primary bg-primary",
          invalid && "border-destructive",
          disabled && "opacity-50",
          className,
        )}
        {...props}
        {...webProps}
      >
        <CheckboxPrimitive.Indicator
          className={cn("h-full w-full items-center justify-center", indicatorClassName)}
        >
          <Icon as={Check} size={14} strokeWidth={3} className="text-primary-foreground" />
        </CheckboxPrimitive.Indicator>
      </CheckboxPrimitive.Root>
    );
  },
);

Checkbox.displayName = "Checkbox";
