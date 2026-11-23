import { describe, expect, it } from "vitest";
import { FetchError } from "@/shared/api/fetch";
import {
  FileSystemUploadType,
  mockExpoFileSystemState,
} from "@/test/mocks/adapters/mock-expo-file-system";
import { mockExpoSharingState } from "@/test/mocks/adapters/mock-expo-sharing";
import { mockExpoWebBrowserState } from "@/test/mocks/adapters/mock-expo-web-browser";
import { createExpoFileTransferAdapter } from "../api/expo-file-transfer-adapter";
import { createInMemoryFileTransferPort, isAbortError } from "../api/transfer-port";
import type { MobileFileAsset, UploadProgressEvent } from "../model/files";

const sampleAsset: MobileFileAsset = {
  uri: "file:///cache/invoice.pdf",
  name: "invoice.pdf",
  size: 2048,
  mimeType: "application/pdf",
};

describe("createExpoFileTransferAdapter", () => {
  it("streams direct multipart uploads via FileSystem.createUploadTask and reports byte progress", async () => {
    const adapter = createExpoFileTransferAdapter();
    const progressEvents: UploadProgressEvent[] = [];

    const record = await adapter.uploadDirectMultipart(
      "http://localhost:9999/api/v1/files",
      sampleAsset,
      {
        headers: {
          Authorization: "Bearer token-123",
          "X-Request-Id": "req_abc",
          traceparent: "00-11111111111111111111111111111111-2222222222222222-01",
        },
        onProgress: (evt) => progressEvents.push(evt),
      },
    );

    expect(record.id).toBe("file-mock-1");
    expect(progressEvents).toEqual([
      { loaded: 50, total: 100, percentage: 50 },
      { loaded: 100, total: 100, percentage: 100 },
    ]);

    const upload = mockExpoFileSystemState.uploads[0];
    expect(upload?.url).toBe("http://localhost:9999/api/v1/files");
    expect(upload?.fileUri).toBe(sampleAsset.uri);
    expect(upload?.options).toMatchObject({
      httpMethod: "POST",
      uploadType: FileSystemUploadType.MULTIPART,
      fieldName: "file",
      mimeType: "application/pdf",
      headers: {
        Authorization: "Bearer token-123",
        "X-Request-Id": "req_abc",
      },
    });
  });

  it("streams presigned binary PUT with ONLY Content-Type header and no Authorization", async () => {
    mockExpoFileSystemState.setUploadResponder(async (_record, onProgress) => {
      onProgress?.({ totalBytesSent: 1024, totalBytesExpectedToSend: 2048 });
      onProgress?.({ totalBytesSent: 2048, totalBytesExpectedToSend: 2048 });
      return {
        status: 200,
        headers: {},
        body: "",
        mimeType: null,
      };
    });

    const adapter = createExpoFileTransferAdapter();
    const progressEvents: UploadProgressEvent[] = [];

    await adapter.uploadPresignedBinary(
      "https://s3.example.com/bucket/key?X-Amz-Signature=abc",
      sampleAsset,
      {
        onProgress: (evt) => progressEvents.push(evt),
      },
    );

    const upload = mockExpoFileSystemState.uploads[0];
    expect(upload?.options).toMatchObject({
      httpMethod: "PUT",
      uploadType: FileSystemUploadType.BINARY_CONTENT,
      headers: {
        "Content-Type": "application/pdf",
      },
    });
    const sentHeaders = (upload?.options?.headers ?? {}) as Record<string, string>;
    expect(Object.keys(sentHeaders)).toEqual(["Content-Type"]);
    expect(sentHeaders.Authorization).toBeUndefined();
    expect(progressEvents[progressEvents.length - 1]?.percentage).toBe(100);
  });

  it("cancels active native upload task and rejects with AbortError when signal aborts", async () => {
    const releaseRef: { current: (() => void) | null } = { current: null };
    mockExpoFileSystemState.setUploadResponder(
      () =>
        new Promise((resolve) => {
          releaseRef.current = () =>
            resolve({
              status: 201,
              headers: {},
              body: "{}",
              mimeType: "application/json",
            });
        }),
    );

    const controller = new AbortController();
    const adapter = createExpoFileTransferAdapter();

    const promise = adapter.uploadDirectMultipart(
      "http://localhost:9999/api/v1/files",
      sampleAsset,
      { signal: controller.signal },
    );

    controller.abort();
    releaseRef.current?.();

    let caught: unknown;
    try {
      await promise;
    } catch (err) {
      caught = err;
    }

    expect(isAbortError(caught)).toBe(true);
    expect(mockExpoFileSystemState.uploads[0]?.cancelled).toBe(true);
  });

  it("downloads files into transfers cache directory and throws FetchError on non-2xx status", async () => {
    const adapter = createExpoFileTransferAdapter();

    const result = await adapter.downloadToCache(
      "http://localhost:9999/api/v1/files/f-1/download",
      "download_f-1_invoice.pdf",
      { headers: { Authorization: "Bearer token-123" } },
    );

    expect(result.status).toBe(200);
    expect(result.uri).toBe("file:///mock-cache/transfers/download_f-1_invoice.pdf");

    mockExpoFileSystemState.setDownloadResponder(async (record) => ({
      uri: record.fileUri,
      status: 409,
      headers: { "x-error-code": "FILE_PENDING" },
      mimeType: "application/json",
    }));

    await expect(
      adapter.downloadToCache(
        "http://localhost:9999/api/v1/files/f-2/download",
        "download_f-2_pending.pdf",
      ),
    ).rejects.toMatchObject({
      name: "FetchError",
      status: 409,
    });
  });

  it("shares local files via expo-sharing and opens preview URLs via expo-web-browser", async () => {
    const adapter = createExpoFileTransferAdapter();

    await adapter.shareLocalFile("file:///mock-cache/transfers/doc.pdf", {
      mimeType: "application/pdf",
      dialogTitle: "Share doc.pdf",
    });

    expect(mockExpoSharingState.calls).toHaveLength(1);
    expect(mockExpoSharingState.calls[0]).toEqual({
      url: "file:///mock-cache/transfers/doc.pdf",
      options: {
        mimeType: "application/pdf",
        dialogTitle: "Share doc.pdf",
      },
    });

    await adapter.openPreviewUrl("https://cdn.example.com/signed/doc.pdf");
    expect(mockExpoWebBrowserState.calls).toEqual([
      { url: "https://cdn.example.com/signed/doc.pdf", options: undefined },
    ]);
  });

  it("throws descriptive error when native sharing is unavailable", async () => {
    mockExpoSharingState.setAvailable(false);
    const adapter = createExpoFileTransferAdapter();

    await expect(adapter.shareLocalFile("file:///mock-cache/transfers/doc.pdf")).rejects.toThrow(
      /sharing is not available/i,
    );
  });

  it("prunes only transfer cache files older than maxAgeMs", async () => {
    const nowSec = Math.floor(Date.now() / 1000);
    const oldSec = nowSec - 48 * 3600;
    const freshSec = nowSec - 30 * 60;

    mockExpoFileSystemState.seedFile("file:///mock-cache/transfers/", { isDirectory: true });
    mockExpoFileSystemState.seedFile("file:///mock-cache/transfers/stale.pdf", {
      modificationTime: oldSec,
    });
    mockExpoFileSystemState.seedFile("file:///mock-cache/transfers/fresh.pdf", {
      modificationTime: freshSec,
    });

    const adapter = createExpoFileTransferAdapter();
    const deletedCount = await adapter.pruneExpiredCacheFiles(24 * 60 * 60 * 1000);

    expect(deletedCount).toBe(1);
    expect(mockExpoFileSystemState.files.has("file:///mock-cache/transfers/stale.pdf")).toBe(false);
    expect(mockExpoFileSystemState.files.has("file:///mock-cache/transfers/fresh.pdf")).toBe(true);
  });

  it("maps S3 403 upload rejection to FetchError with status 403", async () => {
    mockExpoFileSystemState.setUploadResponder(async () => ({
      status: 403,
      headers: {},
      body: "<Error><Code>SignatureDoesNotMatch</Code></Error>",
      mimeType: "application/xml",
    }));

    const adapter = createExpoFileTransferAdapter();

    await expect(
      adapter.uploadPresignedBinary("https://s3.example.com/signed", sampleAsset),
    ).rejects.toBeInstanceOf(FetchError);
  });

  it("provides an in-memory FileTransferPort test double with full call recording", async () => {
    const port = createInMemoryFileTransferPort();
    const uploaded = await port.uploadDirectMultipart(
      "http://localhost:9999/api/v1/files",
      sampleAsset,
      { headers: { Authorization: "Bearer test" } },
    );
    expect(uploaded.originalName).toBe("invoice.pdf");
    expect(port.directUploads).toHaveLength(1);
    expect(port.directUploads[0]?.headers?.Authorization).toBe("Bearer test");
  });
});
