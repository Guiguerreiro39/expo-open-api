import * as SelectPrimitive from "@rn-primitives/select";
import { Check, ChevronDown } from "lucide-react-native";
import { forwardRef } from "react";
import { StyleSheet, View } from "react-native";
import {
  DEFAULT_THEME_PRESET,
  getThemeElevation,
  type ThemePreset,
} from "@/shared/lib/theme/presets";
import { cn } from "@/shared/lib/utils";
import { Icon } from "@/shared/ui/icon";
import { Text, TextClassContext } from "@/shared/ui/text";
import { useOptionalTheme } from "@/shared/ui/theme-provider";

export type SelectOption = NonNullable<SelectPrimitive.Option>;

const PRESET_TRIGGER_RADIUS: Record<ThemePreset, string> = {
  "warm-tactile": "rounded-xl",
  "editorial-slate": "rounded-lg",
  "neo-brutalist": "rounded-sm",
};

export const Select = SelectPrimitive.Root;
export const SelectGroup = SelectPrimitive.Group;

export interface SelectValueProps extends SelectPrimitive.ValueProps {
  className?: string;
}

export const SelectValue = forwardRef<SelectPrimitive.ValueRef, SelectValueProps>(
  ({ className, ...props }, ref) => (
    <SelectPrimitive.Value
      ref={ref}
      className={cn("text-body-md text-foreground font-sans", className)}
      {...props}
    />
  ),
);

SelectValue.displayName = "SelectValue";

export interface SelectTriggerProps extends SelectPrimitive.TriggerProps {
  className?: string;
  invalid?: boolean;
  children?: React.ReactNode;
}

export const SelectTrigger = forwardRef<SelectPrimitive.TriggerRef, SelectTriggerProps>(
  ({ className, invalid = false, disabled, accessibilityState, children, ...props }, ref) => {
    const theme = useOptionalTheme();
    const preset = theme?.preset ?? DEFAULT_THEME_PRESET;
    const rootContext = SelectPrimitive.useRootContext();
    const isExpanded = "open" in rootContext ? Boolean(rootContext.open) : false;
    const isDisabled = Boolean(disabled ?? rootContext.disabled);

    return (
      <SelectPrimitive.Trigger
        ref={ref}
        disabled={disabled}
        accessibilityState={{
          ...accessibilityState,
          disabled: accessibilityState?.disabled ?? isDisabled,
          expanded: accessibilityState?.expanded ?? isExpanded,
        }}
        className={cn(
          PRESET_TRIGGER_RADIUS[preset],
          "bg-surface-container-lowest min-h-12 flex-row items-center justify-between gap-2 border px-4 py-3",
          invalid ? "border-destructive" : "border-outline-variant",
          disabled && "opacity-50",
          className,
        )}
        {...props}
      >
        <View className="flex-1">{children}</View>
        <Icon as={ChevronDown} size={18} className="text-on-surface-variant" />
      </SelectPrimitive.Trigger>
    );
  },
);

SelectTrigger.displayName = "SelectTrigger";

export interface SelectContentProps extends SelectPrimitive.ContentProps {
  className?: string;
  portalHost?: string;
}

export const SelectContent = forwardRef<SelectPrimitive.ContentRef, SelectContentProps>(
  ({ className, style, children, position = "popper", portalHost, ...props }, ref) => {
    const theme = useOptionalTheme();
    const preset = theme?.preset ?? DEFAULT_THEME_PRESET;
    const resolvedScheme = theme?.resolvedColorScheme ?? "light";
    const elevation = getThemeElevation(preset, resolvedScheme);

    return (
      <SelectPrimitive.Portal hostName={portalHost}>
        <SelectPrimitive.Overlay style={StyleSheet.absoluteFill} className="bg-foreground/20">
          <View className="flex-1 items-center justify-center p-4">
            <SelectPrimitive.Content
              ref={ref}
              position={position}
              className={cn(
                "border-outline-variant bg-popover z-50 w-full max-w-sm rounded-xl border p-1.5",
                className,
              )}
              style={StyleSheet.flatten([{ boxShadow: elevation.boxShadow }, style])}
              {...props}
            >
              <SelectPrimitive.Viewport className="gap-1">{children}</SelectPrimitive.Viewport>
            </SelectPrimitive.Content>
          </View>
        </SelectPrimitive.Overlay>
      </SelectPrimitive.Portal>
    );
  },
);

SelectContent.displayName = "SelectContent";

export interface SelectLabelProps extends SelectPrimitive.LabelProps {
  className?: string;
}

export const SelectLabel = forwardRef<SelectPrimitive.LabelRef, SelectLabelProps>(
  ({ className, ...props }, ref) => (
    <SelectPrimitive.Label
      ref={ref}
      className={cn("text-on-surface-variant text-label-md px-3 py-1.5 font-sans", className)}
      {...props}
    />
  ),
);

SelectLabel.displayName = "SelectLabel";

export interface SelectItemProps extends SelectPrimitive.ItemProps {
  className?: string;
}

export const SelectItem = forwardRef<SelectPrimitive.ItemRef, SelectItemProps>(
  ({ className, label, disabled, ...props }, ref) => (
    <TextClassContext.Provider value="text-body-sm text-popover-foreground">
      <SelectPrimitive.Item
        ref={ref}
        label={label}
        disabled={disabled}
        className={cn(
          "active:bg-accent flex-row items-center justify-between gap-2 rounded-lg px-3 py-2.5",
          disabled && "opacity-50",
          className,
        )}
        {...props}
      >
        <Text className="text-body-sm text-popover-foreground flex-1">{label}</Text>
        <SelectPrimitive.ItemIndicator>
          <Icon as={Check} size={16} className="text-primary" />
        </SelectPrimitive.ItemIndicator>
      </SelectPrimitive.Item>
    </TextClassContext.Provider>
  ),
);

SelectItem.displayName = "SelectItem";

export interface SelectSeparatorProps extends SelectPrimitive.SeparatorProps {
  className?: string;
}

export const SelectSeparator = forwardRef<SelectPrimitive.SeparatorRef, SelectSeparatorProps>(
  ({ className, ...props }, ref) => (
    <SelectPrimitive.Separator
      ref={ref}
      className={cn("bg-outline-variant my-1 h-px", className)}
      {...props}
    />
  ),
);

SelectSeparator.displayName = "SelectSeparator";
