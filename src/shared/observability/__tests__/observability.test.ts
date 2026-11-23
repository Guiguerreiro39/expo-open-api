import { describe, expect, it, vi } from "vitest";
import { createCompositeAdapter } from "@/shared/observability/composite-adapter";
import { consoleObservabilityAdapter } from "@/shared/observability/console-adapter";
import {
  createDatadogAdapter,
  type DatadogMobileSdk,
} from "@/shared/observability/datadog-adapter";
import { createObservabilityService } from "@/shared/observability/factory";
import { noopObservabilityAdapter } from "@/shared/observability/noop-adapter";
import {
  extractDefectContext,
  isDefect,
  isExpectedDomainError,
  type ObservabilityService,
  recordErrorOrDefect,
} from "@/shared/observability/port";
import { createSentryAdapter, type SentryMobileSdk } from "@/shared/observability/sentry-adapter";
import {
  createSpyObservability,
  SpyObservabilityAdapter,
} from "@/shared/observability/spy-adapter";

describe("Observability error taxonomy and PII redaction", () => {
  it("classifies 4xx domain errors as expected and 5xx/decode/unhandled errors as defects", () => {
    const expectedTags = [
      "BadRequestError",
      "UnauthorizedError",
      "ForbiddenError",
      "NotFoundError",
      "RequestTimeoutError",
      "ConflictError",
      "PayloadTooLargeError",
      "ValidationError",
      "RateLimitError",
    ];

    for (const tag of expectedTags) {
      expect(isExpectedDomainError({ _tag: tag })).toBe(true);
      expect(isDefect({ _tag: tag })).toBe(false);
    }

    expect(isExpectedDomainError({ status: 404 })).toBe(true);
    expect(isDefect({ status: 404 })).toBe(false);

    expect(isExpectedDomainError({ status: 500 })).toBe(false);
    expect(isDefect({ status: 500 })).toBe(true);

    expect(isDefect({ _tag: "InternalServerError", status: 500 })).toBe(true);
    expect(isDefect({ _tag: "ServiceUnavailableError", status: 503 })).toBe(true);
    expect(isDefect({ _tag: "SchemaDecodeError", path: "/api/v1/tasks" })).toBe(true);
    expect(isDefect({ _tag: "UnknownError", message: "Network failed" })).toBe(true);
    expect(isDefect(new Error("Unexpected crash"))).toBe(true);
  });

  it("extracts structured defect context for API, schema decode, and unhandled errors", () => {
    expect(
      extractDefectContext({
        status: 503,
        code: "SERVICE_UNAVAILABLE",
        requestId: "req_123",
        traceId: "abcd1234",
      }),
    ).toEqual({
      source: "api",
      status: 503,
      code: "SERVICE_UNAVAILABLE",
      requestId: "req_123",
      traceId: "abcd1234",
    });

    expect(extractDefectContext({ _tag: "SchemaDecodeError", path: "/api/v1/me" })).toEqual({
      source: "schema_decode",
      path: "/api/v1/me",
    });

    expect(extractDefectContext(new Error("boom"))).toEqual({
      source: "unhandled",
    });
  });

  it("routes expected 4xx errors to sanitized breadcrumbs with recursive PII redaction", () => {
    const spy = createSpyObservability();

    recordErrorOrDefect(spy, {
      _tag: "ValidationError",
      status: 422,
      code: "VALIDATION_ERROR",
      message: "Invalid credentials",
      requestId: "req_422",
      details: {
        password: "super-secret-password",
        rawInput: "raw-pii-value",
        nested: {
          Authorization: "Bearer top-secret",
          cookie: "session=abc",
          token: "tok_123",
          secret: "shh",
          field: "email",
        },
      },
    });

    expect(spy.defects).toHaveLength(0);
    expect(() => spy.assertNoDefects()).not.toThrow();
    expect(spy.breadcrumbs).toHaveLength(1);

    const crumb = spy.breadcrumbs[0];
    expect(crumb?.category).toBe("api.expected_error");
    expect(crumb?.level).toBe("warning");
    expect(crumb?.message).toBe("[422] Invalid credentials");
    expect(crumb?.data).toEqual({
      status: 422,
      code: "VALIDATION_ERROR",
      requestId: "req_422",
      details: {
        password: "[REDACTED]",
        rawInput: "[REDACTED]",
        nested: {
          Authorization: "[REDACTED]",
          cookie: "[REDACTED]",
          token: "[REDACTED]",
          secret: "[REDACTED]",
          field: "email",
        },
      },
    });
  });

  it("routes 5xx and decode errors to captureDefect and triggers assertNoDefects failure", () => {
    const spy = createSpyObservability();

    recordErrorOrDefect(
      spy,
      {
        _tag: "InternalServerError",
        status: 500,
        code: "INTERNAL_SERVER_ERROR",
        message: "Database unavailable",
        requestId: "req_500",
        traceId: "trace_500",
      },
      { path: "/api/v1/tasks" },
    );

    expect(spy.breadcrumbs).toHaveLength(0);
    expect(spy.defects).toHaveLength(1);
    expect(spy.defects[0]?.context).toEqual({
      source: "api",
      status: 500,
      code: "INTERNAL_SERVER_ERROR",
      requestId: "req_500",
      traceId: "trace_500",
      path: "/api/v1/tasks",
    });

    expect(() => spy.assertNoDefects()).toThrow(/1 unexpected defect/i);

    spy.reset();
    expect(() => spy.assertNoDefects()).not.toThrow();
  });

  it("tracks React errors and user context history on SpyObservabilityAdapter", () => {
    const spy = new SpyObservabilityAdapter();
    spy.setUserContext({ id: "u1", email: "a@b.com", name: "Alice" });
    expect(spy.currentUser?.id).toBe("u1");
    expect(spy.userHistory).toHaveLength(1);

    spy.clearUserContext();
    expect(spy.currentUser).toBeNull();
    expect(spy.userHistory).toHaveLength(2);

    spy.captureReactError(new Error("Render exploded"), { componentStack: "at Screen" });
    expect(spy.reactErrors).toHaveLength(1);
    expect(() => spy.assertNoDefects()).toThrow(/1 React render error/i);
  });
});

describe("Composite, vendor adapters, and observability factory", () => {
  it("isolates throwing adapters inside CompositeObservabilityAdapter", () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    const brokenAdapter: ObservabilityService = {
      captureDefect: () => {
        throw new Error("sentry boom");
      },
      captureReactError: () => {
        throw new Error("react boom");
      },
      recordBreadcrumb: () => {
        throw new Error("crumb boom");
      },
      setUserContext: () => {
        throw new Error("user boom");
      },
      clearUserContext: () => {
        throw new Error("clear boom");
      },
    };
    const healthySpy = createSpyObservability();
    const composite = createCompositeAdapter([brokenAdapter, healthySpy]);

    composite.captureDefect(new Error("db fail"), { status: 500 });
    composite.captureReactError(new Error("ui fail"), { componentStack: "at View" });
    composite.recordBreadcrumb({ category: "ui", message: "tapped" });
    composite.setUserContext({ id: "u-9" });
    composite.clearUserContext();

    expect(healthySpy.defects).toHaveLength(1);
    expect(healthySpy.reactErrors).toHaveLength(1);
    expect(healthySpy.breadcrumbs).toHaveLength(1);
    expect(healthySpy.userHistory).toEqual([{ id: "u-9" }, null]);

    warnSpy.mockRestore();
  });

  it("forwards telemetry to injected Sentry and Datadog mobile SDK doubles", () => {
    const tags: Record<string, string> = {};
    const sentrySdk: SentryMobileSdk = {
      init: vi.fn(),
      withScope: (cb) => {
        cb({
          setTag: (key, value) => {
            tags[key] = value;
          },
          setExtras: vi.fn(),
        });
      },
      captureException: vi.fn(),
      addBreadcrumb: vi.fn(),
      setUser: vi.fn(),
    };

    const sentry = createSentryAdapter({ dsn: "https://example@sentry.io/1" }, sentrySdk);
    sentry.captureDefect(new Error("boom"), {
      requestId: "req_1",
      traceId: "trace_1",
      source: "api",
      status: 500,
    });
    sentry.recordBreadcrumb({ category: "nav", message: "opened tasks" });
    sentry.setUserContext({ id: "u1", email: "u1@example.com", name: "U1" });
    sentry.clearUserContext();

    expect(sentrySdk.init).toHaveBeenCalledOnce();
    expect(tags).toEqual({
      request_id: "req_1",
      trace_id: "trace_1",
      defect_source: "api",
      status_code: "500",
    });
    expect(sentrySdk.captureException).toHaveBeenCalledOnce();
    expect(sentrySdk.addBreadcrumb).toHaveBeenCalledOnce();
    expect(sentrySdk.setUser).toHaveBeenCalledTimes(2);

    const ddSdk: DatadogMobileSdk = {
      initialize: vi.fn(),
      addError: vi.fn(),
      addAction: vi.fn(),
      log: vi.fn(),
      setUser: vi.fn(),
      clearUser: vi.fn(),
    };

    const datadog = createDatadogAdapter(
      { clientToken: "pub_token", applicationId: "app_id", service: "expo-mobile" },
      ddSdk,
    );
    datadog.captureDefect(new Error("dd boom"), { status: 503 });
    datadog.recordBreadcrumb({ category: "api", message: "404", level: "warning" });
    datadog.setUserContext({ id: "u2", email: "u2@example.com" });
    datadog.clearUserContext();

    expect(ddSdk.initialize).toHaveBeenCalledOnce();
    expect(ddSdk.addError).toHaveBeenCalledOnce();
    expect(ddSdk.addAction).toHaveBeenCalledOnce();
    expect(ddSdk.log).toHaveBeenCalledTimes(2);
    expect(ddSdk.log).toHaveBeenNthCalledWith(1, "dd boom", { status: 503 }, "error");
    expect(ddSdk.log).toHaveBeenNthCalledWith(2, "404", { category: "api" }, "warn");
    expect(ddSdk.setUser).toHaveBeenCalledOnce();
    expect(ddSdk.clearUser).toHaveBeenCalledOnce();
  });

  it("selects appropriate observability adapter based on runtime environment", () => {
    expect(createObservabilityService({ NODE_ENV: "test" })).toBeInstanceOf(
      SpyObservabilityAdapter,
    );
    expect(createObservabilityService({ NODE_ENV: "development" })).toBe(
      consoleObservabilityAdapter,
    );
    expect(createObservabilityService({ NODE_ENV: "production" })).toBe(noopObservabilityAdapter);
  });
});
