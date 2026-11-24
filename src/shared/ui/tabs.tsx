import * as TabsPrimitive from "@rn-primitives/tabs";
import { forwardRef, type ReactNode } from "react";
import { cn } from "@/shared/lib/utils";
import { Text, TextClassContext } from "@/shared/ui/text";

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
  ({ className, ...props }, ref) => (
    <TabsPrimitive.List
      ref={ref}
      className={cn(
        "border-outline-variant bg-surface-container flex-row items-center gap-1 rounded-xl border p-1",
        className,
      )}
      {...props}
    />
  ),
);

TabsList.displayName = "TabsList";

export interface TabsTriggerProps extends Omit<TabsPrimitive.TriggerProps, "children"> {
  className?: string;
  children?: ReactNode;
}

export const TabsTrigger = forwardRef<TabsPrimitive.TriggerRef, TabsTriggerProps>(
  ({ className, value, children, disabled, ...props }, ref) => {
    const { value: activeValue } = TabsPrimitive.useRootContext();
    const isActive = activeValue === value;

    return (
      <TextClassContext.Provider
        value={cn(
          "text-label-md text-center",
          isActive ? "text-primary-foreground font-bold" : "text-on-surface-variant font-semibold",
        )}
      >
        <TabsPrimitive.Trigger
          ref={ref}
          value={value}
          disabled={disabled}
          className={cn(
            "min-h-10 flex-1 flex-row items-center justify-center rounded-lg px-3 py-2",
            isActive ? "bg-primary" : "bg-transparent",
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
