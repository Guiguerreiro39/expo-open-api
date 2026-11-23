export const ImpactFeedbackStyle = {
  Light: "light",
  Medium: "medium",
  Heavy: "heavy",
  Rigid: "rigid",
  Soft: "soft",
} as const;

export const NotificationFeedbackType = {
  Success: "success",
  Warning: "warning",
  Error: "error",
} as const;

export interface HapticEvent {
  readonly type: "impact" | "notification" | "selection";
  readonly style?: string;
}

export interface MockHapticsAdapter {
  readonly events: HapticEvent[];
  impactAsync(style?: string): Promise<void>;
  notificationAsync(style?: string): Promise<void>;
  selectionAsync(): Promise<void>;
  reset(): void;
}

export function createMockHaptics(): MockHapticsAdapter {
  const events: HapticEvent[] = [];

  return {
    events,
    async impactAsync(style = ImpactFeedbackStyle.Light): Promise<void> {
      events.push({ type: "impact", style });
    },
    async notificationAsync(style = NotificationFeedbackType.Success): Promise<void> {
      events.push({ type: "notification", style });
    },
    async selectionAsync(): Promise<void> {
      events.push({ type: "selection" });
    },
    reset(): void {
      events.length = 0;
    },
  };
}

export const mockHaptics = createMockHaptics();

export const impactAsync = (style?: string) => mockHaptics.impactAsync(style);
export const notificationAsync = (style?: string) => mockHaptics.notificationAsync(style);
export const selectionAsync = () => mockHaptics.selectionAsync();
