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

export interface MockNavigationTheme {
  readonly dark: boolean;
  readonly colors: {
    readonly primary: string;
    readonly background: string;
    readonly card: string;
    readonly text: string;
    readonly border: string;
    readonly notification: string;
  };
  readonly fonts?: Record<string, unknown>;
}

let currentPathname = "/";
let currentSegments: string[] = [];
let currentParams: Record<string, string | string[] | undefined> = {};
const navigationHistory: NavigationEvent[] = [];
let currentNavigationTheme: MockNavigationTheme | null = null;
let currentStackScreenOptions: unknown = null;
let currentTabsScreenOptions: unknown = null;
const screenOptionsByName: Record<string, unknown> = {};

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
  get navigationTheme() {
    return currentNavigationTheme;
  },
  get stackScreenOptions() {
    return currentStackScreenOptions;
  },
  get tabsScreenOptions() {
    return currentTabsScreenOptions;
  },
  get screenOptionsByName(): Readonly<Record<string, unknown>> {
    return screenOptionsByName;
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
  setNavigationTheme(theme: MockNavigationTheme | null) {
    currentNavigationTheme = theme;
  },
  setStackScreenOptions(options: unknown) {
    currentStackScreenOptions = options;
  },
  setTabsScreenOptions(options: unknown) {
    currentTabsScreenOptions = options;
  },
  setScreenOptions(name: string, options: unknown) {
    screenOptionsByName[name] = options;
  },
  reset() {
    currentPathname = "/";
    currentSegments = [];
    currentParams = {};
    navigationHistory.length = 0;
    currentNavigationTheme = null;
    currentStackScreenOptions = null;
    currentTabsScreenOptions = null;
    for (const key of Object.keys(screenOptionsByName)) {
      delete screenOptionsByName[key];
    }
  },
};

export function resetMockExpoRouter(): void {
  mockRouterState.reset();
}
