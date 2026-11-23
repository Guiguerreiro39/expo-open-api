---
status: accepted
date: 2026-11-23
decision-ticket: https://github.com/Guiguerreiro39/expo-open-api/issues/16
---

# Mobile Testing Strategy, Test Harness Architecture, and Runtime Verification Skill

Testing mobile applications built with React Native and Expo has historically suffered from high execution latency, fragile internal module mocking (`jest.mock(...)`), and disconnected verification loops where unit tests pass but native builds and runtime network paths break in production. We decided to standardize on Vitest 4 (`vitest@^4.0.18`) configured with `vitest-native` and `@effect/vitest` for sub-second ESM-native test execution, assemble an in-memory, mock-free test harness under `src/test/` that strictly bans `vi.mock()` on application code and intercepts remote I/O exclusively at the network and platform boundaries (using MSW v2, `MockEventSource`, `MockXMLHttpRequest`, and an in-memory `SecureStore` double), decouple telemetry verification using `SpyObservabilityAdapter` to assert zero unexpected defects leak during test runs, and establish a canonical 5-phase runtime verification skill (`.agents/skills/verify-expo-open-api/SKILL.md`) that couples static type/lint checks and Vitest suites with Continuous Native Generation validation (`npx expo prebuild --clean --no-install`) and cross-platform static bundle compilation (`npx expo export --platform all`).

## Considered Options

- **Legacy Jest with `jest-expo`**: The traditional React Native test runner introduces heavy Babel transpilation cascades, slow cold-boot times (> 5s), complex module mapping for ESM dependencies, and fragmented syntax compared to the rest of the monorepo/ecosystem (`hono-open-api` and `tanstack-open-api`).
- **Internal Application Module Mocking (`vi.mock('@/shared/auth')`, `vi.mock('@/shared/api')`)**: Mocking internal hooks and client instances hides regressions at integration seams, leads to brittle tests tightly coupled to internal implementation details, and fails to validate real Effect schema decoding, query cache invalidations, and error matching.
- **Pure Unit Testing without Continuous Native Generation (CNG) Validation**: Validating JS logic alone fails to catch invalid native config plugins, missing Android permissions, CocoaPods dependency conflicts, or Metro static export bundle failures that crash apps in production.
- **Vitest 4 + MSW v2 Transport Interception + 5-Phase Runtime Verification (Chosen)**: Delivers sub-second feedback (~100ms watch mode), standardizes mock-free contract testing across both web and mobile, validates real Effect schemas and query lifecycles, guarantees zero unexpected defects via `SpyObservabilityAdapter`, and enforces end-to-end native build and bundle integrity through `.agents/skills/verify-expo-open-api/SKILL.md`.

## Consequences

- **Test Runner & Environment**: Vitest 4 is configured in `vitest.config.ts` using `vitest-native/extend-expect`, `vite-tsconfig-paths`, and `@effect/vitest`. Legacy Jest and `jest-expo` are excluded from the repository.
- **Directory Layout in `src/test/`**:
  - `src/test/setup.ts`: Global test initialization configuring MSW lifecycle (`server.listen`, `server.resetHandlers`, `server.close`), `vitest-native` matchers, `MockEventSource`, `MockXMLHttpRequest`, and cleanup routines.
  - `src/test/test-utils.tsx`: Provides `renderWithProviders()` wrapping `@testing-library/react-native`'s `render()` with in-memory `SafeAreaProvider` (fixed test insets), `QueryClientProvider` with `createTestQueryClient()` (`retry: false`, `gcTime: Infinity`, `staleTime: 0`), `AppRuntimeContext` delivering an isolated test runtime, and `<PortalHost />` for headless dialogs/sheets. Also provides `renderRouter()` for testing file-system route transitions.
  - `src/test/mocks/server.ts`: Configures `msw/node` `setupServer` with modular handlers.
  - `src/test/mocks/handlers/`: Modular contract handlers matching `hono-open-api` reference routes: `auth.ts` (`/api/auth/*`), `tasks.ts` (`/api/v1/tasks/*` and SSE `/api/v1/tasks/live`), `files.ts` (`/api/v1/files/*` multipart and presigned), and `health.ts` (`/health`, `/api/health`).
  - `src/test/mocks/adapters/`: In-memory test doubles for native hardware bridges: `inMemorySecureStore` for credential storage, `mockHaptics` for tactile feedback, and `mockStatusBar`.
- **Strict Mock-Free Boundary Rules**: Calling `vi.mock()` on internal application code (`src/app/`, `src/features/`, or `src/shared/`) is strictly prohibited. Tests execute real application components, hooks (`useLiveQuery`, `useUploadQueue`, `useAppForm`), Orval contract decoders, and Effect pipelines. Only third-party network transports and native device bridges are intercepted.
- **In-Memory Observability Assertions**: Telemetry is encapsulated behind `SpyObservabilityAdapter` (implementing `ObservabilityPort`), recording breadcrumbs, defects, and render crashes in memory. Tests verify that expected domain errors produce sanitized breadcrumbs and assert that zero unexpected 5xx defects occur via `spy.assertNoDefects()` in `afterEach`.
- **Runtime Verification Skill (`verify-expo-open-api`)**:
  - Canonical 5-phase loop codified in `.agents/skills/verify-expo-open-api/SKILL.md`:
    1. **Launch**: Validates upstream `hono-open-api` backend health on `http://localhost:9999/health`.
    2. **Doctor**: Executes static pre-flight checks: `pnpm sync:api && git diff --exit-code` (detecting Orval contract drift), `pnpm typecheck`, and `pnpm lint`.
    3. **Drive**: Runs automated test suites (`pnpm test`), validates Continuous Native Generation manifests and iOS/Android config plugins (`npx expo prebuild --clean --no-install`), verifies static production bundle generation for all platforms (`npx expo export --platform all`), and runs smoke checks against live backend endpoints.
    4. **Evidence**: Writes structured verification logs, bundle metrics, and prebuild summaries to `.verification/`.
    5. **Cleanup**: Terminates background processes and removes temporary CNG outputs (`ios`, `android`, `dist`, `.expo`).
