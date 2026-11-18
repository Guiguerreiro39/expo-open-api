---
status: accepted
date: 2026-11-18
decision-ticket: https://github.com/Guiguerreiro39/expo-open-api/issues/9
---

# Dual-Target Orval Codegen, Typed Effect Contracts, and Mobile Error Taxonomy

In React Native with Expo, consuming OpenAPI backends requires resilient type safety, runtime schema validation, and deterministic error handling across mobile network conditions. We decided to adopt a dual-target Orval codegen architecture (generating TanStack Query v5 hooks and Effect v3 Schemas from `openapi.json`), a custom mobile fetch mutator injecting SecureStore Bearer tokens and W3C `traceparent` headers, an 11-status `Data.TaggedError` taxonomy matching `hono-open-api`, and a `defineContract` + `matchEffect` integration layer that automatically invalidates auth sessions on 401s and routes defects to observability.

## Considered Options

- **Raw TanStack Query with Axios / Fetch**: Standard in many React Native apps, but leaves response data untyped at runtime, relies on generic `try/catch` blocks or `instanceof Error` checks without HTTP status discrimination, and couples screens to ad-hoc error handling.
- **Zod Schema Generation**: Popular in web fullstack setups, but incurs higher runtime bundle and memory overhead on the mobile Hermes engine compared to Effect v3, which compiles cleanly to Hermes bytecode with minimal overhead (~18 KB gzipped) and provides first-class `Data.TaggedError` union types.
- **Dual-Target Orval + Effect Schema Contracts (Chosen)**: Generates pure TypeScript TanStack Query hooks alongside per-status Effect schemas (`generateEachHttpStatus: true`). `defineContract` binds query hooks to response schemas and error decoders, exposing a `.toEffect()` representation for declarative, branch-safe React rendering via `matchEffect()`.

## Consequences

- Codegen must run whenever `openapi.json` is updated (`pnpm openapi:generate`), producing both `src/shared/api/generated/endpoints.ts` and `schemas.ts`.
- All client environment variables must be defined in `src/shared/config/env.ts` with `EXPO_PUBLIC_` prefixes using Effect's `Schema.Struct`.
- The custom mobile fetch mutator (`src/shared/api/client.ts` / `fetch.ts`) is the single bottleneck for base URL resolution, W3C distributed tracing (`traceparent` via `expo-crypto`), and bearer token injection from SecureStore.
- HTTP errors are automatically mapped to 11 discrete `Data.TaggedError` classes. 401 `UnauthorizedError` triggers automatic `["auth", "session"]` cache invalidation, while 5xx errors and `SchemaDecodeError` are automatically reported to `ObservabilityPort` as actionable defects.
