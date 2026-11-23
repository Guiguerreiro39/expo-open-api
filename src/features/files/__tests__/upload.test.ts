import { HttpResponse, http } from "msw";
import { describe, expect, it } from "vitest";
import { FetchError } from "@/shared/api/fetch";
import { setCachedBearerToken } from "@/shared/lib/auth-session-bridge";
import { createSpyObservability } from "@/shared/observability/spy-adapter";
import { TEST_API_BASE } from "@/test/mocks/handlers/auth";
import { honoErrorResponse, server } from "@/test/msw-server";
import {
  createInMemoryFileTransferPort,
  FileTransferError,
  isAbortError,
} from "../api/transfer-port";
import { uploadDirectMultipart, uploadFile, uploadPresigned } from "../api/upload";
import {
  MAX_MULTIPART_BYTES,
  MAX_PRESIGNED_BYTES,
  type MobileFileAsset,
  type UploadProgressEvent,
} from "../model/files";

function makeAsset(overrides: Partial<MobileFileAsset> = {}): MobileFileAsset {
  return {
    uri: "file:///cache/photo.png",
    name: "photo.png",
    size: 512 * 1024,
    mimeType: "image/png",
    ...overrides,
  };
}

describe("mobile upload pipeline", () => {
  it("uploads files <= 10MB directly with Bearer token, X-Request-Id, and W3C traceparent", async () => {
    setCachedBearerToken("mobile-jwt-token");
    const port = createInMemoryFileTransferPort();
    const obs = createSpyObservability();
    const progress: UploadProgressEvent[] = [];

    const asset = makeAsset({ size: MAX_MULTIPART_BYTES });
    const record = await uploadFile(asset, {
      strategy: "auto",
      transferPort: port,
      observability: obs,
      onProgress: (evt) => progress.push(evt),
    });

    expect(record.originalName).toBe("photo.png");
    expect(port.directUploads).toHaveLength(1);
    expect(port.presignedUploads).toHaveLength(0);
    expect(port.directUploads[0]?.url).toBe(`${TEST_API_BASE}/api/v1/files`);
    expect(port.directUploads[0]?.headers?.Authorization).toBe("Bearer mobile-jwt-token");
    expect(port.directUploads[0]?.headers?.["X-Request-Id"]).toMatch(/^req_/);
    expect(port.directUploads[0]?.headers?.traceparent).toMatch(
      /^00-[0-9a-f]{32}-[0-9a-f]{16}-01$/,
    );
    expect(progress[progress.length - 1]?.percentage).toBe(100);
    obs.assertNoDefects();
  });

  it("uploads files > 10MB via 3-step presigned flow without sending Authorization to storage PUT", async () => {
    setCachedBearerToken("mobile-jwt-token");
    const port = createInMemoryFileTransferPort();
    const obs = createSpyObservability();

    let presignAuthHeader: string | null = null;
    let presignBody: Record<string, unknown> | null = null;
    let completeCalledId: string | null = null;

    server.use(
      http.post(`${TEST_API_BASE}/api/v1/files/presign`, async ({ request }) => {
        presignAuthHeader = request.headers.get("authorization");
        presignBody = (await request.json()) as Record<string, unknown>;
        return HttpResponse.json(
          {
            file: {
              id: "file-presign-42",
              userId: "user-1",
              originalName: "large-video.mp4",
              mimeType: "video/mp4",
              sizeBytes: MAX_MULTIPART_BYTES + 4096,
              checksumSha256: null,
              status: "pending",
              expiresAt: null,
              createdAt: "2026-01-01T00:00:00.000Z",
              updatedAt: "2026-01-01T00:00:00.000Z",
            },
            uploadUrl: "https://storage.example.com/uploads/file-presign-42?X-Amz-Signature=sig",
          },
          { status: 201 },
        );
      }),
      http.post(`${TEST_API_BASE}/api/v1/files/:id/complete`, ({ params }) => {
        completeCalledId = String(params.id);
        return HttpResponse.json({
          id: String(params.id),
          userId: "user-1",
          originalName: "large-video.mp4",
          mimeType: "video/mp4",
          sizeBytes: MAX_MULTIPART_BYTES + 4096,
          checksumSha256: "abc123",
          status: "ready",
          expiresAt: null,
          createdAt: "2026-01-01T00:00:00.000Z",
          updatedAt: "2026-01-01T00:00:01.000Z",
        });
      }),
    );

    const largeAsset = makeAsset({
      name: "large-video.mp4",
      mimeType: "video/mp4",
      size: MAX_MULTIPART_BYTES + 4096,
    });

    const record = await uploadFile(largeAsset, {
      strategy: "auto",
      transferPort: port,
      observability: obs,
    });

    expect(presignAuthHeader).toBe("Bearer mobile-jwt-token");
    expect(presignBody).toEqual({
      originalName: "large-video.mp4",
      mimeType: "video/mp4",
      sizeBytes: MAX_MULTIPART_BYTES + 4096,
    });
    expect(port.presignedUploads).toHaveLength(1);
    expect(port.presignedUploads[0]?.uploadUrl).toContain("X-Amz-Signature=sig");
    expect(port.presignedUploads[0]?.headers).toEqual({ "Content-Type": "video/mp4" });
    expect(port.presignedUploads[0]?.headers.Authorization).toBeUndefined();
    expect(completeCalledId).toBe("file-presign-42");
    expect(record.status).toBe("ready");
    obs.assertNoDefects();
  });

  it("rejects invalid file sizes as breadcrumbs without reporting defects", async () => {
    const port = createInMemoryFileTransferPort();
    const obs = createSpyObservability();

    await expect(
      uploadFile(makeAsset({ size: 0 }), { transferPort: port, observability: obs }),
    ).rejects.toThrow("File cannot be empty");

    await expect(
      uploadDirectMultipart(makeAsset({ size: MAX_MULTIPART_BYTES + 1 }), {
        transferPort: port,
        observability: obs,
      }),
    ).rejects.toThrow("File exceeds 10 MB direct upload limit");

    await expect(
      uploadPresigned(makeAsset({ size: MAX_PRESIGNED_BYTES + 1 }), {
        transferPort: port,
        observability: obs,
      }),
    ).rejects.toThrow("File exceeds 100 MB maximum size limit");

    expect(port.directUploads).toHaveLength(0);
    expect(port.presignedUploads).toHaveLength(0);
    expect(obs.breadcrumbs.filter((b) => b.category === "files.validation")).toHaveLength(3);
    obs.assertNoDefects();
  });

  it("records user abort as an informational breadcrumb rather than a defect", async () => {
    const port = createInMemoryFileTransferPort();
    const obs = createSpyObservability();
    const controller = new AbortController();
    controller.abort();

    let caught: unknown;
    try {
      await uploadDirectMultipart(makeAsset(), {
        signal: controller.signal,
        transferPort: port,
        observability: obs,
      });
    } catch (err) {
      caught = err;
    }

    expect(isAbortError(caught)).toBe(true);
    expect(obs.breadcrumbs.some((b) => b.category === "files.transfer")).toBe(true);
    obs.assertNoDefects();
  });

  it("captures S3 403 signature rejection during presigned PUT as an actionable defect", async () => {
    const port = createInMemoryFileTransferPort({
      uploadPresignedBinary: async () => {
        throw new FetchError({
          status: 403,
          code: "SIGNATURE_DOES_NOT_MATCH",
          message: "S3 signature mismatch",
        });
      },
    });
    const obs = createSpyObservability();

    server.use(
      http.post(`${TEST_API_BASE}/api/v1/files/presign`, () =>
        HttpResponse.json(
          {
            file: {
              id: "file-403",
              userId: "user-1",
              originalName: "doc.pdf",
              mimeType: "application/pdf",
              sizeBytes: 2048,
              checksumSha256: null,
              status: "pending",
              expiresAt: null,
              createdAt: "2026-01-01T00:00:00.000Z",
              updatedAt: "2026-01-01T00:00:00.000Z",
            },
            uploadUrl: "https://s3.example.com/bad-sig",
          },
          { status: 201 },
        ),
      ),
    );

    await expect(
      uploadPresigned(makeAsset({ name: "doc.pdf", mimeType: "application/pdf", size: 2048 }), {
        transferPort: port,
        observability: obs,
      }),
    ).rejects.toThrow("S3 signature mismatch");

    expect(obs.defects).toHaveLength(1);
    expect(obs.defects[0]?.context?.extra).toMatchObject({ stage: "presigned_put" });
  });

  it("captures 5xx and storage errors as defects while keeping expected 413 as breadcrumb", async () => {
    const obs = createSpyObservability();

    const port500 = createInMemoryFileTransferPort({
      uploadDirectMultipart: async () => {
        throw new FetchError({ status: 500, code: "INTERNAL_SERVER_ERROR", message: "Boom" });
      },
    });

    await expect(
      uploadDirectMultipart(makeAsset(), { transferPort: port500, observability: obs }),
    ).rejects.toThrow("Boom");
    expect(obs.defects).toHaveLength(1);

    const portStorage = createInMemoryFileTransferPort({
      uploadDirectMultipart: async () => {
        throw new FileTransferError({ message: "ENOSPC disk full", category: "storage" });
      },
    });

    await expect(
      uploadDirectMultipart(makeAsset(), { transferPort: portStorage, observability: obs }),
    ).rejects.toThrow("ENOSPC disk full");
    expect(obs.defects).toHaveLength(2);

    const obs413 = createSpyObservability();
    server.use(
      http.post(`${TEST_API_BASE}/api/v1/files/presign`, () =>
        honoErrorResponse(413, "PAYLOAD_TOO_LARGE", "Quota exceeded"),
      ),
    );

    await expect(
      uploadPresigned(makeAsset(), {
        transferPort: createInMemoryFileTransferPort(),
        observability: obs413,
      }),
    ).rejects.toThrow("Quota exceeded");

    obs413.assertNoDefects();
    expect(obs413.breadcrumbs.length).toBeGreaterThan(0);
  });
});
