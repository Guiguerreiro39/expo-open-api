import { customFetch, type FetchError } from "@/shared/api/fetch";
import type { GetApiV1FilesIdUrl200 } from "@/shared/api/generated/models/getApiV1FilesIdUrl200";
import { resolveApiUrl } from "@/shared/config/env";
import { noopObservabilityAdapter } from "@/shared/observability/noop-adapter";
import type { ObservabilityService } from "@/shared/observability/port";
import { sanitizeFileName, TRANSFER_CACHE_TTL_MS } from "../model/files";
import { createExpoFileTransferAdapter } from "./expo-file-transfer-adapter";
import { createAbortError, type FileTransferPort } from "./transfer-port";
import { buildAuthTracingHeaders, recordTransferError } from "./upload";

export interface DirectDownloadOptions {
  readonly originalName?: string;
  readonly mimeType?: string;
  readonly shareAfterDownload?: boolean;
  readonly maxAttempts?: number;
  readonly backoffMs?: number;
  readonly signal?: AbortSignal;
  readonly headers?: Record<string, string>;
  readonly sleep?: (ms: number) => Promise<void>;
  readonly transferPort?: FileTransferPort;
  readonly observability?: ObservabilityService;
}

export interface DirectDownloadResult {
  readonly uri: string;
  readonly status: number;
}

export interface PreviewUrlOptions {
  readonly openInBrowser?: boolean;
  readonly maxAttempts?: number;
  readonly backoffMs?: number;
  readonly signal?: AbortSignal;
  readonly sleep?: (ms: number) => Promise<void>;
  readonly transferPort?: FileTransferPort;
  readonly observability?: ObservabilityService;
}

export interface PruneCacheOptions {
  readonly maxAgeMs?: number;
  readonly transferPort?: FileTransferPort;
  readonly observability?: ObservabilityService;
}

const DEFAULT_MAX_ATTEMPTS = 3;
const DEFAULT_BACKOFF_MS = 200;

function defaultSleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isFilePendingConflict(error: unknown): boolean {
  if (typeof error !== "object" || error === null) {
    return false;
  }
  const err = error as FetchError;
  return (
    err.status === 409 || err.code === "FILE_PENDING" || err.data?.error?.code === "FILE_PENDING"
  );
}

async function withPendingRetry<T>(
  operation: () => Promise<T>,
  options: {
    readonly maxAttempts: number;
    readonly backoffMs: number;
    readonly signal?: AbortSignal;
    readonly sleep: (ms: number) => Promise<void>;
    readonly observability: ObservabilityService;
    readonly stage: "download" | "preview_url";
    readonly fileId: string;
  },
): Promise<T> {
  let attempt = 0;

  while (true) {
    attempt += 1;
    if (options.signal?.aborted) {
      throw createAbortError("Download aborted");
    }

    try {
      return await operation();
    } catch (err: unknown) {
      if (isFilePendingConflict(err) && attempt < options.maxAttempts) {
        const delayMs = options.backoffMs * 2 ** (attempt - 1);
        options.observability.recordBreadcrumb({
          category: "files.transfer",
          level: "info",
          message: `File ${options.fileId} still pending; retrying attempt ${attempt + 1}/${options.maxAttempts} after ${delayMs}ms`,
          data: {
            stage: options.stage,
            fileId: options.fileId,
            attempt,
            delayMs,
          },
        });
        await options.sleep(delayMs);
        continue;
      }
      throw err;
    }
  }
}

export async function downloadFileDirect(
  fileId: string,
  options: DirectDownloadOptions = {},
): Promise<DirectDownloadResult> {
  const obs = options.observability ?? noopObservabilityAdapter;
  const port = options.transferPort ?? createExpoFileTransferAdapter();
  const maxAttempts = options.maxAttempts ?? DEFAULT_MAX_ATTEMPTS;
  const backoffMs = options.backoffMs ?? DEFAULT_BACKOFF_MS;
  const sleep = options.sleep ?? defaultSleep;
  const shareAfterDownload = options.shareAfterDownload ?? true;

  const url = resolveApiUrl(`/api/v1/files/${fileId}/download`);
  const safeOriginalName = sanitizeFileName(options.originalName ?? "file");
  const cacheFilename = `download_${sanitizeFileName(fileId)}_${safeOriginalName}`;

  let downloadResult: DirectDownloadResult;
  try {
    downloadResult = await withPendingRetry(
      () =>
        port.downloadToCache(url, cacheFilename, {
          headers: buildAuthTracingHeaders(options.headers),
          signal: options.signal,
        }),
      {
        maxAttempts,
        backoffMs,
        signal: options.signal,
        sleep,
        observability: obs,
        stage: "download",
        fileId,
      },
    );
  } catch (err: unknown) {
    recordTransferError(obs, err, "download", { fileId });
    throw err;
  }

  if (shareAfterDownload) {
    try {
      await port.shareLocalFile(downloadResult.uri, {
        mimeType: options.mimeType,
        dialogTitle: options.originalName ?? safeOriginalName,
      });
    } catch (err: unknown) {
      recordTransferError(obs, err, "share", { fileId });
      throw err;
    }
  }

  return downloadResult;
}

export async function openFilePreviewUrl(
  fileId: string,
  options: PreviewUrlOptions = {},
): Promise<GetApiV1FilesIdUrl200> {
  const obs = options.observability ?? noopObservabilityAdapter;
  const port = options.transferPort ?? createExpoFileTransferAdapter();
  const maxAttempts = options.maxAttempts ?? DEFAULT_MAX_ATTEMPTS;
  const backoffMs = options.backoffMs ?? DEFAULT_BACKOFF_MS;
  const sleep = options.sleep ?? defaultSleep;
  const openInBrowser = options.openInBrowser ?? true;

  let response: GetApiV1FilesIdUrl200;
  try {
    response = await withPendingRetry(
      () =>
        customFetch<GetApiV1FilesIdUrl200>(`/api/v1/files/${fileId}/url`, {
          method: "GET",
          signal: options.signal,
        }),
      {
        maxAttempts,
        backoffMs,
        signal: options.signal,
        sleep,
        observability: obs,
        stage: "preview_url",
        fileId,
      },
    );
  } catch (err: unknown) {
    recordTransferError(obs, err, "preview_url", { fileId });
    throw err;
  }

  if (openInBrowser) {
    try {
      await port.openPreviewUrl(response.url);
    } catch (err: unknown) {
      recordTransferError(obs, err, "preview_url", { fileId });
      throw err;
    }
  }

  return response;
}

export async function pruneExpiredTransferCache(options: PruneCacheOptions = {}): Promise<number> {
  const obs = options.observability ?? noopObservabilityAdapter;
  const port = options.transferPort ?? createExpoFileTransferAdapter();
  const maxAgeMs = options.maxAgeMs ?? TRANSFER_CACHE_TTL_MS;

  try {
    const removed = await port.pruneExpiredCacheFiles(maxAgeMs);
    if (removed > 0) {
      obs.recordBreadcrumb({
        category: "files.cache",
        level: "info",
        message: `Pruned ${removed} expired transfer cache file(s)`,
        data: { removed, maxAgeMs },
      });
    }
    return removed;
  } catch (err: unknown) {
    recordTransferError(obs, err, "cache_prune", { maxAgeMs });
    return 0;
  }
}
