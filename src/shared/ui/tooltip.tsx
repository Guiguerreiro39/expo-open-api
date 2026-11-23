import * as TooltipPrimitive from "@rn-primitives/tooltip";
import { forwardRef, type ReactNode } from "react";
import { StyleSheet, View } from "react-native";
import { cn } from "@/shared/lib/utils";
import { Text, TextClassContext } from "@/shared/ui/text";

export const Tooltip = TooltipPrimitive.Root;
export const TooltipTrigger = TooltipPrimitive.Trigger;

export interface TooltipContentProps extends Omit<TooltipPrimitive.ContentProps, "children"> {
  className?: string;
  portalHost?: string;
  children?: ReactNode;
}

export const TooltipContent = forwardRef<TooltipPrimitive.ContentRef, TooltipContentProps>(
  ({ className, sideOffset = 6, portalHost, children, ...props }, ref) => (
    <TooltipPrimitive.Portal hostName={portalHost}>
      <TooltipPrimitive.Overlay style={StyleSheet.absoluteFill}>
        <View className="flex-1 items-center justify-center p-4" pointerEvents="box-none">
          <TextClassContext.Provider value="text-label-md text-inverse-on-surface">
            <TooltipPrimitive.Content
              ref={ref}
              sideOffset={sideOffset}
              className={cn(
                "bg-inverse-surface border-outline-variant z-50 rounded-lg border px-3 py-1.5",
                className,
              )}
              {...props}
            >
              {typeof children === "string" || typeof children === "number" ? (
                <Text>{children}</Text>
              ) : (
                children
              )}
            </TooltipPrimitive.Content>
          </TextClassContext.Provider>
        </View>
      </TooltipPrimitive.Overlay>
    </TooltipPrimitive.Portal>
  ),
);

TooltipContent.displayName = "TooltipContent";
