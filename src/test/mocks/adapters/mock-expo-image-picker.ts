import type { ImagePickerOptions, ImagePickerResult } from "expo-image-picker";

let nextLibraryResult: ImagePickerResult = { canceled: true, assets: null };
let nextCameraResult: ImagePickerResult = { canceled: true, assets: null };
let cameraPermissionGranted = true;
let libraryPermissionGranted = true;

const libraryCalls: Array<ImagePickerOptions | undefined> = [];
const cameraCalls: Array<ImagePickerOptions | undefined> = [];

export const mockImagePickerState = {
  get libraryCalls() {
    return libraryCalls;
  },
  get cameraCalls() {
    return cameraCalls;
  },
  setNextLibraryResult(result: ImagePickerResult) {
    nextLibraryResult = result;
  },
  setNextCameraResult(result: ImagePickerResult) {
    nextCameraResult = result;
  },
  setCameraPermissionGranted(granted: boolean) {
    cameraPermissionGranted = granted;
  },
  setLibraryPermissionGranted(granted: boolean) {
    libraryPermissionGranted = granted;
  },
  reset() {
    nextLibraryResult = { canceled: true, assets: null };
    nextCameraResult = { canceled: true, assets: null };
    cameraPermissionGranted = true;
    libraryPermissionGranted = true;
    libraryCalls.length = 0;
    cameraCalls.length = 0;
  },
};

export function resetMockImagePicker(): void {
  mockImagePickerState.reset();
}

export async function requestCameraPermissionsAsync() {
  return {
    granted: cameraPermissionGranted,
    status: cameraPermissionGranted ? "granted" : "denied",
    canAskAgain: true,
    expires: "never" as const,
  };
}

export async function requestMediaLibraryPermissionsAsync() {
  return {
    granted: libraryPermissionGranted,
    status: libraryPermissionGranted ? "granted" : "denied",
    canAskAgain: true,
    expires: "never" as const,
  };
}

export async function launchImageLibraryAsync(
  options?: ImagePickerOptions,
): Promise<ImagePickerResult> {
  libraryCalls.push(options);
  return nextLibraryResult;
}

export async function launchCameraAsync(options?: ImagePickerOptions): Promise<ImagePickerResult> {
  cameraCalls.push(options);
  return nextCameraResult;
}
