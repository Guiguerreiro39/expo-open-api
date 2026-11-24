let currentBackgroundColor: string | null = null;

export async function getBackgroundColorAsync(): Promise<string | null> {
  return currentBackgroundColor;
}

export async function setBackgroundColorAsync(color: string | null): Promise<void> {
  currentBackgroundColor = color;
}

export function resetMockSystemUI(): void {
  currentBackgroundColor = null;
}
