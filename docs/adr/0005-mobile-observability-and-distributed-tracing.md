---
status: accepted
date: 2026-11-18
decision-ticket: https://github.com/Guiguerreiro39/expo-open-api/issues/12
---

# Mobile Observability Architecture, Sentry & Datadog Adapters, and Distributed Trace Correlation

Mobile applications running on Expo SDK 52+ with the New Architecture and Hermes bytecode encounter dual-runtime failure modes (JavaScript exceptions and native SIGSEGV/ANR crashes) that require unified monitoring without vendor lock-in or alert fatigue. We decided to encapsulate all mobile telemetry behind an Effect `ObservabilityPort` and `ObservabilityService` in `src/shared/observability/`, strictly separate unexpected technical failures (`captureDefect`) from expected HTTP 4xx domain outcomes and user interactions (`recordBreadcrumb` with PII sanitization), implement a `CompositeObservabilityAdapter` with per-adapter try-catch fault isolation supporting `@sentry/react-native` and `@datadog/mobile-react-native`, provide an in-memory `SpyObservabilityAdapter` for mock-free Vitest verification, automate Hermes bytecode source map and native symbol uploads via Expo Config Plugins in `app.config.ts` during EAS Build, and inject W3C `traceparent` (`00-<trace_id>-<span_id>-01`) and `X-Request-Id` headers across all mobile `customFetch` and SSE streaming requests to achieve full-stack trace correlation with `hono-open-api`.

## Considered Options

- **Direct Vendor SDK Invocations Scattered in UI/Hooks**: Directly importing `@sentry/react-native` or `@datadog/mobile-react-native` across components causes vendor lock-in, complicates multi-vendor setups, and requires complex native module mocking in Vitest.
- **Reporting All Non-2xx Responses as Error Events**: Capturing 401 Unauthorized, 404 Not Found, or 409 Conflict as errors causes severe alert fatigue and skews mobile crash-free user metrics with normal user authentication or validation flows.
- **Vendor-Specific Automatic Network Monkey-Patching**: Relying on proprietary fetch instrumentation causes conflicts between concurrent monitoring vendors and risks dropping headers on custom mobile fetch engines like `expo/fetch`.
- **Hexagonal ObservabilityPort with Defect/Breadcrumb Taxonomy and W3C Tracing (Chosen)**: Completely decouples feature code from vendor SDKs, guarantees deterministic testing with `SpyObservabilityAdapter`, isolates multi-vendor dispatches via `CompositeObservabilityAdapter`, scrubs PII, uploads Hermes bytecode source maps via EAS Config Plugins, and links client-server transactions via standard W3C `traceparent` and `X-Request-Id`.

## Consequences

- UI components, route façades, and feature slices never import `@sentry/react-native` or `@datadog/mobile-react-native`; all telemetry is routed through `ObservabilityPort`.
- HTTP 4xx responses are categorized as `api.expected_error` breadcrumbs with sanitized URLs and `[REDACTED]` auth headers; only HTTP 5xx, contract decoding failures (`SchemaDecodeError`), unhandled JS exceptions, React error boundary crashes, and native crashes trigger `captureDefect`.
- Both `@sentry/react-native/expo` and `@datadog/mobile-react-native` config plugins are registered in `app.config.ts`, automating source map and native symbol upload during EAS Build using `SENTRY_AUTH_TOKEN` and `DATADOG_API_KEY`.
- Native crash and unhandled exception listeners are initialized early at the app root entry point before the React tree mounts to capture startup crashes.
- `customFetch` and `useLiveQuery` generate W3C `traceparent` (`00-<trace_id>-<span_id>-01`) and `X-Request-Id` headers using Web Crypto (`crypto.getRandomValues`), correlating mobile requests with backend Pino logs and OpenTelemetry spans in `hono-open-api`.
- Vitest suites use `SpyObservabilityAdapter` by default, asserting telemetry dispatches deterministically without network access or native mocks.
