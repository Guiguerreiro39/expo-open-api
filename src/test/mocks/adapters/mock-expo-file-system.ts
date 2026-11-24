export enum FileSystemUploadType {
  BINARY_CONTENT = 0,
  MULTIPART = 1,
}

export enum FileSystemSessionType {
  BACKGROUND = 0,
  FOREGROUND = 1,
}

export enum EncodingType {
  UTF8 = "utf8",
  Base64 = "base64",
}

export interface MockUploadRecord {
  readonly url: string;
  readonly fileUri: string;
  readonly options?: Record<string, unknown>;
  cancelled: boolean;
}

export interface MockDownloadRecord {
  readonly url: string;
  readonly fileUri: string;
  readonly options?: Record<string, unknown>;
}

export interface MockFileEntry {
  content: string;
  size: number;
  isDirectory: boolean;
  /** Modification time in seconds since epoch (matching expo-file-system) */
  modificationTime: number;
}

export type MockUploadResponder = (
  record: MockUploadRecord,
  onProgress?: (data: { totalBytesSent: number; totalBytesExpectedToSend: number }) => void,
) => Promise<{
  status: number;
  headers: Record<string, string>;
  body: string;
  mimeType: string | null;
}>;

export type MockDownloadResponder = (record: MockDownloadRecord) => Promise<{
  uri: string;
  status: number;
  headers: Record<string, string>;
  mimeType: string | null;
}>;

const files = new Map<string, MockFileEntry>();
const uploads: MockUploadRecord[] = [];
const downloads: MockDownloadRecord[] = [];
let uploadResponder: MockUploadResponder | null = null;
let downloadResponder: MockDownloadResponder | null = null;
let cacheDir: string | null = "file:///mock-cache/";

export const mockExpoFileSystemState = {
  get files() {
    return files;
  },
  get uploads() {
    return uploads;
  },
  get downloads() {
    return downloads;
  },
  setCacheDirectory(dir: string | null) {
    cacheDir = dir;
  },
  setUploadResponder(responder: MockUploadResponder | null) {
    uploadResponder = responder;
  },
  setDownloadResponder(responder: MockDownloadResponder | null) {
    downloadResponder = responder;
  },
  seedFile(uri: string, entry: Partial<MockFileEntry> = {}) {
    files.set(uri, {
      content: entry.content ?? "mock-content",
      size: entry.size ?? 128,
      isDirectory: entry.isDirectory ?? false,
      modificationTime: entry.modificationTime ?? Math.floor(Date.now() / 1000),
    });
  },
  reset() {
    files.clear();
    uploads.length = 0;
    downloads.length = 0;
    uploadResponder = null;
    downloadResponder = null;
    cacheDir = "file:///mock-cache/";
  },
};

export function resetMockExpoFileSystem(): void {
  mockExpoFileSystemState.reset();
}

export const documentDirectory = "file:///mock-documents/";
export const bundleDirectory = "file:///mock-bundle/";

export let cacheDirectory: string | null = cacheDir;

function syncCacheDirectory(): string | null {
  cacheDirectory = cacheDir;
  return cacheDir;
}

export async function getInfoAsync(fileUri: string): Promise<
  | {
      exists: true;
      uri: string;
      size: number;
      isDirectory: boolean;
      modificationTime: number;
    }
  | {
      exists: false;
      uri: string;
      isDirectory: false;
    }
> {
  syncCacheDirectory();
  const entry = files.get(fileUri);
  if (!entry) {
    return { exists: false, uri: fileUri, isDirectory: false };
  }
  return {
    exists: true,
    uri: fileUri,
    size: entry.size,
    isDirectory: entry.isDirectory,
    modificationTime: entry.modificationTime,
  };
}

export async function makeDirectoryAsync(
  fileUri: string,
  _options?: { intermediates?: boolean },
): Promise<void> {
  syncCacheDirectory();
  files.set(fileUri, {
    content: "",
    size: 0,
    isDirectory: true,
    modificationTime: Math.floor(Date.now() / 1000),
  });
}

export async function readDirectoryAsync(fileUri: string): Promise<string[]> {
  syncCacheDirectory();
  const normalizedPrefix = fileUri.endsWith("/") ? fileUri : `${fileUri}/`;
  const names: string[] = [];
  for (const key of files.keys()) {
    if (key.startsWith(normalizedPrefix) && key !== normalizedPrefix) {
      const rest = key.slice(normalizedPrefix.length);
      if (rest.length > 0 && !rest.includes("/")) {
        names.push(rest);
      }
    }
  }
  return names;
}

export async function deleteAsync(
  fileUri: string,
  options?: { idempotent?: boolean },
): Promise<void> {
  syncCacheDirectory();
  if (!files.has(fileUri) && !options?.idempotent) {
    throw new Error(`File does not exist: ${fileUri}`);
  }
  files.delete(fileUri);
}

export async function downloadAsync(
  url: string,
  fileUri: string,
  options?: Record<string, unknown>,
): Promise<{
  uri: string;
  status: number;
  headers: Record<string, string>;
  mimeType: string | null;
}> {
  syncCacheDirectory();
  const record: MockDownloadRecord = { url, fileUri, options };
  downloads.push(record);

  if (downloadResponder) {
    const res = await downloadResponder(record);
    if (res.status >= 200 && res.status < 300) {
      mockExpoFileSystemState.seedFile(res.uri);
    }
    return res;
  }

  mockExpoFileSystemState.seedFile(fileUri);
  return {
    uri: fileUri,
    status: 200,
    headers: { "content-type": "application/octet-stream" },
    mimeType: "application/octet-stream",
  };
}

export class UploadTask {
  private readonly record: MockUploadRecord;
  private readonly callback?: (data: {
    totalBytesSent: number;
    totalBytesExpectedToSend: number;
  }) => void;
  private cancelled = false;

  constructor(
    url: string,
    fileUri: string,
    options?: Record<string, unknown>,
    callback?: (data: { totalBytesSent: number; totalBytesExpectedToSend: number }) => void,
  ) {
    this.record = { url, fileUri, options, cancelled: false };
    this.callback = callback;
  }

  async cancelAsync(): Promise<void> {
    this.cancelled = true;
    this.record.cancelled = true;
  }

  async uploadAsync(): Promise<
    | {
        status: number;
        headers: Record<string, string>;
        body: string;
        mimeType: string | null;
      }
    | undefined
  > {
    uploads.push(this.record);
    if (this.cancelled) {
      return undefined;
    }

    if (uploadResponder) {
      const result = await uploadResponder(this.record, this.callback);
      if (this.cancelled) {
        return undefined;
      }
      return result;
    }

    this.callback?.({ totalBytesSent: 50, totalBytesExpectedToSend: 100 });
    this.callback?.({ totalBytesSent: 100, totalBytesExpectedToSend: 100 });

    if (this.cancelled) {
      return undefined;
    }

    return {
      status: 201,
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        id: "file-mock-1",
        userId: "user-1",
        originalName: "mock.bin",
        mimeType: "application/octet-stream",
        sizeBytes: 100,
        checksumSha256: null,
        status: "ready",
        expiresAt: null,
        createdAt: "2026-01-01T00:00:00.000Z",
        updatedAt: "2026-01-01T00:00:00.000Z",
      }),
      mimeType: "application/json",
    };
  }
}

export function createUploadTask(
  url: string,
  fileUri: string,
  options?: Record<string, unknown>,
  callback?: (data: { totalBytesSent: number; totalBytesExpectedToSend: number }) => void,
): UploadTask {
  syncCacheDirectory();
  return new UploadTask(url, fileUri, options, callback);
}
