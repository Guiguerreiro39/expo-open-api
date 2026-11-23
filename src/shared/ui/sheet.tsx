import * as DialogPrimitive from "@rn-primitives/dialog";
import { X } from "lucide-react-native";
import { forwardRef, type ReactNode } from "react";
import { StyleSheet, View, type ViewProps } from "react-native";
import { DEFAULT_THEME_PRESET, getThemeElevation } from "@/shared/lib/theme/presets";
import { cn } from "@/shared/lib/utils";
import { Icon } from "@/shared/ui/icon";
import { useOptionalTheme } from "@/shared/ui/theme-provider";

/**
 * Bottom-slide Sheet built on headless `@rn-primitives/dialog` (per ADR 0007 — no `@gorhom/bottom-sheet`).
 */
export const Sheet = DialogPrimitive.Root;
export const SheetTrigger = DialogPrimitive.Trigger;
export const SheetClose = DialogPrimitive.Close;
export const SheetPortal = DialogPrimitive.Portal;

export interface SheetContentProps extends Omit<DialogPrimitive.ContentProps, "children"> {
  className?: string;
  portalHost?: string;
  showHandle?: boolean;
  showCloseButton?: boolean;
  children?: ReactNode;
}

export const SheetContent = forwardRef<DialogPrimitive.ContentRef, SheetContentProps>(
  (
    { className, style, children, portalHost, showHandle = true, showCloseButton = true, ...props },
    ref,
  ) => {
    const theme = useOptionalTheme();
    const preset = theme?.preset ?? DEFAULT_THEME_PRESET;
    const resolvedScheme = theme?.resolvedColorScheme ?? "light";
    const elevation = getThemeElevation(preset, resolvedScheme);

    return (
      <SheetPortal hostName={portalHost}>
        <DialogPrimitive.Overlay
          style={StyleSheet.absoluteFill}
          className="bg-foreground/45 z-50 justify-end"
        >
          <DialogPrimitive.Content
            ref={ref}
            className={cn(
              "border-outline-variant bg-surface-container-highest relative w-full gap-4 rounded-t-3xl border-x border-t px-6 pt-3 pb-8",
              className,
            )}
            style={[{ boxShadow: elevation.boxShadow }, style]}
            {...props}
          >
            {showHandle ? (
              <View className="bg-outline-variant mx-auto h-1.5 w-12 rounded-full" />
            ) : null}
            {children}
            {showCloseButton ? (
              <DialogPrimitive.Close
                accessibilityLabel="Close sheet"
                hitSlop={8}
                className="bg-surface-container absolute top-4 right-4 rounded-lg p-1.5"
              >
                <Icon as={X} size={16} className="text-on-surface-variant" />
              </DialogPrimitive.Close>
            ) : null}
          </DialogPrimitive.Content>
        </DialogPrimitive.Overlay>
      </SheetPortal>
    );
  },
);

SheetContent.displayName = "SheetContent";

export function SheetHeader({ className, ...props }: ViewProps & { className?: string }) {
  return <View className={cn("flex-col gap-1.5 pr-8", className)} {...props} />;
}

export function SheetFooter({ className, ...props }: ViewProps & { className?: string }) {
  return <View className={cn("flex-row items-center justify-end gap-2", className)} {...props} />;
}

export interface SheetTitleProps extends DialogPrimitive.TitleProps {
  className?: string;
}

export const SheetTitle = forwardRef<DialogPrimitive.TitleRef, SheetTitleProps>(
  ({ className, ...props }, ref) => (
    <DialogPrimitive.Title
      ref={ref}
      className={cn("text-title-md text-foreground font-sans font-bold", className)}
      {...props}
    />
  ),
);

SheetTitle.displayName = "SheetTitle";

export interface SheetDescriptionProps extends DialogPrimitive.DescriptionProps {
  className?: string;
}

export const SheetDescription = forwardRef<DialogPrimitive.DescriptionRef, SheetDescriptionProps>(
  ({ className, ...props }, ref) => (
    <DialogPrimitive.Description
      ref={ref}
      className={cn("text-body-sm text-on-surface-variant font-sans", className)}
      {...props}
    />
  ),
);

SheetDescription.displayName = "SheetDescription";
