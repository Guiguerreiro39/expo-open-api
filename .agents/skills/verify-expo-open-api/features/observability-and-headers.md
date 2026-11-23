# Verification Flow: Observability & Trace Headers (`observability-and-headers`)

Validates outbound W3C `traceparent` and `X-Request-Id` header propagation, `ObservabilityPort` defect vs PII-redacted breadcrumb classification, vendor-free fallbacks, and `SpyObservabilityAdapter.assertNoDefects()` across all routes.

---

## Automated Boundary Gate

```bash
pnpm test src/shared/observability/__tests__/observability.test.ts src/shared/api/__tests__/contracts.test.ts src/app/__tests__/composition.test.ts src/app/__tests__/architecture.test.ts
```

---

## Verification Steps

### 1. Outbound Trace Correlation Headers

1. Trigger API requests across `/(app)/tasks`, `/(app)/files`, or `/(auth)/login` (or inspect captured requests in MSW / `hono-open-api` logs).
2. **Assertion**: Every `customFetch` and `buildAuthTracingHeaders` request attaches:
   - **`X-Request-Id`**: Unique request correlation ID (`req_<uuid>`).
   - **`traceparent`**: Valid W3C Trace Context header (`00-<32-hex-trace-id>-<16-hex-span-id>-01`).
3. In paired mode, inspect `hono-open-api` request logs:
   - **Assertion**: Matching `X-Request-Id` and trace ID appear in backend logs across the network boundary.

### 2. Defect Capture vs Breadcrumb Discipline & PII Redaction

1. Trigger an unexpected runtime failure (`500 InternalServerError`, `503 ServiceUnavailableError`, `SchemaDecodeError`, or `UnknownError`):
   - **Assertion**: `recordErrorOrDefect()` invokes `ObservabilityPort.captureDefect()` with sanitized metadata and `requestId`.
2. Trigger expected `4xx` domain errors (`400`, `403`, `404`, `422`) or user aborts (`AbortError`):
   - **Assertion**: `captureDefect()` is **not** called; events record exclusively via `ObservabilityPort.recordBreadcrumb()`.
   - Sensitive keys (`password`, `rawInput`, `token`, `secret`, `authorization`, `cookie`) are scrubbed to `"[REDACTED]"`.

### 3. Zero-Vendor Fallback & Fault Isolation

1. Run with `EXPO_PUBLIC_SENTRY_DSN` and `EXPO_PUBLIC_DATADOG_CLIENT_TOKEN` unset:
   - **Assertion**: `createObservabilityService()` selects `SpyObservabilityAdapter` in `test`, `ConsoleObservabilityAdapter` in `development`, and `NoopObservabilityAdapter` in `production`, making zero external telemetry calls.
2. When multiple adapters are composed in `CompositeObservabilityAdapter`:
   - **Assertion**: A throwing adapter is isolated inside `try/catch` and never breaks sibling adapters or application UI.
3. Across all boundary test suites:
   - **Assertion**: `observability.assertNoDefects()` passes on every happy-path and 4xx test case.
