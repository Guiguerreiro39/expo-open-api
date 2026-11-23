import { QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react-native";
import type { ReactNode } from "react";
import { describe, expect, it } from "vitest";
import { FILES_QUERY_KEYS } from "@/shared/api/query-keys";
import { ObservabilityContext } from "@/shared/observability/observability-context";
import { createSpyObservability } from "@/shared/observability/spy-adapter";
import { createTestQueryClient } from "@/test/render";
import { createAbortError, createInMemoryFileTransferPort } from "../api/transfer-port";
import type { FileRecord, MobileFileAsset } from "../model/files";
import { useUploadQueue } from "../model/use-upload-queue";

function makeAsset(name: string, size = 4096): MobileFileAsset {
  return {
    uri: `file:///cache/${name}`,
    name,
    size,
    mimeType: "application/pdf",
  };
}

function makeRecord(id: string, name: string, size = 4096): FileRecord {
  return {
    id,
    userId: "user-1",
    originalName: name,
    mimeType: "application/pdf",
    sizeBytes: size,
    checksumSha256: null,
    status: "ready",
    expiresAt: null,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
  };
}

interface DeferredUpload {
  readonly name: string;
  readonly resolve: (record: FileRecord) => void;
  readonly reject: (err: unknown) => void;
  readonly emitProgress: (loaded: number, total: number) => void;
}

describe("useUploadQueue", () => {
  it("throttles active uploads to at most 2 concurrent streams and drains queued items as slots open", async () => {
    const queryClient = createTestQueryClient();
    const obs = createSpyObservability();
    let maxObservedConcurrency = 0;
    let activeCount = 0;
    const pendingUploads = new Map<string, DeferredUpload>();

    const port = createInMemoryFileTransferPort({
      uploadDirectMultipart: (_url, asset, options) => {
        activeCount += 1;
        maxObservedConcurrency = Math.max(maxObservedConcurrency, activeCount);

        return new Promise<FileRecord>((resolve, reject) => {
          const cleanup = () => {
            activeCount -= 1;
          };
          pendingUploads.set(asset.name, {
            name: asset.name,
            resolve: (rec) => {
              cleanup();
              resolve(rec);
            },
            reject: (err) => {
              cleanup();
              reject(err);
            },
            emitProgress: (loaded, total) => {
              options?.onProgress?.({
                loaded,
                total,
                percentage: Math.round((loaded / total) * 100),
              });
            },
          });
        });
      },
    });

    const wrapper = ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={queryClient}>
        <ObservabilityContext.Provider value={obs}>{children}</ObservabilityContext.Provider>
      </QueryClientProvider>
    );

    const { result } = renderHook(() => useUploadQueue({ transferPort: port }), { wrapper });

    act(() => {
      result.current.enqueue(
        [makeAsset("a.pdf"), makeAsset("b.pdf"), makeAsset("c.pdf"), makeAsset("d.pdf")],
        "direct",
      );
    });

    await waitFor(() => {
      const uploading = result.current.items.filter((i) => i.status === "uploading");
      const queued = result.current.items.filter((i) => i.status === "queued");
      expect(uploading).toHaveLength(2);
      expect(queued).toHaveLength(2);
    });

    expect(maxObservedConcurrency).toBe(2);

    // Report mid-flight progress on first file
    act(() => {
      pendingUploads.get("a.pdf")?.emitProgress(2048, 4096);
    });

    expect(result.current.items.find((i) => i.asset.name === "a.pdf")?.progress).toBe(50);

    // Complete first file -> third file should start automatically
    act(() => {
      pendingUploads
        .get("a.pdf")
        ?.resolve(makeRecord("11111111-1111-4111-8111-111111111111", "a.pdf"));
    });

    await waitFor(() => {
      expect(result.current.items.find((i) => i.asset.name === "a.pdf")?.status).toBe("completed");
      expect(result.current.items.find((i) => i.asset.name === "c.pdf")?.status).toBe("uploading");
      expect(result.current.items.find((i) => i.asset.name === "d.pdf")?.status).toBe("queued");
    });

    expect(maxObservedConcurrency).toBe(2);

    // Finish remaining uploads
    act(() => {
      pendingUploads
        .get("b.pdf")
        ?.resolve(makeRecord("22222222-2222-4222-8222-222222222222", "b.pdf"));
      pendingUploads
        .get("c.pdf")
        ?.resolve(makeRecord("33333333-3333-4333-8333-333333333333", "c.pdf"));
    });

    await waitFor(() => {
      expect(result.current.items.find((i) => i.asset.name === "d.pdf")?.status).toBe("uploading");
    });

    act(() => {
      pendingUploads
        .get("d.pdf")
        ?.resolve(makeRecord("44444444-4444-4444-8444-444444444444", "d.pdf"));
    });

    await waitFor(() => {
      expect(result.current.items.every((i) => i.status === "completed")).toBe(true);
    });

    expect(maxObservedConcurrency).toBe(2);
    obs.assertNoDefects();
  });

  it("cancels active uploads cleanly as breadcrumbs, frees concurrency slots, and retries to completion", async () => {
    const queryClient = createTestQueryClient();
    const obs = createSpyObservability();
    let invalidatedFiles = false;
    const originalInvalidate = queryClient.invalidateQueries.bind(queryClient);
    queryClient.invalidateQueries = ((filters?: { queryKey?: readonly unknown[] }) => {
      if (Array.isArray(filters?.queryKey) && filters.queryKey[0] === FILES_QUERY_KEYS.all[0]) {
        invalidatedFiles = true;
      }
      return originalInvalidate(filters);
    }) as typeof queryClient.invalidateQueries;

    let attemptForA = 0;

    const port = createInMemoryFileTransferPort({
      uploadDirectMultipart: (_url, asset, options) => {
        if (asset.name === "a.pdf" && attemptForA === 0) {
          attemptForA += 1;
          return new Promise<FileRecord>((_resolve, reject) => {
            options?.signal?.addEventListener(
              "abort",
              () => reject(createAbortError("Cancelled by user")),
              { once: true },
            );
          });
        }
        options?.onProgress?.({ loaded: asset.size, total: asset.size, percentage: 100 });
        return Promise.resolve(makeRecord("55555555-5555-4555-8555-555555555555", asset.name));
      },
    });

    const wrapper = ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={queryClient}>
        <ObservabilityContext.Provider value={obs}>{children}</ObservabilityContext.Provider>
      </QueryClientProvider>
    );

    const { result } = renderHook(() => useUploadQueue({ transferPort: port }), { wrapper });

    act(() => {
      result.current.enqueue([makeAsset("a.pdf")], "direct");
    });

    await waitFor(() => {
      expect(result.current.items[0]?.status).toBe("uploading");
    });

    const itemId = result.current.items[0]?.id ?? "";

    act(() => {
      result.current.cancel(itemId);
    });

    await waitFor(() => {
      expect(result.current.items[0]?.status).toBe("aborted");
    });

    obs.assertNoDefects();

    // Retry the aborted item -> succeeds and invalidates files query cache
    act(() => {
      result.current.retry(itemId);
    });

    await waitFor(() => {
      expect(result.current.items[0]?.status).toBe("completed");
      expect(result.current.items[0]?.progress).toBe(100);
    });

    expect(invalidatedFiles).toBe(true);
    obs.assertNoDefects();

    // Clear completed removes completed items
    act(() => {
      result.current.clearCompleted();
    });

    expect(result.current.items).toHaveLength(0);
  });

  it("marks empty files as error immediately without consuming upload slots or capturing defects", async () => {
    const queryClient = createTestQueryClient();
    const obs = createSpyObservability();
    const port = createInMemoryFileTransferPort();

    const wrapper = ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={queryClient}>
        <ObservabilityContext.Provider value={obs}>{children}</ObservabilityContext.Provider>
      </QueryClientProvider>
    );

    const { result } = renderHook(() => useUploadQueue({ transferPort: port }), { wrapper });

    act(() => {
      result.current.enqueue([makeAsset("empty.txt", 0)], "auto");
    });

    expect(result.current.items).toHaveLength(1);
    expect(result.current.items[0]?.status).toBe("error");
    expect(result.current.items[0]?.error).toBe("File cannot be empty");
    expect(port.directUploads).toHaveLength(0);
    expect(obs.breadcrumbs.some((b) => b.category === "files.validation")).toBe(true);
    obs.assertNoDefects();

    const id = result.current.items[0]?.id ?? "";
    act(() => {
      result.current.remove(id);
    });
    expect(result.current.items).toHaveLength(0);
  });
});
