import { HttpResponse, http } from "msw";
import { describe, expect, it } from "vitest";
import { createMobileAuthClient } from "@/features/auth/api/client";
import {
  authSessionQueryOptions,
  hydrateBearerToken,
  signInWithEmail,
  signOut,
  signUpWithEmail,
} from "@/features/auth/api/session";
import { customFetch } from "@/shared/api/fetch";
import { AUTH_QUERY_KEYS, TASKS_QUERY_KEYS } from "@/shared/api/query-keys";
import { BEARER_TOKEN_STORAGE_KEY, getCachedBearerToken } from "@/shared/lib/auth-session-bridge";
import { createSpyObservability } from "@/shared/observability/spy-adapter";
import { createInMemoryCredentialStore } from "@/shared/storage/credential-store";
import { buildTestSessionPayload } from "@/test/mocks/handlers/auth";
import { honoErrorResponse, server, TEST_API_BASE } from "@/test/msw-server";
import { createTestComposition } from "@/test/render";

describe("mobile auth client, bearer cache, and session lifecycle", () => {
  it("creates a Better Auth mobile client backed by an injected CredentialStorePort", () => {
    const credentialStore = createInMemoryCredentialStore();
    const client = createMobileAuthClient({
      credentialStore,
      baseURL: TEST_API_BASE,
    });

    expect(typeof client.signIn.email).toBe("function");
    expect(typeof client.signUp.email).toBe("function");
    expect(typeof client.signOut).toBe("function");
    expect(typeof client.getSession).toBe("function");
    expect(typeof client.getCookie).toBe("function");
  });

  it("hydrates bearer token once at bootstrap and injects Authorization header synchronously in customFetch", async () => {
    const credentialStore = createInMemoryCredentialStore({
      [BEARER_TOKEN_STORAGE_KEY]: "tok_bootstrapped_999",
    });

    let readCount = 0;
    const trackedStore = {
      async getItem(key: string) {
        readCount += 1;
        return credentialStore.getItem(key);
      },
      setItem: (key: string, value: string) => credentialStore.setItem(key, value),
      deleteItem: (key: string) => credentialStore.deleteItem(key),
    };

    const hydrated = await hydrateBearerToken(trackedStore);
    expect(hydrated).toBe("tok_bootstrapped_999");
    expect(getCachedBearerToken()).toBe("tok_bootstrapped_999");
    expect(readCount).toBe(1);

    let capturedAuthHeader: string | null = null;
    server.use(
      http.get(`${TEST_API_BASE}/api/v1/me`, ({ request }) => {
        capturedAuthHeader = request.headers.get("authorization");
        return HttpResponse.json({ id: "user-1", name: "Ada" });
      }),
    );

    await customFetch("/api/v1/me");
    await customFetch("/api/v1/me");

    expect(capturedAuthHeader).toBe("Bearer tok_bootstrapped_999");
    // Zero extra Keychain IPC reads on subsequent outbound requests
    expect(readCount).toBe(1);
  });

  it("persists token to both CredentialStorePort and cachedBearerToken on signInWithEmail", async () => {
    const observability = createSpyObservability();
    const credentialStore = createInMemoryCredentialStore();
    const composition = createTestComposition({ observability, credentialStore });

    try {
      const envelope = await signInWithEmail(
        { email: "ada@example.com", password: "password123" },
        {
          credentialStore,
          queryClient: composition.queryClient,
          observability,
        },
      );

      expect(envelope.user.email).toBe("ada@example.com");
      expect(envelope.session.token).toBe("token-user-1");
      expect(getCachedBearerToken()).toBe("token-user-1");
      expect(await credentialStore.getItem(BEARER_TOKEN_STORAGE_KEY)).toBe("token-user-1");
      expect(composition.queryClient.getQueryData(AUTH_QUERY_KEYS.session())).toEqual(envelope);
      expect(observability.currentUser).toEqual({
        id: "user-1",
        email: "ada@example.com",
        role: "member",
      });
    } finally {
      await composition.dispose();
    }
  });

  it("persists token to both CredentialStorePort and cachedBearerToken on signUpWithEmail", async () => {
    const observability = createSpyObservability();
    const credentialStore = createInMemoryCredentialStore();
    const composition = createTestComposition({ observability, credentialStore });

    try {
      const envelope = await signUpWithEmail(
        { name: "Grace Hopper", email: "grace@example.com", password: "password123" },
        {
          credentialStore,
          queryClient: composition.queryClient,
          observability,
        },
      );

      expect(envelope.user.name).toBe("Grace Hopper");
      expect(envelope.user.email).toBe("grace@example.com");
      expect(getCachedBearerToken()).toBe("token-user-new");
      expect(await credentialStore.getItem(BEARER_TOKEN_STORAGE_KEY)).toBe("token-user-new");
      expect(composition.queryClient.getQueryData(AUTH_QUERY_KEYS.session())).toEqual(envelope);
      expect(observability.currentUser?.id).toBe("user-new");
    } finally {
      await composition.dispose();
    }
  });

  it("purges both CredentialStorePort and cachedBearerToken and clears QueryClient on signOut", async () => {
    const observability = createSpyObservability();
    const credentialStore = createInMemoryCredentialStore();
    const composition = createTestComposition({ observability, credentialStore });

    try {
      await signInWithEmail(
        { email: "ada@example.com", password: "password123" },
        {
          credentialStore,
          queryClient: composition.queryClient,
          observability,
        },
      );
      composition.queryClient.setQueryData(TASKS_QUERY_KEYS.lists(), [{ id: "task-1" }]);

      await signOut({
        credentialStore,
        queryClient: composition.queryClient,
        observability,
      });

      expect(getCachedBearerToken()).toBeNull();
      expect(await credentialStore.getItem(BEARER_TOKEN_STORAGE_KEY)).toBeNull();
      expect(composition.queryClient.getQueryData(AUTH_QUERY_KEYS.session())).toBeUndefined();
      expect(composition.queryClient.getQueryData(TASKS_QUERY_KEYS.lists())).toBeUndefined();
      expect(observability.currentUser).toBeNull();
    } finally {
      await composition.dispose();
    }
  });

  it("wipes cachedBearerToken, CredentialStorePort, and QueryClient on HTTP 401", async () => {
    const observability = createSpyObservability();
    const credentialStore = createInMemoryCredentialStore();
    const composition = createTestComposition({ observability, credentialStore });

    try {
      await signInWithEmail(
        { email: "ada@example.com", password: "password123" },
        {
          credentialStore,
          queryClient: composition.queryClient,
          observability,
        },
      );
      composition.queryClient.setQueryData(TASKS_QUERY_KEYS.lists(), [{ id: "task-1" }]);

      server.use(
        http.get(`${TEST_API_BASE}/api/v1/tasks`, () =>
          honoErrorResponse(401, "UNAUTHORIZED", "Session expired"),
        ),
      );

      await expect(
        composition.queryClient.fetchQuery({
          queryKey: ["tasks", "unauthorized-check"],
          queryFn: () => customFetch("/api/v1/tasks"),
        }),
      ).rejects.toThrow();

      expect(getCachedBearerToken()).toBeNull();
      expect(await credentialStore.getItem(BEARER_TOKEN_STORAGE_KEY)).toBeNull();
      expect(composition.queryClient.getQueryData(TASKS_QUERY_KEYS.lists())).toBeUndefined();
      expect(observability.currentUser).toBeNull();
    } finally {
      await composition.dispose();
    }
  });

  it("preserves bearer token and active session on HTTP 403 Forbidden", async () => {
    const observability = createSpyObservability();
    const credentialStore = createInMemoryCredentialStore();
    const composition = createTestComposition({ observability, credentialStore });

    try {
      const envelope = await signInWithEmail(
        { email: "viewer@example.com", password: "password123" },
        {
          credentialStore,
          queryClient: composition.queryClient,
          observability,
        },
      );

      server.use(
        http.delete(`${TEST_API_BASE}/api/v1/tasks/task-foreign`, () =>
          honoErrorResponse(403, "FORBIDDEN", "Insufficient permissions"),
        ),
      );

      await expect(customFetch("/api/v1/tasks/task-foreign", { method: "DELETE" })).rejects.toThrow(
        "Insufficient permissions",
      );

      expect(getCachedBearerToken()).toBe("token-user-1");
      expect(await credentialStore.getItem(BEARER_TOKEN_STORAGE_KEY)).toBe("token-user-1");
      expect(composition.queryClient.getQueryData(AUTH_QUERY_KEYS.session())).toEqual(envelope);
      expect(observability.currentUser?.id).toBe("user-1");
    } finally {
      await composition.dispose();
    }
  });

  it("fetches and decodes session via authSessionQueryOptions and syncs bearer token", async () => {
    const payload = buildTestSessionPayload({
      id: "user-42",
      name: "Linus",
      email: "linus@example.com",
      role: "admin",
    });
    server.use(http.get(`${TEST_API_BASE}/api/auth/get-session`, () => HttpResponse.json(payload)));

    const composition = createTestComposition();
    try {
      const session = await composition.queryClient.fetchQuery(authSessionQueryOptions);
      expect(session?.user.id).toBe("user-42");
      expect(session?.user.role).toBe("admin");
      expect(getCachedBearerToken()).toBe("token-user-42");
    } finally {
      await composition.dispose();
    }
  });
});
