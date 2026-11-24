export type HrefObject =
  | string
  | {
      pathname: string;
      params?: Record<string, string | number | undefined>;
    };

export interface NavigationEvent {
  readonly type: "push" | "replace" | "back" | "redirect";
  readonly href?: HrefObject;
}

let currentPathname = "/";
let currentSegments: string[] = [];
let currentParams: Record<string, string | string[] | undefined> = {};
const navigationHistory: NavigationEvent[] = [];

export const mockRouterState = {
  get pathname() {
    return currentPathname;
  },
  get segments() {
    return currentSegments;
  },
  get params() {
    return currentParams;
  },
  get history() {
    return navigationHistory;
  },
  setPathname(pathname: string) {
    currentPathname = pathname;
  },
  setSegments(segments: string[]) {
    currentSegments = segments;
  },
  setParams(params: Record<string, string | string[] | undefined>) {
    currentParams = params;
  },
  reset() {
    currentPathname = "/";
    currentSegments = [];
    currentParams = {};
    navigationHistory.length = 0;
  },
};

export function resetMockExpoRouter(): void {
  mockRouterState.reset();
}
