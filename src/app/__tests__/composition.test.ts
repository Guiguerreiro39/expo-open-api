import { useQuery } from "@tanstack/react-query";
import { screen, waitFor } from "@testing-library/react-native";
import { Context, Effect, Layer } from "effect";
import { HttpResponse, http } from "msw";
import { createElement } from "react";
import { Text, View } from "react-native";
import { afterEach, describe, expect, it } from "vitest";
import { createAppComposition } from "@/app/composition";
import { createAppRuntime, useAppRuntime } from "@/app/runtime";
import { customFetch } from "@/shared/api/fetch";
import { AUTH_QUERY_KEYS } from "@/shared/api/query-keys";
import {
  clearCachedBearerToken,
  getCachedBearerToken,
  setCachedBearerToken,
} from "@/shared/lib/auth-session-bridge";
import { ObservabilityPort } from "@/shared/observability/port";
import { createSpyObservability } from "@/shared/observability/spy-adapter";
import { honoErrorResponse, server, TEST_API_BASE } from "@/test/msw-server";
import { createTestQueryClient, renderWithProviders } from "@/test/render";

class FeatureFlagPort extends Context.Tag("FeatureFlagPort")<
  FeatureFlagPort,
  { readonly enabled: boolean }
>() {}

afterEach(() => {
  clearCachedBearerToken();
});

describe("createAppRuntime", () => {
  it("creates isolated ManagedRuntime instances and provides ObservabilityPort", async () => {
    const spyA = createSpyObservability();
    const spyB = createSpyObservability();

    const runtimeA = createAppRuntime(undefined, { observability: spyA });
    const runtimeB = createAppRuntime(undefined, { observability: spyB });

    expect(runtimeA).not.toBe(runtimeB);

    const obsFromA = await runtimeA.runPromise(ObservabilityPort);
    const obsFromB = await runtimeB.runPromise(ObservabilityPort);

    expect(obsFromA).toBe(spyA);
    expect(obsFromB).toBe(spyB);

    await runtimeA.dispose();
    await runtimeB.dispose();
  });

  it("merges custom Effect layers into the runtime", async () => {
    const flagLayer = Layer.succeed(FeatureFlagPort, { enabled: true });
    const runtime = createAppRuntime(flagLayer, { observability: createSpyObservability() });

    const enabled = await runtime.runPromise(
      Effect.gen(function* () {
        const flag = yield* FeatureFlagPort;
        return flag.enabled;
      }),
    );

    expect(enabled).toBe(true);
    await runtime.dispose();
  });
});

describe("createAppComposition", () => {
  it("isolates queryClient, runtime, observability, credentialStore, and kvStore between instances", async () => {
    const compA = createAppComposition({
      queryClient: createTestQueryClient(),
      observability: createSpyObservability(),
    });
    const compB = createAppComposition({
      queryClient: createTestQueryClient(),
      observability: createSpyObservability(),
    });

    expect(compA.queryClient).not.toBe(compB.queryClient);
    expect(compA.runtime).not.toBe(compB.runtime);
    expect(compA.observability).not.toBe(compB.observability);
    expect(compA.credentialStore).not.toBe(compB.credentialStore);
    expect(compA.kvStore).not.toBe(compB.kvStore);

    compA.kvStore.set("theme.preset", "neo-brutalist");
    await compA.credentialStore.setItem("token", "secret-a");
    compA.queryClient.setQueryData(["probe"], "from-a");

    expect(compB.kvStore.getString("theme.preset")).toBeUndefined();
    expect(await compB.credentialStore.getItem("token")).toBeNull();
    expect(compB.queryClient.getQueryData(["probe"])).toBeUndefined();

    await compA.dispose();
    await compB.dispose();
  });

  it("centralizes 401 session wipe vs 403 preservation vs 500 defect routing in QueryCache", async () => {
    server.use(
      http.get(`${TEST_API_BASE}/api/v1/forbidden`, () =>
        honoErrorResponse(403, "FORBIDDEN", "Insufficient role"),
      ),
      http.get(`${TEST_API_BASE}/api/v1/unauthorized`, () =>
        honoErrorResponse(401, "UNAUTHORIZED", "Expired token"),
      ),
      http.get(`${TEST_API_BASE}/api/v1/explode`, () =>
        honoErrorResponse(500, "INTERNAL_SERVER_ERROR", "Database down"),
      ),
    );

    const spy = createSpyObservability();
    const comp = createAppComposition({
      observability: spy,
      defaultQueryOptions: { retry: false, gcTime: Number.POSITIVE_INFINITY, staleTime: 0 },
    });

    setCachedBearerToken("active_token");
    comp.queryClient.setQueryData(AUTH_QUERY_KEYS.session(), { user: { id: "u1" } });

    // 403 preserves session and produces zero defects
    await expect(
      comp.queryClient.fetchQuery({
        queryKey: ["forbidden"],
        queryFn: () => customFetch("/api/v1/forbidden"),
      }),
    ).rejects.toThrow("Insufficient role");

    expect(getCachedBearerToken()).toBe("active_token");
    expect(comp.queryClient.getQueryData(AUTH_QUERY_KEYS.session())).toEqual({
      user: { id: "u1" },
    });
    expect(() => spy.assertNoDefects()).not.toThrow();

    // 401 wipes session, bearer token, and cached queries without recording a defect
    comp.queryClient.setQueryData(["tasks", "list"], [{ id: "t1" }]);
    await expect(
      comp.queryClient.fetchQuery({
        queryKey: ["unauthorized"],
        queryFn: () => customFetch("/api/v1/unauthorized"),
      }),
    ).rejects.toThrow("Expired token");

    expect(getCachedBearerToken()).toBeNull();
    expect(comp.queryClient.getQueryData(AUTH_QUERY_KEYS.session())).toBeUndefined();
    expect(comp.queryClient.getQueryData(["tasks", "list"])).toBeUndefined();
    expect(() => spy.assertNoDefects()).not.toThrow();

    // 500 routes to captureDefect
    await expect(
      comp.queryClient.fetchQuery({
        queryKey: ["explode"],
        queryFn: () => customFetch("/api/v1/explode"),
      }),
    ).rejects.toThrow("Database down");

    expect(spy.defects).toHaveLength(1);
    expect(() => spy.assertNoDefects()).toThrow(/1 unexpected defect/i);

    await comp.dispose();
  });
});

function HarnessProbe() {
  const runtime = useAppRuntime();
  const query = useQuery({
    queryKey: ["me", "greeting"],
    queryFn: () => customFetch<{ greeting: string }>("/api/v1/me"),
  });

  return createElement(
    View,
    null,
    createElement(Text, null, runtime ? "runtime:ready" : "runtime:missing"),
    createElement(Text, null, query.data?.greeting ?? "loading"),
  );
}

describe("renderWithProviders test harness", () => {
  it("renders React Native components with QueryClient, AppRuntimeContext, ThemeProvider, and seeded user", async () => {
    server.use(
      http.get(`${TEST_API_BASE}/api/v1/me`, ({ request }) => {
        const authHeader = request.headers.get("authorization");
        return HttpResponse.json({
          greeting: authHeader === "Bearer token-u-42" ? "Authenticated Ada" : "Anonymous",
        });
      }),
    );

    const result = renderWithProviders(createElement(HarnessProbe), {
      user: {
        id: "u-42",
        name: "Ada Lovelace",
        email: "ada@example.com",
        role: "admin",
      },
    });

    expect(screen.getByText("runtime:ready")).toBeTruthy();

    await waitFor(() => {
      expect(screen.getByText("Authenticated Ada")).toBeTruthy();
    });

    expect(() => result.observability.assertNoDefects()).not.toThrow();
    await result.composition.dispose();
  });
});
