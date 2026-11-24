import { AlertCircle, RefreshCw, X } from "lucide-react-native";
import { View } from "react-native";
import {
  DEFAULT_THEME_PRESET,
  getThemeElevation,
  type ThemePreset,
} from "@/shared/lib/theme/presets";
import { cn } from "@/shared/lib/utils";
import { Alert, AlertDescription } from "@/shared/ui/alert";
import { Badge, type BadgeProps } from "@/shared/ui/badge";
import { Button } from "@/shared/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/ui/card";
import { Icon } from "@/shared/ui/icon";
import { Progress } from "@/shared/ui/progress";
import { Text } from "@/shared/ui/text";
import { useOptionalTheme } from "@/shared/ui/theme-provider";
import { formatFileSize, type UploadItem, type UploadStatus } from "../model/files";

export interface UploadProgressListProps {
  readonly items: readonly UploadItem[];
  readonly onCancel: (id: string) => void;
  readonly onRetry: (id: string) => void;
  readonly onRemove: (id: string) => void;
  readonly onClearCompleted: () => void;
}

const PRESET_ITEM_RADIUS: Record<ThemePreset, string> = {
  "warm-tactile": "rounded-xl",
  "editorial-slate": "rounded-lg",
  "neo-brutalist": "rounded-sm",
};

const STATUS_BADGE: Record<
  UploadStatus,
  { readonly label: string; readonly variant: BadgeProps["variant"] }
> = {
  idle: { label: "Idle", variant: "secondary" },
  queued: { label: "Queued", variant: "outline" },
  uploading: { label: "Uploading", variant: "info" },
  completed: { label: "Completed", variant: "success" },
  error: { label: "Failed", variant: "destructive" },
  aborted: { label: "Canceled", variant: "warning" },
};

export function UploadProgressList({
  items,
  onCancel,
  onRetry,
  onRemove,
  onClearCompleted,
}: UploadProgressListProps) {
  const theme = useOptionalTheme();
  const preset = theme?.preset ?? DEFAULT_THEME_PRESET;
  const scheme = theme?.resolvedColorScheme ?? "light";
  const elevation = getThemeElevation(preset, scheme);
  const borderClass = elevation.borderWidth >= 2 ? "border-2" : "border";

  if (items.length === 0) {
    return null;
  }

  const hasCompleted = items.some((item) => item.status === "completed");

  return (
    <Card>
      <CardHeader className="flex-row flex-wrap items-center justify-between gap-2">
        <CardTitle className="min-w-0 flex-1">{`Transfer Queue (${items.length})`}</CardTitle>
        {hasCompleted ? (
          <Button
            variant="ghost"
            size="sm"
            className="shrink-0"
            accessibilityLabel="Clear completed uploads"
            onPress={onClearCompleted}
          >
            Clear completed
          </Button>
        ) : null}
      </CardHeader>

      <CardContent className="gap-3">
        {items.map((item) => {
          const badge = STATUS_BADGE[item.status];
          const canCancel = item.status === "queued" || item.status === "uploading";
          const canRetry = item.status === "error" || item.status === "aborted";
          const clampedProgress = Math.min(100, Math.max(0, item.progress));

          return (
            <View
              key={item.id}
              className={cn(
                "border-outline-variant bg-surface-container-low gap-2 p-3",
                PRESET_ITEM_RADIUS[preset],
                borderClass,
              )}
            >
              <View className="flex-row flex-wrap items-start justify-between gap-2">
                <View className="min-w-0 flex-1 gap-0.5">
                  <Text variant="label" numberOfLines={1}>
                    {item.asset.name}
                  </Text>
                  <Text variant="caption" numberOfLines={1}>
                    {`${formatFileSize(item.loadedBytes)} / ${formatFileSize(item.totalBytes)} • ${item.progress}% • ${item.resolvedStrategy}`}
                  </Text>
                </View>
                <Badge variant={badge.variant} className="shrink-0">
                  {badge.label}
                </Badge>
              </View>

              <Progress
                value={clampedProgress}
                max={100}
                className="h-2"
                indicatorClassName={
                  item.status === "error"
                    ? "bg-destructive"
                    : item.status === "completed"
                      ? "bg-success"
                      : "bg-primary"
                }
              />

              {item.error ? (
                <Alert variant="destructive" className="p-3">
                  <View className="flex-row items-start gap-2">
                    <Icon
                      as={AlertCircle}
                      size={16}
                      className="text-on-destructive-container mt-0.5 shrink-0"
                    />
                    <AlertDescription className="min-w-0 flex-1">{item.error}</AlertDescription>
                  </View>
                </Alert>
              ) : null}

              <View className="flex-row flex-wrap items-center justify-end gap-2">
                {canCancel ? (
                  <Button
                    variant="outline"
                    size="sm"
                    accessibilityLabel={`Cancel ${item.asset.name}`}
                    onPress={() => onCancel(item.id)}
                  >
                    <Icon as={X} size={14} className="text-foreground" />
                    <Text>Cancel</Text>
                  </Button>
                ) : null}

                {canRetry ? (
                  <Button
                    variant="secondary"
                    size="sm"
                    accessibilityLabel={`Retry ${item.asset.name}`}
                    onPress={() => onRetry(item.id)}
                  >
                    <Icon as={RefreshCw} size={14} className="text-on-secondary-container" />
                    <Text>Retry</Text>
                  </Button>
                ) : null}

                {!canCancel ? (
                  <Button
                    variant="ghost"
                    size="sm"
                    accessibilityLabel={`Dismiss ${item.asset.name}`}
                    onPress={() => onRemove(item.id)}
                  >
                    Dismiss
                  </Button>
                ) : null}
              </View>
            </View>
          );
        })}
      </CardContent>
    </Card>
  );
}
