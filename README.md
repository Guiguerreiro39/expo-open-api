# expo-open-api

Production-ready React Native (Expo) mobile starter kit built on Expo Router, Effect, and OpenAPI contracts, pairing directly with [`hono-open-api`](https://github.com/Guiguerreiro39/hono-open-api).

## Tech Stack Highlights

- **Framework & Navigation**: [Expo SDK 52](https://expo.dev) (New Architecture, CNG Prebuild) + [Expo Router v4](https://docs.expo.dev/router/introduction/) with typed routes and pathless layout guards.
- **State, Forms & Realtime**: [TanStack Query](https://tanstack.com/query) with MMKV offline persistence + SSE live queries (`eventsource-parser`) + [TanStack Form](https://tanstack.com/form) (`Schema.standardSchemaV1`).
- **Contracts & Errors**: [Effect](https://effect.website) typed schemas, 11 status `Data.TaggedError` classes, and dual-target [Orval](https://orval.dev) v8 generation.
- **Authentication & RBAC**: [Better Auth](https://better-auth.com) (`@better-auth/expo`) with `expo-secure-store` Bearer token cache and declarative `<Can />` authorization.
- **Design System**: [NativeWind v4](https://www.nativewind.dev) OKLCH-to-HSL semantic tokens, [React Native Reusables](https://react-native-reusables.vercel.app) catalog, 3 runtime presets, and tactile elevation.
- **Quality & Testing**: [Biome 2](https://biomejs.dev) guardrails, [Vitest](https://vitest.dev) 4 + `vitest-native` boundary harness, and [MSW](https://mswjs.io) v2 (zero internal mocks).
- **Observability**: Pluggable `ObservabilityPort` (Sentry React Native / Datadog Mobile) with W3C `traceparent` and `X-Request-Id` trace correlation.
- **Release & Governance**: [Release-Please](https://github.com/googleapis/release-please) semver/changelog automation, [Lefthook](https://github.com/evilmartians/lefthook) + [Commitlint](https://commitlint.js.org) hooks.

## Prerequisites & Quickstart

Requires **Node >= 22** (CI runs Node 24) and **pnpm 11**. Xcode / Android Studio are only required for native dev clients (`pnpm ios` / `pnpm android`).

```bash
pnpm install       # Install dependencies and Lefthook git hooks
pnpm start         # Start Expo Metro dev server (choose iOS, Android, or web)
pnpm ios           # Build & run native iOS dev client via CNG
pnpm android       # Build & run native Android dev client via CNG
pnpm web           # Launch Metro web preview
pnpm test          # Run Vitest 4 + MSW v2 boundary test suite
pnpm prebuild      # Validate Continuous Native Generation (iOS/Android manifests)
pnpm export        # Compile static production bundles for iOS, Android, and web
```

## Project Scripts

| Script          | Command                                         | Purpose                                                               |
| :-------------- | :---------------------------------------------- | :-------------------------------------------------------------------- |
| `start`         | `expo start`                                    | Start Expo Metro bundler in interactive mode                          |
| `ios`           | `expo run:ios`                                  | Compile and launch the native iOS development build                   |
| `android`       | `expo run:android`                              | Compile and launch the native Android development build               |
| `web`           | `expo start --web`                              | Start Metro dev server targeting React Native Web                     |
| `prebuild`      | `expo prebuild --clean --no-install`            | Validate CNG native iOS/Android project generation without pod install |
| `export`        | `expo export --platform all`                    | Build static production bundles for iOS, Android, and web             |
| `typecheck`     | `tsc --noEmit`                                  | Run strict TypeScript typechecking across all layers                  |
| `lint`          | `biome check .`                                 | Verify formatting, FSD import boundaries, and RN lint rules           |
| `lint:fix`      | `biome check --write .`                         | Apply safe Biome formatting and import-sorting fixes                  |
| `test`          | `vitest run`                                    | Execute unit, contract, architecture, and boundary test suites        |
| `test:watch`    | `vitest`                                        | Run Vitest in interactive watch mode                                  |
| `test:coverage` | `vitest run --coverage`                         | Generate V8 coverage report via `@vitest/coverage-v8`                 |
| `generate:api`  | `orval`                                         | Regenerate Effect schemas & React Query endpoints from `openapi.json` |
| `sync:api`      | `curl -fsS http://localhost:9999/doc && orval`  | Pull live OpenAPI spec from `hono-open-api` and regenerate clients    |
| `verify:tokens` | `node scripts/verify-design-tokens.mjs`         | Verify `DESIGN.md` token parity across CSS, Tailwind, and TS presets  |

## Route & Feature Slice Architecture

Organized under 4-layer Mobile Feature-Sliced Design (`app/` -> `src/app/` -> `src/features/<slice>/` -> `src/shared/`):

```text
app/                            # Thin Route Façades (1-line re-exports only)
├── _layout.tsx                 # RootLayout Composition Root + SafeArea + PortalHost
├── +not-found.tsx              # Fallback unmatched-route screen
├── (auth)/
│   ├── _layout.tsx             # AuthLayoutGuard (redirects authenticated users to /(app))
│   ├── login.tsx               # Better Auth email sign-in screen
│   └── register.tsx            # Better Auth registration screen
└── (app)/
    ├── _layout.tsx             # AppLayoutGuard (session guard + themed bottom Tabs shell)
    ├── index.tsx               # Authenticated workspace home screen
    ├── tasks.tsx               # Realtime SSE live tasks with optimistic mutation buffering
    ├── files.tsx               # Dual-strategy uploads (multipart + presigned) & native share
    └── showcase.tsx            # Reusables catalog, runtime ThemeSwitcher & Effect form demo
```

## Documentation

- [Architecture Guide](docs/architecture.md): FSD layers, Composition Root, Orval/Effect contracts, auth, SSE, observability, theming, and file transfer.
- [Development & Playbooks](docs/development.md): 3 dev modes, mobile network addressing (`10.0.2.2`), 4 onboarding playbooks, 7-step scaffolding, testing, and env vars.
- [Agent Instructions](AGENTS.md): Architectural guardrails, testing rules, and verification gates for contributors and AI agents.
- [Design System & Tokens](DESIGN.md): Single-source OKLCH-to-HSL tokens, presets (`warm-tactile`, `editorial-slate`, `neo-brutalist`), and tactile elevation.
- [Domain Glossary](GLOSSARY.md): Ubiquitous terminology across mobile FSD, contracts, realtime, and testing.
- [Architecture Decision Records](docs/adr/): Accepted ADRs (`ADR-0001` through `ADR-0013`).
- [Runtime Verification Skill](.agents/skills/verify-expo-open-api/SKILL.md): 5-phase verification protocol (`Launch`, `Doctor`, `Drive`, `Evidence`, `Cleanup`) and feature guides.
