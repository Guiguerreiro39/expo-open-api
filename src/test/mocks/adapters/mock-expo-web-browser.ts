export interface MockOpenBrowserCall {
  readonly url: string;
  readonly options?: Record<string, unknown>;
}

const calls: MockOpenBrowserCall[] = [];

export const mockExpoWebBrowserState = {
  get calls() {
    return calls;
  },
  reset() {
    calls.length = 0;
  },
};

export function resetMockExpoWebBrowser(): void {
  mockExpoWebBrowserState.reset();
}

export async function openBrowserAsync(
  url: string,
  options?: Record<string, unknown>,
): Promise<{ type: "opened" }> {
  calls.push({ url, options });
  return { type: "opened" };
}
