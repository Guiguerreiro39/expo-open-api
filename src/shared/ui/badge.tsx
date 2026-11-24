import { cva, type VariantProps } from "class-variance-authority";
import { type ComponentRef, forwardRef, type ReactNode } from "react";
import { View, type ViewProps } from "react-native";
import { cn } from "@/shared/lib/utils";
import { Text, TextClassContext } from "@/shared/ui/text";

export const badgeVariants = cva("flex-row items-center self-start rounded-full border px-3 py-1", {
  variants: {
    variant: {
      default: "bg-primary border-transparent",
      secondary: "border-outline-variant bg-secondary-container",
      outline: "border-outline-variant bg-surface-container-lowest",
      destructive: "bg-destructive-container border-transparent",
      success: "bg-success-container border-transparent",
      warning: "bg-warning-container border-transparent",
      info: "bg-info-container border-transparent",
    },
  },
  defaultVariants: {
    variant: "default",
  },
});

export const badgeTextVariants = cva("text-label-md", {
  variants: {
    variant: {
      default: "text-primary-foreground",
      secondary: "text-on-secondary-container",
      outline: "text-foreground",
      destructive: "text-on-destructive-container",
      success: "text-on-success-container",
      warning: "text-on-warning-container",
      info: "text-on-info-container",
    },
  },
  defaultVariants: {
    variant: "default",
  },
});

export interface BadgeProps
  extends Omit<ViewProps, "children">,
    VariantProps<typeof badgeVariants> {
  className?: string;
  textClassName?: string;
  children?: ReactNode;
}

export const Badge = forwardRef<ComponentRef<typeof View>, BadgeProps>(
  ({ className, textClassName, variant = "default", children, ...props }, ref) => {
    const resolvedTextClass = cn(badgeTextVariants({ variant }), textClassName);
    const renderedChildren =
      typeof children === "string" || typeof children === "number" ? (
        <Text>{children}</Text>
      ) : (
        children
      );

    return (
      <TextClassContext.Provider value={resolvedTextClass}>
        <View ref={ref} className={cn(badgeVariants({ variant }), className)} {...props}>
          {renderedChildren}
        </View>
      </TextClassContext.Provider>
    );
  },
);

Badge.displayName = "Badge";
