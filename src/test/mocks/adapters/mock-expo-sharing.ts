import type { SharingOptions } from "expo-sharing";

export interface MockShareCall {
  readonly url: string;
  readonly options?: SharingOptions;
}

let available = true;
let shareError: Error | null = null;
const calls: MockShareCall[] = [];

export const mockExpoSharingState = {
  get calls() {
    return calls;
  },
  setAvailable(next: boolean) {
    available = next;
  },
  setError(error: Error | null) {
    shareError = error;
  },
  reset() {
    available = true;
    shareError = null;
    calls.length = 0;
  },
};

export function resetMockExpoSharing(): void {
  mockExpoSharingState.reset();
}

export async function isAvailableAsync(): Promise<boolean> {
  return available;
}

export async function shareAsync(url: string, options?: SharingOptions): Promise<void> {
  calls.push({ url, options });
  if (shareError) {
    throw shareError;
  }
}
