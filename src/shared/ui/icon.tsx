import type { LucideIcon, LucideProps } from "lucide-react-native";
import { cssInterop } from "nativewind";
import { cn } from "@/shared/lib/utils";

const registeredIcons = new WeakSet<LucideIcon>();

export function iconWithClassName(icon: LucideIcon): LucideIcon {
  if (!registeredIcons.has(icon)) {
    cssInterop(icon, {
      className: {
        target: "style",
        nativeStyleToProp: {
          color: true,
          opacity: true,
        },
      },
    });
    registeredIcons.add(icon);
  }
  return icon;
}

export interface IconProps extends LucideProps {
  as: LucideIcon;
  className?: string;
}

export function Icon({ as: IconComponent, className, size = 20, ...props }: IconProps) {
  const StyledIcon = iconWithClassName(IconComponent);
  return <StyledIcon size={size} className={cn("text-foreground", className)} {...props} />;
}
