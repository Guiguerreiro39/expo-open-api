import * as Slot from "@rn-primitives/slot";
import { cva, type VariantProps } from "class-variance-authority";
import { type ComponentRef, createContext, forwardRef, useContext } from "react";
import { Text as RNText, type TextProps as RNTextProps } from "react-native";
import { cn } from "@/shared/lib/utils";

export const TextClassContext = createContext<string | undefined>(undefined);

const BASE_TEXT_CLASS = "text-foreground font-sans";

const TEXT_VARIANT_CLASSES = {
  default: "text-body-md",
  display: "font-display text-display-lg",
  h1: "font-display text-headline-xl",
  h2: "font-display text-headline-lg",
  h3: "font-sans-semibold text-headline-md",
  h4: "font-sans-semibold text-headline-sm",
  title: "font-sans-semibold text-title-md",
  lead: "font-sans-medium text-body-lg text-on-surface-variant",
  muted: "text-body-sm text-muted-foreground",
  label: "font-sans-bold text-label-lg",
  caption: "font-sans-semibold text-label-md text-on-surface-variant",
  mono: "font-mono text-body-sm",
} as const;

export const textVariants = cva(BASE_TEXT_CLASS, {
  variants: {
    variant: TEXT_VARIANT_CLASSES,
  },
  defaultVariants: {
    variant: "default",
  },
});

export interface TextProps extends RNTextProps, VariantProps<typeof textVariants> {
  asChild?: boolean;
  className?: string;
}

export const Text = forwardRef<ComponentRef<typeof RNText>, TextProps>(
  ({ className, variant, asChild = false, ...props }, ref) => {
    const inheritedClass = useContext(TextClassContext);
    const Component = asChild ? Slot.Text : RNText;
    const resolvedClassName = variant
      ? cn(BASE_TEXT_CLASS, inheritedClass, TEXT_VARIANT_CLASSES[variant], className)
      : cn(BASE_TEXT_CLASS, TEXT_VARIANT_CLASSES.default, inheritedClass, className);

    return <Component ref={ref} className={resolvedClassName} {...props} />;
  },
);

Text.displayName = "Text";
