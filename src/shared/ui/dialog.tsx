import * as DialogPrimitive from "@rn-primitives/dialog";
import { X } from "lucide-react-native";
import { forwardRef, type ReactNode } from "react";
import { StyleSheet, View, type ViewProps } from "react-native";
import {
  DEFAULT_THEME_PRESET,
  getThemeElevation,
  type ThemePreset,
} from "@/shared/lib/theme/presets";
import { cn } from "@/shared/lib/utils";
import { Icon } from "@/shared/ui/icon";
import { useOptionalTheme } from "@/shared/ui/theme-provider";

const PRESET_DIALOG_RADIUS: Record<ThemePreset, string> = {
  "warm-tactile": "rounded-2xl",
  "editorial-slate": "rounded-xl",
  "neo-brutalist": "rounded-sm",
};

export const Dialog = DialogPrimitive.Root;
export const DialogTrigger = DialogPrimitive.Trigger;
export const DialogPortal = DialogPrimitive.Portal;
export const DialogClose = DialogPrimitive.Close;

export interface DialogOverlayProps extends DialogPrimitive.OverlayProps {
  className?: string;
}

export const DialogOverlay = forwardRef<DialogPrimitive.OverlayRef, DialogOverlayProps>(
  ({ className, ...props }, ref) => (
    <DialogPrimitive.Overlay
      ref={ref}
      style={StyleSheet.absoluteFill}
      className={cn("bg-foreground/45 z-50 items-center justify-center p-4", className)}
      {...props}
    />
  ),
);

DialogOverlay.displayName = "DialogOverlay";

export interface DialogContentProps extends Omit<DialogPrimitive.ContentProps, "children"> {
  className?: string;
  portalHost?: string;
  showCloseButton?: boolean;
  children?: ReactNode;
}

export const DialogContent = forwardRef<DialogPrimitive.ContentRef, DialogContentProps>(
  ({ className, style, children, portalHost, showCloseButton = true, ...props }, ref) => {
    const theme = useOptionalTheme();
    const preset = theme?.preset ?? DEFAULT_THEME_PRESET;
    const resolvedScheme = theme?.resolvedColorScheme ?? "light";
    const elevation = getThemeElevation(preset, resolvedScheme);
    const borderClass = elevation.borderWidth >= 2 ? "border-2" : "border";

    return (
      <DialogPortal hostName={portalHost}>
        <DialogOverlay>
          <DialogPrimitive.Content
            ref={ref}
            className={cn(
              PRESET_DIALOG_RADIUS[preset],
              borderClass,
              "border-outline-variant bg-card relative w-full max-w-md gap-4 p-6",
              className,
            )}
            style={[{ boxShadow: elevation.boxShadow }, style]}
            {...props}
          >
            {children}
            {showCloseButton ? (
              <DialogPrimitive.Close
                accessibilityLabel="Close dialog"
                hitSlop={8}
                className="bg-surface-container absolute top-4 right-4 rounded-lg p-1.5"
              >
                <Icon as={X} size={16} className="text-on-surface-variant" />
              </DialogPrimitive.Close>
            ) : null}
          </DialogPrimitive.Content>
        </DialogOverlay>
      </DialogPortal>
    );
  },
);

DialogContent.displayName = "DialogContent";

export function DialogHeader({ className, ...props }: ViewProps & { className?: string }) {
  return <View className={cn("flex-col gap-1.5 pr-8", className)} {...props} />;
}

export function DialogFooter({ className, ...props }: ViewProps & { className?: string }) {
  return <View className={cn("flex-row items-center justify-end gap-2", className)} {...props} />;
}

export interface DialogTitleProps extends DialogPrimitive.TitleProps {
  className?: string;
}

export const DialogTitle = forwardRef<DialogPrimitive.TitleRef, DialogTitleProps>(
  ({ className, ...props }, ref) => (
    <DialogPrimitive.Title
      ref={ref}
      className={cn("text-title-md text-card-foreground font-sans font-bold", className)}
      {...props}
    />
  ),
);

DialogTitle.displayName = "DialogTitle";

export interface DialogDescriptionProps extends DialogPrimitive.DescriptionProps {
  className?: string;
}

export const DialogDescription = forwardRef<DialogPrimitive.DescriptionRef, DialogDescriptionProps>(
  ({ className, ...props }, ref) => (
    <DialogPrimitive.Description
      ref={ref}
      className={cn("text-body-sm text-on-surface-variant font-sans", className)}
      {...props}
    />
  ),
);

DialogDescription.displayName = "DialogDescription";
