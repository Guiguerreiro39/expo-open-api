import * as CheckboxPrimitive from "@rn-primitives/checkbox";
import { Check } from "lucide-react-native";
import { forwardRef } from "react";
import { cn } from "@/shared/lib/utils";
import { Icon } from "@/shared/ui/icon";

export interface CheckboxProps extends CheckboxPrimitive.RootProps {
  className?: string;
  indicatorClassName?: string;
}

export const Checkbox = forwardRef<CheckboxPrimitive.RootRef, CheckboxProps>(
  ({ className, indicatorClassName, checked, disabled, accessibilityState, ...props }, ref) => (
    <CheckboxPrimitive.Root
      ref={ref}
      checked={checked}
      disabled={disabled}
      accessibilityState={{
        ...accessibilityState,
        checked: accessibilityState?.checked ?? checked,
        disabled: accessibilityState?.disabled ?? Boolean(disabled),
      }}
      className={cn(
        "border-outline bg-surface-container-lowest h-6 w-6 shrink-0 items-center justify-center rounded-md border",
        checked && "border-primary bg-primary",
        disabled && "opacity-50",
        className,
      )}
      {...props}
    >
      <CheckboxPrimitive.Indicator
        className={cn("h-full w-full items-center justify-center", indicatorClassName)}
      >
        <Icon as={Check} size={14} strokeWidth={3} className="text-primary-foreground" />
      </CheckboxPrimitive.Indicator>
    </CheckboxPrimitive.Root>
  ),
);

Checkbox.displayName = "Checkbox";
