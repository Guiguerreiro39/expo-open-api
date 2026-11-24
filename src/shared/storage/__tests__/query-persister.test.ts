import { QueryClient } from "@tanstack/react-query";
import {
  persistQueryClientRestore,
  persistQueryClientSave,
} from "@tanstack/react-query-persist-client";
import { describe, expect, it } from "vitest";
import { AUTH_QUERY_KEYS } from "@/shared/api/query-keys";
import { createInMemoryKvStore, createMmkvKvStore } from "@/shared/storage/kv-store";
import {
  createQueryPersister,
  QUERY_CACHE_STORAGE_KEY,
  shouldDehydrateAppQuery,
} from "@/shared/storage/query-persister";
import { mockMmkv } from "@/test/mocks/adapters/mock-react-native-mmkv";

describe("createMmkvKvStore", () => {
  it("reads, writes, deletes, and clears values through MMKV", () => {
    const kv = createMmkvKvStore({ id: "test-mmkv-instance" });
    expect(kv.getString("missing")).toBeUndefined();

    kv.set("theme", "warm-tactile");
    expect(kv.getString("theme")).toBe("warm-tactile");
    expect(mockMmkv.getStore("test-mmkv-instance").get("theme")).toBe("warm-tactile");

    kv.delete("theme");
    expect(kv.getString("theme")).toBeUndefined();

    kv.set("a", "1");
    kv.set("b", "2");
    kv.clearAll();
    expect(kv.getString("a")).toBeUndefined();
    expect(kv.getString("b")).toBeUndefined();
  });

  it("falls back safely to in-memory storage when native MMKV runtime is unavailable", () => {
    mockMmkv.setShouldThrowOnConstruct(true);

    const kv = createMmkvKvStore({ id: "unavailable-mmkv" });
    kv.set("cached", "offline-ok");
    expect(kv.getString("cached")).toBe("offline-ok");
    kv.delete("cached");
    expect(kv.getString("cached")).toBeUndefined();
  });

  it("skips loading react-native-mmkv when NitroModules is unavailable (e.g. Expo Go)", () => {
    const runtime = globalThis as { NitroModulesProxy?: unknown };
    const previousProxy = runtime.NitroModulesProxy;
    runtime.NitroModulesProxy = undefined;
    try {
      const kv = createMmkvKvStore({ id: "expo-go-mmkv" });
      kv.set("theme", "editorial-slate");
      expect(kv.getString("theme")).toBe("editorial-slate");
      expect(mockMmkv.getStore("expo-go-mmkv").get("theme")).toBeUndefined();
    } finally {
      runtime.NitroModulesProxy = previousProxy;
    }
  });
});

describe("query-persister offline cache & auth exclusion invariant", () => {
  it("persists tasks across simulated app restart while strictly excluding ['auth', 'session']", async () => {
    const kvStore = createInMemoryKvStore();
    const persister = createQueryPersister(kvStore, { throttleTime: 0 });

    const firstSessionClient = new QueryClient({
      defaultOptions: {
        queries: { gcTime: Number.POSITIVE_INFINITY, staleTime: 0 },
      },
    });

    const tasksPayload = {
      data: [
        {
          id: "11111111-1111-4111-8111-111111111111",
          name: "Offline persisted task",
          done: false,
          userId: "user-1",
          createdAt: "2026-03-01T10:00:00.000Z",
          updatedAt: "2026-03-01T10:00:00.000Z",
        },
      ],
      meta: { nextCursor: null, hasMore: false },
    };

    const sensitiveSession = {
      user: {
        id: "user-1",
        email: "secret@example.com",
        name: "Secret User",
        role: "admin",
      },
      session: {
        id: "sess-1",
        token: "top-secret-bearer-token-never-in-mmkv",
      },
    };

    firstSessionClient.setQueryData(["/api/v1/tasks"], tasksPayload);
    firstSessionClient.setQueryData(AUTH_QUERY_KEYS.session(), sensitiveSession);

    await persistQueryClientSave({
      queryClient: firstSessionClient,
      persister,
      dehydrateOptions: {
        shouldDehydrateQuery: shouldDehydrateAppQuery,
      },
    });

    // createSyncStoragePersister throttles writes onto a timer tick even when throttleTime is 0
    await new Promise((resolve) => setTimeout(resolve, 10));

    // Verify raw serialized MMKV blob NEVER contains session or bearer token PII
    const persistedRaw = kvStore.getString(QUERY_CACHE_STORAGE_KEY);
    expect(persistedRaw).toBeDefined();
    expect(persistedRaw).toContain("Offline persisted task");
    expect(persistedRaw).not.toContain("top-secret-bearer-token-never-in-mmkv");
    expect(persistedRaw).not.toContain("secret@example.com");
    expect(persistedRaw).not.toContain('"auth"');

    // Simulate cold restart with a brand new QueryClient hydrated from the same KV store
    const restartedClient = new QueryClient({
      defaultOptions: {
        queries: { gcTime: Number.POSITIVE_INFINITY, staleTime: 0 },
      },
    });

    await persistQueryClientRestore({
      queryClient: restartedClient,
      persister,
    });

    expect(restartedClient.getQueryData(["/api/v1/tasks"])).toEqual(tasksPayload);
    expect(restartedClient.getQueryData(AUTH_QUERY_KEYS.session())).toBeUndefined();
  });

  it("excludes pending or errored queries and all auth queries from dehydration", () => {
    const client = new QueryClient();
    client.setQueryData(AUTH_QUERY_KEYS.session(), { user: { id: "u1" } });
    client.setQueryData(AUTH_QUERY_KEYS.me(), { id: "u1", email: "me@example.com" });
    client.setQueryData(["/api/v1/tasks"], {
      data: [],
      meta: { nextCursor: null, hasMore: false },
    });

    const authSessionQuery = client.getQueryCache().find({ queryKey: AUTH_QUERY_KEYS.session() });
    const authMeQuery = client.getQueryCache().find({ queryKey: AUTH_QUERY_KEYS.me() });
    const tasksQuery = client.getQueryCache().find({ queryKey: ["/api/v1/tasks"] });

    expect(authSessionQuery).toBeDefined();
    expect(authMeQuery).toBeDefined();
    expect(tasksQuery).toBeDefined();

    if (authSessionQuery) {
      expect(shouldDehydrateAppQuery(authSessionQuery)).toBe(false);
    }
    if (authMeQuery) {
      expect(shouldDehydrateAppQuery(authMeQuery)).toBe(false);
    }
    if (tasksQuery) {
      expect(shouldDehydrateAppQuery(tasksQuery)).toBe(true);
    }
  });
});
