export interface MockMmkvConfiguration {
  readonly id?: string;
  readonly path?: string;
  readonly encryptionKey?: string;
  readonly mode?: string;
  readonly readOnly?: boolean;
}

const storesById = new Map<string, Map<string, string | number | boolean | ArrayBuffer>>();
let shouldThrowOnConstruct = false;

export const mockMmkv = {
  setShouldThrowOnConstruct(shouldThrow: boolean) {
    shouldThrowOnConstruct = shouldThrow;
  },
  getStore(id = "mmkv.default") {
    let store = storesById.get(id);
    if (!store) {
      store = new Map();
      storesById.set(id, store);
    }
    return store;
  },
  reset() {
    storesById.clear();
    shouldThrowOnConstruct = false;
  },
};

export const Mode = {
  SINGLE_PROCESS: "SINGLE_PROCESS",
  MULTI_PROCESS: "MULTI_PROCESS",
} as const;

export class MMKV {
  private readonly store: Map<string, string | number | boolean | ArrayBuffer>;
  private readonly listeners = new Set<(key: string) => void>();
  readonly isReadOnly: boolean;

  constructor(configuration?: MockMmkvConfiguration) {
    if (shouldThrowOnConstruct) {
      throw new Error("Mock MMKV native runtime unavailable");
    }
    const id = configuration?.id ?? "mmkv.default";
    this.isReadOnly = Boolean(configuration?.readOnly);
    this.store = mockMmkv.getStore(id);
  }

  get size(): number {
    return this.store.size;
  }

  set(key: string, value: boolean | string | number | ArrayBuffer): void {
    this.store.set(key, value);
    for (const listener of this.listeners) {
      listener(key);
    }
  }

  getString(key: string): string | undefined {
    const val = this.store.get(key);
    return typeof val === "string" ? val : undefined;
  }

  getBoolean(key: string): boolean | undefined {
    const val = this.store.get(key);
    return typeof val === "boolean" ? val : undefined;
  }

  getNumber(key: string): number | undefined {
    const val = this.store.get(key);
    return typeof val === "number" ? val : undefined;
  }

  getBuffer(key: string): ArrayBufferLike | undefined {
    const val = this.store.get(key);
    return val instanceof ArrayBuffer ? val : undefined;
  }

  contains(key: string): boolean {
    return this.store.has(key);
  }

  delete(key: string): void {
    this.store.delete(key);
    for (const listener of this.listeners) {
      listener(key);
    }
  }

  getAllKeys(): string[] {
    return Array.from(this.store.keys());
  }

  clearAll(): void {
    this.store.clear();
  }

  recrypt(_key: string | undefined): void {
    // No-op in pure-JS test double
  }

  trim(): void {
    // No-op in pure-JS test double
  }

  addOnValueChangedListener(onValueChanged: (key: string) => void): { remove: () => void } {
    this.listeners.add(onValueChanged);
    return {
      remove: () => {
        this.listeners.delete(onValueChanged);
      },
    };
  }
}
