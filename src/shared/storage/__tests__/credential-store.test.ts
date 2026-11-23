import * as SecureStore from "expo-secure-store";
import { describe, expect, it } from "vitest";
import {
  createInMemoryCredentialStore,
  createSecureStoreCredentialStore,
} from "@/shared/storage/credential-store";
import { mockSecureStoreState } from "@/test/mocks/adapters/mock-secure-store";

describe("credential-store", () => {
  it("persists, reads, and deletes credentials using expo-secure-store with AFTER_FIRST_UNLOCK", async () => {
    const store = createSecureStoreCredentialStore();

    await store.setItem("expo_open_api_bearer_token", "tok_secret_123");
    expect(await store.getItem("expo_open_api_bearer_token")).toBe("tok_secret_123");

    await store.deleteItem("expo_open_api_bearer_token");
    expect(await store.getItem("expo_open_api_bearer_token")).toBeNull();

    const setOp = mockSecureStoreState.operations.find((op) => op.method === "setItemAsync");
    const getOp = mockSecureStoreState.operations.find((op) => op.method === "getItemAsync");
    const deleteOp = mockSecureStoreState.operations.find((op) => op.method === "deleteItemAsync");

    expect(setOp?.options?.keychainAccessible).toBe(SecureStore.AFTER_FIRST_UNLOCK);
    expect(getOp?.options?.keychainAccessible).toBe(SecureStore.AFTER_FIRST_UNLOCK);
    expect(deleteOp?.options?.keychainAccessible).toBe(SecureStore.AFTER_FIRST_UNLOCK);
  });

  it("falls back safely to in-memory storage when SecureStore is unavailable (e.g. web)", async () => {
    mockSecureStoreState.setAvailable(false);
    const store = createSecureStoreCredentialStore();

    await store.setItem("expo_open_api_bearer_token", "web_tok_456");
    expect(await store.getItem("expo_open_api_bearer_token")).toBe("web_tok_456");
    expect(mockSecureStoreState.operations).toHaveLength(0);

    await store.deleteItem("expo_open_api_bearer_token");
    expect(await store.getItem("expo_open_api_bearer_token")).toBeNull();
  });

  it("isolates in-memory credential stores per instance", async () => {
    const storeA = createInMemoryCredentialStore({ token: "a" });
    const storeB = createInMemoryCredentialStore();

    expect(await storeA.getItem("token")).toBe("a");
    expect(await storeB.getItem("token")).toBeNull();

    await storeA.deleteItem("token");
    expect(await storeA.getItem("token")).toBeNull();
  });
});
