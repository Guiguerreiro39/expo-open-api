import { Platform, TurboModuleRegistry } from "react-native";
import type { MMKV } from "react-native-mmkv";

type MmkvModule = {
  readonly createMMKV?: (configuration?: { readonly id?: string }) => MMKV;
};

function hasNativeNitroModules(): boolean {
  const runtime = globalThis as { readonly NitroModulesProxy?: unknown };
  if (runtime.NitroModulesProxy != null) {
    return true;
  }
  // Probe TurboModuleRegistry before loading react-native-mmkv so Metro's
  // module loader never emits a LogBox error in Expo Go or un-rebuilt binaries.
  return typeof TurboModuleRegistry?.get === "function"
    ? TurboModuleRegistry.get("NitroModules") != null
    : false;
}

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

  if (Platform.OS === "web" || !hasNativeNitroModules()) {
    return fallbackStore;
  }

  let instance: MMKV;
  try {
    // Lazy-require so Expo Go / environments without NitroModules fall back cleanly
    // instead of throwing during top-level module evaluation.
    const mmkvModule = require("react-native-mmkv") as MmkvModule;
    if (typeof mmkvModule.createMMKV !== "function") {
      return fallbackStore;
    }
    instance = mmkvModule.createMMKV(options.id ? { id: options.id } : undefined);
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
      instance.remove(key);
    },
    clearAll(): void {
      instance.clearAll();
    },
  };
}
