import * as AvatarPrimitive from "@rn-primitives/avatar";
import { forwardRef, type ReactNode } from "react";
import { cn } from "@/shared/lib/utils";
import { Text, TextClassContext } from "@/shared/ui/text";

export interface AvatarProps extends AvatarPrimitive.RootProps {
  className?: string;
}

export const Avatar = forwardRef<AvatarPrimitive.RootRef, AvatarProps>(
  ({ className, ...props }, ref) => (
    <AvatarPrimitive.Root
      ref={ref}
      className={cn(
        "border-outline-variant bg-surface-container relative flex h-10 w-10 shrink-0 overflow-hidden rounded-full border",
        className,
      )}
      {...props}
    />
  ),
);

Avatar.displayName = "Avatar";

export interface AvatarImageProps extends AvatarPrimitive.ImageProps {
  className?: string;
}

export const AvatarImage = forwardRef<AvatarPrimitive.ImageRef, AvatarImageProps>(
  ({ className, ...props }, ref) => (
    <AvatarPrimitive.Image
      ref={ref}
      className={cn("aspect-square h-full w-full", className)}
      {...props}
    />
  ),
);

AvatarImage.displayName = "AvatarImage";

export interface AvatarFallbackProps extends Omit<AvatarPrimitive.FallbackProps, "children"> {
  className?: string;
  children?: ReactNode;
}

export const AvatarFallback = forwardRef<AvatarPrimitive.FallbackRef, AvatarFallbackProps>(
  ({ className, children, ...props }, ref) => (
    <TextClassContext.Provider value="text-label-md text-on-secondary-container font-bold">
      <AvatarPrimitive.Fallback
        ref={ref}
        className={cn(
          "bg-secondary-container flex h-full w-full items-center justify-center rounded-full",
          className,
        )}
        {...props}
      >
        {typeof children === "string" || typeof children === "number" ? (
          <Text>{children}</Text>
        ) : (
          children
        )}
      </AvatarPrimitive.Fallback>
    </TextClassContext.Provider>
  ),
);

AvatarFallback.displayName = "AvatarFallback";
