import { describe, expect, it } from "vitest";
import {
  calculateProgress,
  deriveMimeTypeFromName,
  formatFileSize,
  MAX_CONCURRENT_UPLOADS,
  MAX_MULTIPART_BYTES,
  MAX_PRESIGNED_BYTES,
  type MobileFileAsset,
  resolveUploadStrategy,
  sanitizeFileName,
  TRANSFER_CACHE_TTL_MS,
  validateUploadFile,
} from "../model/files";

function makeAsset(overrides: Partial<MobileFileAsset> = {}): MobileFileAsset {
  return {
    uri: "file:///cache/report.pdf",
    name: "report.pdf",
    size: 1024,
    mimeType: "application/pdf",
    ...overrides,
  };
}

describe("files model domain helpers", () => {
  it("exposes expected mobile transfer constants", () => {
    expect(MAX_MULTIPART_BYTES).toBe(10 * 1024 * 1024);
    expect(MAX_PRESIGNED_BYTES).toBe(100 * 1024 * 1024);
    expect(MAX_CONCURRENT_UPLOADS).toBe(2);
    expect(TRANSFER_CACHE_TTL_MS).toBe(24 * 60 * 60 * 1000);
  });

  it("formats file sizes cleanly across units", () => {
    expect(formatFileSize(0)).toBe("0 B");
    expect(formatFileSize(-10)).toBe("0 B");
    expect(formatFileSize(512)).toBe("512 B");
    expect(formatFileSize(1024)).toBe("1 KB");
    expect(formatFileSize(1536)).toBe("1.5 KB");
    expect(formatFileSize(10 * 1024 * 1024)).toBe("10 MB");
    expect(formatFileSize(2.5 * 1024 * 1024 * 1024)).toBe("2.5 GB");
  });

  it("calculates clamped upload percentage progress", () => {
    expect(calculateProgress(0, 0)).toBe(0);
    expect(calculateProgress(-5, 100)).toBe(0);
    expect(calculateProgress(50, -10)).toBe(0);
    expect(calculateProgress(25, 100)).toBe(25);
    expect(calculateProgress(1, 3)).toBe(33);
    expect(calculateProgress(100, 100)).toBe(100);
    expect(calculateProgress(150, 100)).toBe(100);
  });

  it("resolves upload strategy based on file size and user override", () => {
    const small = makeAsset({ size: MAX_MULTIPART_BYTES });
    const large = makeAsset({ size: MAX_MULTIPART_BYTES + 1 });

    expect(resolveUploadStrategy(small, "auto")).toBe("direct");
    expect(resolveUploadStrategy(large, "auto")).toBe("presigned");
    expect(resolveUploadStrategy(large, "direct")).toBe("direct");
    expect(resolveUploadStrategy(small, "presigned")).toBe("presigned");
  });

  it("validates upload size boundaries accurately", () => {
    expect(validateUploadFile(makeAsset({ size: 0 }), "auto")).toBe("File cannot be empty");
    expect(validateUploadFile(makeAsset({ size: -1 }), "auto")).toBe("File cannot be empty");
    expect(validateUploadFile(makeAsset({ size: MAX_MULTIPART_BYTES }), "direct")).toBeNull();
    expect(validateUploadFile(makeAsset({ size: MAX_MULTIPART_BYTES + 1 }), "direct")).toBe(
      "File exceeds 10 MB direct upload limit",
    );
    expect(validateUploadFile(makeAsset({ size: MAX_MULTIPART_BYTES + 1 }), "auto")).toBeNull();
    expect(validateUploadFile(makeAsset({ size: MAX_PRESIGNED_BYTES }), "auto")).toBeNull();
    expect(validateUploadFile(makeAsset({ size: MAX_PRESIGNED_BYTES + 1 }), "auto")).toBe(
      "File exceeds 100 MB maximum size limit",
    );
    expect(validateUploadFile(makeAsset({ size: MAX_PRESIGNED_BYTES + 1 }), "presigned")).toBe(
      "File exceeds 100 MB maximum size limit",
    );
  });

  it("derives MIME types from file extensions with octet-stream fallback", () => {
    expect(deriveMimeTypeFromName("invoice.pdf")).toBe("application/pdf");
    expect(deriveMimeTypeFromName("photo.JPG")).toBe("image/jpeg");
    expect(deriveMimeTypeFromName("photo.jpeg")).toBe("image/jpeg");
    expect(deriveMimeTypeFromName("avatar.png")).toBe("image/png");
    expect(deriveMimeTypeFromName("hero.webp")).toBe("image/webp");
    expect(deriveMimeTypeFromName("live.heic")).toBe("image/heic");
    expect(deriveMimeTypeFromName("clip.mp4")).toBe("video/mp4");
    expect(deriveMimeTypeFromName("data.json")).toBe("application/json");
    expect(deriveMimeTypeFromName("sheet.csv")).toBe("text/csv");
    expect(deriveMimeTypeFromName("notes.txt")).toBe("text/plain");
    expect(deriveMimeTypeFromName("archive.zip")).toBe("application/zip");
    expect(deriveMimeTypeFromName("README")).toBe("application/octet-stream");
    expect(deriveMimeTypeFromName("file.unknownext")).toBe("application/octet-stream");
  });

  it("sanitizes unsafe path segments and special characters in filenames", () => {
    expect(sanitizeFileName("../../etc/passwd")).toBe("passwd");
    expect(sanitizeFileName("folder\\sub\\my report (final).pdf")).toBe("my_report__final_.pdf");
    expect(sanitizeFileName("  ")).toBe("file");
    expect(sanitizeFileName("clean-file_01.png")).toBe("clean-file_01.png");
  });
});
