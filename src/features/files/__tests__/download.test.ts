import { HttpResponse, http } from "msw";
import { describe, expect, it } from "vitest";
import { FetchError } from "@/shared/api/fetch";
import { setCachedBearerToken } from "@/shared/lib/auth-session-bridge";
import { createSpyObservability } from "@/shared/observability/spy-adapter";
import { TEST_API_BASE } from "@/test/mocks/handlers/auth";
import { honoErrorResponse, server } from "@/test/msw-server";
import { downloadFileDirect, openFilePreviewUrl, pruneExpiredTransferCache } from "../api/download";
import { createInMemoryFileTransferPort, FileTransferError } from "../api/transfer-port";
import { TRANSFER_CACHE_TTL_MS } from "../model/files";

describe("mobile download, sharing, and 409 FILE_PENDING retry", () => {
  it("downloads file to local cache with auth/tracing headers and triggers native share sheet", async () => {
    setCachedBearerToken("download-jwt");
    const port = createInMemoryFileTransferPort();
    const obs = createSpyObservability();

    const result = await downloadFileDirect("file-10", {
      originalName: "Q4 Report.pdf",
      mimeType: "application/pdf",
      transferPort: port,
      observability: obs,
    });

    expect(port.downloads).toHaveLength(1);
    expect(port.downloads[0]?.url).toBe(`${TEST_API_BASE}/api/v1/files/file-10/download`);
    expect(port.downloads[0]?.filename).toBe("download_file-10_Q4_Report.pdf");
    expect(port.downloads[0]?.headers?.Authorization).toBe("Bearer download-jwt");
    expect(port.downloads[0]?.headers?.["X-Request-Id"]).toMatch(/^req_/);
    expect(port.downloads[0]?.headers?.traceparent).toMatch(/^00-[0-9a-f]{32}-[0-9a-f]{16}-01$/);

    expect(port.shares).toHaveLength(1);
    expect(port.shares[0]).toEqual({
      uri: result.uri,
      options: {
        mimeType: "application/pdf",
        dialogTitle: "Q4 Report.pdf",
      },
    });
    obs.assertNoDefects();
  });

  it("retries 409 FILE_PENDING with exponential backoff (backoffMs * 2^(attempt-1)) and succeeds on attempt 3", async () => {
    let attempts = 0;
    const sleepDelays: number[] = [];

    const port = createInMemoryFileTransferPort({
      downloadToCache: async (_url, filename) => {
        attempts += 1;
        if (attempts < 3) {
          throw new FetchError({
            status: 409,
            code: "FILE_PENDING",
            message: "File is still processing",
          });
        }
        return { uri: `file:///cache/transfers/${filename}`, status: 200 };
      },
    });
    const obs = createSpyObservability();

    const result = await downloadFileDirect("file-pending-1", {
      originalName: "processing.pdf",
      mimeType: "application/pdf",
      maxAttempts: 3,
      backoffMs: 25,
      sleep: async (ms) => {
        sleepDelays.push(ms);
      },
      transferPort: port,
      observability: obs,
    });

    expect(attempts).toBe(3);
    expect(sleepDelays).toEqual([25, 50]);
    expect(result.uri).toContain("download_file-pending-1_processing.pdf");
    expect(port.shares).toHaveLength(1);
    obs.assertNoDefects();
  });

  it("stops retrying after max attempts on persistent 409 FILE_PENDING and records breadcrumb", async () => {
    let attempts = 0;
    const port = createInMemoryFileTransferPort({
      downloadToCache: async () => {
        attempts += 1;
        throw new FetchError({
          status: 409,
          code: "FILE_PENDING",
          message: "Still pending",
        });
      },
    });
    const obs = createSpyObservability();

    await expect(
      downloadFileDirect("file-stuck", {
        originalName: "stuck.pdf",
        maxAttempts: 3,
        backoffMs: 1,
        transferPort: port,
        observability: obs,
      }),
    ).rejects.toMatchObject({ status: 409, code: "FILE_PENDING" });

    expect(attempts).toBe(3);
    expect(port.shares).toHaveLength(0);
    obs.assertNoDefects();
    expect(obs.breadcrumbs.length).toBeGreaterThan(0);
  });

  it("fetches presigned preview URL with 409 retry and opens in WebBrowser", async () => {
    let urlCalls = 0;
    const sleepDelays: number[] = [];

    server.use(
      http.get(`${TEST_API_BASE}/api/v1/files/:id/url`, () => {
        urlCalls += 1;
        if (urlCalls === 1) {
          return honoErrorResponse(409, "FILE_PENDING", "Upload finalizing");
        }
        return HttpResponse.json({
          url: "https://cdn.example.com/signed/file-99?exp=3600",
          expiresInSeconds: 3600,
        });
      }),
    );

    const port = createInMemoryFileTransferPort();
    const obs = createSpyObservability();

    const response = await openFilePreviewUrl("file-99", {
      backoffMs: 10,
      sleep: async (ms) => {
        sleepDelays.push(ms);
      },
      transferPort: port,
      observability: obs,
    });

    expect(urlCalls).toBe(2);
    expect(sleepDelays).toEqual([10]);
    expect(response).toEqual({
      url: "https://cdn.example.com/signed/file-99?exp=3600",
      expiresInSeconds: 3600,
    });
    expect(port.openedPreviewUrls).toEqual(["https://cdn.example.com/signed/file-99?exp=3600"]);
    obs.assertNoDefects();
  });

  it("does not retry 500 errors and captures them as defects", async () => {
    let attempts = 0;
    const port = createInMemoryFileTransferPort({
      downloadToCache: async () => {
        attempts += 1;
        throw new FetchError({
          status: 500,
          code: "INTERNAL_SERVER_ERROR",
          message: "Server down",
        });
      },
    });
    const obs = createSpyObservability();

    await expect(
      downloadFileDirect("file-err", {
        originalName: "err.pdf",
        backoffMs: 1,
        transferPort: port,
        observability: obs,
      }),
    ).rejects.toThrow("Server down");

    expect(attempts).toBe(1);
    expect(obs.defects).toHaveLength(1);
  });

  it("does not retry HTTP 409 conflicts whose error code is not FILE_PENDING", async () => {
    let previewCalls = 0;
    server.use(
      http.get(`${TEST_API_BASE}/api/v1/files/:id/url`, () => {
        previewCalls += 1;
        return honoErrorResponse(409, "CONFLICT", "Quarantined");
      }),
    );

    const port = createInMemoryFileTransferPort();
    const obs = createSpyObservability();

    await expect(
      openFilePreviewUrl("file-quarantined", {
        backoffMs: 1,
        transferPort: port,
        observability: obs,
      }),
    ).rejects.toMatchObject({ status: 409, code: "CONFLICT", message: "Quarantined" });

    expect(previewCalls).toBe(1);

    let downloadCalls = 0;
    const failingDownloadPort = createInMemoryFileTransferPort({
      downloadToCache: async () => {
        downloadCalls += 1;
        throw new FetchError({
          status: 409,
          code: "CONFLICT",
          message: "Quarantined",
        });
      },
    });

    await expect(
      downloadFileDirect("file-quarantined", {
        originalName: "bad.pdf",
        backoffMs: 1,
        transferPort: failingDownloadPort,
        observability: obs,
      }),
    ).rejects.toMatchObject({ status: 409, code: "CONFLICT" });

    expect(downloadCalls).toBe(1);
    obs.assertNoDefects();
  });

  it("prunes expired transfer cache files and captures storage failures as defects", async () => {
    const port = createInMemoryFileTransferPort();
    const obs = createSpyObservability();
    port.cachedFiles.set("old.pdf", {
      uri: "file:///cache/transfers/old.pdf",
      modifiedAtMs: Date.now() - TRANSFER_CACHE_TTL_MS - 10_000,
    });

    const removed = await pruneExpiredTransferCache({ transferPort: port, observability: obs });
    expect(removed).toBe(1);
    expect(port.pruneCalls).toEqual([TRANSFER_CACHE_TTL_MS]);
    obs.assertNoDefects();

    const failingPort = createInMemoryFileTransferPort({
      pruneExpiredCacheFiles: async () => {
        throw new FileTransferError({ message: "Permission denied", category: "storage" });
      },
    });
    const removedOnFail = await pruneExpiredTransferCache({
      transferPort: failingPort,
      observability: obs,
    });
    expect(removedOnFail).toBe(0);
    expect(obs.defects).toHaveLength(1);
  });
});
