import { Radio } from "lucide-react-native";
import { View } from "react-native";
import type { LiveConnectionStatus } from "@/shared/lib/hooks/use-live-query";
import { cn } from "@/shared/lib/utils";
import { Badge, type BadgeProps } from "@/shared/ui/badge";
import { Icon } from "@/shared/ui/icon";
import { Text } from "@/shared/ui/text";

export interface LiveQueryBadgeProps {
  readonly status: LiveConnectionStatus;
  readonly lastPingAt?: number | null;
  readonly className?: string;
}

interface StatusVisualConfig {
  readonly label: string;
  readonly badgeVariant: NonNullable<BadgeProps["variant"]>;
  readonly dotClass: string;
  readonly iconClass: string;
}

function getStatusConfig(status: LiveConnectionStatus): StatusVisualConfig {
  switch (status) {
    case "connected":
      return {
        label: "Live Connected",
        badgeVariant: "success",
        dotClass: "bg-success",
        iconClass: "text-on-success-container",
      };
    case "connecting":
      return {
        label: "Connecting...",
        badgeVariant: "warning",
        dotClass: "bg-warning",
        iconClass: "text-on-warning-container",
      };
    case "reconnecting":
      return {
        label: "Reconnecting...",
        badgeVariant: "warning",
        dotClass: "bg-warning",
        iconClass: "text-on-warning-container",
      };
    case "error":
      return {
        label: "Disconnected",
        badgeVariant: "destructive",
        dotClass: "bg-destructive",
        iconClass: "text-on-destructive-container",
      };
    default:
      return {
        label: "Idle",
        badgeVariant: "outline",
        dotClass: "bg-muted-foreground",
        iconClass: "text-foreground",
      };
  }
}

export function LiveQueryBadge({ status, lastPingAt, className }: LiveQueryBadgeProps) {
  const { label, badgeVariant, dotClass, iconClass } = getStatusConfig(status);
  const accessibilityHint = lastPingAt
    ? `Last live heartbeat at ${new Date(lastPingAt).toLocaleTimeString()}`
    : undefined;

  return (
    <Badge
      variant={badgeVariant}
      accessibilityRole="text"
      accessibilityLabel={`Live stream status: ${label}`}
      accessibilityHint={accessibilityHint}
      className={cn("gap-1.5 px-3 py-1", className)}
    >
      <View className={cn("h-2 w-2 rounded-full", dotClass)} />
      <Icon as={Radio} size={13} className={iconClass} />
      <Text className="text-label-md">{label}</Text>
    </Badge>
  );
}
