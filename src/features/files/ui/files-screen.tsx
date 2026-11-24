import { AlertCircle } from "lucide-react-native";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { decodeApiError } from "@/shared/api/contracts";
import { useObservability } from "@/shared/observability/observability-context";
import { Alert, AlertDescription, AlertTitle } from "@/shared/ui/alert";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/shared/ui/alert-dialog";
import { Badge } from "@/shared/ui/badge";
import { Can } from "@/shared/ui/can";
import { Card, CardDescription, CardHeader, CardTitle } from "@/shared/ui/card";
import { Icon } from "@/shared/ui/icon";
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

interface ActionFeedback {
  readonly title: string;
  readonly message: string;
}

function addIdToSet(prev: ReadonlySet<string>, id: string): ReadonlySet<string> {
  if (prev.has(id)) return prev;
  const next = new Set(prev);
  next.add(id);
  return next;
}

function removeIdFromSet(prev: ReadonlySet<string>, id: string): ReadonlySet<string> {
  if (!prev.has(id)) return prev;
  const next = new Set(prev);
  next.delete(id);
  return next;
}

export function FilesScreen({ transferPort: providedPort, pickerAdapter }: FilesScreenProps = {}) {
  const observability = useObservability();
  const defaultPort = useMemo(() => createExpoFileTransferAdapter(), []);
  const transferPort = providedPort ?? defaultPort;

  const [strategy, setStrategy] = useState<UploadStrategy>("auto");
  const [busyFileIds, setBusyFileIds] = useState<ReadonlySet<string>>(() => new Set());
  const [deletingFileIds, setDeletingFileIds] = useState<ReadonlySet<string>>(() => new Set());
  const inFlightBusyIdsRef = useRef<Set<string>>(new Set());
  const inFlightDeleteIdsRef = useRef<Set<string>>(new Set());
  const [filePendingDelete, setFilePendingDelete] = useState<FileRecord | null>(null);
  const [actionFeedback, setActionFeedback] = useState<ActionFeedback | null>(null);

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
      if (inFlightBusyIdsRef.current.has(file.id) || inFlightDeleteIdsRef.current.has(file.id)) {
        return;
      }
      inFlightBusyIdsRef.current.add(file.id);
      setBusyFileIds((prev) => addIdToSet(prev, file.id));
      setActionFeedback(null);
      try {
        await downloadFileDirect(file.id, {
          originalName: file.originalName,
          mimeType: file.mimeType,
          transferPort,
          observability,
        });
      } catch (err: unknown) {
        const decoded = decodeApiError(err);
        setActionFeedback({
          title: decoded._tag === "ForbiddenError" ? "Access denied" : "Download failed",
          message: decoded.message || "Download failed",
        });
      } finally {
        inFlightBusyIdsRef.current.delete(file.id);
        setBusyFileIds((prev) => removeIdFromSet(prev, file.id));
      }
    },
    [observability, transferPort],
  );

  const handlePreviewUrl = useCallback(
    async (file: FileRecord) => {
      if (inFlightBusyIdsRef.current.has(file.id) || inFlightDeleteIdsRef.current.has(file.id)) {
        return;
      }
      inFlightBusyIdsRef.current.add(file.id);
      setBusyFileIds((prev) => addIdToSet(prev, file.id));
      setActionFeedback(null);
      try {
        await openFilePreviewUrl(file.id, {
          transferPort,
          observability,
        });
      } catch (err: unknown) {
        const decoded = decodeApiError(err);
        setActionFeedback({
          title: decoded._tag === "ForbiddenError" ? "Access denied" : "Preview failed",
          message: decoded.message || "Preview failed",
        });
      } finally {
        inFlightBusyIdsRef.current.delete(file.id);
        setBusyFileIds((prev) => removeIdFromSet(prev, file.id));
      }
    },
    [observability, transferPort],
  );

  const handleDelete = useCallback(
    async (file: FileRecord) => {
      if (inFlightDeleteIdsRef.current.has(file.id)) {
        return;
      }
      inFlightDeleteIdsRef.current.add(file.id);
      setDeletingFileIds((prev) => addIdToSet(prev, file.id));
      setActionFeedback(null);
      try {
        await deleteMutation.mutateAsync(file.id);
      } catch (err: unknown) {
        const decoded = decodeApiError(err);
        setActionFeedback({
          title: decoded._tag === "ForbiddenError" ? "Access denied" : "Delete failed",
          message: decoded.message || "Delete failed",
        });
      } finally {
        inFlightDeleteIdsRef.current.delete(file.id);
        setDeletingFileIds((prev) => removeIdFromSet(prev, file.id));
      }
    },
    [deleteMutation],
  );

  const handleConfirmDelete = useCallback(() => {
    if (!filePendingDelete) return;
    const target = filePendingDelete;
    setFilePendingDelete(null);
    void handleDelete(target);
  }, [filePendingDelete, handleDelete]);

  const errorMessage =
    filesQuery.error instanceof Error
      ? filesQuery.error.message
      : filesQuery.error
        ? "Failed to load files"
        : null;

  const header = (
    <View className="gap-6 pb-2">
      <View
        testID="files-status-header"
        className="flex-row flex-wrap items-center justify-between gap-3"
      >
        <Text variant="muted" className="min-w-0 flex-1">
          Stream multipart or presigned uploads, track transfer progress, and share files natively.
        </Text>
        <Badge variant="secondary" className="shrink-0">
          {`${files.length} file${files.length === 1 ? "" : "s"}`}
        </Badge>
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
        <Alert testID="files-action-alert" variant="destructive">
          <View className="flex-row items-start gap-2.5">
            <Icon
              as={AlertCircle}
              size={18}
              className="text-on-destructive-container mt-0.5 shrink-0"
            />
            <View className="min-w-0 flex-1 gap-0.5">
              <AlertTitle>{actionFeedback.title}</AlertTitle>
              <AlertDescription>{actionFeedback.message}</AlertDescription>
            </View>
          </View>
        </Alert>
      ) : null}

      <View className="flex-row flex-wrap items-center justify-between gap-2 pt-2">
        <Text variant="h4">Stored Files</Text>
        <Text variant="caption">{`${files.length} file${files.length === 1 ? "" : "s"}`}</Text>
      </View>
    </View>
  );

  return (
    <SafeAreaView className="bg-background flex-1" edges={["left", "right"]}>
      <FileList
        files={files}
        isLoading={filesQuery.isPending}
        isRefreshing={filesQuery.isRefetching && !filesQuery.isFetchingNextPage}
        errorMessage={errorMessage}
        busyFileIds={busyFileIds}
        deletingFileIds={deletingFileIds}
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
          if (
            inFlightDeleteIdsRef.current.has(file.id) ||
            inFlightBusyIdsRef.current.has(file.id)
          ) {
            return;
          }
          setFilePendingDelete(file);
        }}
      />

      <AlertDialog
        open={filePendingDelete !== null}
        onOpenChange={(open) => {
          if (!open) {
            setFilePendingDelete(null);
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete file?</AlertDialogTitle>
            <AlertDialogDescription>
              {`Are you sure you want to delete "${filePendingDelete?.originalName ?? ""}"? This action cannot be undone.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onPress={() => setFilePendingDelete(null)}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              accessibilityLabel="Confirm delete file"
              onPress={handleConfirmDelete}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </SafeAreaView>
  );
}
