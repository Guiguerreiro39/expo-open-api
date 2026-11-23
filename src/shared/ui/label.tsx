import * as LabelPrimitive from "@rn-primitives/label";
import { forwardRef } from "react";
import { cn } from "@/shared/lib/utils";

export interface LabelProps
  extends Omit<LabelPrimitive.TextProps, "onPress" | "onLongPress" | "onPressIn" | "onPressOut"> {
  className?: string;
  onPress?: LabelPrimitive.RootProps["onPress"];
  onLongPress?: LabelPrimitive.RootProps["onLongPress"];
  onPressIn?: LabelPrimitive.RootProps["onPressIn"];
  onPressOut?: LabelPrimitive.RootProps["onPressOut"];
}

export const Label = forwardRef<LabelPrimitive.TextRef, LabelProps>(
  ({ className, onPress, onLongPress, onPressIn, onPressOut, ...props }, ref) => (
    <LabelPrimitive.Root
      className="self-start"
      onPress={onPress}
      onLongPress={onLongPress}
      onPressIn={onPressIn}
      onPressOut={onPressOut}
    >
      <LabelPrimitive.Text
        ref={ref}
        className={cn("text-foreground text-label-lg font-sans", className)}
        {...props}
      />
    </LabelPrimitive.Root>
  ),
);

Label.displayName = "Label";
