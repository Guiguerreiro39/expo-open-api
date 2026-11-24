import * as LabelPrimitive from "@rn-primitives/label";
import { forwardRef } from "react";
import { cn } from "@/shared/lib/utils";

const ROOT_LAYOUT_CLASS_REGEX =
  /^(?:flex(?:-\S+)?|shrink(?:-\S+)?|grow(?:-\S+)?|basis-\S+|self-\S+|w-\S+|min-w-\S+|max-w-\S+|m[trblxy]?-\S+)$/;
const FLEXIBLE_WIDTH_CLASS_REGEX =
  /^(?:flex(?:-(?:1|auto|initial|shrink|grow))?|shrink(?:-\S+)?|grow(?:-\S+)?|basis-\S+|w-\S+|min-w-\S+|max-w-\S+)$/;

function splitLabelClasses(className?: string): {
  readonly layoutClasses: string[];
  readonly textClasses: string[];
} {
  const layoutClasses: string[] = [];
  const textClasses: string[] = [];

  if (!className) {
    return { layoutClasses, textClasses };
  }

  for (const token of className.trim().split(/\s+/)) {
    if (!token) continue;
    if (ROOT_LAYOUT_CLASS_REGEX.test(token)) {
      layoutClasses.push(token);
    } else {
      textClasses.push(token);
    }
  }

  return { layoutClasses, textClasses };
}

export interface LabelProps
  extends Omit<LabelPrimitive.TextProps, "onPress" | "onLongPress" | "onPressIn" | "onPressOut"> {
  className?: string;
  rootClassName?: string;
  onPress?: LabelPrimitive.RootProps["onPress"];
  onLongPress?: LabelPrimitive.RootProps["onLongPress"];
  onPressIn?: LabelPrimitive.RootProps["onPressIn"];
  onPressOut?: LabelPrimitive.RootProps["onPressOut"];
}

export const Label = forwardRef<LabelPrimitive.TextRef, LabelProps>(
  ({ className, rootClassName, onPress, onLongPress, onPressIn, onPressOut, ...props }, ref) => {
    const { layoutClasses, textClasses } = splitLabelClasses(className);
    const rootTokens = [
      ...layoutClasses,
      ...(rootClassName ? rootClassName.trim().split(/\s+/).filter(Boolean) : []),
    ];
    const hasCustomSelfOrFlex = rootTokens.some(
      (token) => token.startsWith("self-") || FLEXIBLE_WIDTH_CLASS_REGEX.test(token),
    );
    const hasFlexibleWidth = rootTokens.some((token) => FLEXIBLE_WIDTH_CLASS_REGEX.test(token));

    return (
      <LabelPrimitive.Root
        className={cn(
          !hasCustomSelfOrFlex && "self-start",
          hasFlexibleWidth && "min-w-0",
          layoutClasses.join(" "),
          rootClassName,
        )}
        onPress={onPress}
        onLongPress={onLongPress}
        onPressIn={onPressIn}
        onPressOut={onPressOut}
      >
        <LabelPrimitive.Text
          ref={ref}
          className={cn("text-foreground text-label-lg font-sans-bold", textClasses.join(" "))}
          {...props}
        />
      </LabelPrimitive.Root>
    );
  },
);

Label.displayName = "Label";
