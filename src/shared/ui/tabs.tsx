import * as TabsPrimitive from "@rn-primitives/tabs";
import { Children, cloneElement, forwardRef, isValidElement, type ReactNode } from "react";
import { ScrollView } from "react-native";
import {
  DEFAULT_THEME_PRESET,
  getThemeElevation,
  type ThemePreset,
} from "@/shared/lib/theme/presets";
import { cn } from "@/shared/lib/utils";
import { Text, TextClassContext } from "@/shared/ui/text";
import { useOptionalTheme } from "@/shared/ui/theme-provider";

const PRESET_TABS_LIST_RADIUS: Record<ThemePreset, string> = {
  "warm-tactile": "rounded-xl",
  "editorial-slate": "rounded-lg",
  "neo-brutalist": "rounded-sm",
};

const PRESET_TABS_TRIGGER_RADIUS: Record<ThemePreset, string> = {
  "warm-tactile": "rounded-lg",
  "editorial-slate": "rounded-md",
  "neo-brutalist": "rounded-sm",
};

export interface TabsProps extends TabsPrimitive.RootProps {
  className?: string;
}

export const Tabs = forwardRef<TabsPrimitive.RootRef, TabsProps>(({ className, ...props }, ref) => (
  <TabsPrimitive.Root ref={ref} className={cn("w-full gap-4", className)} {...props} />
));

Tabs.displayName = "Tabs";

export interface TabsListProps extends TabsPrimitive.ListProps {
  className?: string;
}

export const TabsList = forwardRef<TabsPrimitive.ListRef, TabsListProps>(
  ({ className, ...props }, ref) => {
    const theme = useOptionalTheme();
    const preset = theme?.preset ?? DEFAULT_THEME_PRESET;
    const resolvedScheme = theme?.resolvedColorScheme ?? "light";
    const elevation = getThemeElevation(preset, resolvedScheme);
    const borderClass = elevation.borderWidth >= 2 ? "border-2" : "border";

    return (
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        bounces={false}
        className={cn(
          "border-outline-variant bg-surface-container w-full p-1",
          PRESET_TABS_LIST_RADIUS[preset],
          borderClass,
          className,
        )}
        contentContainerClassName="min-w-full flex-grow flex-row items-center gap-1"
      >
        <TabsPrimitive.List
          ref={ref}
          className="min-w-full flex-1 flex-row items-center gap-1"
          {...props}
        />
      </ScrollView>
    );
  },
);

TabsList.displayName = "TabsList";

export interface TabsTriggerProps extends Omit<TabsPrimitive.TriggerProps, "children"> {
  className?: string;
  children?: ReactNode;
}

export const TabsTrigger = forwardRef<TabsPrimitive.TriggerRef, TabsTriggerProps>(
  ({ className, value, children, disabled, ...props }, ref) => {
    const theme = useOptionalTheme();
    const preset = theme?.preset ?? DEFAULT_THEME_PRESET;
    const { value: activeValue } = TabsPrimitive.useRootContext();
    const isActive = activeValue === value;

    const renderedChildren =
      typeof children === "string" || typeof children === "number" ? (
        <Text numberOfLines={1}>{children}</Text>
      ) : (
        Children.map(children, (child) =>
          isValidElement<{ numberOfLines?: number }>(child) && child.type === Text
            ? cloneElement(child, { numberOfLines: child.props.numberOfLines ?? 1 })
            : child,
        )
      );

    return (
      <TextClassContext.Provider
        value={cn(
          "text-label-md text-center whitespace-nowrap",
          isActive ? "text-primary-foreground font-bold" : "text-on-surface-variant font-semibold",
        )}
      >
        <TabsPrimitive.Trigger
          ref={ref}
          value={value}
          disabled={disabled}
          className={cn(
            "min-h-10 shrink-0 grow flex-row items-center justify-center px-3 py-2",
            PRESET_TABS_TRIGGER_RADIUS[preset],
            isActive ? "bg-primary" : "bg-transparent",
            disabled && "opacity-50",
            className,
          )}
          {...props}
        >
          {renderedChildren}
        </TabsPrimitive.Trigger>
      </TextClassContext.Provider>
    );
  },
);

TabsTrigger.displayName = "TabsTrigger";

export interface TabsContentProps extends TabsPrimitive.ContentProps {
  className?: string;
}

export const TabsContent = forwardRef<TabsPrimitive.ContentRef, TabsContentProps>(
  ({ className, ...props }, ref) => (
    <TabsPrimitive.Content ref={ref} className={cn("w-full", className)} {...props} />
  ),
);

TabsContent.displayName = "TabsContent";
