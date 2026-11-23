import { Platform } from "react-native";
import { MMKV } from "react-native-mmkv";

export interface KeyValueStorePort {
  getString(key: string): string | undefined;
  set(key: string, value: string): void;
  delete(key: string): void;
  clearAll(): void;
}

export interface InMemoryKvStore extends KeyValueStorePort {
  readonly store: Map<string, string>;
}

export function createInMemoryKvStore(initialEntries?: Record<string, string>): InMemoryKvStore {
  const store = new Map<string, string>(initialEntries ? Object.entries(initialEntries) : []);

  return {
    store,
    getString(key: string): string | undefined {
      return store.get(key);
    },
    set(key: string, value: string): void {
      store.set(key, value);
    },
    delete(key: string): void {
      store.delete(key);
    },
    clearAll(): void {
      store.clear();
    },
  };
}

export interface MmkvKvStoreOptions {
  readonly id?: string;
  readonly fallbackStore?: KeyValueStorePort;
}

/**
 * Synchronous KeyValueStorePort adapter backed by `react-native-mmkv`.
 * Falls back safely to an in-memory store on web or environments where
 * the native MMKV JSI runtime is unavailable.
 */
export function createMmkvKvStore(options: MmkvKvStoreOptions = {}): KeyValueStorePort {
  const fallbackStore = options.fallbackStore ?? createInMemoryKvStore();

  if (Platform.OS === "web") {
    return fallbackStore;
  }

  let instance: MMKV | null = null;
  try {
    instance = new MMKV(options.id ? { id: options.id } : undefined);
  } catch {
    return fallbackStore;
  }

  return {
    getString(key: string): string | undefined {
      return instance.getString(key);
    },
    set(key: string, value: string): void {
      instance.set(key, value);
    },
    delete(key: string): void {
      instance.delete(key);
    },
    clearAll(): void {
      instance.clearAll();
    },
  };
}
