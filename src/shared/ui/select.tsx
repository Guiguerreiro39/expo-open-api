import * as SelectPrimitive from "@rn-primitives/select";
import { Check, ChevronDown } from "lucide-react-native";
import { forwardRef, type ReactNode } from "react";
import { ScrollView, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  DEFAULT_THEME_PRESET,
  getThemeElevation,
  type ThemePreset,
} from "@/shared/lib/theme/presets";
import { cn } from "@/shared/lib/utils";
import { Icon } from "@/shared/ui/icon";
import { TextClassContext } from "@/shared/ui/text";
import { useOptionalTheme } from "@/shared/ui/theme-provider";
import { getOverlayFillStyle } from "@/shared/ui/web-overlay";

export type SelectOption = NonNullable<SelectPrimitive.Option>;

const PRESET_TRIGGER_RADIUS: Record<ThemePreset, string> = {
  "warm-tactile": "rounded-xl",
  "editorial-slate": "rounded-lg",
  "neo-brutalist": "rounded-sm",
};

const PRESET_CONTENT_RADIUS: Record<ThemePreset, string> = {
  "warm-tactile": "rounded-xl",
  "editorial-slate": "rounded-lg",
  "neo-brutalist": "rounded-sm",
};

const PRESET_ITEM_RADIUS: Record<ThemePreset, string> = {
  "warm-tactile": "rounded-lg",
  "editorial-slate": "rounded-md",
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
  children?: ReactNode;
}

export const SelectTrigger = forwardRef<SelectPrimitive.TriggerRef, SelectTriggerProps>(
  ({ className, invalid = false, disabled, accessibilityState, children, ...props }, ref) => {
    const theme = useOptionalTheme();
    const preset = theme?.preset ?? DEFAULT_THEME_PRESET;
    const resolvedScheme = theme?.resolvedColorScheme ?? "light";
    const elevation = getThemeElevation(preset, resolvedScheme);
    const borderClass = elevation.borderWidth >= 2 ? "border-2" : "border";
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
          borderClass,
          "bg-surface-container-lowest min-h-12 flex-row items-center justify-between gap-2 px-4 py-3",
          invalid ? "border-destructive" : "border-outline",
          disabled && "opacity-50",
          className,
        )}
        {...props}
      >
        <View className="min-w-0 flex-1">{children}</View>
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
  (
    {
      className,
      style,
      children,
      position = "popper",
      sideOffset = 4,
      insets: insetsProp,
      portalHost,
      ...props
    },
    ref,
  ) => {
    const safeInsets = useSafeAreaInsets();
    const theme = useOptionalTheme();
    const preset = theme?.preset ?? DEFAULT_THEME_PRESET;
    const resolvedScheme = theme?.resolvedColorScheme ?? "light";
    const elevation = getThemeElevation(preset, resolvedScheme);
    const borderClass = elevation.borderWidth >= 2 ? "border-2" : "border";

    const contentInsets = insetsProp ?? {
      top: safeInsets.top + 8,
      bottom: safeInsets.bottom + 8,
      left: safeInsets.left + 12,
      right: safeInsets.right + 12,
    };

    return (
      <SelectPrimitive.Portal hostName={portalHost}>
        <SelectPrimitive.Overlay
          testID="select-overlay"
          style={getOverlayFillStyle()}
          className="bg-scrim/25 web:fixed web:inset-0 z-50"
        >
          <SelectPrimitive.Content
            ref={ref}
            position={position}
            sideOffset={sideOffset}
            insets={contentInsets}
            className={cn(
              PRESET_CONTENT_RADIUS[preset],
              borderClass,
              "border-outline-variant bg-popover z-50 max-w-sm min-w-44 p-1.5",
              className,
            )}
            style={StyleSheet.flatten([{ boxShadow: elevation.boxShadow }, style]) ?? undefined}
            {...props}
          >
            <SelectPrimitive.Viewport className="w-full">
              <ScrollView
                className="max-h-64"
                contentContainerClassName="gap-1"
                nestedScrollEnabled
                bounces={false}
              >
                {children}
              </ScrollView>
            </SelectPrimitive.Viewport>
          </SelectPrimitive.Content>
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
  ({ className, label, disabled, ...props }, ref) => {
    const theme = useOptionalTheme();
    const preset = theme?.preset ?? DEFAULT_THEME_PRESET;

    return (
      <TextClassContext.Provider value="text-body-sm text-popover-foreground">
        <SelectPrimitive.Item
          ref={ref}
          label={label}
          disabled={disabled}
          className={cn(
            PRESET_ITEM_RADIUS[preset],
            "active:bg-surface-container-high hover:bg-surface-container-high focus:bg-surface-container-high flex flex-row items-center justify-between gap-2 px-3 py-2.5",
            disabled && "opacity-50",
            className,
          )}
          {...props}
        >
          <SelectPrimitive.ItemText className="text-body-sm text-popover-foreground flex-1 font-sans" />
          <SelectPrimitive.ItemIndicator>
            <Icon as={Check} size={16} className="text-primary" />
          </SelectPrimitive.ItemIndicator>
        </SelectPrimitive.Item>
      </TextClassContext.Provider>
    );
  },
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
