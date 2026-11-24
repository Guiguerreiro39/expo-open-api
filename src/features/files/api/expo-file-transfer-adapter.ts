import * as FileSystem from "expo-file-system/legacy";
import * as Sharing from "expo-sharing";
import * as WebBrowser from "expo-web-browser";
import { Platform } from "react-native";
import { FetchError, type HonoErrorEnvelope } from "@/shared/api/fetch";
import { resetAuthSessionCache } from "@/shared/lib/auth-session-bridge";
import {
  calculateProgress,
  type FileRecord,
  type MobileFileAsset,
  sanitizeFileName,
  TRANSFER_CACHE_TTL_MS,
} from "../model/files";
import {
  createAbortError,
  type DirectMultipartUploadOptions,
  type DownloadToCacheOptions,
  type DownloadToCacheResult,
  FileTransferError,
  type FileTransferPort,
  isAbortError,
  type PresignedBinaryUploadOptions,
  type ShareLocalFileOptions,
} from "./transfer-port";

const TRANSFERS_SUBDIR = "transfers/";

function getTransfersDirectory(): string | null {
  if (!FileSystem.cacheDirectory) {
    return null;
  }
  const base = FileSystem.cacheDirectory.endsWith("/")
    ? FileSystem.cacheDirectory
    : `${FileSystem.cacheDirectory}/`;
  return `${base}${TRANSFERS_SUBDIR}`;
}

function parseErrorEnvelope(body: string, status: number, fallbackPrefix: string): FetchError {
  let errorData: HonoErrorEnvelope | undefined;
  try {
    if (body.trim().length > 0) {
      errorData = JSON.parse(body) as HonoErrorEnvelope;
    }
  } catch {
    errorData = undefined;
  }

  const code = errorData?.error?.code;
  const requestId = errorData?.error?.requestId;
  const message =
    errorData?.error?.message ||
    errorData?.message ||
    `${fallbackPrefix} failed with HTTP ${status}`;

  return new FetchError({
    status,
    code,
    message,
    requestId,
    details: errorData?.error?.details,
    data: errorData,
  });
}

async function ensureTransfersDirectory(): Promise<string> {
  const dir = getTransfersDirectory();
  if (!dir) {
    throw new FileTransferError({
      message: "Local cache directory is unavailable on this platform",
      category: "storage",
      code: "CACHE_DIRECTORY_UNAVAILABLE",
    });
  }

  const info = await FileSystem.getInfoAsync(dir);
  if (!info.exists) {
    await FileSystem.makeDirectoryAsync(dir, { intermediates: true });
  }
  return dir;
}

async function webUploadDirectMultipart(
  url: string,
  asset: MobileFileAsset,
  options: DirectMultipartUploadOptions,
): Promise<FileRecord> {
  if (options.signal?.aborted) {
    throw createAbortError();
  }

  const fileResponse = await fetch(asset.uri);
  const blob = await fileResponse.blob();
  const formData = new FormData();
  formData.append("file", blob, asset.name);

  const response = await fetch(url, {
    method: "POST",
    headers: options.headers,
    body: formData,
    signal: options.signal,
  });

  const bodyText = await response.text();
  if (!response.ok) {
    if (response.status === 401) {
      resetAuthSessionCache();
    }
    throw parseErrorEnvelope(bodyText, response.status, "Direct upload");
  }

  options.onProgress?.({
    loaded: asset.size,
    total: asset.size,
    percentage: 100,
  });

  try {
    return JSON.parse(bodyText) as FileRecord;
  } catch (err) {
    throw new FileTransferError({
      message: "Failed to parse file upload response",
      category: "parse",
      cause: err,
    });
  }
}

async function webUploadPresignedBinary(
  uploadUrl: string,
  asset: MobileFileAsset,
  options: PresignedBinaryUploadOptions,
): Promise<void> {
  if (options.signal?.aborted) {
    throw createAbortError();
  }

  const fileResponse = await fetch(asset.uri);
  const blob = await fileResponse.blob();

  const response = await fetch(uploadUrl, {
    method: "PUT",
    headers: {
      "Content-Type": asset.mimeType || "application/octet-stream",
    },
    body: blob,
    signal: options.signal,
  });

  if (!response.ok) {
    const bodyText = await response.text().catch(() => "");
    throw parseErrorEnvelope(bodyText, response.status, "Presigned storage upload");
  }

  options.onProgress?.({
    loaded: asset.size,
    total: asset.size,
    percentage: 100,
  });
}

export function createExpoFileTransferAdapter(): FileTransferPort {
  return {
    async uploadDirectMultipart(
      url: string,
      asset: MobileFileAsset,
      options: DirectMultipartUploadOptions = {},
    ): Promise<FileRecord> {
      if (options.signal?.aborted) {
        throw createAbortError();
      }

      if (Platform.OS === "web" || !FileSystem.cacheDirectory) {
        return webUploadDirectMultipart(url, asset, options);
      }

      const task = FileSystem.createUploadTask(
        url,
        asset.uri,
        {
          httpMethod: "POST",
          uploadType: FileSystem.FileSystemUploadType.MULTIPART,
          fieldName: "file",
          mimeType: asset.mimeType || "application/octet-stream",
          headers: options.headers,
        },
        (progressData) => {
          const total =
            progressData.totalBytesExpectedToSend > 0
              ? progressData.totalBytesExpectedToSend
              : asset.size;
          options.onProgress?.({
            loaded: progressData.totalBytesSent,
            total,
            percentage: calculateProgress(progressData.totalBytesSent, total),
          });
        },
      );

      let aborted = false;
      const onAbort = () => {
        aborted = true;
        void task.cancelAsync().catch(() => undefined);
      };

      options.signal?.addEventListener("abort", onAbort, { once: true });

      try {
        const result = await task.uploadAsync();
        if (aborted || options.signal?.aborted || !result) {
          throw createAbortError();
        }

        if (result.status < 200 || result.status >= 300) {
          if (result.status === 401) {
            resetAuthSessionCache();
          }
          throw parseErrorEnvelope(result.body, result.status, "Direct upload");
        }

        try {
          return JSON.parse(result.body) as FileRecord;
        } catch (err) {
          throw new FileTransferError({
            message: "Failed to parse file upload response",
            category: "parse",
            cause: err,
          });
        }
      } catch (err: unknown) {
        if (aborted || options.signal?.aborted || isAbortError(err)) {
          throw createAbortError();
        }
        throw err;
      } finally {
        options.signal?.removeEventListener("abort", onAbort);
      }
    },

    async uploadPresignedBinary(
      uploadUrl: string,
      asset: MobileFileAsset,
      options: PresignedBinaryUploadOptions = {},
    ): Promise<void> {
      if (options.signal?.aborted) {
        throw createAbortError();
      }

      if (Platform.OS === "web" || !FileSystem.cacheDirectory) {
        return webUploadPresignedBinary(uploadUrl, asset, options);
      }

      const contentType = asset.mimeType || "application/octet-stream";

      // Strictly send ONLY Content-Type to presigned S3/R2 URLs (no Authorization/cookies).
      const task = FileSystem.createUploadTask(
        uploadUrl,
        asset.uri,
        {
          httpMethod: "PUT",
          uploadType: FileSystem.FileSystemUploadType.BINARY_CONTENT,
          headers: {
            "Content-Type": contentType,
          },
        },
        (progressData) => {
          const total =
            progressData.totalBytesExpectedToSend > 0
              ? progressData.totalBytesExpectedToSend
              : asset.size;
          options.onProgress?.({
            loaded: progressData.totalBytesSent,
            total,
            percentage: calculateProgress(progressData.totalBytesSent, total),
          });
        },
      );

      let aborted = false;
      const onAbort = () => {
        aborted = true;
        void task.cancelAsync().catch(() => undefined);
      };

      options.signal?.addEventListener("abort", onAbort, { once: true });

      try {
        const result = await task.uploadAsync();
        if (aborted || options.signal?.aborted || !result) {
          throw createAbortError();
        }

        if (result.status < 200 || result.status >= 300) {
          throw parseErrorEnvelope(result.body, result.status, "Presigned storage upload");
        }
      } catch (err: unknown) {
        if (aborted || options.signal?.aborted || isAbortError(err)) {
          throw createAbortError();
        }
        throw err;
      } finally {
        options.signal?.removeEventListener("abort", onAbort);
      }
    },

    async downloadToCache(
      url: string,
      filename: string,
      options: DownloadToCacheOptions = {},
    ): Promise<DownloadToCacheResult> {
      if (options.signal?.aborted) {
        throw createAbortError();
      }

      if (Platform.OS === "web" || !FileSystem.cacheDirectory) {
        const response = await fetch(url, {
          method: "GET",
          headers: options.headers,
          signal: options.signal,
        });
        if (!response.ok) {
          const bodyText = await response.text().catch(() => "");
          if (response.status === 401) {
            resetAuthSessionCache();
          }
          throw parseErrorEnvelope(bodyText, response.status, "File download");
        }
        const blob = await response.blob();
        const objectUrl =
          typeof URL !== "undefined" && typeof URL.createObjectURL === "function"
            ? URL.createObjectURL(blob)
            : url;
        return { uri: objectUrl, status: response.status };
      }

      const dir = await ensureTransfersDirectory();
      const safeName = sanitizeFileName(filename);
      const destinationUri = `${dir}${safeName}`;

      const result = await FileSystem.downloadAsync(url, destinationUri, {
        headers: options.headers,
      });

      if (options.signal?.aborted) {
        await FileSystem.deleteAsync(destinationUri, { idempotent: true }).catch(() => undefined);
        throw createAbortError();
      }

      if (result.status < 200 || result.status >= 300) {
        await FileSystem.deleteAsync(destinationUri, { idempotent: true }).catch(() => undefined);
        if (result.status === 401) {
          resetAuthSessionCache();
        }
        const headerCode =
          result.headers["x-error-code"] ??
          result.headers["X-Error-Code"] ??
          (result.status === 409 ? "FILE_PENDING" : undefined);

        throw new FetchError({
          status: result.status,
          code: headerCode,
          message: `File download failed with HTTP ${result.status}`,
        });
      }

      return {
        uri: result.uri,
        status: result.status,
      };
    },

    async shareLocalFile(uri: string, options: ShareLocalFileOptions = {}): Promise<void> {
      if (Platform.OS === "web") {
        if (typeof document !== "undefined") {
          const anchor = document.createElement("a");
          anchor.href = uri;
          anchor.download = options.dialogTitle ?? "download";
          document.body.appendChild(anchor);
          anchor.click();
          document.body.removeChild(anchor);
        }
        return;
      }

      const available = await Sharing.isAvailableAsync();
      if (!available) {
        throw new FileTransferError({
          message: "Native file sharing is not available on this device",
          category: "share",
          code: "SHARING_UNAVAILABLE",
        });
      }

      await Sharing.shareAsync(uri, {
        mimeType: options.mimeType,
        dialogTitle: options.dialogTitle,
      });
    },

    async openPreviewUrl(url: string): Promise<void> {
      if (Platform.OS === "web" && typeof window !== "undefined") {
        window.open(url, "_blank", "noopener,noreferrer");
        return;
      }
      await WebBrowser.openBrowserAsync(url);
    },

    async pruneExpiredCacheFiles(maxAgeMs: number = TRANSFER_CACHE_TTL_MS): Promise<number> {
      if (Platform.OS === "web") {
        return 0;
      }

      const dir = getTransfersDirectory();
      if (!dir) {
        return 0;
      }

      const dirInfo = await FileSystem.getInfoAsync(dir);
      if (!dirInfo.exists || !dirInfo.isDirectory) {
        return 0;
      }

      const entries = await FileSystem.readDirectoryAsync(dir);
      const cutoffMs = Date.now() - maxAgeMs;
      let deletedCount = 0;

      for (const name of entries) {
        const entryUri = `${dir}${name}`;
        const info = await FileSystem.getInfoAsync(entryUri);
        if (!info.exists || info.isDirectory) {
          continue;
        }
        // expo-file-system reports modificationTime in seconds since epoch
        const modifiedAtMs =
          info.modificationTime < 1e12 ? info.modificationTime * 1000 : info.modificationTime;
        if (modifiedAtMs < cutoffMs) {
          await FileSystem.deleteAsync(entryUri, { idempotent: true });
          deletedCount += 1;
        }
      }

      return deletedCount;
    },
  };
}
