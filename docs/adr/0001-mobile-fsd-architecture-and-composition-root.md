---
status: accepted
date: 2026-11-18
decision-ticket: https://github.com/Guiguerreiro39/expo-open-api/issues/8
---

# Feature-Sliced Design with Route Façades and Side-Effect-Free Composition Root

In an Expo Router project, file-based routing creates structural tension with Feature-Sliced Design (FSD) and test isolation. We decided to structure the repository with root `app/` strictly as an ephemeral Route Façade layer (5–10 line re-exports) while isolating all domain logic under `src/` divided into three FSD layers (`src/app/`, `src/features/<slice>/`, and `src/shared/`), assembled through a side-effect-free factory function `createAppComposition()`. This eliminates global state singletons, enables isolated in-memory testing without module mocks, and prevents cross-feature coupling via centralized route and query key helpers in `src/shared/`.

## Considered Options

- **Co-located screens in `src/app/`**: Placing full screen components, state, and queries directly in route files violates FSD isolation, couples routing to domain logic, and complicates unit/integration testing of screens outside Expo Router.
- **Global Module Singletons**: Exporting shared `queryClient` and `defaultRuntime` module singletons risks state leakage and side effects between test runs and prevents isolated configuration injection.
- **Route Façade Pattern with `createAppComposition` (Chosen)**: Separates Expo Router route registration (`app/`) from domain features (`src/features/`), delivers the Effect runtime via `AppRuntimeContext`, coordinates startup via `useAppBootstrap()`, and enforces strict unidirectional boundaries via Vitest static AST tests.

## Consequences

- Every new route requires a minimal façade file in `app/` delegating to `src/features/<slice>/ui/<Screen>.tsx`.
- Features cannot import from other features; cross-feature navigation must go through `src/shared/config/routes.ts` and cache invalidation through `src/shared/api/query-keys.ts`.
- Tests mount components using `renderWithProviders` backed by `createAppComposition({ queryClient: createTestQueryClient(), observability: new SpyObservabilityAdapter() })`, guaranteeing hermetic test isolation.
- Architecture rules are continuously checked in CI via `src/app/__tests__/architecture.test.ts`.
