import * as DropdownMenuPrimitive from "@rn-primitives/dropdown-menu";
import { Check } from "lucide-react-native";
import { forwardRef, type ReactNode } from "react";
import { StyleSheet, View } from "react-native";
import { DEFAULT_THEME_PRESET, getThemeElevation } from "@/shared/lib/theme/presets";
import { cn } from "@/shared/lib/utils";
import { Icon } from "@/shared/ui/icon";
import { Text, TextClassContext } from "@/shared/ui/text";
import { useOptionalTheme } from "@/shared/ui/theme-provider";

export const DropdownMenu = DropdownMenuPrimitive.Root;
export const DropdownMenuTrigger = DropdownMenuPrimitive.Trigger;
export const DropdownMenuGroup = DropdownMenuPrimitive.Group;
export const DropdownMenuPortal = DropdownMenuPrimitive.Portal;
export const DropdownMenuRadioGroup = DropdownMenuPrimitive.RadioGroup;

export interface DropdownMenuContentProps extends DropdownMenuPrimitive.ContentProps {
  className?: string;
  portalHost?: string;
}

export const DropdownMenuContent = forwardRef<
  DropdownMenuPrimitive.ContentRef,
  DropdownMenuContentProps
>(({ className, style, portalHost, ...props }, ref) => {
  const theme = useOptionalTheme();
  const preset = theme?.preset ?? DEFAULT_THEME_PRESET;
  const resolvedScheme = theme?.resolvedColorScheme ?? "light";
  const elevation = getThemeElevation(preset, resolvedScheme);

  return (
    <DropdownMenuPrimitive.Portal hostName={portalHost}>
      <DropdownMenuPrimitive.Overlay style={StyleSheet.absoluteFill} className="bg-foreground/15">
        <View className="flex-1 items-center justify-center p-4">
          <DropdownMenuPrimitive.Content
            ref={ref}
            className={cn(
              "border-outline-variant bg-popover z-50 min-w-56 rounded-xl border p-1.5",
              className,
            )}
            style={StyleSheet.flatten([{ boxShadow: elevation.boxShadow }, style])}
            {...props}
          />
        </View>
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
  ({ className, inset, disabled, children, ...props }, ref) => (
    <TextClassContext.Provider value="text-body-sm text-popover-foreground">
      <DropdownMenuPrimitive.Item
        ref={ref}
        disabled={disabled}
        className={cn(
          "active:bg-accent flex-row items-center gap-2 rounded-lg px-3 py-2.5",
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
  ),
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
>(({ className, children, disabled, ...props }, ref) => (
  <TextClassContext.Provider value="text-body-sm text-popover-foreground">
    <DropdownMenuPrimitive.CheckboxItem
      ref={ref}
      disabled={disabled}
      className={cn(
        "active:bg-accent flex-row items-center justify-between gap-2 rounded-lg px-3 py-2.5",
        disabled && "opacity-50",
        className,
      )}
      {...props}
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
));

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
