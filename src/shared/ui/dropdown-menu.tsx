import * as DropdownMenuPrimitive from "@rn-primitives/dropdown-menu";
import { Check } from "lucide-react-native";
import { forwardRef, type ReactNode } from "react";
import { StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  DEFAULT_THEME_PRESET,
  getThemeElevation,
  type ThemePreset,
} from "@/shared/lib/theme/presets";
import { cn } from "@/shared/lib/utils";
import { Icon } from "@/shared/ui/icon";
import { Text, TextClassContext } from "@/shared/ui/text";
import { useOptionalTheme } from "@/shared/ui/theme-provider";
import {
  getOverlayFillStyle,
  getWebClickGuardProps,
  useWebToggleDedup,
} from "@/shared/ui/web-overlay";

const PRESET_MENU_RADIUS: Record<ThemePreset, string> = {
  "warm-tactile": "rounded-xl",
  "editorial-slate": "rounded-lg",
  "neo-brutalist": "rounded-sm",
};

const PRESET_ITEM_RADIUS: Record<ThemePreset, string> = {
  "warm-tactile": "rounded-lg",
  "editorial-slate": "rounded-md",
  "neo-brutalist": "rounded-sm",
};

export const DropdownMenu = DropdownMenuPrimitive.Root;
export const DropdownMenuGroup = DropdownMenuPrimitive.Group;
export const DropdownMenuPortal = DropdownMenuPrimitive.Portal;
export const DropdownMenuRadioGroup = DropdownMenuPrimitive.RadioGroup;

export const DropdownMenuTrigger = forwardRef<
  DropdownMenuPrimitive.TriggerRef,
  DropdownMenuPrimitive.TriggerProps
>((props, ref) => {
  const webProps = getWebClickGuardProps(props);

  return <DropdownMenuPrimitive.Trigger ref={ref} {...props} {...webProps} />;
});

DropdownMenuTrigger.displayName = "DropdownMenuTrigger";

export interface DropdownMenuContentProps extends DropdownMenuPrimitive.ContentProps {
  className?: string;
  portalHost?: string;
}

export const DropdownMenuContent = forwardRef<
  DropdownMenuPrimitive.ContentRef,
  DropdownMenuContentProps
>(({ className, style, sideOffset = 4, insets: insetsProp, portalHost, ...props }, ref) => {
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
    <DropdownMenuPrimitive.Portal hostName={portalHost}>
      <DropdownMenuPrimitive.Overlay
        testID="dropdown-menu-overlay"
        style={getOverlayFillStyle()}
        className="bg-scrim/20 web:fixed web:inset-0 z-50"
      >
        <DropdownMenuPrimitive.Content
          ref={ref}
          sideOffset={sideOffset}
          insets={contentInsets}
          className={cn(
            PRESET_MENU_RADIUS[preset],
            borderClass,
            "border-outline-variant bg-popover z-50 min-w-56 p-1.5",
            className,
          )}
          style={StyleSheet.flatten([{ boxShadow: elevation.boxShadow }, style]) ?? undefined}
          {...props}
        />
      </DropdownMenuPrimitive.Overlay>
    </DropdownMenuPrimitive.Portal>
  );
});

DropdownMenuContent.displayName = "DropdownMenuContent";

export interface DropdownMenuItemProps extends Omit<DropdownMenuPrimitive.ItemProps, "children"> {
  className?: string;
  inset?: boolean;
  children?: ReactNode;
}

export const DropdownMenuItem = forwardRef<DropdownMenuPrimitive.ItemRef, DropdownMenuItemProps>(
  ({ className, inset, disabled, children, ...props }, ref) => {
    const theme = useOptionalTheme();
    const preset = theme?.preset ?? DEFAULT_THEME_PRESET;

    return (
      <TextClassContext.Provider value="text-body-sm text-popover-foreground">
        <DropdownMenuPrimitive.Item
          ref={ref}
          disabled={disabled}
          className={cn(
            PRESET_ITEM_RADIUS[preset],
            "active:bg-surface-container-high hover:bg-surface-container-high focus:bg-surface-container-high flex flex-row items-center gap-2 px-3 py-2.5",
            inset && "pl-8",
            disabled && "opacity-50",
            className,
          )}
          {...props}
        >
          {typeof children === "string" || typeof children === "number" ? (
            <Text>{children}</Text>
          ) : (
            children
          )}
        </DropdownMenuPrimitive.Item>
      </TextClassContext.Provider>
    );
  },
);

DropdownMenuItem.displayName = "DropdownMenuItem";

export interface DropdownMenuCheckboxItemProps
  extends Omit<DropdownMenuPrimitive.CheckboxItemProps, "children"> {
  className?: string;
  children?: ReactNode;
}

export const DropdownMenuCheckboxItem = forwardRef<
  DropdownMenuPrimitive.CheckboxItemRef,
  DropdownMenuCheckboxItemProps
>(({ className, children, disabled, onCheckedChange, ...props }, ref) => {
  const theme = useOptionalTheme();
  const preset = theme?.preset ?? DEFAULT_THEME_PRESET;
  const handleCheckedChange = useWebToggleDedup(onCheckedChange);
  const webProps = getWebClickGuardProps(props);

  return (
    <TextClassContext.Provider value="text-body-sm text-popover-foreground">
      <DropdownMenuPrimitive.CheckboxItem
        ref={ref}
        disabled={disabled}
        onCheckedChange={handleCheckedChange}
        className={cn(
          PRESET_ITEM_RADIUS[preset],
          "active:bg-surface-container-high hover:bg-surface-container-high focus:bg-surface-container-high flex flex-row items-center justify-between gap-2 px-3 py-2.5",
          disabled && "opacity-50",
          className,
        )}
        {...props}
        {...webProps}
      >
        <View className="flex-1">
          {typeof children === "string" || typeof children === "number" ? (
            <Text>{children}</Text>
          ) : (
            children
          )}
        </View>
        <DropdownMenuPrimitive.ItemIndicator>
          <Icon as={Check} size={15} className="text-primary" />
        </DropdownMenuPrimitive.ItemIndicator>
      </DropdownMenuPrimitive.CheckboxItem>
    </TextClassContext.Provider>
  );
});

DropdownMenuCheckboxItem.displayName = "DropdownMenuCheckboxItem";

export interface DropdownMenuLabelProps extends DropdownMenuPrimitive.LabelProps {
  className?: string;
  inset?: boolean;
}

export const DropdownMenuLabel = forwardRef<DropdownMenuPrimitive.LabelRef, DropdownMenuLabelProps>(
  ({ className, inset, ...props }, ref) => (
    <DropdownMenuPrimitive.Label
      ref={ref}
      className={cn(
        "text-on-surface-variant text-label-md px-3 py-1.5 font-sans",
        inset && "pl-8",
        className,
      )}
      {...props}
    />
  ),
);

DropdownMenuLabel.displayName = "DropdownMenuLabel";

export interface DropdownMenuSeparatorProps extends DropdownMenuPrimitive.SeparatorProps {
  className?: string;
}

export const DropdownMenuSeparator = forwardRef<
  DropdownMenuPrimitive.SeparatorRef,
  DropdownMenuSeparatorProps
>(({ className, ...props }, ref) => (
  <DropdownMenuPrimitive.Separator
    ref={ref}
    className={cn("bg-outline-variant my-1 h-px", className)}
    {...props}
  />
));

DropdownMenuSeparator.displayName = "DropdownMenuSeparator";
