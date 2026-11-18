---
status: accepted
date: 2026-11-18
decision-ticket: https://github.com/Guiguerreiro39/expo-open-api/issues/10
---

# Better Auth Client Integration, SecureStore Bearer Tokens, and Mobile RBAC

Native mobile applications lack browser cookie jar synchronization across background network requests, SSE streaming, and native file uploads. We decided to configure `@better-auth/expo/client` backed by hardware-encrypted `expo-secure-store` with an in-memory token cache hydrated at startup, enforce pathless layout guards in Expo Router v4 (`app/(auth)`, `app/(app)`, `app/(public)`) coordinated with `SplashScreen.preventAutoHideAsync()`, decouple shared UI from the auth slice via an `AuthSessionBridge` registered at the `Composition Root`, and enforce Role-Based Access Control via a pure TypeScript RBAC matrix and `<Can />` component.

## Considered Options

- **Web-Style Cookie Authentication (`credentials: "include"`)**: Standard in web browsers, but React Native's Hermes runtime does not provide unified cookie persistence across `fetch`, `XMLHttpRequest`, Server-Sent Events (`/api/v1/tasks/live`), and native upload tasks, leading to silent auth failures and cross-domain synchronization issues.
- **Async SecureStore IPC on Every Outbound Request**: Storing tokens solely in `expo-secure-store` without an in-memory cache incurs 5–25ms asynchronous Keychain/KeyStore IPC latency on every network call, preventing synchronous Bearer header injection in the fetch mutator and blocking SSE reconnects.
- **Direct Feature Import in Shared UI (`src/shared/ui/can.tsx` importing `src/features/auth`)**: Convenient for small apps, but violates Feature-Sliced Design layer boundaries by introducing an illegal upward dependency from `shared` to `features`, preventing modular reuse and clean test harnesses.
- **Better Auth with In-Memory Cache and AuthSessionBridge (Chosen)**: Integrates `@better-auth/expo/client` with `expo-secure-store` (`storagePrefix: "expo_open_api"`). Tokens are cached in-memory during `useAppBootstrap()` for synchronous RFC 6750 Bearer injection. The session state is bridged into `src/shared/lib/auth-bridge.ts` at the `Composition Root`, and Expo Router v4 pathless layout groups enforce route security without auth flash.

## Consequences

- `expo-secure-store` is required and must be configured with `SecureStore.AFTER_FIRST_UNLOCK` to survive background app refreshes while staying encrypted when the device is locked.
- `useAppBootstrap()` coordinates initial session hydration before dismissing the native splash screen via `SplashScreen.hideAsync()`.
- TanStack Query's `focusManager` is wired to React Native's `AppState` to revalidate user sessions and stale queries automatically whenever the app is foregrounded.
- HTTP 401 `UnauthorizedError` handling is centralized in TanStack Query's `QueryCache` and `MutationCache` error handlers, immediately clearing the bearer token, wiping `["auth", "session"]`, calling `queryClient.clear()`, and redirecting to `/(auth)/login`. HTTP 403 `ForbiddenError` preserves the session and surfaces in-place access-denied UI.
- The RBAC matrix in `src/shared/lib/rbac.ts` provides 1:1 parity with `hono-open-api` roles (`admin`, `member`, `viewer`) and scopes (`own` vs `all`), consumed declaratively via `<Can />` and imperatively via `useCan()`.
