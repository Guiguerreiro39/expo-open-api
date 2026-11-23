let preventAutoHideCalls = 0;
let hideCalls = 0;

export async function preventAutoHideAsync(): Promise<boolean> {
  preventAutoHideCalls += 1;
  return true;
}

export async function hideAsync(): Promise<boolean> {
  hideCalls += 1;
  return true;
}

export const mockSplashScreen = {
  get preventAutoHideCalls() {
    return preventAutoHideCalls;
  },
  get hideCalls() {
    return hideCalls;
  },
  reset() {
    preventAutoHideCalls = 0;
    hideCalls = 0;
  },
};

export function resetMockSplashScreen(): void {
  mockSplashScreen.reset();
}
