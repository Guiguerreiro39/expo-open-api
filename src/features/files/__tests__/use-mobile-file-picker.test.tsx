import { act, renderHook } from "@testing-library/react-native";
import { describe, expect, it } from "vitest";
import { createSpyObservability } from "@/shared/observability/spy-adapter";
import { mockDocumentPickerState } from "@/test/mocks/adapters/mock-expo-document-picker";
import { mockImagePickerState } from "@/test/mocks/adapters/mock-expo-image-picker";
import { type MobileFilePickerAdapter, useMobileFilePicker } from "../model/use-mobile-file-picker";

describe("useMobileFilePicker", () => {
  it("picks a document via expo-document-picker with copyToCacheDirectory and derives missing MIME type", async () => {
    const obs = createSpyObservability();
    mockDocumentPickerState.setNextResult({
      canceled: false,
      assets: [
        {
          uri: "file:///cache/quarterly-report.pdf",
          name: "quarterly-report.pdf",
          size: 4096,
          lastModified: 1_700_000_000_000,
        },
      ],
    });

    const { result } = renderHook(() => useMobileFilePicker({ observability: obs }));

    let picked = null;
    await act(async () => {
      picked = await result.current.pickDocument();
    });

    expect(mockDocumentPickerState.calls[0]).toMatchObject({ copyToCacheDirectory: true });
    expect(picked).toEqual({
      uri: "file:///cache/quarterly-report.pdf",
      name: "quarterly-report.pdf",
      size: 4096,
      mimeType: "application/pdf",
    });
    obs.assertNoDefects();
  });

  it("returns null cleanly when document picker is canceled", async () => {
    const obs = createSpyObservability();
    mockDocumentPickerState.setNextResult({ canceled: true, assets: null });

    const { result } = renderHook(() => useMobileFilePicker({ observability: obs }));

    let picked: unknown = "sentinel";
    await act(async () => {
      picked = await result.current.pickDocument();
    });

    expect(picked).toBeNull();
    expect(result.current.error).toBeNull();
    obs.assertNoDefects();
  });

  it("picks an image from library and normalizes missing filename and MIME type from URI", async () => {
    const obs = createSpyObservability();
    mockImagePickerState.setNextLibraryResult({
      canceled: false,
      assets: [
        {
          uri: "file:///var/mobile/IMG_2048.HEIC",
          width: 1200,
          height: 800,
          fileSize: 245_000,
          fileName: null,
        },
      ],
    });

    const { result } = renderHook(() => useMobileFilePicker({ observability: obs }));

    let picked = null;
    await act(async () => {
      picked = await result.current.pickImageFromLibrary();
    });

    expect(picked).toEqual({
      uri: "file:///var/mobile/IMG_2048.HEIC",
      name: "IMG_2048.HEIC",
      size: 245_000,
      mimeType: "image/heic",
    });
    obs.assertNoDefects();
  });

  it("captures a photo with the camera and handles denied permission as a breadcrumb", async () => {
    const obs = createSpyObservability();
    mockImagePickerState.setCameraPermissionGranted(false);

    const { result } = renderHook(() => useMobileFilePicker({ observability: obs }));

    let picked: unknown = "sentinel";
    await act(async () => {
      picked = await result.current.capturePhotoWithCamera();
    });

    expect(picked).toBeNull();
    expect(result.current.error).toMatch(/camera permission/i);
    expect(obs.breadcrumbs.some((b) => b.category === "files.picker")).toBe(true);
    obs.assertNoDefects();
  });

  it("supports injecting a custom MobileFilePickerAdapter without module mocks", async () => {
    const customAdapter: MobileFilePickerAdapter = {
      pickDocument: async () => ({
        uri: "file:///injected/contract.docx",
        name: "contract.docx",
        size: 8192,
        mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      }),
      pickImageFromLibrary: async () => null,
      capturePhotoWithCamera: async () => ({
        uri: "file:///injected/snap.jpg",
        name: "snap.jpg",
        size: 51200,
        mimeType: "image/jpeg",
      }),
    };

    const { result } = renderHook(() => useMobileFilePicker({ adapter: customAdapter }));

    let doc = null;
    let photo = null;
    await act(async () => {
      doc = await result.current.pickDocument();
      photo = await result.current.capturePhotoWithCamera();
    });

    expect(doc).toMatchObject({ name: "contract.docx", size: 8192 });
    expect(photo).toMatchObject({ name: "snap.jpg", mimeType: "image/jpeg" });
  });
});
