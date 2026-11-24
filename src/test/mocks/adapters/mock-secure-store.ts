export const AFTER_FIRST_UNLOCK = 0;
export const AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY = 1;
export const ALWAYS = 2;
export const WHEN_PASSCODE_SET_THIS_DEVICE_ONLY = 3;
export const ALWAYS_THIS_DEVICE_ONLY = 4;
export const WHEN_UNLOCKED = 5;
export const WHEN_UNLOCKED_THIS_DEVICE_ONLY = 6;

export interface MockSecureStoreOptions {
  keychainService?: string;
  requireAuthentication?: boolean;
  authenticationPrompt?: string;
  keychainAccessible?: number;
}

export interface SecureStoreOperation {
  readonly method: "getItem" | "getItemAsync" | "setItem" | "setItemAsync" | "deleteItemAsync";
  readonly key: string;
  readonly value?: string;
  readonly options?: MockSecureStoreOptions;
}

const backingStore = new Map<string, string>();
const operations: SecureStoreOperation[] = [];
let available = true;

export const mockSecureStoreState = {
  get store() {
    return backingStore;
  },
  get operations() {
    return operations;
  },
  setAvailable(next: boolean) {
    available = next;
  },
  reset() {
    backingStore.clear();
    operations.length = 0;
    available = true;
  },
};

export async function isAvailableAsync(): Promise<boolean> {
  return available;
}

export function getItem(key: string, options?: MockSecureStoreOptions): string | null {
  operations.push({ method: "getItem", key, options });
  return backingStore.get(key) ?? null;
}

export async function getItemAsync(
  key: string,
  options?: MockSecureStoreOptions,
): Promise<string | null> {
  operations.push({ method: "getItemAsync", key, options });
  return backingStore.get(key) ?? null;
}

export function setItem(key: string, value: string, options?: MockSecureStoreOptions): void {
  operations.push({ method: "setItem", key, value, options });
  backingStore.set(key, value);
}

export async function setItemAsync(
  key: string,
  value: string,
  options?: MockSecureStoreOptions,
): Promise<void> {
  operations.push({ method: "setItemAsync", key, value, options });
  backingStore.set(key, value);
}

export async function deleteItemAsync(
  key: string,
  options?: MockSecureStoreOptions,
): Promise<void> {
  operations.push({ method: "deleteItemAsync", key, options });
  backingStore.delete(key);
}

export function resetMockSecureStore(): void {
  mockSecureStoreState.reset();
}
