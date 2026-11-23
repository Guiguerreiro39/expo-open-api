import type { GetApiV1Files200DataItem } from "@/shared/api/generated/models/getApiV1Files200DataItem";

export type FileRecord = GetApiV1Files200DataItem;
export type FileStatus = FileRecord["status"];

export interface MobileFileAsset {
  readonly uri: string;
  readonly name: string;
  readonly size: number;
  readonly mimeType: string;
}

export type UploadStatus = "idle" | "queued" | "uploading" | "completed" | "error" | "aborted";
export type UploadStrategy = "auto" | "direct" | "presigned";
export type ResolvedUploadStrategy = "direct" | "presigned";

export interface UploadProgressEvent {
  readonly loaded: number;
  readonly total: number;
  readonly percentage: number;
}

export interface UploadItem {
  readonly id: string;
  readonly asset: MobileFileAsset;
  readonly strategy: UploadStrategy;
  readonly resolvedStrategy: ResolvedUploadStrategy;
  readonly status: UploadStatus;
  readonly progress: number;
  readonly loadedBytes: number;
  readonly totalBytes: number;
  readonly error?: string;
  readonly uploadedFile?: FileRecord;
}

export const MAX_MULTIPART_BYTES = 10 * 1024 * 1024; // 10 MB
export const MAX_PRESIGNED_BYTES = 100 * 1024 * 1024; // 100 MB
export const MAX_CONCURRENT_UPLOADS = 2;
export const TRANSFER_CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

const EXTENSION_MIME_MAP: Record<string, string> = {
  pdf: "application/pdf",
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  gif: "image/gif",
  webp: "image/webp",
  heic: "image/heic",
  heif: "image/heif",
  svg: "image/svg+xml",
  mp4: "video/mp4",
  mov: "video/quicktime",
  webm: "video/webm",
  mp3: "audio/mpeg",
  wav: "audio/wav",
  m4a: "audio/mp4",
  txt: "text/plain",
  md: "text/markdown",
  csv: "text/csv",
  html: "text/html",
  json: "application/json",
  xml: "application/xml",
  zip: "application/zip",
  gz: "application/gzip",
  doc: "application/msword",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  xls: "application/vnd.ms-excel",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  ppt: "application/vnd.ms-powerpoint",
  pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
};

export function formatFileSize(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return "0 B";
  const units = ["B", "KB", "MB", "GB", "TB"];
  const index = Math.floor(Math.log(bytes) / Math.log(1024));
  const normalizedIndex = Math.min(index, units.length - 1);
  const size = bytes / 1024 ** normalizedIndex;
  const rounded = Number.isInteger(size) ? size.toString() : size.toFixed(2).replace(/\.?0+$/, "");
  return `${rounded} ${units[normalizedIndex] ?? "B"}`;
}

export function calculateProgress(loaded: number, total: number): number {
  if (!Number.isFinite(loaded) || !Number.isFinite(total) || total <= 0 || loaded <= 0) {
    return 0;
  }
  if (loaded >= total) return 100;
  return Math.min(100, Math.max(0, Math.round((loaded / total) * 100)));
}

export function resolveUploadStrategy(
  asset: Pick<MobileFileAsset, "size">,
  strategy: UploadStrategy,
): ResolvedUploadStrategy {
  if (strategy === "direct") return "direct";
  if (strategy === "presigned") return "presigned";
  return asset.size <= MAX_MULTIPART_BYTES ? "direct" : "presigned";
}

export function validateUploadFile(
  asset: Pick<MobileFileAsset, "size">,
  strategy: UploadStrategy,
): string | null {
  if (!Number.isFinite(asset.size) || asset.size <= 0) {
    return "File cannot be empty";
  }

  const resolved = resolveUploadStrategy(asset, strategy);
  if (resolved === "direct" && asset.size > MAX_MULTIPART_BYTES) {
    return "File exceeds 10 MB direct upload limit";
  }

  if (asset.size > MAX_PRESIGNED_BYTES) {
    return "File exceeds 100 MB maximum size limit";
  }

  return null;
}

export function deriveMimeTypeFromName(name: string): string {
  const cleanName = name.split("?")[0]?.split("#")[0] ?? name;
  const lastDot = cleanName.lastIndexOf(".");
  if (lastDot === -1 || lastDot === cleanName.length - 1) {
    return "application/octet-stream";
  }
  const ext = cleanName.slice(lastDot + 1).toLowerCase();
  return EXTENSION_MIME_MAP[ext] ?? "application/octet-stream";
}

export function sanitizeFileName(name: string): string {
  const trimmed = name.trim();
  if (!trimmed) {
    return "file";
  }
  const segments = trimmed.split(/[/\\]+/).filter(Boolean);
  const baseName = segments[segments.length - 1] ?? "";
  const cleaned = baseName
    .replace(/^\.+/, "")
    .replace(/[^a-zA-Z0-9._-]/g, "_")
    .slice(0, 200);
  return cleaned.length > 0 ? cleaned : "file";
}
