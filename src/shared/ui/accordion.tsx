import * as AccordionPrimitive from "@rn-primitives/accordion";
import { ChevronDown, ChevronUp } from "lucide-react-native";
import { forwardRef, type ReactNode } from "react";
import { View } from "react-native";
import { cn } from "@/shared/lib/utils";
import { Icon } from "@/shared/ui/icon";
import { Text, TextClassContext } from "@/shared/ui/text";

export type AccordionProps = AccordionPrimitive.RootProps & {
  className?: string;
};

export const Accordion = forwardRef<AccordionPrimitive.RootRef, AccordionProps>(
  ({ className, ...props }, ref) => (
    <AccordionPrimitive.Root ref={ref} className={cn("w-full gap-2", className)} {...props} />
  ),
);

Accordion.displayName = "Accordion";

export interface AccordionItemProps extends AccordionPrimitive.ItemProps {
  className?: string;
}

export const AccordionItem = forwardRef<AccordionPrimitive.ItemRef, AccordionItemProps>(
  ({ className, ...props }, ref) => (
    <AccordionPrimitive.Item
      ref={ref}
      className={cn(
        "border-outline-variant bg-surface-container-lowest overflow-hidden rounded-xl border",
        className,
      )}
      {...props}
    />
  ),
);

AccordionItem.displayName = "AccordionItem";

export interface AccordionTriggerProps extends Omit<AccordionPrimitive.TriggerProps, "children"> {
  className?: string;
  children?: ReactNode;
}

export const AccordionTrigger = forwardRef<AccordionPrimitive.TriggerRef, AccordionTriggerProps>(
  ({ className, children, ...props }, ref) => {
    const { isExpanded } = AccordionPrimitive.useItemContext();

    return (
      <TextClassContext.Provider value="text-body-md text-foreground font-semibold">
        <AccordionPrimitive.Header className="flex">
          <AccordionPrimitive.Trigger
            ref={ref}
            className={cn("flex-row items-center justify-between gap-3 px-4 py-3.5", className)}
            {...props}
          >
            <View className="flex-1">
              {typeof children === "string" || typeof children === "number" ? (
                <Text>{children}</Text>
              ) : (
                children
              )}
            </View>
            <Icon
              as={isExpanded ? ChevronUp : ChevronDown}
              size={18}
              className="text-on-surface-variant"
            />
          </AccordionPrimitive.Trigger>
        </AccordionPrimitive.Header>
      </TextClassContext.Provider>
    );
  },
);

AccordionTrigger.displayName = "AccordionTrigger";

export interface AccordionContentProps extends Omit<AccordionPrimitive.ContentProps, "children"> {
  className?: string;
  children?: ReactNode;
}

export const AccordionContent = forwardRef<AccordionPrimitive.ContentRef, AccordionContentProps>(
  ({ className, children, ...props }, ref) => (
    <TextClassContext.Provider value="text-body-sm text-on-surface-variant">
      <AccordionPrimitive.Content
        ref={ref}
        className={cn("border-outline-variant/60 border-t px-4 py-3", className)}
        {...props}
      >
        {typeof children === "string" || typeof children === "number" ? (
          <Text>{children}</Text>
        ) : (
          children
        )}
      </AccordionPrimitive.Content>
    </TextClassContext.Provider>
  ),
);

AccordionContent.displayName = "AccordionContent";
