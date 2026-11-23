import {
  calculateProgress,
  type FileRecord,
  type MobileFileAsset,
  sanitizeFileName,
  TRANSFER_CACHE_TTL_MS,
  type UploadProgressEvent,
} from "../model/files";

export interface DirectMultipartUploadOptions {
  readonly headers?: Record<string, string>;
  readonly onProgress?: (event: UploadProgressEvent) => void;
  readonly signal?: AbortSignal;
}

export interface PresignedBinaryUploadOptions {
  readonly onProgress?: (event: UploadProgressEvent) => void;
  readonly signal?: AbortSignal;
}

export interface DownloadToCacheOptions {
  readonly headers?: Record<string, string>;
  readonly signal?: AbortSignal;
}

export interface ShareLocalFileOptions {
  readonly mimeType?: string;
  readonly dialogTitle?: string;
}

export interface DownloadToCacheResult {
  readonly uri: string;
  readonly status: number;
}

export interface FileTransferPort {
  readonly uploadDirectMultipart: (
    url: string,
    asset: MobileFileAsset,
    options?: DirectMultipartUploadOptions,
  ) => Promise<FileRecord>;
  readonly uploadPresignedBinary: (
    uploadUrl: string,
    asset: MobileFileAsset,
    options?: PresignedBinaryUploadOptions,
  ) => Promise<void>;
  readonly downloadToCache: (
    url: string,
    filename: string,
    options?: DownloadToCacheOptions,
  ) => Promise<DownloadToCacheResult>;
  readonly shareLocalFile: (uri: string, options?: ShareLocalFileOptions) => Promise<void>;
  readonly openPreviewUrl: (url: string) => Promise<void>;
  readonly pruneExpiredCacheFiles: (maxAgeMs?: number) => Promise<number>;
}

export type FileTransferErrorCategory = "network" | "storage" | "share" | "parse" | "validation";

export class FileTransferError extends Error {
  readonly category: FileTransferErrorCategory;
  readonly code?: string;
  readonly status?: number;
  readonly cause?: unknown;

  constructor(options: {
    message: string;
    category: FileTransferErrorCategory;
    code?: string;
    status?: number;
    cause?: unknown;
  }) {
    super(options.message);
    this.name = "FileTransferError";
    this.category = options.category;
    this.code = options.code;
    this.status = options.status;
    this.cause = options.cause;
  }
}

export function createAbortError(message = "File transfer aborted"): Error {
  if (typeof DOMException !== "undefined") {
    return new DOMException(message, "AbortError");
  }
  const error = new Error(message);
  error.name = "AbortError";
  return error;
}

export function isAbortError(error: unknown): boolean {
  if (typeof error !== "object" || error === null) {
    return false;
  }
  const err = error as { name?: unknown; code?: unknown };
  return err.name === "AbortError" || err.code === "ABORT_ERR" || err.code === "ERR_CANCELED";
}

export interface RecordedDirectUpload {
  readonly url: string;
  readonly asset: MobileFileAsset;
  readonly headers?: Record<string, string>;
}

export interface RecordedPresignedUpload {
  readonly uploadUrl: string;
  readonly asset: MobileFileAsset;
  readonly headers: Record<string, string>;
}

export interface RecordedDownload {
  readonly url: string;
  readonly filename: string;
  readonly headers?: Record<string, string>;
}

export interface RecordedShare {
  readonly uri: string;
  readonly options?: ShareLocalFileOptions;
}

export interface InMemoryFileTransferHandlers {
  uploadDirectMultipart?: FileTransferPort["uploadDirectMultipart"];
  uploadPresignedBinary?: FileTransferPort["uploadPresignedBinary"];
  downloadToCache?: FileTransferPort["downloadToCache"];
  shareLocalFile?: FileTransferPort["shareLocalFile"];
  openPreviewUrl?: FileTransferPort["openPreviewUrl"];
  pruneExpiredCacheFiles?: FileTransferPort["pruneExpiredCacheFiles"];
}

export interface InMemoryFileTransferPort extends FileTransferPort {
  readonly directUploads: RecordedDirectUpload[];
  readonly presignedUploads: RecordedPresignedUpload[];
  readonly downloads: RecordedDownload[];
  readonly shares: RecordedShare[];
  readonly openedPreviewUrls: string[];
  readonly pruneCalls: number[];
  readonly cachedFiles: Map<string, { uri: string; modifiedAtMs: number }>;
  setHandlers: (handlers: Partial<InMemoryFileTransferHandlers>) => void;
  reset: () => void;
}

export function createInMemoryFileTransferPort(
  initialHandlers: InMemoryFileTransferHandlers = {},
): InMemoryFileTransferPort {
  let handlers: InMemoryFileTransferHandlers = { ...initialHandlers };
  let idCounter = 0;

  const directUploads: RecordedDirectUpload[] = [];
  const presignedUploads: RecordedPresignedUpload[] = [];
  const downloads: RecordedDownload[] = [];
  const shares: RecordedShare[] = [];
  const openedPreviewUrls: string[] = [];
  const pruneCalls: number[] = [];
  const cachedFiles = new Map<string, { uri: string; modifiedAtMs: number }>();

  return {
    directUploads,
    presignedUploads,
    downloads,
    shares,
    openedPreviewUrls,
    pruneCalls,
    cachedFiles,

    setHandlers(next) {
      handlers = { ...handlers, ...next };
    },

    reset() {
      directUploads.length = 0;
      presignedUploads.length = 0;
      downloads.length = 0;
      shares.length = 0;
      openedPreviewUrls.length = 0;
      pruneCalls.length = 0;
      cachedFiles.clear();
      handlers = { ...initialHandlers };
      idCounter = 0;
    },

    async uploadDirectMultipart(url, asset, options = {}) {
      if (options.signal?.aborted) {
        throw createAbortError();
      }
      directUploads.push({ url, asset, headers: options.headers });

      if (handlers.uploadDirectMultipart) {
        return handlers.uploadDirectMultipart(url, asset, options);
      }

      const half = Math.floor(asset.size / 2);
      options.onProgress?.({
        loaded: half,
        total: asset.size,
        percentage: calculateProgress(half, asset.size),
      });
      options.onProgress?.({
        loaded: asset.size,
        total: asset.size,
        percentage: 100,
      });

      if (options.signal?.aborted) {
        throw createAbortError();
      }

      idCounter += 1;
      const now = new Date().toISOString();
      const suffix = idCounter.toString(16).padStart(12, "0");
      return {
        id: `00000000-0000-4000-8000-${suffix}`,
        userId: "user-1",
        originalName: asset.name,
        mimeType: asset.mimeType,
        sizeBytes: asset.size,
        checksumSha256: null,
        status: "ready",
        expiresAt: null,
        createdAt: now,
        updatedAt: now,
      };
    },

    async uploadPresignedBinary(uploadUrl, asset, options = {}) {
      if (options.signal?.aborted) {
        throw createAbortError();
      }
      presignedUploads.push({
        uploadUrl,
        asset,
        headers: { "Content-Type": asset.mimeType || "application/octet-stream" },
      });

      if (handlers.uploadPresignedBinary) {
        return handlers.uploadPresignedBinary(uploadUrl, asset, options);
      }

      options.onProgress?.({
        loaded: asset.size,
        total: asset.size,
        percentage: 100,
      });

      if (options.signal?.aborted) {
        throw createAbortError();
      }
    },

    async downloadToCache(url, filename, options = {}) {
      if (options.signal?.aborted) {
        throw createAbortError();
      }
      downloads.push({ url, filename, headers: options.headers });

      if (handlers.downloadToCache) {
        return handlers.downloadToCache(url, filename, options);
      }

      const safeName = sanitizeFileName(filename);
      const uri = `file:///in-memory-cache/transfers/${safeName}`;
      cachedFiles.set(safeName, { uri, modifiedAtMs: Date.now() });
      return { uri, status: 200 };
    },

    async shareLocalFile(uri, options) {
      shares.push({ uri, options });
      if (handlers.shareLocalFile) {
        return handlers.shareLocalFile(uri, options);
      }
    },

    async openPreviewUrl(url) {
      openedPreviewUrls.push(url);
      if (handlers.openPreviewUrl) {
        return handlers.openPreviewUrl(url);
      }
    },

    async pruneExpiredCacheFiles(maxAgeMs = TRANSFER_CACHE_TTL_MS) {
      pruneCalls.push(maxAgeMs);
      if (handlers.pruneExpiredCacheFiles) {
        return handlers.pruneExpiredCacheFiles(maxAgeMs);
      }
      const cutoff = Date.now() - maxAgeMs;
      let removed = 0;
      for (const [key, entry] of cachedFiles.entries()) {
        if (entry.modifiedAtMs < cutoff) {
          cachedFiles.delete(key);
          removed += 1;
        }
      }
      return removed;
    },
  };
}
