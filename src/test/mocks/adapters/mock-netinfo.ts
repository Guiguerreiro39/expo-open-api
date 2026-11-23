import { useEffect, useState } from "react";

export interface MockNetInfoState {
  readonly type: string;
  readonly isConnected: boolean | null;
  readonly isInternetReachable: boolean | null;
  readonly details: Record<string, unknown> | null;
}

export type NetInfoChangeHandler = (state: MockNetInfoState) => void;

const DEFAULT_ONLINE_STATE: MockNetInfoState = {
  type: "wifi",
  isConnected: true,
  isInternetReachable: true,
  details: null,
};

let currentState: MockNetInfoState = { ...DEFAULT_ONLINE_STATE };
const listeners = new Set<NetInfoChangeHandler>();

export function emitMockNetInfoState(partial: Partial<MockNetInfoState>): void {
  currentState = {
    ...currentState,
    ...partial,
  };
  for (const listener of Array.from(listeners)) {
    listener(currentState);
  }
}

export function getMockNetInfoListenerCount(): number {
  return listeners.size;
}

export function resetMockNetInfo(): void {
  currentState = { ...DEFAULT_ONLINE_STATE };
  listeners.clear();
}

export function configure(): void {
  // No-op in test adapter
}

export async function fetch(): Promise<MockNetInfoState> {
  return currentState;
}

export async function refresh(): Promise<MockNetInfoState> {
  return currentState;
}

export function addEventListener(listener: NetInfoChangeHandler): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function useNetInfo(): MockNetInfoState {
  const [state, setState] = useState<MockNetInfoState>(currentState);

  useEffect(() => {
    setState(currentState);
    return addEventListener(setState);
  }, []);

  return state;
}

const NetInfo = {
  configure,
  fetch,
  refresh,
  addEventListener,
  useNetInfo,
};

export default NetInfo;
