---
status: accepted
date: 2026-11-23
decision-ticket: https://github.com/Guiguerreiro39/expo-open-api/issues/20
---

# Master Specification Compilation and Implementation Backlog Slicing

Deciding how to synthesize all locked architectural decisions, research findings (Issues #2–#7), and domain specifications (ADRs 0001–0012) into an actionable, agent-executable implementation backlog. We decided to publish a unified Master Specification tracking issue on GitHub adhering to the `/to-spec` standard, accompanied by 8 vertically sliced tracer-bullet implementation issues with explicit native `blockedBy` dependencies. Each implementation ticket is tagged with `ready-for-agent`, adheres to strict boundary-interception testing (banning internal `vi.mock()` calls), and enforces the 5-phase runtime verification gate before completion.

## Considered Options

- **Direct Monolithic Implementation Without Slicing**: Attempting to implement the entire starter template in one or two massive PRs. This breaks agent context windows, creates untraceable merge conflicts across native bridges and schemas, and prevents progressive validation of foundational Continuous Native Generation (CNG) prebuilds.
- **Horizontal Layer-by-Layer Slicing (Schema -> UI -> Tests)**: Creating tickets by horizontal tiers (e.g., ticket for all UI components, ticket for all API hooks). This violates vertical tracer-bullet principles, leaves intermediate states non-functional and untestable, and prevents end-to-end demoability.
- **Ordered Vertical Tracer-Bullet Backlog with Master Spec (Chosen)**: Compiles all locked decisions into a canonical Master Specification issue on GitHub, then slices the work into 8 vertical tracer bullets with explicit native blocking dependencies (`--add-blocked-by`). Each slice delivers a narrow but complete path through schemas, runtime wiring, UI, and integration tests that remains green, verifiable, and runnable on its own.

## The 8 Vertical Tracer Bullets

1. **Ticket 1: Foundation Scaffolding & CI Pipeline**:
   - Deliverables: Expo SDK 52+, Expo Router v4 setup, Continuous Native Generation (CNG) prebuild verification (`expo prebuild --clean --no-install`), multi-platform Metro export (`expo export --platform all`), Biome linting/formatting, Lefthook git governance, and GitHub Actions CI workflow.
   - Blocked by: None.
2. **Ticket 2: Design System & Theming Tokens**:
   - Deliverables: NativeWind v4 with Tailwind 3.4.x, OKLCH semantic token bridge mapping to space-separated HSL channels (`hsl(var(--<token>) / <alpha>)`), typed `vars()` theme presets (Zinc, Slate, Neutral), React Native Reusables component catalog integration, and `TactilePressable` with `expo-haptics`.
   - Blocked by: Ticket 1.
3. **Ticket 3: Mock-Free Test Harness & Contract Codegen**:
   - Deliverables: Vitest 4 + `vitest-native` + `@effect/vitest`, side-effect-free Composition Root (`createAppComposition`), mock-free test harness in `src/test/` (`renderWithProviders`, MSW v2 `setupServer`, in-memory SecureStore/MMKV doubles, `SpyObservabilityAdapter`), and Orval v8 dual-target codegen pipeline with Effect Schema decoding.
   - Blocked by: Ticket 1.
4. **Ticket 4: Auth & Session Management Vertical Slice**:
   - Deliverables: `@better-auth/expo/client`, SecureStore credential tier, in-memory token cache for synchronous `customFetch` Bearer injection, Expo Router `(auth)` / `(app)` layout guards, login/register UI, and session hydration/guard tests.
   - Blocked by: Ticket 2, Ticket 3.
5. **Ticket 5: Tasks & Real-Time SSE Live Query Vertical Slice**:
   - Deliverables: Tasks CRUD with optimistic updates, live SSE streaming client (`/api/v1/tasks/live` using `eventsource-parser` and `expo/fetch` WinterCG `ReadableStream`), mutation snapshot buffering flushed in `queueMicrotask`, MMKV TanStack Query offline cache persister with NetInfo/AppState listeners, and live sync testing.
   - Blocked by: Ticket 4.
6. **Ticket 6: Mobile File Transfer & Native Sharing Vertical Slice**:
   - Deliverables: `expo-file-system` upload pipeline (`createUploadTask` for direct multipart $\le$ 10MB and presigned PUT $\le$ 100MB), throttled queue concurrency, download with `expo-sharing`, and file management UI.
   - Blocked by: Ticket 4.
7. **Ticket 7: Component Showcase & Theming Switcher**:
   - Deliverables: Interactive showcase screen exercising all React Native Reusables primitives, form validation with Effect Schema, dynamic theme switching, and tactile haptic feedback.
   - Blocked by: Ticket 2, Ticket 4.
8. **Ticket 8: Starter Documentation Suite & Template Onboarding**:
   - Deliverables: 7 canonical documentation files (`README.md`, `AGENTS.md`, `GLOSSARY.md`, `DESIGN.md`, `docs/architecture.md`, `docs/development.md`, `docs/adr/`), rebranding & feature pruning playbooks, emulator networking guides, and `.agents/skills/verify-expo-open-api/SKILL.md`.
   - Blocked by: Ticket 5, Ticket 6, Ticket 7.

## Consequences

- The Master Specification is filed as a GitHub issue that aggregates all specifications, user stories, and architecture contracts.
- 8 implementation sub-issues are published with the `ready-for-agent` label and native GitHub blocking links.
- Downstream developers and autonomous agents execute one ticket per session via `/implement-spec <ticket-id>`, following strict TDD Red-Green-Refactor cycles.
- Every ticket must pass the 5-phase `verify-expo-open-api` verification suite prior to merging.
- Internal `vi.mock()` calls are forbidden; all tests must utilize the public boundary test harness in `src/test/`.
