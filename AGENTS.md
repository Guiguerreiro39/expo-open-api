# Agent Instructions

## Design System

Adhere to the semantic tokens, typography scale, presets, and tactile elevation contract in [DESIGN.md](./DESIGN.md) when building or modifying UI components and screens.

## Engineering Guardrails

- **FSD unidirectional DAG (`app/` -> `src/app/` -> `src/features/<slice>/` -> `src/shared/`).** Keep every `Feature Slice` (`auth`, `home`, `tasks`, `files`, `showcase`) isolated inside `api/`, `model/`, and `ui/` `Segment`s with direct file imports, zero barrel `index.ts` files, and zero cross-slice or upward imports (enforced by `biome.json` and `src/app/__tests__/architecture.test.ts`). Coordinate across slices via `src/shared/config/routes.ts`, `src/shared/api/query-keys.ts`, and `src/shared/lib/auth-session-bridge.ts`.

- **Thin Route Façades (`<= 50 LOC`).** Keep files under `app/**` as minimal re-exports mounting screen components from `src/features/<slice>/ui/` or `src/app/root-layout.tsx`, with zero business logic, data fetching, or inline state.

- **Side-effect-free Composition Root and env isolation.** Assemble `QueryClient`, Effect `ManagedRuntime`, `ObservabilityService`, `CredentialStorePort`, and `KeyValueStorePort` exclusively through `createAppComposition` (`src/app/composition.ts`), `createAppRuntime` (`src/app/runtime.ts`), and `useAppBootstrap` (`src/app/bootstrap.ts`). Read `process.env` only in `src/shared/config/env.ts` (`ClientEnvSchema`, enforced by Biome `style/noProcessEnv`).

- **Orval v8 and Effect contracts.** Bind API operations via `defineContract` (`src/shared/api/contracts.ts`) paired with generated schemas in `src/shared/api/generated/`, consuming them through `useEffectQuery`, `useEffectMutation`, and `matchEffect`. Regenerate `src/shared/api/generated/**` with `pnpm generate:api` or `pnpm sync:api` instead of hand-editing generated code.

- **Better Auth, SecureStore Bearer cache, Layout Guards, and RBAC.** Persist credentials only in `CredentialStorePort` (`expo-secure-store`, `AFTER_FIRST_UNLOCK`), hydrate `cachedBearerToken` once during `useAppBootstrap` for synchronous `Authorization: Bearer` injection in `customFetch`, protect screens via pathless `app/(auth)/_layout.tsx` and `app/(app)/_layout.tsx` guards, wipe session state on `401` (`UnauthorizedError`) while rendering `403` (`ForbiddenError`) refusals in place, and gate actions through `src/shared/lib/rbac.ts` and `<Can />` (`src/shared/ui/can.tsx`).

- **Realtime SSE and MMKV offline cache.** Subscribe to `/api/v1/tasks/live` via `useLiveQuery` (`src/shared/lib/hooks/use-live-query.ts`) using `expo/fetch` streaming and `eventsource-parser` (Authorization header only — never `?token=` query params), suspend on `AppState` background and reconnect on `NetInfo` recovery, key task mutations under `["tasks", "mutation"]` for microtask-flushed mutation buffering, and exclude `["auth", "session"]` from unencrypted MMKV query persistence (`shouldDehydrateAppQuery`).

- **Driver-agnostic observability.** Call `ObservabilityPort` (`src/shared/observability/port.ts`) rather than importing Sentry or Datadog SDKs in features or UI. Report unexpected `Defect`s (`5xx`, `UnknownError`, `SchemaDecodeError`, uncaught React errors) via `captureDefect` / `captureReactError`, log expected `4xx` errors and user actions as PII-safe breadcrumbs via `recordBreadcrumb`, and preserve outbound `X-Request-Id` and W3C `traceparent` headers.

- **Single-source tokens, overlays, and mobile ergonomics.** Express all styling through semantic NativeWind tokens in `global.css`, `tailwind.config.ts`, and `src/shared/lib/theme/presets.ts` (zero hardcoded hex/rgb values, verified by `pnpm verify:tokens` and `src/test/design-tokens.test.ts`). Mount `<SafeAreaProvider>`, `<ThemeProvider>`, `<ToastProvider>`, and a single `<PortalHost />` once in `src/app/root-layout.tsx`, and build validated forms with `useAppForm` (`src/shared/ui/form.tsx`, `Schema.standardSchemaV1`) inside `FormScrollView` (`src/shared/ui/form-scroll-view.tsx`).

- **File naming and formatting.** Name every file under `src/` in `kebab-case` (Expo Router special names like `_layout.tsx` and `+not-found.tsx` are allowed only under `app/**`). Wrap all visible strings in `<Text>` (Biome `noReactNativeRawText`) and run `pnpm lint:fix` to format and sort imports/classes.

- **Zero-mock boundary testing.** Test real screens, hooks, and contracts via `renderWithProviders` (`src/test/render.tsx`), MSW v2 (`onUnhandledRequest: "error"`), `MockEventSource`, `MockXMLHttpRequest`, pure-JS adapters in `src/test/mocks/adapters/`, and `SpyObservabilityAdapter.assertNoDefects()`. Never call `vi.mock()` or `jest.mock()` anywhere under `src/` (enforced by `src/app/__tests__/architecture.test.ts`).

- **Verification gates.** Before reporting work complete, pass all checks:
  1. `pnpm generate:api && git diff --exit-code src/shared/api/generated`
  2. `pnpm verify:tokens`
  3. `pnpm typecheck`
  4. `pnpm lint`
  5. `pnpm test`
  6. `CI=1 pnpm prebuild`
  7. `CI=1 TMPDIR="$(mktemp -d)" pnpm export -- --clear`
  Execute [.agents/skills/verify-expo-open-api/SKILL.md](./.agents/skills/verify-expo-open-api/SKILL.md) whenever routes, auth, API contracts, native plugins, or UI flows change, and clean up generated `ios/`, `android/`, `dist/`, `.expo/`, and `.verification/` artifacts before committing.

- **Git governance and releases.** Use Conventional Commits 1.0.0 (`feat`, `fix`, `perf`, `refactor`, `docs`, `style`, `test`, `build`, `ci`, `chore`, `revert`; lowercase subject; header <= 100 chars) enforced by Lefthook (`lefthook.yml`), Commitlint (`commitlint.config.mjs`), and `.github/workflows/pr-title.yml`. Never push directly to `main` or pass `--no-verify`. Releases and `CHANGELOG.md` are automated by Release-Please (`.github/workflows/release.yml`).

## Context Pointers

- [GLOSSARY.md](./GLOSSARY.md): consult when naming layers, slices, segments, ports, adapters, contracts, live queries, defects, tokens, file transfers, or test harnesses.
- [DESIGN.md](./DESIGN.md): consult when editing UI primitives, color tokens, typography scale, tactile elevation, or runtime presets (`warm-tactile`, `editorial-slate`, `neo-brutalist`).
- [docs/architecture.md](./docs/architecture.md): consult when modifying `createAppComposition`, `useAppBootstrap`, `customFetch`, `defineContract`, Better Auth guards, `useLiveQuery`, `ObservabilityPort`, or `FileTransferPort`.
- [docs/development.md](./docs/development.md): consult when onboarding from the template, rebranding `app.json`, configuring Android/iOS backend addresses (`10.0.2.2:9999`), pruning demo slices, scaffolding a slice, or adding `EXPO_PUBLIC_*` env vars.
- [docs/adr/](./docs/adr/): consult before changing FSD rules, Orval/Effect contracts, auth/RBAC, SSE, telemetry, tokens, Reusables/forms, file transfer, testing, CI/CNG, or documentation conventions (`ADR-0001` through `ADR-0013`).
- [.agents/skills/verify-expo-open-api/SKILL.md](./.agents/skills/verify-expo-open-api/SKILL.md): execute before opening a PR or claiming a runtime feature works; keep updated when routes, auth, env vars, or test scripts change.
