# Verification Flow: Authentication & RBAC (`auth-and-rbac`)

Validates Better Auth mobile flows, `expo-secure-store` Bearer token hydration, synchronous `Authorization: Bearer` injection, themed pathless Expo Router Layout Guards, single-header `<Tabs>` chrome, zero-jump `useAppForm` auth screens, open-redirect sanitization, `<Can />` RBAC, and 401 vs 403 error discipline.

---

## Automated Boundary Gate

```bash
pnpm test src/features/auth/__tests__/ src/shared/lib/__tests__/rbac.test.ts src/shared/ui/__tests__/can.test.tsx src/shared/storage/__tests__/credential-store.test.ts
```

---

## Interactive / Paired Verification Steps

### 1. Pathless Layout Guards & Themed Loading Chrome

1. Launch the app while bootstrap/session resolution is in flight:
   - **Assertion**: `AppLayoutGuard` and `AuthLayoutGuard` render a themed loading view (`bg-background` + primary `ActivityIndicator`, `testID="layout-guard-loading"`) rather than flashing blank/white.
2. With an empty `CredentialStorePort` (unauthenticated state), attempt to navigate to `/(app)/tasks`:
   - **Assertion**: `AppLayoutGuard` (`app/(app)/_layout.tsx`) redirects to `/(auth)/login?redirect=%2Ftasks`.
3. Supply a malicious redirect query (e.g. `redirect=//evil.example` or `redirect=https://evil.example`):
   - **Assertion**: `sanitizeRedirect` rejects external/protocol-relative targets and falls back safely to `/(app)`.

### 2. Zero-Jump Auth Forms, Sign-In, Credential Persistence & Synchronous Bearer Cache

1. On `/(auth)/login` and `/(auth)/register`, verify `useAppForm` + top-anchored `FormScrollView` ergonomics:
   - **Assertion**: Opening the keyboard never yanks a vertically centered card upward, `FormMessage` reserves `min-h-5` space on blur validation, keyboard return keys (`Next` / `Done`) advance focus across inputs and submit on the last field, the `>= 44×44pt` Show/Hide password toggle flips `secureTextEntry`, card footers wrap cleanly on 320–375px screens, and error/`403` banners reuse `<Alert>`.
2. Enter valid `hono-open-api` credentials and submit:
   - **Assertion**:
     - `POST /api/auth/sign-in/email` succeeds (with double-submit protection while in flight).
     - The session token is written to `CredentialStorePort` (`expo-secure-store`, `AFTER_FIRST_UNLOCK`) AND stored in `cachedBearerToken` (`src/shared/lib/auth-session-bridge.ts`).
     - `AuthLayoutGuard` redirects into `/(app)` and subsequent `customFetch` calls attach `Authorization: Bearer <token>` synchronously without per-request Keychain IPC.
3. Cold-restart the app:
   - **Assertion**: `useAppBootstrap` hydrates `cachedBearerToken` and custom fonts, restores non-auth MMKV queries, verifies `/api/auth/get-session`, and dismisses the themed splash screen without flashing the login screen.

### 3. RBAC & Declarative `<Can />` Authorization

1. Sign in as a `member` user and inspect `/(app)/tasks` and `/(app)/files`:
   - **Assertion**: Own resources render delete/edit controls; resources owned by other users hide restricted actions via `<Can action="task:delete" resource={task} />`.
2. Sign in as a `viewer` user:
   - **Assertion**: Creation and mutation actions are hidden (`<Can action="task:create" />` fails closed).
3. Sign in as an `admin` user:
   - **Assertion**: `all` scope permits managing resources across users.

### 4. 401 vs 403 Error Discipline & Double-Tap-Locked Sign-Out

1. **401 Unauthorized**: Revoke or expire the token and trigger a protected request:
   - **Assertion**: `cachedBearerToken`, `CredentialStorePort`, `["auth", "session"]`, and `QueryClient` are wiped, `ObservabilityPort.clearUserContext()` runs, and `AppLayoutGuard` redirects immediately to `/(auth)/login`.
2. **403 Forbidden**: Trigger an action denied by backend RBAC:
   - **Assertion**: Session remains intact (no redirect to login), an in-place `<Alert variant="warning">` refusal renders, and the error logs as a breadcrumb (zero defects).
3. Tap **Sign out** in the themed `<Tabs>` header (`min-h-11 min-w-11`, `>= 44×44pt` touch target):
   - **Assertion**: Concurrent double-taps are locked while `"Signing out..."` is in flight, tokens and query caches clear cleanly, and navigation returns to `/(auth)/login`.
