import { createW3CTraceparent, customFetch, type FetchError } from "@/shared/api/fetch";
import type { PostApiV1FilesPresign201 } from "@/shared/api/generated/models/postApiV1FilesPresign201";
import { resolveApiUrl } from "@/shared/config/env";
import { getCachedBearerToken } from "@/shared/lib/auth-session-bridge";
import { noopObservabilityAdapter } from "@/shared/observability/noop-adapter";
import {
  extractDefectContext,
  type ObservabilityService,
  recordErrorOrDefect,
} from "@/shared/observability/port";
import {
  type FileRecord,
  type MobileFileAsset,
  resolveUploadStrategy,
  type UploadProgressEvent,
  type UploadStrategy,
  validateUploadFile,
} from "../model/files";
import { createExpoFileTransferAdapter } from "./expo-file-transfer-adapter";
import {
  createAbortError,
  FileTransferError,
  type FileTransferPort,
  isAbortError,
} from "./transfer-port";

export interface UploadOptions {
  readonly onProgress?: (event: UploadProgressEvent) => void;
  readonly signal?: AbortSignal;
  readonly headers?: Record<string, string>;
  readonly transferPort?: FileTransferPort;
  readonly observability?: ObservabilityService;
}

export type TransferStage =
  | "validation"
  | "direct_multipart"
  | "presign_request"
  | "presigned_put"
  | "presign_complete"
  | "download"
  | "preview_url"
  | "share"
  | "cache_prune";

function generateRequestId(): string {
  if (
    typeof globalThis.crypto !== "undefined" &&
    typeof globalThis.crypto.randomUUID === "function"
  ) {
    return `req_${globalThis.crypto.randomUUID()}`;
  }
  return `req_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}

export function buildAuthTracingHeaders(
  customHeaders?: Record<string, string>,
): Record<string, string> {
  const headers: Record<string, string> = { ...(customHeaders ?? {}) };

  const hasAuth = Object.keys(headers).some((k) => k.toLowerCase() === "authorization");
  if (!hasAuth) {
    const token = getCachedBearerToken();
    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }
  }

  const hasRequestId = Object.keys(headers).some((k) => k.toLowerCase() === "x-request-id");
  if (!hasRequestId) {
    headers["X-Request-Id"] = generateRequestId();
  }

  const hasTraceparent = Object.keys(headers).some((k) => k.toLowerCase() === "traceparent");
  if (!hasTraceparent) {
    headers.traceparent = createW3CTraceparent().traceparent;
  }

  return headers;
}

export function recordTransferError(
  observability: ObservabilityService,
  error: unknown,
  stage: TransferStage,
  extra?: Record<string, unknown>,
): void {
  if (isAbortError(error)) {
    observability.recordBreadcrumb({
      category: "files.transfer",
      level: "info",
      message: `Transfer aborted during ${stage}`,
      data: { stage, ...extra },
    });
    return;
  }

  if (error instanceof FileTransferError && error.category === "validation") {
    observability.recordBreadcrumb({
      category: "files.validation",
      level: "warning",
      message: error.message,
      data: { stage, ...extra },
    });
    return;
  }

  const status = (error as FetchError | undefined)?.status;
  if (stage === "presigned_put" && status === 403) {
    observability.captureDefect(error, {
      ...extractDefectContext(error),
      source: "files.transfer",
      extra: { stage, reason: "s3_signature_rejected", ...extra },
    });
    return;
  }

  if (
    error instanceof FileTransferError &&
    (error.category === "storage" || error.category === "share" || error.category === "parse")
  ) {
    observability.captureDefect(error, {
      source: "files.transfer",
      code: error.code,
      extra: { stage, category: error.category, ...extra },
    });
    return;
  }

  recordErrorOrDefect(observability, error, {
    source: "files.transfer",
    extra: { stage, ...extra },
  });
}

function getTransferPort(port?: FileTransferPort): FileTransferPort {
  return port ?? createExpoFileTransferAdapter();
}

export async function uploadDirectMultipart(
  asset: MobileFileAsset,
  options: UploadOptions = {},
): Promise<FileRecord> {
  const obs = options.observability ?? noopObservabilityAdapter;
  const validationError = validateUploadFile(asset, "direct");
  if (validationError) {
    const err = new FileTransferError({
      message: validationError,
      category: "validation",
      code: "FILE_VALIDATION_ERROR",
    });
    recordTransferError(obs, err, "validation", { size: asset.size, mimeType: asset.mimeType });
    throw err;
  }

  if (options.signal?.aborted) {
    const abortErr = createAbortError();
    recordTransferError(obs, abortErr, "direct_multipart");
    throw abortErr;
  }

  const port = getTransferPort(options.transferPort);
  const url = resolveApiUrl("/api/v1/files");
  const headers = buildAuthTracingHeaders(options.headers);

  try {
    return await port.uploadDirectMultipart(url, asset, {
      headers,
      onProgress: options.onProgress,
      signal: options.signal,
    });
  } catch (err: unknown) {
    recordTransferError(obs, err, "direct_multipart", {
      size: asset.size,
      mimeType: asset.mimeType,
    });
    throw err;
  }
}

export async function uploadPresigned(
  asset: MobileFileAsset,
  options: UploadOptions = {},
): Promise<FileRecord> {
  const obs = options.observability ?? noopObservabilityAdapter;
  const validationError = validateUploadFile(asset, "presigned");
  if (validationError) {
    const err = new FileTransferError({
      message: validationError,
      category: "validation",
      code: "FILE_VALIDATION_ERROR",
    });
    recordTransferError(obs, err, "validation", { size: asset.size, mimeType: asset.mimeType });
    throw err;
  }

  if (options.signal?.aborted) {
    const abortErr = createAbortError();
    recordTransferError(obs, abortErr, "presign_request");
    throw abortErr;
  }

  const port = getTransferPort(options.transferPort);

  // Step 1: Request presigned upload URL from API
  let presignResponse: PostApiV1FilesPresign201;
  try {
    presignResponse = await customFetch<PostApiV1FilesPresign201>("/api/v1/files/presign", {
      method: "POST",
      headers: options.headers,
      signal: options.signal,
      body: JSON.stringify({
        originalName: asset.name,
        mimeType: asset.mimeType || "application/octet-stream",
        sizeBytes: asset.size,
      }),
    });
  } catch (err: unknown) {
    recordTransferError(obs, err, "presign_request", {
      size: asset.size,
      mimeType: asset.mimeType,
    });
    throw err;
  }

  const { file: pendingFile, uploadUrl } = presignResponse;

  if (options.signal?.aborted) {
    const abortErr = createAbortError();
    recordTransferError(obs, abortErr, "presigned_put", { fileId: pendingFile.id });
    throw abortErr;
  }

  // Step 2: Stream binary bytes directly to presigned storage URL (NO Authorization/cookies!)
  try {
    await port.uploadPresignedBinary(uploadUrl, asset, {
      onProgress: options.onProgress,
      signal: options.signal,
    });
  } catch (err: unknown) {
    recordTransferError(obs, err, "presigned_put", {
      fileId: pendingFile.id,
      size: asset.size,
      mimeType: asset.mimeType,
    });
    throw err;
  }

  if (options.signal?.aborted) {
    const abortErr = createAbortError();
    recordTransferError(obs, abortErr, "presign_complete", { fileId: pendingFile.id });
    throw abortErr;
  }

  // Step 3: Promote pending file to ready
  try {
    return await customFetch<FileRecord>(`/api/v1/files/${pendingFile.id}/complete`, {
      method: "POST",
      headers: options.headers,
      signal: options.signal,
    });
  } catch (err: unknown) {
    recordTransferError(obs, err, "presign_complete", { fileId: pendingFile.id });
    throw err;
  }
}

export async function uploadFile(
  asset: MobileFileAsset,
  options: UploadOptions & { readonly strategy?: UploadStrategy } = {},
): Promise<FileRecord> {
  const strategy = options.strategy ?? "auto";
  const resolved = resolveUploadStrategy(asset, strategy);
  if (resolved === "direct") {
    return uploadDirectMultipart(asset, options);
  }
  return uploadPresigned(asset, options);
}
