import { createSyncStoragePersister } from "@tanstack/query-sync-storage-persister";
import { defaultShouldDehydrateQuery, type Query } from "@tanstack/react-query";
import type { Persister } from "@tanstack/react-query-persist-client";
import { AUTH_QUERY_KEYS } from "@/shared/api/query-keys";
import type { KeyValueStorePort } from "@/shared/storage/kv-store";

export const QUERY_CACHE_STORAGE_KEY = "expo_open_api_query_cache_v1";

export const DEFAULT_QUERY_CACHE_MAX_AGE_MS = 1000 * 60 * 60 * 24; // 24 hours

/**
 * Dehydration filter for unencrypted MMKV query cache persistence.
 * Strictly excludes `["auth", "session"]` and any `["auth", ...]` queries so
 * credentials and session PII never leave the encrypted CredentialStore tier.
 */
export function shouldDehydrateAppQuery(query: Query): boolean {
  if (!defaultShouldDehydrateQuery(query)) {
    return false;
  }

  const rootKey = query.queryKey[0];
  if (rootKey === AUTH_QUERY_KEYS.all[0]) {
    return false;
  }

  return true;
}

export interface CreateQueryPersisterOptions {
  readonly key?: string;
  readonly throttleTime?: number;
}

/**
 * Creates a TanStack Query synchronous persister backed by any `KeyValueStorePort`
 * (MMKV on native devices, in-memory double in tests / web fallback).
 */
export function createQueryPersister(
  kvStore: KeyValueStorePort,
  options: CreateQueryPersisterOptions = {},
): Persister {
  return createSyncStoragePersister({
    key: options.key ?? QUERY_CACHE_STORAGE_KEY,
    throttleTime: options.throttleTime ?? 1000,
    storage: {
      getItem: (key) => kvStore.getString(key) ?? null,
      setItem: (key, value) => {
        kvStore.set(key, value);
      },
      removeItem: (key) => {
        kvStore.delete(key);
      },
    },
  });
}
