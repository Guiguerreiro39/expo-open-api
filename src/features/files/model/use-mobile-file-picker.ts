import * as DocumentPicker from "expo-document-picker";
import * as FileSystem from "expo-file-system";
import * as ImagePicker from "expo-image-picker";
import { useCallback, useMemo, useState } from "react";
import { useObservability } from "@/shared/observability/observability-context";
import type { ObservabilityService } from "@/shared/observability/port";
import { deriveMimeTypeFromName, type MobileFileAsset } from "./files";

export class PickerPermissionError extends Error {
  readonly code = "PICKER_PERMISSION_DENIED";

  constructor(message: string) {
    super(message);
    this.name = "PickerPermissionError";
  }
}

export interface MobileFilePickerAdapter {
  readonly pickDocument: () => Promise<MobileFileAsset | null>;
  readonly pickImageFromLibrary: () => Promise<MobileFileAsset | null>;
  readonly capturePhotoWithCamera: () => Promise<MobileFileAsset | null>;
}

function extractNameFromUri(uri: string, fallbackPrefix: string): string {
  const cleanUri = uri.split("?")[0]?.split("#")[0] ?? uri;
  const segments = cleanUri.split("/").filter(Boolean);
  const lastSegment = segments[segments.length - 1];
  if (lastSegment && lastSegment.trim().length > 0) {
    try {
      return decodeURIComponent(lastSegment);
    } catch {
      return lastSegment;
    }
  }
  return `${fallbackPrefix}-${Date.now()}.bin`;
}

async function resolveAssetSize(uri: string, reportedSize?: number | null): Promise<number> {
  if (typeof reportedSize === "number" && Number.isFinite(reportedSize) && reportedSize >= 0) {
    return reportedSize;
  }
  try {
    const info = await FileSystem.getInfoAsync(uri);
    if (info.exists && typeof info.size === "number") {
      return info.size;
    }
  } catch {
    // Fallback to 0 when file metadata cannot be inspected
  }
  return 0;
}

function normalizeImageAsset(
  asset: ImagePicker.ImagePickerAsset,
  fallbackPrefix: string,
  size: number,
): MobileFileAsset {
  const name =
    asset.fileName && asset.fileName.trim().length > 0
      ? asset.fileName.trim()
      : extractNameFromUri(asset.uri, fallbackPrefix);
  const mimeType =
    asset.mimeType && asset.mimeType.trim().length > 0
      ? asset.mimeType.trim()
      : deriveMimeTypeFromName(name);

  return {
    uri: asset.uri,
    name,
    size,
    mimeType,
  };
}

export function createExpoFilePickerAdapter(): MobileFilePickerAdapter {
  return {
    async pickDocument(): Promise<MobileFileAsset | null> {
      const result = await DocumentPicker.getDocumentAsync({
        copyToCacheDirectory: true,
        multiple: false,
      });

      if (result.canceled || !result.assets || result.assets.length === 0) {
        return null;
      }

      const asset = result.assets[0];
      if (!asset) {
        return null;
      }

      const name =
        asset.name && asset.name.trim().length > 0
          ? asset.name.trim()
          : extractNameFromUri(asset.uri, "document");
      const size = await resolveAssetSize(asset.uri, asset.size);
      const mimeType =
        asset.mimeType && asset.mimeType.trim().length > 0
          ? asset.mimeType.trim()
          : deriveMimeTypeFromName(name);

      return {
        uri: asset.uri,
        name,
        size,
        mimeType,
      };
    },

    async pickImageFromLibrary(): Promise<MobileFileAsset | null> {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        throw new PickerPermissionError("Media library permission was denied");
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["images", "videos"],
        allowsMultipleSelection: false,
        quality: 1,
      });

      if (result.canceled || !result.assets || result.assets.length === 0) {
        return null;
      }

      const asset = result.assets[0];
      if (!asset) {
        return null;
      }

      const size = await resolveAssetSize(asset.uri, asset.fileSize);
      return normalizeImageAsset(asset, "image", size);
    },

    async capturePhotoWithCamera(): Promise<MobileFileAsset | null> {
      const permission = await ImagePicker.requestCameraPermissionsAsync();
      if (!permission.granted) {
        throw new PickerPermissionError("Camera permission was denied");
      }

      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ["images"],
        quality: 1,
      });

      if (result.canceled || !result.assets || result.assets.length === 0) {
        return null;
      }

      const asset = result.assets[0];
      if (!asset) {
        return null;
      }

      const size = await resolveAssetSize(asset.uri, asset.fileSize);
      return normalizeImageAsset(asset, "photo", size);
    },
  };
}

export interface UseMobileFilePickerOptions {
  readonly adapter?: MobileFilePickerAdapter;
  readonly observability?: ObservabilityService;
}

export interface UseMobileFilePickerResult {
  readonly isPicking: boolean;
  readonly error: string | null;
  readonly clearError: () => void;
  readonly pickDocument: () => Promise<MobileFileAsset | null>;
  readonly pickImageFromLibrary: () => Promise<MobileFileAsset | null>;
  readonly capturePhotoWithCamera: () => Promise<MobileFileAsset | null>;
}

export function useMobileFilePicker(
  options: UseMobileFilePickerOptions = {},
): UseMobileFilePickerResult {
  const contextObs = useObservability();
  const observability = options.observability ?? contextObs;
  const defaultAdapter = useMemo(() => createExpoFilePickerAdapter(), []);
  const adapter = options.adapter ?? defaultAdapter;

  const [isPicking, setIsPicking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const runPicker = useCallback(
    async (
      source: "document" | "library" | "camera",
      fn: () => Promise<MobileFileAsset | null>,
    ): Promise<MobileFileAsset | null> => {
      setIsPicking(true);
      setError(null);
      try {
        const asset = await fn();
        if (asset) {
          observability.recordBreadcrumb({
            category: "files.picker",
            level: "info",
            message: `Selected file from ${source}`,
            data: { source, mimeType: asset.mimeType, size: asset.size },
          });
        }
        return asset;
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : "Failed to pick file";
        setError(message);

        if (err instanceof PickerPermissionError) {
          observability.recordBreadcrumb({
            category: "files.picker",
            level: "warning",
            message,
            data: { source, code: err.code },
          });
        } else {
          observability.captureDefect(err, {
            source: "files.picker",
            extra: { pickerSource: source },
          });
        }
        return null;
      } finally {
        setIsPicking(false);
      }
    },
    [observability],
  );

  const pickDocument = useCallback(
    () => runPicker("document", () => adapter.pickDocument()),
    [adapter, runPicker],
  );

  const pickImageFromLibrary = useCallback(
    () => runPicker("library", () => adapter.pickImageFromLibrary()),
    [adapter, runPicker],
  );

  const capturePhotoWithCamera = useCallback(
    () => runPicker("camera", () => adapter.capturePhotoWithCamera()),
    [adapter, runPicker],
  );

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  return {
    isPicking,
    error,
    clearError,
    pickDocument,
    pickImageFromLibrary,
    capturePhotoWithCamera,
  };
}
