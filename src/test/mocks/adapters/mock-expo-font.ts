export interface MockExpoFontState {
  loadedFontMaps: Array<Record<string, unknown>>;
  nextError: Error | null;
}

export const mockExpoFont: MockExpoFontState = {
  loadedFontMaps: [],
  nextError: null,
};

export async function loadAsync(fonts: Record<string, unknown>): Promise<void> {
  if (mockExpoFont.nextError) {
    const error = mockExpoFont.nextError;
    mockExpoFont.nextError = null;
    throw error;
  }
  mockExpoFont.loadedFontMaps.push({ ...fonts });
}

export function isLoaded(fontFamily: string): boolean {
  return mockExpoFont.loadedFontMaps.some((map) => fontFamily in map);
}

export function resetMockExpoFont(): void {
  mockExpoFont.loadedFontMaps = [];
  mockExpoFont.nextError = null;
}
