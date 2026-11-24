import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";

export interface CredentialStorePort {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
  deleteItem(key: string): Promise<void>;
}

export interface InMemoryCredentialStore extends CredentialStorePort {
  readonly store: Map<string, string>;
  clear(): void;
}

export function createInMemoryCredentialStore(
  initialEntries?: Record<string, string>,
): InMemoryCredentialStore {
  const store = new Map<string, string>(initialEntries ? Object.entries(initialEntries) : []);

  return {
    store,
    async getItem(key: string): Promise<string | null> {
      return store.get(key) ?? null;
    },
    async setItem(key: string, value: string): Promise<void> {
      store.set(key, value);
    },
    async deleteItem(key: string): Promise<void> {
      store.delete(key);
    },
    clear(): void {
      store.clear();
    },
  };
}

export interface SecureStoreCredentialStoreOptions {
  readonly keychainAccessible?: SecureStore.KeychainAccessibilityConstant;
  readonly keychainService?: string;
  readonly fallbackStore?: CredentialStorePort;
}

/**
 * Hardware-backed CredentialStorePort adapter powered by `expo-secure-store`.
 * Defaults to `SecureStore.AFTER_FIRST_UNLOCK` so background refreshes can read
 * credentials while data remains encrypted when the device is locked before first unlock.
 * Falls back safely to an in-memory store on web or non-native platforms where
 * `SecureStore.isAvailableAsync()` resolves to `false`.
 */
export function createSecureStoreCredentialStore(
  options: SecureStoreCredentialStoreOptions = {},
): CredentialStorePort {
  const fallbackStore = options.fallbackStore ?? createInMemoryCredentialStore();
  const storeOptions: SecureStore.SecureStoreOptions = {
    keychainAccessible: options.keychainAccessible ?? SecureStore.AFTER_FIRST_UNLOCK,
    ...(options.keychainService ? { keychainService: options.keychainService } : {}),
  };

  let availabilityPromise: Promise<boolean> | null = null;

  const isNativeSecureStoreAvailable = (): Promise<boolean> => {
    if (Platform.OS === "web") {
      return Promise.resolve(false);
    }
    if (!availabilityPromise) {
      availabilityPromise = SecureStore.isAvailableAsync().catch(() => false);
    }
    return availabilityPromise;
  };

  return {
    async getItem(key: string): Promise<string | null> {
      if (!(await isNativeSecureStoreAvailable())) {
        return fallbackStore.getItem(key);
      }
      return SecureStore.getItemAsync(key, storeOptions);
    },
    async setItem(key: string, value: string): Promise<void> {
      if (!(await isNativeSecureStoreAvailable())) {
        await fallbackStore.setItem(key, value);
        return;
      }
      await SecureStore.setItemAsync(key, value, storeOptions);
    },
    async deleteItem(key: string): Promise<void> {
      if (!(await isNativeSecureStoreAvailable())) {
        await fallbackStore.deleteItem(key);
        return;
      }
      await SecureStore.deleteItemAsync(key, storeOptions);
    },
  };
}
