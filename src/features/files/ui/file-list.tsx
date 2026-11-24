import { Download, ExternalLink, Paperclip, Trash2 } from "lucide-react-native";
import type { ReactElement } from "react";
import { ActivityIndicator, FlatList, View } from "react-native";
import { Badge } from "@/shared/ui/badge";
import { Button } from "@/shared/ui/button";
import { Can } from "@/shared/ui/can";
import { Card, CardContent } from "@/shared/ui/card";
import { Icon } from "@/shared/ui/icon";
import { Text } from "@/shared/ui/text";
import { type FileRecord, formatFileSize } from "../model/files";

export interface FileListProps {
  readonly files: readonly FileRecord[];
  readonly isLoading?: boolean;
  readonly isRefreshing?: boolean;
  readonly errorMessage?: string | null;
  readonly busyFileId?: string | null;
  readonly deletingFileId?: string | null;
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
  busyFileId,
  deletingFileId,
  hasNextPage = false,
  isFetchingNextPage = false,
  header,
  onRefresh,
  onLoadMore,
  onDownloadShare,
  onPreviewUrl,
  onDelete,
}: FileListProps) {
  return (
    <FlatList
      data={files}
      keyExtractor={(item) => item.id}
      refreshing={isRefreshing}
      onRefresh={onRefresh}
      contentContainerClassName="gap-4 px-5 pb-10 pt-4"
      ListHeaderComponent={header}
      ListEmptyComponent={
        isLoading ? (
          <Card>
            <CardContent className="items-center gap-3 py-8">
              <ActivityIndicator />
              <Text variant="muted">Loading files...</Text>
            </CardContent>
          </Card>
        ) : errorMessage ? (
          <Card>
            <CardContent className="gap-3 py-6">
              <Text variant="title" className="text-destructive">
                Unable to load files
              </Text>
              <Text variant="muted">{errorMessage}</Text>
              {onRefresh ? (
                <Button variant="outline" size="sm" onPress={onRefresh}>
                  Try Again
                </Button>
              ) : null}
            </CardContent>
          </Card>
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
        const isBusy = busyFileId === item.id;
        const isDeleting = deletingFileId === item.id;

        return (
          <Card>
            <CardContent className="gap-3 pt-4">
              <View className="flex-row items-start justify-between gap-2">
                <View className="flex-1 gap-1">
                  <Text variant="title" numberOfLines={1}>
                    {item.originalName}
                  </Text>
                  <Text variant="caption">
                    {`${formatFileSize(item.sizeBytes)} • ${item.mimeType}`}
                  </Text>
                </View>
                <Badge variant={item.status === "ready" ? "success" : "warning"}>
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
