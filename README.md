# expo-open-api

Production-ready React Native (Expo) mobile starter kit built on Expo Router, Effect, and OpenAPI contracts, pairing directly with [`hono-open-api`](https://github.com/Guiguerreiro39/hono-open-api).

## Tech Stack Highlights

- **Framework & Navigation**: [Expo SDK 52+](https://expo.dev) (New Architecture, CNG / Prebuild) + [Expo Router v4](https://docs.expo.dev/router/introduction/) with typed routes and pathless session guards.
- **State & Realtime**: [TanStack Query](https://tanstack.com/query) with offline persistence + SSE live queries with optimistic mutation buffering.
- **Contracts & Errors**: [Effect](https://effect.website) typed schemas, 11 status `Data.TaggedError` classes, and dual-target [Orval](https://orval.dev) generation.
- **Authentication & RBAC**: [Better Auth](https://better-auth.com) (`@better-auth/expo`) with `expo-secure-store` Bearer token transport and fine-grained `<Can />` authorization.
- **Design System**: [NativeWind v4](https://www.nativewind.dev) semantic tokens, [React Native Reusables](https://react-native-reusables.vercel.app) component catalog, OKLCH presets, and tactile elevation.
- **Quality & Testing**: [Biome 2](https://biomejs.dev) lint/format guardrails, [Vitest](https://vitest.dev) 4 boundary harness, and [MSW](https://mswjs.io) v2.
- **Observability**: Pluggable `ObservabilityPort` (Sentry React Native / Datadog Mobile) with W3C `traceparent` and `X-Request-Id` trace correlation.
- **Release & Governance**: [Release-Please](https://github.com/googleapis/release-please) automated semver/changelog, [Lefthook](https://github.com/evilmartians/lefthook) + [Commitlint](https://commitlint.js.org) git hooks.
