import { RefreshCw, X } from "lucide-react-native";
import { View } from "react-native";
import { Badge, type BadgeProps } from "@/shared/ui/badge";
import { Button } from "@/shared/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/ui/card";
import { Icon } from "@/shared/ui/icon";
import { Text } from "@/shared/ui/text";
import { formatFileSize, type UploadItem, type UploadStatus } from "../model/files";

export interface UploadProgressListProps {
  readonly items: readonly UploadItem[];
  readonly onCancel: (id: string) => void;
  readonly onRetry: (id: string) => void;
  readonly onRemove: (id: string) => void;
  readonly onClearCompleted: () => void;
}

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
  if (items.length === 0) {
    return null;
  }

  const hasCompleted = items.some((item) => item.status === "completed");

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between gap-2">
        <CardTitle>Transfer Queue ({items.length})</CardTitle>
        {hasCompleted ? (
          <Button
            variant="ghost"
            size="sm"
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
          const fillWidth = `${Math.min(100, Math.max(0, item.progress))}%` as const;

          return (
            <View
              key={item.id}
              className="border-outline-variant bg-surface-container-low gap-2 rounded-xl border p-3"
            >
              <View className="flex-row items-start justify-between gap-2">
                <View className="flex-1 gap-0.5">
                  <Text variant="label" numberOfLines={1}>
                    {item.asset.name}
                  </Text>
                  <Text variant="caption">
                    {`${formatFileSize(item.loadedBytes)} / ${formatFileSize(item.totalBytes)} • ${item.progress}% • ${item.resolvedStrategy}`}
                  </Text>
                </View>
                <Badge variant={badge.variant}>{badge.label}</Badge>
              </View>

              <View
                accessibilityRole="progressbar"
                accessibilityValue={{ min: 0, max: 100, now: item.progress }}
                className="bg-surface-container-highest h-2 w-full overflow-hidden rounded-full"
              >
                <View
                  className={
                    item.status === "error"
                      ? "bg-destructive h-full rounded-full"
                      : item.status === "completed"
                        ? "bg-success h-full rounded-full"
                        : "bg-primary h-full rounded-full"
                  }
                  style={{ width: fillWidth }}
                />
              </View>

              {item.error ? (
                <Text variant="caption" className="text-destructive">
                  {item.error}
                </Text>
              ) : null}

              <View className="flex-row items-center justify-end gap-2">
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
