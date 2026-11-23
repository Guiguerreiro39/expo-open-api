---
status: accepted
date: 2026-11-23
decision-ticket: https://github.com/Guiguerreiro39/expo-open-api/issues/17
---

# CI/CD Pipelines, Continuous Native Generation Validation, and Release Automation

Establishing an enterprise-grade CI/CD and release automation strategy for a mobile React Native / Expo application starter kit paired with `hono-open-api`. Ensuring that CI catches contract drift, static type errors, lint/format issues, regressions, broken native configuration plugins (via Continuous Native Generation / CNG), and Metro export failures without requiring expensive or slow macOS build runners. Enforcing strict conventional commits locally (via Lefthook and Commitlint) and in PRs, and driving automated changelog, semantic versioning, and GitHub releases via Release-Please while skipping unnecessary container/npm publishing steps.

## Considered Options

- **Full Native Compilation on macOS Runners in CI (Xcode & Gradle)**: Running full Xcode and Android Gradle builds on every PR introduces massive queue latency, high CI minute costs ($0.08–0.16/min for macOS runners), and 15–25 minute build cascades. This is redundant for validating JavaScript, TypeScript, and config plugin logic.
- **Pure Static Linting and Unit Testing without CNG or Export Verification**: Running only Biome, TypeScript, and Vitest fails to detect broken native config plugins, unresolvable native pods/manifests, syntax errors in platform-specific shims, or Metro bundling failures that crash applications in production builds.
- **Spinning Up Live Backend Containers in CI**: Launching a live `hono-open-api` Docker container or server process in GitHub Actions runners introduces networking race conditions, container boot overhead, and flakiness. Hermetic in-memory MSW v2 mocking provides deterministic, sub-minute contract and UI testing in CI, while live backend checks are codified in the local `.agents/skills/verify-expo-open-api` skill.
- **Hermetic Linux CI with CNG Prebuild Validation, Metro Export, Lefthook/Commitlint Governance, and Release-Please Automation (Chosen)**: Standardizes on a single ultra-fast Linux runner job (`ubuntu-latest`, Node 24, pnpm) validating dependency locks, Orval API contract drift, type safety, Biome linting, Vitest suites, Continuous Native Generation (`npx expo prebuild --clean --no-install`), and multi-platform Metro bundling (`npx expo export --platform all`). Complemented by local Lefthook git hooks, Commitlint commit message validation, PR title semantic linting, and Release-Please automated tagging and changelog management.

## Consequences

- **GitHub Actions CI Workflow (`.github/workflows/ci.yml`)**:
  - Triggers on pull requests and pushes to `main` and `master`.
  - Configured with concurrency group `ci-${{ github.ref }}` and `cancel-in-progress: true` (except for default branches).
  - Runs on `ubuntu-latest` with Node 24 and pnpm caching (`frozen-lockfile`).
  - Executes six sequential verification stages:
    1. **Orval Codegen Drift**: Runs `pnpm sync:api` and validates `git diff --exit-code src/shared/api/generated` to guarantee generated schemas and endpoints match the OpenAPI contract.
    2. **Typecheck**: Runs `pnpm typecheck` across all layers and route façades.
    3. **Lint & Format**: Runs `pnpm biome ci .` enforcing strict linting and formatting.
    4. **In-Memory Vitest**: Runs `pnpm test` against mock-free test harnesses using MSW v2, in-memory SecureStore doubles, and SpyObservabilityAdapter.
    5. **CNG Prebuild Validation**: Executes `npx expo prebuild --clean --no-install` to verify native iOS/Android manifests and config plugins synthesize cleanly without native compilation.
    6. **Metro Multi-Platform Export**: Executes `npx expo export --platform all` to verify static production bundles compile for iOS, Android, and web without unresolved modules or runtime packaging errors.
  - Conditionally uploads Sentry and Datadog Mobile source maps when optional secrets (`SENTRY_AUTH_TOKEN`, `DATADOG_API_KEY`) are configured.
- **Pull Request Semantic Validation (`.github/workflows/pr-title.yml`)**:
  - Validates all PR titles against Conventional Commits (`feat`, `fix`, `perf`, `refactor`, `docs`, `style`, `test`, `build`, `ci`, `chore`, `revert`) using `amannn/action-semantic-pull-request@v6` on `pull_request_target`.
  - Guarantees squash-merged PRs generate structured commit messages for downstream release tooling.
- **Local Git Hooks & Commit Governance**:
  - **Lefthook (`lefthook.yml`)**: Configured with `pre-commit` running `biome check --write` on staged files with `stage_fixed: true`, `commit-msg` running Commitlint on commit messages, and `pre-push` running `scripts/check-branch-push.sh` to block direct pushes to `main`.
  - **Commitlint (`commitlint.config.mjs`)**: Extends `@commitlint/config-conventional` enforcing conventional commit types, lower-case subject prefixes, and maximum header length of 100 characters.
- **Release Automation (`.github/workflows/release.yml`)**:
  - Automates release tracking using `googleapis/release-please-action@v4` on push to `main` using `release-please-config.json` and `.release-please-manifest.json` configured for `node` component.
  - Automatically updates `CHANGELOG.md`, bumps `package.json` version, creates semantic git tags, and publishes GitHub Releases.
  - Excludes container image and npm registry publishing since `expo-open-api` is an application starter kit template.
