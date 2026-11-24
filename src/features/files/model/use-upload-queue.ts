import { useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useRef, useState } from "react";
import { FILES_QUERY_KEYS } from "@/shared/api/query-keys";
import { useObservability } from "@/shared/observability/observability-context";
import type { ObservabilityService } from "@/shared/observability/port";
import { type FileTransferPort, isAbortError } from "../api/transfer-port";
import { uploadFile } from "../api/upload";
import {
  MAX_CONCURRENT_UPLOADS,
  type MobileFileAsset,
  resolveUploadStrategy,
  type UploadItem,
  type UploadStrategy,
  validateUploadFile,
} from "./files";

export interface UseUploadQueueOptions {
  readonly maxConcurrent?: number;
  readonly transferPort?: FileTransferPort;
  readonly observability?: ObservabilityService;
}

export interface UseUploadQueueResult {
  readonly items: readonly UploadItem[];
  readonly activeCount: number;
  readonly queuedCount: number;
  readonly enqueue: (assets: readonly MobileFileAsset[], strategy?: UploadStrategy) => void;
  readonly cancel: (id: string) => void;
  readonly retry: (id: string) => void;
  readonly remove: (id: string) => void;
  readonly clearCompleted: () => void;
}

let uploadSequence = 0;

function createUploadId(): string {
  uploadSequence += 1;
  return `upload-${Date.now()}-${uploadSequence}`;
}

export function useUploadQueue(options: UseUploadQueueOptions = {}): UseUploadQueueResult {
  const maxConcurrent = Math.max(1, options.maxConcurrent ?? MAX_CONCURRENT_UPLOADS);
  const queryClient = useQueryClient();
  const contextObs = useObservability();
  const observability = options.observability ?? contextObs;
  const transferPort = options.transferPort;

  const [items, setItems] = useState<UploadItem[]>([]);
  const itemsRef = useRef<UploadItem[]>([]);
  const activeIdsRef = useRef<Set<string>>(new Set());
  const controllersRef = useRef<Map<string, AbortController>>(new Map());
  const mountedRef = useRef(true);

  const updateItems = useCallback((updater: (prev: UploadItem[]) => UploadItem[]) => {
    const next = updater(itemsRef.current);
    itemsRef.current = next;
    if (mountedRef.current) {
      setItems(next);
    }
  }, []);

  const pumpQueueRef = useRef<() => void>(() => undefined);

  const startItem = useCallback(
    (item: UploadItem) => {
      const controller = new AbortController();
      activeIdsRef.current.add(item.id);
      controllersRef.current.set(item.id, controller);

      updateItems((prev) =>
        prev.map((entry) =>
          entry.id === item.id
            ? {
                ...entry,
                status: "uploading",
                progress: 0,
                loadedBytes: 0,
                error: undefined,
              }
            : entry,
        ),
      );

      void uploadFile(item.asset, {
        strategy: item.strategy,
        signal: controller.signal,
        transferPort,
        observability,
        onProgress: (evt) => {
          updateItems((prev) =>
            prev.map((entry) =>
              entry.id === item.id && entry.status === "uploading"
                ? {
                    ...entry,
                    progress: evt.percentage,
                    loadedBytes: evt.loaded,
                    totalBytes: evt.total > 0 ? evt.total : entry.totalBytes,
                  }
                : entry,
            ),
          );
        },
      })
        .then((record) => {
          activeIdsRef.current.delete(item.id);
          controllersRef.current.delete(item.id);

          updateItems((prev) =>
            prev.map((entry) =>
              entry.id === item.id
                ? {
                    ...entry,
                    status: "completed",
                    progress: 100,
                    loadedBytes: entry.totalBytes,
                    uploadedFile: record,
                    error: undefined,
                  }
                : entry,
            ),
          );

          void queryClient.invalidateQueries({ queryKey: FILES_QUERY_KEYS.all });
          pumpQueueRef.current();
        })
        .catch((err: unknown) => {
          activeIdsRef.current.delete(item.id);
          controllersRef.current.delete(item.id);

          const aborted = controller.signal.aborted || isAbortError(err);
          const message = err instanceof Error ? err.message : "Upload failed";

          updateItems((prev) =>
            prev.map((entry) =>
              entry.id === item.id
                ? {
                    ...entry,
                    status: aborted ? "aborted" : "error",
                    error: aborted ? undefined : message,
                  }
                : entry,
            ),
          );

          pumpQueueRef.current();
        });
    },
    [observability, queryClient, transferPort, updateItems],
  );

  const pumpQueue = useCallback(() => {
    if (!mountedRef.current) return;

    while (activeIdsRef.current.size < maxConcurrent) {
      const nextQueued = itemsRef.current.find(
        (entry) => entry.status === "queued" && !activeIdsRef.current.has(entry.id),
      );
      if (!nextQueued) {
        break;
      }
      startItem(nextQueued);
    }
  }, [maxConcurrent, startItem]);

  pumpQueueRef.current = pumpQueue;

  useEffect(() => {
    mountedRef.current = true;
    const controllers = controllersRef.current;
    const activeIds = activeIdsRef.current;
    return () => {
      mountedRef.current = false;
      for (const controller of controllers.values()) {
        controller.abort();
      }
      controllers.clear();
      activeIds.clear();
    };
  }, []);

  const enqueue = useCallback(
    (assets: readonly MobileFileAsset[], strategy: UploadStrategy = "auto") => {
      if (assets.length === 0) return;

      const created: UploadItem[] = assets.map((asset) => {
        const resolvedStrategy = resolveUploadStrategy(asset, strategy);
        const validationError = validateUploadFile(asset, strategy);

        if (validationError) {
          observability.recordBreadcrumb({
            category: "files.validation",
            level: "warning",
            message: validationError,
            data: { size: asset.size, mimeType: asset.mimeType, strategy },
          });
        }

        return {
          id: createUploadId(),
          asset,
          strategy,
          resolvedStrategy,
          status: validationError ? "error" : "queued",
          progress: 0,
          loadedBytes: 0,
          totalBytes: Math.max(0, asset.size),
          error: validationError ?? undefined,
        };
      });

      updateItems((prev) => [...created, ...prev]);
      pumpQueue();
    },
    [observability, pumpQueue, updateItems],
  );

  const cancel = useCallback(
    (id: string) => {
      const controller = controllersRef.current.get(id);
      if (controller) {
        controller.abort();
        return;
      }

      updateItems((prev) =>
        prev.map((entry) =>
          entry.id === id && entry.status === "queued"
            ? {
                ...entry,
                status: "aborted",
                error: undefined,
              }
            : entry,
        ),
      );
    },
    [updateItems],
  );

  const retry = useCallback(
    (id: string) => {
      const target = itemsRef.current.find((entry) => entry.id === id);
      if (!target || (target.status !== "error" && target.status !== "aborted")) {
        return;
      }

      const validationError = validateUploadFile(target.asset, target.strategy);
      if (validationError) {
        updateItems((prev) =>
          prev.map((entry) =>
            entry.id === id ? { ...entry, status: "error", error: validationError } : entry,
          ),
        );
        return;
      }

      updateItems((prev) =>
        prev.map((entry) =>
          entry.id === id
            ? {
                ...entry,
                status: "queued",
                progress: 0,
                loadedBytes: 0,
                error: undefined,
              }
            : entry,
        ),
      );

      pumpQueue();
    },
    [pumpQueue, updateItems],
  );

  const remove = useCallback(
    (id: string) => {
      const controller = controllersRef.current.get(id);
      if (controller) {
        controller.abort();
      }

      updateItems((prev) => prev.filter((entry) => entry.id !== id));

      // For in-flight uploads, wait until the transfer promise settles in startItem's
      // .then()/.catch() before releasing activeIdsRef and pumping the queue so
      // active transfers never exceed maxConcurrent.
      if (!controller) {
        pumpQueue();
      }
    },
    [pumpQueue, updateItems],
  );

  const clearCompleted = useCallback(() => {
    updateItems((prev) => prev.filter((entry) => entry.status !== "completed"));
  }, [updateItems]);

  const activeCount = items.filter((i) => i.status === "uploading").length;
  const queuedCount = items.filter((i) => i.status === "queued").length;

  return {
    items,
    activeCount,
    queuedCount,
    enqueue,
    cancel,
    retry,
    remove,
    clearCompleted,
  };
}
