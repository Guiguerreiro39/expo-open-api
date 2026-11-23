import * as ProgressPrimitive from "@rn-primitives/progress";
import { forwardRef } from "react";
import { cn } from "@/shared/lib/utils";

export interface ProgressProps extends ProgressPrimitive.RootProps {
  className?: string;
  indicatorClassName?: string;
}

export const Progress = forwardRef<ProgressPrimitive.RootRef, ProgressProps>(
  ({ className, indicatorClassName, value = 0, max = 100, ...props }, ref) => {
    const safeMax = max > 0 ? max : 100;
    const clamped = Math.min(100, Math.max(0, ((value ?? 0) / safeMax) * 100));

    return (
      <ProgressPrimitive.Root
        ref={ref}
        value={value}
        max={safeMax}
        className={cn(
          "bg-surface-container-high border-outline-variant h-3 w-full overflow-hidden rounded-full border",
          className,
        )}
        {...props}
      >
        <ProgressPrimitive.Indicator
          className={cn("bg-primary h-full rounded-full", indicatorClassName)}
          style={{ width: `${clamped}%` }}
        />
      </ProgressPrimitive.Root>
    );
  },
);

Progress.displayName = "Progress";
