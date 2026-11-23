import { useCallback, useEffect, useMemo, useState } from "react";
import { View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useObservability } from "@/shared/observability/observability-context";
import { Can } from "@/shared/ui/can";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/shared/ui/card";
import { Text } from "@/shared/ui/text";
import { downloadFileDirect, openFilePreviewUrl, pruneExpiredTransferCache } from "../api/download";
import { createExpoFileTransferAdapter } from "../api/expo-file-transfer-adapter";
import { useDeleteFileMutation, useFilesInfiniteQuery } from "../api/files-query";
import type { FileTransferPort } from "../api/transfer-port";
import { type FileRecord, TRANSFER_CACHE_TTL_MS, type UploadStrategy } from "../model/files";
import { type MobileFilePickerAdapter, useMobileFilePicker } from "../model/use-mobile-file-picker";
import { useUploadQueue } from "../model/use-upload-queue";
import { FileList } from "./file-list";
import { FilePickerCard } from "./file-picker-card";
import { UploadProgressList } from "./upload-progress-list";

export interface FilesScreenProps {
  readonly transferPort?: FileTransferPort;
  readonly pickerAdapter?: MobileFilePickerAdapter;
}

export function FilesScreen({ transferPort: providedPort, pickerAdapter }: FilesScreenProps = {}) {
  const observability = useObservability();
  const defaultPort = useMemo(() => createExpoFileTransferAdapter(), []);
  const transferPort = providedPort ?? defaultPort;

  const [strategy, setStrategy] = useState<UploadStrategy>("auto");
  const [busyFileId, setBusyFileId] = useState<string | null>(null);
  const [deletingFileId, setDeletingFileId] = useState<string | null>(null);
  const [actionFeedback, setActionFeedback] = useState<string | null>(null);

  const filesQuery = useFilesInfiniteQuery({ limit: 25 });
  const deleteMutation = useDeleteFileMutation();
  const picker = useMobileFilePicker({ adapter: pickerAdapter, observability });
  const uploadQueue = useUploadQueue({ transferPort, observability });

  useEffect(() => {
    void pruneExpiredTransferCache({
      maxAgeMs: TRANSFER_CACHE_TTL_MS,
      transferPort,
      observability,
    });
  }, [transferPort, observability]);

  const files = useMemo(
    () => filesQuery.data?.pages.flatMap((page) => page.data) ?? [],
    [filesQuery.data],
  );

  const handlePickDocument = useCallback(async () => {
    const asset = await picker.pickDocument();
    if (asset) {
      uploadQueue.enqueue([asset], strategy);
    }
  }, [picker, strategy, uploadQueue]);

  const handlePickImage = useCallback(async () => {
    const asset = await picker.pickImageFromLibrary();
    if (asset) {
      uploadQueue.enqueue([asset], strategy);
    }
  }, [picker, strategy, uploadQueue]);

  const handleCaptureCamera = useCallback(async () => {
    const asset = await picker.capturePhotoWithCamera();
    if (asset) {
      uploadQueue.enqueue([asset], strategy);
    }
  }, [picker, strategy, uploadQueue]);

  const handleDownloadShare = useCallback(
    async (file: FileRecord) => {
      setBusyFileId(file.id);
      setActionFeedback(null);
      try {
        await downloadFileDirect(file.id, {
          originalName: file.originalName,
          mimeType: file.mimeType,
          transferPort,
          observability,
        });
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : "Download failed";
        setActionFeedback(message);
      } finally {
        setBusyFileId(null);
      }
    },
    [observability, transferPort],
  );

  const handlePreviewUrl = useCallback(
    async (file: FileRecord) => {
      setBusyFileId(file.id);
      setActionFeedback(null);
      try {
        await openFilePreviewUrl(file.id, {
          transferPort,
          observability,
        });
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : "Preview failed";
        setActionFeedback(message);
      } finally {
        setBusyFileId(null);
      }
    },
    [observability, transferPort],
  );

  const handleDelete = useCallback(
    async (file: FileRecord) => {
      setDeletingFileId(file.id);
      setActionFeedback(null);
      try {
        await deleteMutation.mutateAsync(file.id);
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : "Delete failed";
        setActionFeedback(message);
      } finally {
        setDeletingFileId(null);
      }
    },
    [deleteMutation],
  );

  const errorMessage =
    filesQuery.error instanceof Error
      ? filesQuery.error.message
      : filesQuery.error
        ? "Failed to load files"
        : null;

  const header = (
    <View className="gap-4 pb-2">
      <View className="gap-1">
        <Text variant="h2">Files</Text>
        <Text variant="muted">
          Stream multipart or presigned uploads, track transfer progress, and share files natively.
        </Text>
      </View>

      <Can
        action="file:create"
        fallback={
          <Card>
            <CardHeader>
              <CardTitle>Read-only access</CardTitle>
              <CardDescription>
                Your account can download and preview files, but uploading new files is restricted.
              </CardDescription>
            </CardHeader>
          </Card>
        }
      >
        <FilePickerCard
          strategy={strategy}
          onStrategyChange={setStrategy}
          onPickDocument={() => {
            void handlePickDocument();
          }}
          onPickImage={() => {
            void handlePickImage();
          }}
          onCaptureCamera={() => {
            void handleCaptureCamera();
          }}
          isPicking={picker.isPicking}
          pickerError={picker.error}
        />
      </Can>

      <UploadProgressList
        items={uploadQueue.items}
        onCancel={uploadQueue.cancel}
        onRetry={uploadQueue.retry}
        onRemove={uploadQueue.remove}
        onClearCompleted={uploadQueue.clearCompleted}
      />

      {actionFeedback ? (
        <Card>
          <CardContent className="py-3">
            <Text variant="caption" className="text-destructive">
              {actionFeedback}
            </Text>
          </CardContent>
        </Card>
      ) : null}

      <View className="flex-row items-center justify-between pt-1">
        <Text variant="h4">Stored Files</Text>
        <Text variant="caption">{`${files.length} file${files.length === 1 ? "" : "s"}`}</Text>
      </View>
    </View>
  );

  return (
    <SafeAreaView className="bg-background flex-1" edges={["top"]}>
      <FileList
        files={files}
        isLoading={filesQuery.isPending}
        isRefreshing={filesQuery.isRefetching && !filesQuery.isFetchingNextPage}
        errorMessage={errorMessage}
        busyFileId={busyFileId}
        deletingFileId={deletingFileId}
        hasNextPage={filesQuery.hasNextPage}
        isFetchingNextPage={filesQuery.isFetchingNextPage}
        header={header}
        onRefresh={() => {
          void filesQuery.refetch();
        }}
        onLoadMore={() => {
          void filesQuery.fetchNextPage();
        }}
        onDownloadShare={(file) => {
          void handleDownloadShare(file);
        }}
        onPreviewUrl={(file) => {
          void handlePreviewUrl(file);
        }}
        onDelete={(file) => {
          void handleDelete(file);
        }}
      />
    </SafeAreaView>
  );
}
