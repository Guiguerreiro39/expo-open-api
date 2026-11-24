import { AlertCircle, Download, ExternalLink, Paperclip, Trash2 } from "lucide-react-native";
import type { ReactElement } from "react";
import { ActivityIndicator, FlatList, RefreshControl, View } from "react-native";
import { DEFAULT_THEME_PRESET, resolveThemeColor } from "@/shared/lib/theme/presets";
import { Alert, AlertDescription, AlertTitle } from "@/shared/ui/alert";
import { Badge } from "@/shared/ui/badge";
import { Button } from "@/shared/ui/button";
import { Can } from "@/shared/ui/can";
import { Card, CardContent } from "@/shared/ui/card";
import { Icon } from "@/shared/ui/icon";
import { Text } from "@/shared/ui/text";
import { useOptionalTheme } from "@/shared/ui/theme-provider";
import { type FileRecord, formatFileSize } from "../model/files";

export interface FileListProps {
  readonly files: readonly FileRecord[];
  readonly isLoading?: boolean;
  readonly isRefreshing?: boolean;
  readonly errorMessage?: string | null;
  readonly busyFileIds?: ReadonlySet<string>;
  readonly deletingFileIds?: ReadonlySet<string>;
  readonly hasNextPage?: boolean;
  readonly isFetchingNextPage?: boolean;
  readonly header?: ReactElement;
  readonly onRefresh?: () => void;
  readonly onLoadMore?: () => void;
  readonly onDownloadShare: (file: FileRecord) => void;
  readonly onPreviewUrl: (file: FileRecord) => void;
  readonly onDelete: (file: FileRecord) => void;
}

export function FileList({
  files,
  isLoading = false,
  isRefreshing = false,
  errorMessage,
  busyFileIds,
  deletingFileIds,
  hasNextPage = false,
  isFetchingNextPage = false,
  header,
  onRefresh,
  onLoadMore,
  onDownloadShare,
  onPreviewUrl,
  onDelete,
}: FileListProps) {
  const theme = useOptionalTheme();
  const preset = theme?.preset ?? DEFAULT_THEME_PRESET;
  const scheme = theme?.resolvedColorScheme ?? "light";
  const primaryColor = resolveThemeColor(preset, scheme, "primary");

  const showRefreshErrorBanner = Boolean(errorMessage && files.length > 0);
  const listHeader =
    header || showRefreshErrorBanner ? (
      <View className="gap-3">
        {header}
        {showRefreshErrorBanner ? (
          <Alert variant="destructive">
            <View className="flex-row items-start gap-2.5">
              <Icon
                as={AlertCircle}
                size={18}
                className="text-on-destructive-container mt-0.5 shrink-0"
              />
              <View className="min-w-0 flex-1 gap-2">
                <View className="gap-0.5">
                  <AlertTitle>Unable to refresh files</AlertTitle>
                  <AlertDescription>{errorMessage}</AlertDescription>
                </View>
                {onRefresh ? (
                  <View className="self-start">
                    <Button variant="outline" size="sm" onPress={onRefresh}>
                      Try Again
                    </Button>
                  </View>
                ) : null}
              </View>
            </View>
          </Alert>
        ) : null}
      </View>
    ) : undefined;

  return (
    <FlatList
      data={files}
      keyExtractor={(item) => item.id}
      refreshControl={
        onRefresh ? (
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={onRefresh}
            tintColor={primaryColor}
            colors={[primaryColor]}
          />
        ) : undefined
      }
      contentContainerClassName="gap-4 px-5 pb-10 pt-4"
      ListHeaderComponent={listHeader}
      ListEmptyComponent={
        isLoading ? (
          <Card>
            <CardContent className="items-center gap-3 py-8">
              <ActivityIndicator color={primaryColor} />
              <Text variant="muted">Loading files...</Text>
            </CardContent>
          </Card>
        ) : errorMessage ? (
          <Alert variant="destructive">
            <View className="flex-row items-start gap-2.5">
              <Icon
                as={AlertCircle}
                size={18}
                className="text-on-destructive-container mt-0.5 shrink-0"
              />
              <View className="min-w-0 flex-1 gap-3">
                <View className="gap-0.5">
                  <AlertTitle>Unable to load files</AlertTitle>
                  <AlertDescription>{errorMessage}</AlertDescription>
                </View>
                {onRefresh ? (
                  <View className="self-start">
                    <Button variant="outline" size="sm" onPress={onRefresh}>
                      Try Again
                    </Button>
                  </View>
                ) : null}
              </View>
            </View>
          </Alert>
        ) : (
          <Card>
            <CardContent className="items-center gap-2 py-8">
              <Icon as={Paperclip} size={24} className="text-on-surface-variant" />
              <Text variant="title">No files uploaded yet</Text>
              <Text variant="muted" className="text-center">
                Pick a document, photo, or camera capture above to start a transfer.
              </Text>
            </CardContent>
          </Card>
        )
      }
      ListFooterComponent={
        hasNextPage && onLoadMore ? (
          <View className="items-center pt-2">
            <Button variant="outline" size="sm" disabled={isFetchingNextPage} onPress={onLoadMore}>
              {isFetchingNextPage ? "Loading more..." : "Load More"}
            </Button>
          </View>
        ) : undefined
      }
      renderItem={({ item }) => {
        const isBusy = busyFileIds?.has(item.id) ?? false;
        const isDeleting = deletingFileIds?.has(item.id) ?? false;

        return (
          <Card>
            <CardContent className="gap-3 py-4">
              <View className="flex-row items-start justify-between gap-2">
                <View className="min-w-0 flex-1 gap-1">
                  <Text variant="title" numberOfLines={1}>
                    {item.originalName}
                  </Text>
                  <Text variant="caption" numberOfLines={1}>
                    {`${formatFileSize(item.sizeBytes)} • ${item.mimeType}`}
                  </Text>
                </View>
                <Badge
                  variant={item.status === "ready" ? "success" : "warning"}
                  className="shrink-0"
                >
                  {item.status === "ready" ? "Ready" : "Pending"}
                </Badge>
              </View>

              <View className="flex-row flex-wrap items-center gap-2">
                <Button
                  variant="secondary"
                  size="sm"
                  disabled={isBusy || isDeleting}
                  accessibilityLabel={`Download and share ${item.originalName}`}
                  onPress={() => onDownloadShare(item)}
                >
                  <Icon as={Download} size={14} className="text-on-secondary-container" />
                  <Text>{isBusy ? "Working..." : "Share"}</Text>
                </Button>

                <Button
                  variant="outline"
                  size="sm"
                  disabled={isBusy || isDeleting}
                  accessibilityLabel={`Preview ${item.originalName}`}
                  onPress={() => onPreviewUrl(item)}
                >
                  <Icon as={ExternalLink} size={14} className="text-foreground" />
                  <Text>Preview</Text>
                </Button>

                <Can action="file:delete" resource={{ ...item, type: "file" }}>
                  <Button
                    variant="destructive"
                    size="sm"
                    disabled={isDeleting || isBusy}
                    accessibilityLabel={`Delete ${item.originalName}`}
                    onPress={() => onDelete(item)}
                  >
                    <Icon as={Trash2} size={14} className="text-destructive-foreground" />
                    <Text>{isDeleting ? "Deleting..." : "Delete"}</Text>
                  </Button>
                </Can>
              </View>
            </CardContent>
          </Card>
        );
      }}
    />
  );
}
