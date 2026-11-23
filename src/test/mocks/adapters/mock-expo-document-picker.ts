import type { DocumentPickerOptions, DocumentPickerResult } from "expo-document-picker";

let nextResult: DocumentPickerResult = { canceled: true, assets: null };
const calls: Array<DocumentPickerOptions | undefined> = [];

export const mockDocumentPickerState = {
  get calls() {
    return calls;
  },
  setNextResult(result: DocumentPickerResult) {
    nextResult = result;
  },
  reset() {
    nextResult = { canceled: true, assets: null };
    calls.length = 0;
  },
};

export function resetMockDocumentPicker(): void {
  mockDocumentPickerState.reset();
}

export async function getDocumentAsync(
  options?: DocumentPickerOptions,
): Promise<DocumentPickerResult> {
  calls.push(options);
  return nextResult;
}
