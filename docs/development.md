# Expo OpenAPI Starter — Development & Onboarding Playbooks

This guide covers local development modes, mobile network addressing across simulators/emulators/devices, the four template onboarding playbooks, the 7-step feature scaffolding checklist, the mock-free test harness, environment variables, and Git/Release governance.

---

## 1. Local Development Modes

### Mode 1: Standalone Offline Mock Mode (MSW v2 & Unit/Contract Harness)

Use this mode when iterating on UI primitives, design tokens, forms, or feature contracts without running a local backend:

```bash
pnpm test:watch        # Sub-second Vitest 4 + MSW v2 boundary TDD loop
pnpm web               # Preview screens in Metro web mode (Showcase & auth UI)
```

All automated tests under `src/` run against `src/test/msw-server.ts` (`onUnhandledRequest: "error"`) and pure-JS native adapters in `src/test/mocks/adapters/`, requiring zero network access or simulators.

### Mode 2: Paired with Local `hono-open-api` Backend (`http://localhost:9999`)

The standard full-stack development loop:

1. Start `hono-open-api` in its workspace:
   ```bash
   pnpm dev            # Listens on http://localhost:9999 (/health, /doc, /api/*)
   ```
2. Point `EXPO_PUBLIC_API_URL` at your target platform address (see Section 2) and start Expo Metro:
   ```bash
   pnpm start          # Press i (iOS Simulator), a (Android Emulator), or w (Web)
   ```
3. Better Auth issues Bearer tokens stored in `expo-secure-store`, `customFetch` injects `Authorization: Bearer`, `X-Request-Id`, and `traceparent`, and `/api/v1/tasks/live` streams live SSE snapshots.

### Mode 3: Continuous Native Generation (CNG) Native Dev Client

Use this mode whenever testing native hardware bridges (`expo-secure-store`, `react-native-mmkv`, `expo-haptics`, `expo-sharing`, `expo-document-picker`, `expo-image-picker`) or validating native config plugins:

```bash
pnpm ios               # Runs `expo run:ios` (CNG prebuild + Xcode dev client)
pnpm android           # Runs `expo run:android` (CNG prebuild + Gradle dev client)
```

To validate CNG manifests without launching Xcode/Gradle (matching CI):

```bash
CI=1 pnpm prebuild
CI=1 TMPDIR="$(mktemp -d)" pnpm export -- --clear
```

---

## 2. Mobile Network Addressing Guide

Mobile simulators, emulators, and physical devices resolve `localhost` differently from your workstation. Set `EXPO_PUBLIC_API_URL` in `.env` (gitignored) according to your runtime target:

| Runtime Target | `EXPO_PUBLIC_API_URL` Value | Notes |
| :------------- | :-------------------------- | :---- |
| **iOS Simulator & Web** | `http://localhost:9999` | Default in `ClientEnvSchema`; shares the host macOS loopback interface. |
| **Android Emulator** | `http://10.0.2.2:9999` | Uses the Android **Emulator Loopback** alias (`10.0.2.2`) to reach host `localhost:9999`. |
| **Physical Device (Same Wi-Fi LAN)** | `http://<LAN_IP>:9999` | Replace `<LAN_IP>` with your workstation's local IP (e.g. `192.168.1.42`). Ensure `hono-open-api` binds `0.0.0.0` and macOS firewall permits port `9999`. |
| **Remote / Restricted Wi-Fi (Expo Tunnel)** | `https://<tunnel-url>` | Launch Metro with `npx expo start --tunnel` and expose the backend via a tunnel (e.g. Cloudflare Tunnel or ngrok) over HTTPS. |

### Android Development Cleartext HTTP

Android 9+ blocks plain `http://` traffic in release builds by default. For local development against `http://10.0.2.2:9999` or `http://<LAN_IP>:9999`, Expo dev clients allow cleartext traffic automatically in debug builds; if you add a custom network security profile or test release-like staging over HTTP, explicitly enable `android.usesCleartextTraffic` only for non-production build variants and keep production strictly HTTPS.

---

## 3. Template Onboarding Playbooks

### Playbook 1: Bootstrap & Rebrand

Transform this template into your organization's mobile app:

1. **Update [`package.json`](../package.json)**: Set `"name"`, `"version"`, and metadata fields.
2. **Update [`app.json`](../app.json)**:
   - `expo.name` and `expo.slug` (your app display name and Expo slug).
   - `expo.scheme` (deep-link URL scheme, e.g. `"myapp"` — also update `scheme` in `src/features/auth/api/client.ts` and `src/shared/config/app-info.ts`).
   - `expo.ios.bundleIdentifier` (e.g. `"com.example.myapp"`).
   - `expo.android.package` (e.g. `"com.example.myapp"`).
   - Replace app icons and splash artwork in `assets/images/` (`icon.png`, `adaptive-icon.png`, `splash-icon.png`, `favicon.png`).
3. **Update App Metadata (`src/shared/config/app-info.ts`)**: Update `APP_INFO.name` and `APP_INFO.scheme`.
4. **Update Default Observability Service Name (`src/shared/config/env.ts`)**: Change `EXPO_PUBLIC_DATADOG_SERVICE` default from `"expo-open-api-mobile"` to your service identifier.
5. **Verify CNG & Bundle Integrity**:
   ```bash
   pnpm typecheck && pnpm lint && pnpm test
   CI=1 pnpm prebuild
   CI=1 TMPDIR="$(mktemp -d)" pnpm export -- --clear
   ```

### Playbook 2: Single-File Restyle

Change visual identity without modifying screen markup:

1. **Choose or Edit Theme Presets**: Built-in presets are `warm-tactile` (default), `editorial-slate`, and `neo-brutalist`, each with `light` and `dark` palettes.
2. **Update Canonical Spec ([`DESIGN.md`](../DESIGN.md))**: Update the YAML frontmatter (`colors`, `typography`, `rounded`) as the single source of truth.
3. **Sync Space-Separated HSL Channels**: Update `:root` / `.dark` in [`global.css`](../global.css) and preset palettes/elevation metadata in `src/shared/lib/theme/tokens.ts` and `src/shared/lib/theme/presets.ts`.
4. **Verify Token Parity & Hygiene**:
   ```bash
   pnpm verify:tokens
   pnpm test src/test/design-tokens.test.ts
   ```
   Both checks verify 100% token parity across `DESIGN.md`, `global.css`, `tailwind.config.ts`, and `tokens.ts`, and enforce zero hardcoded hex/rgb values in `src/features/` and `src/shared/ui/`.

### Playbook 3: OpenAPI Contract Sync

When endpoints or schemas change in `hono-open-api`:

1. **Sync Live from Local Backend (`http://localhost:9999/doc`)**:
   ```bash
   pnpm sync:api
   ```
   Downloads the updated spec to `openapi.json` and runs Orval v8 to regenerate `src/shared/api/generated/endpoints.ts`, `models/`, and `schemas.ts`.
2. **Offline Regeneration (After Editing `openapi.json`)**:
   ```bash
   pnpm generate:api
   ```
3. **Inspect & Verify**:
   ```bash
   git diff src/shared/api/generated
   pnpm typecheck && pnpm test
   ```

### Playbook 4: Demo-Slice Pruning

Remove the reference slices (`tasks`, `files`, `showcase`) while keeping auth, RBAC, theming, forms, error contracts, observability, and offline query persistence intact:

1. **Delete Route Façades**:
   ```bash
   rm app/(app)/tasks.tsx app/(app)/files.tsx app/(app)/showcase.tsx
   ```
2. **Delete Feature Slices**:
   ```bash
   rm -rf src/features/tasks src/features/files src/features/showcase
   ```
3. **Update Navigation & Routes**:
   - Remove the `tasks`, `files`, and `showcase` `<Tabs.Screen>` entries in `src/features/auth/ui/app-layout-guard.tsx`.
   - Remove unused route constants in `src/shared/config/routes.ts` and unused query keys in `src/shared/api/query-keys.ts`.
   - Update quick links in `src/features/home/ui/home-screen.tsx`.
4. **Clean Up MSW Test Handlers**: Remove `tasks.ts` and `files.ts` handlers from `src/test/mocks/handlers/` and `src/test/msw-server.ts`.
5. **Re-Verify**:
   ```bash
   pnpm typecheck && pnpm lint && pnpm test
   CI=1 TMPDIR="$(mktemp -d)" pnpm export -- --clear
   ```

---

## 4. Scaffolding a New Feature Slice (7-Step Checklist)

Follow these steps to add a new feature slice adhering to Mobile FSD and zero-mock TDD:

- [ ] **Step 1: Domain & OpenAPI Sync**: Record ubiquitous terms in [`GLOSSARY.md`](../GLOSSARY.md) (and an ADR in [`docs/adr/`](./adr/) if architectural), then run `pnpm sync:api` or `pnpm generate:api` so schemas exist in `src/shared/api/generated/`.
- [ ] **Step 2: Create Slice Segments**:
  ```bash
  mkdir -p src/features/<slice>/{api,model,ui,__tests__}
  ```
  Use `kebab-case` filenames and zero barrel `index.ts` files.
- [ ] **Step 3: Bind API Contracts (`api/`)**: Define `defineContract` descriptors (`src/shared/api/contracts.ts`) and typed hooks (`useEffectQuery`, `useEffectMutation`, or `useLiveQuery`). Register shared keys in `src/shared/api/query-keys.ts`.
- [ ] **Step 4: Implement Domain Model & Validation (`model/`)**: Write pure business logic, Effect `Schema.Struct` form schemas (for `Schema.standardSchemaV1`), and state hooks.
- [ ] **Step 5: Build Accessible UI (`ui/`)**: Compose Reusables primitives from `src/shared/ui/`, semantic NativeWind tokens, `useAppForm` + `FormScrollView`, `TactilePressable`, and `<Can />` RBAC guards.
- [ ] **Step 6: Wire Thin Route Façade (`app/`)**: Add a 1-line re-export under `app/(app)/<slice>.tsx`, add its path constant to `src/shared/config/routes.ts`, and register the tab/screen in `src/features/auth/ui/app-layout-guard.tsx`.
- [ ] **Step 7: Add MSW Handlers & Behavioral Tests (`__tests__/`)**: Add modular handlers under `src/test/mocks/handlers/`, write boundary tests using `renderWithProviders`, assert `observability.assertNoDefects()`, and pass all verification gates.

---

## 5. Testing Guide & Mock-Free Boundary Harness (`ADR-0009`)

Tests run on **Vitest 4** with **`vitest-native`** (`engine: "mock"`), **`@effect/vitest`**, and **`@testing-library/react-native`**.

### Zero Internal Module Mocking

Calling `vi.mock()` or `jest.mock()` anywhere under `src/` is prohibited and fails `src/app/__tests__/architecture.test.ts`. Tests execute the real `createAppComposition` graph via `renderWithProviders()` (`src/test/render.tsx`) and intercept exclusively at outer I/O boundaries:

| Boundary | Double / Harness | Location | Purpose |
| :------- | :--------------- | :------- | :------ |
| **HTTP REST & SSE** | MSW v2 (`msw/node`) | `src/test/msw-server.ts`, `src/test/mocks/handlers/` | Intercepts all HTTP/fetch calls (`onUnhandledRequest: "error"`). |
| **EventSource Streams** | `MockEventSource` | `src/test/mock-event-source.ts` | Simulates SSE frames, reconnects, and error events. |
| **Binary XHR Transfers** | `MockXMLHttpRequest` | `src/test/mock-xml-http-request.ts` | Simulates byte progress and upload aborts. |
| **Native Expo / RN Bridges** | Pure-JS Adapters | `src/test/mocks/adapters/` | In-memory SecureStore, MMKV, NetInfo, FileSystem, Sharing, Haptics, Router, and `expo/fetch`. |
| **Telemetry / Defects** | `SpyObservabilityAdapter` | `src/shared/observability/spy-adapter.ts` | Captures breadcrumbs/defects in RAM; call `observability.assertNoDefects()` to guarantee zero leaked 5xx/decode defects. |

```bash
pnpm test              # Full test suite (unit, contract, architecture, token & docs hygiene)
pnpm test:watch        # Interactive watch mode
pnpm test:coverage     # V8 coverage report
```

---

## 6. Environment Variables Reference

All runtime environment variables are validated through `ClientEnvSchema` in `src/shared/config/env.ts` (`process.env` reads outside allowed config files are blocked by Biome `style/noProcessEnv`).

### Client Runtime Variables (`ClientEnvSchema`)

| Variable | Type | Default | Purpose |
| :------- | :--- | :------ | :------ |
| `EXPO_PUBLIC_API_URL` | String | `"http://localhost:9999"` | Base URL for `hono-open-api` REST, Better Auth, and SSE requests. |
| `EXPO_PUBLIC_APP_VERSION` | String | `"0.1.0"` | Application version reported to telemetry adapters. |
| `EXPO_PUBLIC_SENTRY_DSN` | String (optional) | `undefined` | Enables `SentryObservabilityAdapter` when set. |
| `EXPO_PUBLIC_SENTRY_TRACES_SAMPLE_RATE` | Number (coercible) | `0.2` | Sentry performance trace sample rate (`0.0`–`1.0`). |
| `EXPO_PUBLIC_DATADOG_APPLICATION_ID` | String (optional) | `undefined` | Enables `DatadogObservabilityAdapter` (paired with client token). |
| `EXPO_PUBLIC_DATADOG_CLIENT_TOKEN` | String (optional) | `undefined` | Datadog Mobile RUM client ingestion token. |
| `EXPO_PUBLIC_DATADOG_SITE` | String | `"datadoghq.com"` | Datadog intake region (e.g. `datadoghq.eu`). |
| `EXPO_PUBLIC_DATADOG_SERVICE` | String | `"expo-open-api-mobile"` | Service name tagged on Datadog RUM sessions. |
| `EXPO_PUBLIC_DATADOG_SESSION_SAMPLE_RATE` | Number (coercible) | `100` | Percentage of sessions tracked by Datadog RUM. |
| `NODE_ENV` | `"development" \| "production" \| "test"` | `"development"` | Selects default observability adapter (`Spy` in test, `Console` in dev, `Noop` fallback in prod). |

### CI-Only Secrets (`.github/workflows/ci.yml`)

| Secret | Scope | Purpose |
| :----- | :---- | :------ |
| `SENTRY_AUTH_TOKEN` | GitHub Actions (`main` / `master`) | Conditionally triggers hidden sourcemap uploads to Sentry on default-branch builds. |
| `DATADOG_API_KEY` | GitHub Actions (`main` / `master`) | Conditionally triggers sourcemap uploads to Datadog Mobile on default-branch builds. |

---

## 7. Git Governance & Release-Please (`ADR-0010`)

- **Lefthook ([`lefthook.yml`](../lefthook.yml))**: Installed automatically on `pnpm install` (`package.json#prepare`).
  - `pre-commit`: Runs `biome check --write` on staged files and re-stages fixes.
  - `commit-msg`: Validates Conventional Commits 1.0.0 via **Commitlint** ([`commitlint.config.mjs`](../commitlint.config.mjs)) (`feat`, `fix`, `perf`, `refactor`, `docs`, `style`, `test`, `build`, `ci`, `chore`, `revert`; lowercase subject; header <= 100 chars).
  - `pre-push`: Runs `scripts/check-branch-push.sh` to block accidental direct pushes to `main`/`master` (emergency bypass: `ALLOW_DIRECT_MAIN_PUSH=1`).
- **PR Title CI (`.github/workflows/pr-title.yml`)**: Enforces Conventional Commit PR titles so squash merges feed release automation cleanly.
- **Release-Please (`.github/workflows/release.yml`, `release-please-config.json`)**: Evaluates commits landing on `main`, maintains a Release PR updating `package.json` and `CHANGELOG.md`, and creates semver Git tags and GitHub Releases when merged.
