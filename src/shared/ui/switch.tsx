import * as SwitchPrimitive from "@rn-primitives/switch";
import { forwardRef, useCallback } from "react";
import { Platform } from "react-native";
import {
  DEFAULT_THEME_PRESET,
  getThemeElevation,
  type ThemePreset,
} from "@/shared/lib/theme/presets";
import { cn } from "@/shared/lib/utils";
import { useOptionalTheme } from "@/shared/ui/theme-provider";
import { getWebClickGuardProps, useWebToggleDedup } from "@/shared/ui/web-overlay";

const SWITCH_HIT_SLOP = { top: 8, bottom: 8, left: 0, right: 0 } as const;

type SwitchKeyDownEvent = Parameters<NonNullable<SwitchPrimitive.RootProps["onKeyDown"]>>[0];

interface WebKeyEventLike {
  readonly key?: string;
  preventDefault?: () => void;
}

const PRESET_SWITCH_RADIUS: Record<ThemePreset, string> = {
  "warm-tactile": "rounded-full",
  "editorial-slate": "rounded-full",
  "neo-brutalist": "rounded-sm",
};

export interface SwitchProps extends SwitchPrimitive.RootProps {
  className?: string;
  thumbClassName?: string;
  invalid?: boolean;
}

export const Switch = forwardRef<SwitchPrimitive.RootRef, SwitchProps>(
  (
    {
      className,
      thumbClassName,
      checked,
      disabled,
      invalid = false,
      hitSlop,
      accessibilityState,
      onCheckedChange,
      onKeyDown,
      ...props
    },
    ref,
  ) => {
    const theme = useOptionalTheme();
    const preset = theme?.preset ?? DEFAULT_THEME_PRESET;
    const resolvedScheme = theme?.resolvedColorScheme ?? "light";
    const elevation = getThemeElevation(preset, resolvedScheme);
    const borderClass = elevation.borderWidth >= 2 ? "border-2" : "border";
    const radiusClass = PRESET_SWITCH_RADIUS[preset];
    const handleCheckedChange = useWebToggleDedup(onCheckedChange);
    const webProps = getWebClickGuardProps(props);

    const handleKeyDown = useCallback(
      (event: WebKeyEventLike) => {
        if (Platform.OS === "web" && event?.key === " ") {
          event.preventDefault?.();
        }
        onKeyDown?.(event as SwitchKeyDownEvent);
      },
      [onKeyDown],
    );

    return (
      <SwitchPrimitive.Root
        ref={ref}
        checked={checked}
        disabled={disabled}
        hitSlop={hitSlop ?? SWITCH_HIT_SLOP}
        onCheckedChange={handleCheckedChange}
        onKeyDown={handleKeyDown}
        accessibilityState={{
          ...accessibilityState,
          checked: accessibilityState?.checked ?? checked,
          disabled: accessibilityState?.disabled ?? Boolean(disabled),
        }}
        className={cn(
          "h-7 w-12 shrink-0 flex-row items-center p-0.5",
          radiusClass,
          borderClass,
          checked
            ? "border-primary bg-primary justify-end"
            : "border-outline bg-surface-container-high justify-start",
          invalid && "border-destructive",
          disabled && "opacity-50",
          className,
        )}
        {...props}
        {...webProps}
      >
        <SwitchPrimitive.Thumb
          className={cn(
            "h-5 w-5",
            radiusClass,
            checked ? "bg-primary-foreground" : "bg-on-surface-variant",
            thumbClassName,
          )}
        />
      </SwitchPrimitive.Root>
    );
  },
);

Switch.displayName = "Switch";
