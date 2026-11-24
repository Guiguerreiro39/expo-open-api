import * as Slot from "@rn-primitives/slot";
import { cva, type VariantProps } from "class-variance-authority";
import { type ComponentRef, createContext, forwardRef, useContext } from "react";
import { Text as RNText, type TextProps as RNTextProps } from "react-native";
import { cn } from "@/shared/lib/utils";

export const TextClassContext = createContext<string | undefined>(undefined);

export const textVariants = cva("text-foreground font-sans", {
  variants: {
    variant: {
      default: "text-body-md",
      display: "font-display text-display-lg",
      h1: "font-display text-headline-xl",
      h2: "font-display text-headline-lg",
      h3: "text-headline-md",
      h4: "text-headline-sm",
      title: "text-title-md",
      lead: "text-body-lg text-on-surface-variant",
      muted: "text-body-sm text-muted-foreground",
      label: "text-label-lg",
      caption: "text-label-md text-on-surface-variant",
      mono: "text-body-sm font-mono",
    },
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
    return (
      <Component
        ref={ref}
        className={cn(textVariants({ variant }), inheritedClass, className)}
        {...props}
      />
    );
  },
);

Text.displayName = "Text";
