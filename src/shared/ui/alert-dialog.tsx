import * as AlertDialogPrimitive from "@rn-primitives/alert-dialog";
import { forwardRef, type ReactNode } from "react";
import { View, type ViewProps } from "react-native";
import {
  DEFAULT_THEME_PRESET,
  getThemeElevation,
  type ThemePreset,
} from "@/shared/lib/theme/presets";
import { cn } from "@/shared/lib/utils";
import { buttonTextVariants, buttonVariants } from "@/shared/ui/button";
import { Text, TextClassContext } from "@/shared/ui/text";
import { useOptionalTheme } from "@/shared/ui/theme-provider";
import { getOverlayFillStyle, getWebClickGuardProps } from "@/shared/ui/web-overlay";

const PRESET_ALERT_DIALOG_RADIUS: Record<ThemePreset, string> = {
  "warm-tactile": "rounded-2xl",
  "editorial-slate": "rounded-xl",
  "neo-brutalist": "rounded-sm",
};

const PRESET_ACTION_RADIUS: Record<ThemePreset, string> = {
  "warm-tactile": "rounded-xl",
  "editorial-slate": "rounded-lg",
  "neo-brutalist": "rounded-sm",
};

export const AlertDialog = AlertDialogPrimitive.Root;
export const AlertDialogPortal = AlertDialogPrimitive.Portal;

export const AlertDialogTrigger = forwardRef<
  AlertDialogPrimitive.TriggerRef,
  AlertDialogPrimitive.TriggerProps
>((props, ref) => {
  const webProps = getWebClickGuardProps(props);

  return <AlertDialogPrimitive.Trigger ref={ref} {...props} {...webProps} />;
});

AlertDialogTrigger.displayName = "AlertDialogTrigger";

export interface AlertDialogOverlayProps extends AlertDialogPrimitive.OverlayProps {
  className?: string;
}

export const AlertDialogOverlay = forwardRef<
  AlertDialogPrimitive.OverlayRef,
  AlertDialogOverlayProps
>(({ className, style, ...props }, ref) => (
  <AlertDialogPrimitive.Overlay
    ref={ref}
    testID="alert-dialog-overlay"
    style={[getOverlayFillStyle(), style]}
    className={cn(
      "bg-scrim/55 web:fixed web:inset-0 z-50 flex items-center justify-center p-4",
      className,
    )}
    {...props}
  />
));

AlertDialogOverlay.displayName = "AlertDialogOverlay";

export interface AlertDialogContentProps extends AlertDialogPrimitive.ContentProps {
  className?: string;
  portalHost?: string;
}

export const AlertDialogContent = forwardRef<
  AlertDialogPrimitive.ContentRef,
  AlertDialogContentProps
>(({ className, style, portalHost, ...props }, ref) => {
  const theme = useOptionalTheme();
  const preset = theme?.preset ?? DEFAULT_THEME_PRESET;
  const resolvedScheme = theme?.resolvedColorScheme ?? "light";
  const elevation = getThemeElevation(preset, resolvedScheme);
  const borderClass = elevation.borderWidth >= 2 ? "border-2" : "border";

  return (
    <AlertDialogPortal hostName={portalHost}>
      <AlertDialogOverlay>
        <AlertDialogPrimitive.Content
          ref={ref}
          className={cn(
            PRESET_ALERT_DIALOG_RADIUS[preset],
            borderClass,
            "border-outline-variant bg-card web:w-[calc(100vw-2rem)] w-full max-w-md gap-4 p-6",
            className,
          )}
          style={[{ boxShadow: elevation.boxShadow }, style]}
          {...props}
        />
      </AlertDialogOverlay>
    </AlertDialogPortal>
  );
});

AlertDialogContent.displayName = "AlertDialogContent";

export function AlertDialogHeader({ className, ...props }: ViewProps & { className?: string }) {
  return <View className={cn("flex-col gap-1.5", className)} {...props} />;
}

export function AlertDialogFooter({ className, ...props }: ViewProps & { className?: string }) {
  return <View className={cn("flex-row items-center justify-end gap-2", className)} {...props} />;
}

export interface AlertDialogTitleProps extends AlertDialogPrimitive.TitleProps {
  className?: string;
}

export const AlertDialogTitle = forwardRef<AlertDialogPrimitive.TitleRef, AlertDialogTitleProps>(
  ({ className, ...props }, ref) => (
    <AlertDialogPrimitive.Title
      ref={ref}
      className={cn("text-title-md text-card-foreground font-sans font-bold", className)}
      {...props}
    />
  ),
);

AlertDialogTitle.displayName = "AlertDialogTitle";

export interface AlertDialogDescriptionProps extends AlertDialogPrimitive.DescriptionProps {
  className?: string;
}

export const AlertDialogDescription = forwardRef<
  AlertDialogPrimitive.DescriptionRef,
  AlertDialogDescriptionProps
>(({ className, ...props }, ref) => (
  <AlertDialogPrimitive.Description
    ref={ref}
    className={cn("text-body-sm text-on-surface-variant font-sans", className)}
    {...props}
  />
));

AlertDialogDescription.displayName = "AlertDialogDescription";

export interface AlertDialogActionProps extends Omit<AlertDialogPrimitive.ActionProps, "children"> {
  className?: string;
  children?: ReactNode;
}

export const AlertDialogAction = forwardRef<AlertDialogPrimitive.ActionRef, AlertDialogActionProps>(
  ({ className, children, ...props }, ref) => {
    const theme = useOptionalTheme();
    const preset = theme?.preset ?? DEFAULT_THEME_PRESET;
    const resolvedScheme = theme?.resolvedColorScheme ?? "light";
    const elevation = getThemeElevation(preset, resolvedScheme);
    const borderClass = elevation.borderWidth >= 2 ? "border-2" : "border";
    const webProps = getWebClickGuardProps(props);

    return (
      <TextClassContext.Provider value={buttonTextVariants({ variant: "destructive", size: "sm" })}>
        <AlertDialogPrimitive.Action
          ref={ref}
          className={cn(
            buttonVariants({ variant: "destructive", size: "sm" }),
            PRESET_ACTION_RADIUS[preset],
            borderClass,
            className,
          )}
          {...props}
          {...webProps}
        >
          {typeof children === "string" || typeof children === "number" ? (
            <Text>{children}</Text>
          ) : (
            children
          )}
        </AlertDialogPrimitive.Action>
      </TextClassContext.Provider>
    );
  },
);

AlertDialogAction.displayName = "AlertDialogAction";

export interface AlertDialogCancelProps extends Omit<AlertDialogPrimitive.CancelProps, "children"> {
  className?: string;
  children?: ReactNode;
}

export const AlertDialogCancel = forwardRef<AlertDialogPrimitive.CancelRef, AlertDialogCancelProps>(
  ({ className, children, ...props }, ref) => {
    const theme = useOptionalTheme();
    const preset = theme?.preset ?? DEFAULT_THEME_PRESET;
    const resolvedScheme = theme?.resolvedColorScheme ?? "light";
    const elevation = getThemeElevation(preset, resolvedScheme);
    const borderClass = elevation.borderWidth >= 2 ? "border-2" : "border";
    const webProps = getWebClickGuardProps(props);

    return (
      <TextClassContext.Provider value={buttonTextVariants({ variant: "outline", size: "sm" })}>
        <AlertDialogPrimitive.Cancel
          ref={ref}
          className={cn(
            buttonVariants({ variant: "outline", size: "sm" }),
            PRESET_ACTION_RADIUS[preset],
            borderClass,
            className,
          )}
          {...props}
          {...webProps}
        >
          {typeof children === "string" || typeof children === "number" ? (
            <Text>{children}</Text>
          ) : (
            children
          )}
        </AlertDialogPrimitive.Cancel>
      </TextClassContext.Provider>
    );
  },
);

AlertDialogCancel.displayName = "AlertDialogCancel";
