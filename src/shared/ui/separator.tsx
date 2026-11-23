import * as SeparatorPrimitive from "@rn-primitives/separator";
import { forwardRef } from "react";
import { cn } from "@/shared/lib/utils";

export interface SeparatorProps extends SeparatorPrimitive.RootProps {
  className?: string;
}

export const Separator = forwardRef<SeparatorPrimitive.RootRef, SeparatorProps>(
  ({ className, orientation = "horizontal", decorative = true, ...props }, ref) => (
    <SeparatorPrimitive.Root
      ref={ref}
      decorative={decorative}
      orientation={orientation}
      className={cn(
        "bg-outline-variant shrink-0",
        orientation === "horizontal" ? "h-px w-full" : "h-full w-px",
        className,
      )}
      {...props}
    />
  ),
);

Separator.displayName = "Separator";
