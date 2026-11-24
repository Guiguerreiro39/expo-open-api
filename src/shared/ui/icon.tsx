import type { LucideIcon, LucideProps } from "lucide-react-native";
import { cssInterop } from "nativewind";
import { useContext } from "react";
import { cn } from "@/shared/lib/utils";
import { TextClassContext } from "@/shared/ui/text";

const NON_COLOR_TEXT_CLASS_REGEX =
  /^text-(?:left|center|right|justify|start|end|wrap|nowrap|balance|pretty|ellipsis|clip|xs|sm|base|lg|[2-9]?xl|display-\S+|headline-\S+|title-\S+|body-\S+|label-\S+)$/;

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

interface LucideIconAdapterProps extends LucideProps {
  icon: LucideIcon;
  className?: string;
}

function LucideIconAdapter({ icon: IconComponent, ...props }: LucideIconAdapterProps) {
  return <IconComponent {...props} />;
}

cssInterop(LucideIconAdapter, {
  className: {
    target: "style",
    nativeStyleToProp: {
      color: true,
      opacity: true,
    },
  },
});

function extractInheritedIconClasses(inheritedTextClass?: string): string | undefined {
  if (!inheritedTextClass) return undefined;
  const kept = inheritedTextClass
    .trim()
    .split(/\s+/)
    .filter((token) => {
      if (!token) return false;
      if (token.startsWith("opacity-")) return true;
      if (token.startsWith("text-") && !NON_COLOR_TEXT_CLASS_REGEX.test(token)) return true;
      return false;
    });
  return kept.length > 0 ? kept.join(" ") : undefined;
}

export interface IconProps extends LucideProps {
  as: LucideIcon;
  className?: string;
}

export function Icon({ as: IconComponent, className, size = 20, ...props }: IconProps) {
  const inheritedTextClass = useContext(TextClassContext);
  const inheritedIconClasses = extractInheritedIconClasses(inheritedTextClass);

  return (
    <LucideIconAdapter
      icon={IconComponent}
      size={size}
      className={cn("text-foreground", inheritedIconClasses, className)}
      {...props}
    />
  );
}
