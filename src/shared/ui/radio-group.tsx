import * as RadioGroupPrimitive from "@rn-primitives/radio-group";
import { forwardRef } from "react";
import { View } from "react-native";
import { cn } from "@/shared/lib/utils";

export interface RadioGroupProps extends RadioGroupPrimitive.RootProps {
  className?: string;
}

export const RadioGroup = forwardRef<RadioGroupPrimitive.RootRef, RadioGroupProps>(
  ({ className, ...props }, ref) => (
    <RadioGroupPrimitive.Root ref={ref} className={cn("gap-2.5", className)} {...props} />
  ),
);

RadioGroup.displayName = "RadioGroup";

export interface RadioGroupItemProps extends RadioGroupPrimitive.ItemProps {
  className?: string;
}

export const RadioGroupItem = forwardRef<RadioGroupPrimitive.ItemRef, RadioGroupItemProps>(
  ({ className, disabled, ...props }, ref) => (
    <RadioGroupPrimitive.Item
      ref={ref}
      disabled={disabled}
      className={cn(
        "border-outline bg-surface-container-lowest h-6 w-6 items-center justify-center rounded-full border",
        disabled && "opacity-50",
        className,
      )}
      {...props}
    >
      <RadioGroupPrimitive.Indicator className="items-center justify-center">
        <View className="bg-primary h-3 w-3 rounded-full" />
      </RadioGroupPrimitive.Indicator>
    </RadioGroupPrimitive.Item>
  ),
);

RadioGroupItem.displayName = "RadioGroupItem";
