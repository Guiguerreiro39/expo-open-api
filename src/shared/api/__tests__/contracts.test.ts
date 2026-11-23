import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react-native";
import { Schema } from "effect";
import { HttpResponse, http } from "msw";
import { createElement } from "react";
import { Pressable, Text, View } from "react-native";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  BadRequestError,
  ConflictError,
  decodeApiError,
  defineContract,
  ForbiddenError,
  getNextCursorParam,
  InternalServerError,
  isInvalidCursorError,
  matchEffect,
  NotFoundError,
  PayloadTooLargeError,
  RateLimitError,
  RequestTimeoutError,
  SchemaDecodeError,
  ServiceUnavailableError,
  UnauthorizedError,
  UnknownError,
  useEffectMutation,
  useEffectQuery,
  ValidationError,
} from "@/shared/api/contracts";
import { createW3CTraceparent, customFetch, FetchError } from "@/shared/api/fetch";
import { getApiV1Tasks } from "@/shared/api/generated/endpoints";
import { GetApiV1Tasks200Response } from "@/shared/api/generated/schemas";
import { AUTH_QUERY_KEYS } from "@/shared/api/query-keys";
import {
  clearCachedBearerToken,
  getCachedBearerToken,
  onAuthUnauthorized,
  registerQueryClient,
  setCachedBearerToken,
} from "@/shared/lib/auth-session-bridge";
import {
  createSpyObservability,
  type SpyObservabilityAdapter,
} from "@/shared/observability/spy-adapter";
import { honoErrorResponse, server, TEST_API_BASE } from "@/test/msw-server";
import { renderWithProviders } from "@/test/render";

function TasksProbe({
  queryKey,
  spy,
  mode,
}: {
  queryKey: string[];
  spy: SpyObservabilityAdapter;
  mode: "normal" | "drift";
}) {
  const tasksContract = defineContract({
    operation: "GetApiV1Tasks",
    path: "/api/v1/tasks",
    dataSchema: GetApiV1Tasks200Response,
    observability: spy,
  });

  const query = useEffectQuery(
    {
      queryKey,
      queryFn: () => getApiV1Tasks(),
    },
    tasksContract,
  );

  return matchEffect(
    query,
    {
      onPending: () =>
        createElement(Text, null, mode === "drift" ? "Loading..." : "Loading tasks..."),
      onFailure: (err) =>
        createElement(Text, null, mode === "drift" ? `Drift: ${err._tag}` : `Error: ${err._tag}`),
      onSuccess: (payload) =>
        createElement(
          Text,
          null,
          mode === "drift" ? "Unexpected success" : `Loaded: ${payload.data[0]?.name}`,
        ),
    },
    { observability: spy },
  );
}

function MutationProbe({ spy }: { spy: SpyObservabilityAdapter }) {
  const createContract = defineContract({
    path: "/api/v1/tasks",
    dataSchema: Schema.Struct({ id: Schema.String }),
    errors: [401, 403, 422],
    observability: spy,
  });

  const mutation = useEffectMutation(
    {
      mutationFn: () =>
        customFetch<{ id: string }>("/api/v1/tasks", {
          method: "POST",
          body: JSON.stringify({ name: "" }),
        }),
    },
    createContract,
  );

  return createElement(
    View,
    null,
    createElement(
      Pressable,
      { onPress: () => mutation.mutate() },
      createElement(Text, null, "Submit Task"),
    ),
    matchEffect(
      mutation,
      {
        onPending: () => createElement(Text, null, "Idle"),
        onFailure: (err) => createElement(Text, null, `MutationError: ${err._tag}`),
        onSuccess: (data) => createElement(Text, null, data.id),
      },
      { observability: spy },
    ),
  );
}

afterEach(() => {
  clearCachedBearerToken();
});

describe("customFetch transport, tracing, Bearer injection, and 401 session reset", () => {
  it("generates valid W3C traceparent headers", () => {
    const trace = createW3CTraceparent();
    expect(trace.traceId).toMatch(/^[0-9a-f]{32}$/);
    expect(trace.spanId).toMatch(/^[0-9a-f]{16}$/);
    expect(trace.traceparent).toBe(`00-${trace.traceId}-${trace.spanId}-01`);
  });

  it("injects synchronous Bearer token, X-Request-Id, and W3C traceparent headers", async () => {
    let capturedHeaders: Headers | undefined;
    server.use(
      http.get(`${TEST_API_BASE}/api/v1/me`, ({ request }) => {
        capturedHeaders = request.headers;
        return HttpResponse.json({ id: "u1", name: "Ada" });
      }),
    );

    setCachedBearerToken("jwt_mobile_token_123");
    const data = await customFetch<{ id: string; name: string }>("/api/v1/me");

    expect(data).toEqual({ id: "u1", name: "Ada" });
    expect(capturedHeaders?.get("authorization")).toBe("Bearer jwt_mobile_token_123");
    expect(capturedHeaders?.get("content-type")).toBe("application/json");
    expect(capturedHeaders?.get("x-request-id")).toMatch(/^req_/);
    expect(capturedHeaders?.get("traceparent")).toMatch(/^00-[0-9a-f]{32}-[0-9a-f]{16}-01$/);
  });

  it("preserves explicit Authorization, X-Request-Id, and traceparent headers and omits Content-Type for FormData", async () => {
    let capturedHeaders: Headers | undefined;
    server.use(
      http.post(`${TEST_API_BASE}/api/v1/files`, ({ request }) => {
        capturedHeaders = request.headers;
        return new HttpResponse(null, { status: 204 });
      }),
    );

    setCachedBearerToken("cached_token_ignored");
    const form = new FormData();
    form.append("note", "hello");

    const explicitTrace = "00-11111111111111111111111111111111-2222222222222222-01";
    const result = await customFetch<void>("/api/v1/files", {
      method: "POST",
      body: form,
      headers: {
        Authorization: "Bearer explicit_override",
        "X-Request-Id": "req_custom_42",
        traceparent: explicitTrace,
      },
    });

    expect(result).toBeUndefined();
    expect(capturedHeaders?.get("authorization")).toBe("Bearer explicit_override");
    expect(capturedHeaders?.get("x-request-id")).toBe("req_custom_42");
    expect(capturedHeaders?.get("traceparent")).toBe(explicitTrace);
    expect(capturedHeaders?.get("content-type")).not.toBe("application/json");
  });

  it("clears cached Bearer token, registered QueryClient auth session, and fires unauthorized listener on 401", async () => {
    server.use(
      http.get(`${TEST_API_BASE}/api/v1/me`, () =>
        honoErrorResponse(401, "UNAUTHORIZED", "Token expired"),
      ),
    );

    const queryClient = new QueryClient();
    queryClient.setQueryData(AUTH_QUERY_KEYS.session(), { user: { id: "u1" } });
    const unregisterClient = registerQueryClient(queryClient);
    const unauthorizedListener = vi.fn();
    const unregisterListener = onAuthUnauthorized(unauthorizedListener);

    setCachedBearerToken("expired_token");

    await expect(customFetch("/api/v1/me")).rejects.toMatchObject({
      name: "FetchError",
      status: 401,
      code: "UNAUTHORIZED",
      message: "Token expired",
      requestId: "req-test-123",
    });

    expect(getCachedBearerToken()).toBeNull();
    expect(queryClient.getQueryData(AUTH_QUERY_KEYS.session())).toBeNull();
    expect(unauthorizedListener).toHaveBeenCalledOnce();

    unregisterClient();
    unregisterListener();
  });
});

describe("decodeApiError 11-status Data.TaggedError taxonomy", () => {
  const statusCases = [
    { status: 400, expectedClass: BadRequestError, expectedTag: "BadRequestError" },
    { status: 401, expectedClass: UnauthorizedError, expectedTag: "UnauthorizedError" },
    { status: 403, expectedClass: ForbiddenError, expectedTag: "ForbiddenError" },
    { status: 404, expectedClass: NotFoundError, expectedTag: "NotFoundError" },
    { status: 408, expectedClass: RequestTimeoutError, expectedTag: "RequestTimeoutError" },
    { status: 409, expectedClass: ConflictError, expectedTag: "ConflictError" },
    { status: 413, expectedClass: PayloadTooLargeError, expectedTag: "PayloadTooLargeError" },
    { status: 422, expectedClass: ValidationError, expectedTag: "ValidationError" },
    { status: 429, expectedClass: RateLimitError, expectedTag: "RateLimitError" },
    { status: 500, expectedClass: InternalServerError, expectedTag: "InternalServerError" },
    { status: 503, expectedClass: ServiceUnavailableError, expectedTag: "ServiceUnavailableError" },
  ] as const;

  it.each(statusCases)(
    "decodes HTTP $status into $expectedTag",
    ({ status, expectedClass, expectedTag }) => {
      const fetchErr = new FetchError({
        status,
        code: `CODE_${status}`,
        message: `Error ${status}`,
        requestId: `req_${status}`,
        details: status === 422 ? [{ path: ["name"], message: "Required" }] : undefined,
        data: status === 503 ? { message: "Maintenance" } : undefined,
      });

      const decoded = decodeApiError(fetchErr);
      expect(decoded).toBeInstanceOf(expectedClass);
      expect(decoded._tag).toBe(expectedTag);
      expect(decoded.status).toBe(status);
      expect(decoded.requestId).toBe(`req_${status}`);

      if (decoded._tag === "ValidationError") {
        expect(decoded.issues).toEqual([{ path: ["name"], message: "Required" }]);
      }
      if (decoded._tag === "ServiceUnavailableError") {
        expect(decoded.data).toEqual({ message: "Maintenance" });
      }
    },
  );

  it("maps unrecognized HTTP statuses and raw JS errors to UnknownError", () => {
    const teapot = decodeApiError(
      new FetchError({ status: 418, code: "TEAPOT", message: "I am a teapot" }),
    );
    expect(teapot).toBeInstanceOf(UnknownError);
    expect(teapot._tag).toBe("UnknownError");

    const networkErr = decodeApiError(new TypeError("Network request failed"));
    expect(networkErr).toBeInstanceOf(UnknownError);
    expect(networkErr.message).toBe("Network request failed");
  });

  it("provides accurate cursor pagination helpers", () => {
    const invalidCursor = new BadRequestError({
      status: 400,
      code: "INVALID_CURSOR",
      message: "Bad cursor",
      requestId: "req_1",
    });
    const otherBadReq = new BadRequestError({
      status: 400,
      code: "BAD_REQUEST",
      message: "Bad request",
      requestId: "req_2",
    });

    expect(isInvalidCursorError(invalidCursor)).toBe(true);
    expect(isInvalidCursorError(otherBadReq)).toBe(false);
    expect(isInvalidCursorError(null)).toBe(false);

    expect(getNextCursorParam({ meta: { hasMore: true, nextCursor: "cur_2" } })).toBe("cur_2");
    expect(getNextCursorParam({ meta: { hasMore: false, nextCursor: "cur_2" } })).toBeUndefined();
    expect(getNextCursorParam({ meta: { hasMore: true, nextCursor: null } })).toBeUndefined();
  });
});

describe("defineContract, useEffectQuery, useEffectMutation, and matchEffect", () => {
  it("validates API responses against Orval Effect schemas and renders via matchEffect", async () => {
    const now = new Date().toISOString();
    server.use(
      http.get(`${TEST_API_BASE}/api/v1/tasks`, () =>
        HttpResponse.json({
          data: [
            {
              id: "11111111-1111-4111-8111-111111111111",
              name: "Ship Ticket 26",
              done: false,
              userId: "user-1",
              createdAt: now,
              updatedAt: now,
            },
          ],
          meta: { nextCursor: null, hasMore: false },
        }),
      ),
    );

    const spy = createSpyObservability();
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });

    render(
      createElement(
        QueryClientProvider,
        { client: queryClient },
        createElement(TasksProbe, { queryKey: ["tasks", "probe"], spy, mode: "normal" }),
      ),
    );

    expect(screen.getByText("Loading tasks...")).toBeTruthy();
    await waitFor(() => {
      expect(screen.getByText("Loaded: Ship Ticket 26")).toBeTruthy();
    });
    expect(() => spy.assertNoDefects()).not.toThrow();
  });

  it("captures SchemaDecodeError as a defect when server payload drifts from Effect schema", async () => {
    server.use(
      http.get(`${TEST_API_BASE}/api/v1/tasks`, () => HttpResponse.json({ broken: true })),
    );

    const spy = createSpyObservability();
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });

    render(
      createElement(
        QueryClientProvider,
        { client: queryClient },
        createElement(TasksProbe, { queryKey: ["tasks", "drift"], spy, mode: "drift" }),
      ),
    );

    await waitFor(() => {
      expect(screen.getByText("Drift: SchemaDecodeError")).toBeTruthy();
    });
    expect(spy.defects.some((d) => d.error instanceof SchemaDecodeError)).toBe(true);
  });

  it("records expected 422 ValidationError from useEffectMutation as breadcrumb without defect", async () => {
    server.use(
      http.post(`${TEST_API_BASE}/api/v1/tasks`, () =>
        honoErrorResponse(422, "VALIDATION_ERROR", "Task name is required", [
          { path: ["name"], message: "String must contain at least 1 character(s)" },
        ]),
      ),
    );

    const spy = createSpyObservability();
    const queryClient = new QueryClient({ defaultOptions: { mutations: { retry: false } } });

    render(
      createElement(
        QueryClientProvider,
        { client: queryClient },
        createElement(MutationProbe, { spy }),
      ),
    );
    expect(screen.getByText("Idle")).toBeTruthy();

    fireEvent.press(screen.getByText("Submit Task"));

    await waitFor(() => {
      expect(screen.getByText("MutationError: ValidationError")).toBeTruthy();
    });
    expect(() => spy.assertNoDefects()).not.toThrow();
    expect(spy.breadcrumbs.some((b) => b.category === "api.expected_error")).toBe(true);
  });

  it("emits exactly 1 defect (not 2x) for a single HTTP 500 in useEffectQuery under createAppComposition", async () => {
    server.use(
      http.get(`${TEST_API_BASE}/api/v1/tasks`, () =>
        honoErrorResponse(500, "INTERNAL_SERVER_ERROR", "Database exploded"),
      ),
    );

    const spy = createSpyObservability();
    const { composition } = renderWithProviders(
      createElement(TasksProbe, { queryKey: ["tasks", "dedup-500"], spy, mode: "normal" }),
      { observability: spy },
    );

    try {
      await waitFor(() => {
        expect(screen.getByText("Error: InternalServerError")).toBeTruthy();
      });

      expect(spy.defects).toHaveLength(1);
    } finally {
      await composition.dispose();
    }
  });
});
