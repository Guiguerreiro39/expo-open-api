---
status: accepted
date: 2026-11-23
decision-ticket: https://github.com/Guiguerreiro39/expo-open-api/issues/18
---

# Starter Documentation Suite, Developer Playbooks, and Template Onboarding

Establishing an enterprise-grade documentation architecture, developer onboarding playbooks, and AI agent engineering guardrails for `expo-open-api` paired directly with `hono-open-api`. Ensuring that developers and autonomous AI agents have authoritative, searchable, and battle-tested guidance across local development modes, mobile network addressing (emulators, simulators, physical devices), template rebranding, feature scaffolding and pruning, and strict architectural layer boundaries.

## Considered Options

- **Monolithic Single-File README**: Keeping all setup guides, architecture overviews, script references, mobile networking tricks, and agent rules in a single `README.md`. This results in an unwieldy, high-churn file that blurs user onboarding with internal architectural design decisions, making it difficult for both developers and LLM agents to maintain clear context.
- **External Wiki or Hosted Documentation Portal (e.g., Docusaurus/GitBook)**: Hosting documentation externally or in a separate documentation branch. This creates synchronization friction, causes documentation to drift from code across pull requests, and isolates AI agents that rely on in-repo context pointers (`AGENTS.md`, `GLOSSARY.md`, `DESIGN.md`).
- **Canonical 7-File In-Repo Documentation Suite with Mobile-Specific Playbooks (Chosen)**: Standardizes on a structured 7-file in-repo documentation architecture maintaining 1:1 structural parity with `tanstack-open-api` while addressing mobile-native considerations (network addressing, New Architecture CNG, emulators/simulators, keyboard controllers, safe area insets). Complemented by explicit developer onboarding playbooks, feature scaffolding checklists, demo slice pruning instructions, and strict agent guardrails.

## Consequences

- **Documentation Suite Hierarchy & File Responsibilities**:
  1. **`README.md`**: High-level repository landing page, tech stack highlights, quickstart commands (Expo CLI, iOS Simulator, Android Emulator, physical devices via Expo Go/development builds), project script matrix, paired backend setup, and link index.
  2. **`docs/architecture.md`**: Primary system architecture specification detailing ADR 0001 through ADR 0011 (Mobile FSD 4-layer hierarchy, side-effect-free Composition Root, Orval/Effect contracts and error taxonomy, Better Auth + SecureStore bearer cache, realtime SSE live queries with mutation buffering, pluggable `ObservabilityPort` with Sentry/Datadog Mobile, themeable OKLCH→HSL design system with tactile elevation, React Native Reusables and form primitives, mobile file transfer pipeline, Vitest in-memory test harness, and CI/CD with CNG prebuild validation).
  3. **`docs/development.md`**: Developer and contributor playbooks covering:
     - **3 Local Development Modes**: Mode 1 (Standalone Offline Mock with MSW v2), Mode 2 (Paired with Local `hono-open-api`), and Mode 3 (Continuous Native Generation dev client via `expo run:ios` / `expo run:android`).
     - **Mobile Network Addressing**: Detailed recipes for resolving backend API endpoints across iOS Simulator (`localhost:9999`), Android Emulator (`10.0.2.2:9999`), physical devices on LAN (`http://<LAN_IP>:9999`), and remote development via Expo Tunnel (`npx expo start --tunnel`), alongside development cleartext HTTP configuration (`android:usesCleartextTraffic`).
     - **Template Customization & Rebranding**: Step-by-step checklist for updating `app.json` (`name`, `slug`, `scheme`, `ios.bundleIdentifier`, `android.package`), app icons, splash screens, and adaptive icons.
     - **7-Step Feature Scaffolding Checklist**: Protocol for adding new feature slices (`src/features/<slice>/api/`, `model/`, `ui/`, Orval contract registration, TanStack Form validation, route façade wireup).
     - **Demo Slice Pruning Playbook**: Precise deletion and cleanup steps for removing reference slices (`tasks`, `files`, `showcase`) without leaving orphaned imports or breaking test suites.
     - **Environment Variable Reference**: Complete table of configuration flags (`EXPO_PUBLIC_API_URL`, `EXPO_PUBLIC_AUTH_URL`, `EXPO_PUBLIC_SENTRY_DSN`, `EXPO_PUBLIC_DATADOG_CLIENT_TOKEN`, etc.) and validation rules.
  4. **`AGENTS.md`**: Authoritative engineering rules and guardrails for AI agents and human contributors:
     - Strict FSD layer hierarchy (`src/app/` → `src/routes/` → `src/features/<slice>/` → `src/shared/`) with zero circular or cross-slice imports and zero barrel `index.ts` files.
     - Route Façade pattern: `src/routes/` files remain thin shells ($\le$ 50 LOC) delegating rendering to feature slice screens.
     - Zero direct vendor SDK calls: all telemetry calls `ObservabilityPort`, auth calls `src/shared/auth/`, and storage calls `src/shared/storage/`.
     - In-memory test discipline: no internal `vi.mock()` calls; tests utilize `src/test/` test doubles and MSW v2 handlers.
     - Safe area and keyboard discipline: mandatory use of `react-native-safe-area-context` and `react-native-keyboard-controller`.
     - Single root `<PortalHost />` at the Composition Root for all overlays.
     - Verification gates: mandatory execution of `.agents/skills/verify-expo-open-api/SKILL.md` before marking tickets complete.
  5. **`GLOSSARY.md`**: Ubiquitous language definition ensuring shared terminology across code, ADRs, and issues (Mobile FSD, Composition Root, Bearer Token Cache, Live Query, Defect, Design Token, Tactile Elevation, MobileFileAsset, Test Harness, CNG).
  6. **`DESIGN.md`**: Visual styling specification, semantic OKLCH-to-HSL native color tokens, typography scales, tactile elevation physics (`boxShadow: 4px 4px 0px 0px`), and Reusables guidelines.
  7. **`docs/adr/`**: Numbered Architecture Decision Records (`0001` through `0011`) capturing architectural decisions, alternatives, and trade-offs.
