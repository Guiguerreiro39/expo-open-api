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
