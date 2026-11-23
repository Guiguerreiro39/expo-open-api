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
