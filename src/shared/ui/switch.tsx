import * as SwitchPrimitive from "@rn-primitives/switch";
import { forwardRef } from "react";
import { cn } from "@/shared/lib/utils";

export interface SwitchProps extends SwitchPrimitive.RootProps {
  className?: string;
  thumbClassName?: string;
}

export const Switch = forwardRef<SwitchPrimitive.RootRef, SwitchProps>(
  ({ className, thumbClassName, checked, disabled, ...props }, ref) => (
    <SwitchPrimitive.Root
      ref={ref}
      checked={checked}
      disabled={disabled}
      className={cn(
        "h-7 w-12 shrink-0 flex-row items-center rounded-full border p-0.5",
        checked
          ? "border-primary bg-primary justify-end"
          : "border-outline-variant bg-surface-container-high justify-start",
        disabled && "opacity-50",
        className,
      )}
      {...props}
    >
      <SwitchPrimitive.Thumb
        className={cn(
          "h-5 w-5 rounded-full",
          checked ? "bg-primary-foreground" : "bg-surface-container-lowest",
          thumbClassName,
        )}
      />
    </SwitchPrimitive.Root>
  ),
);

Switch.displayName = "Switch";
