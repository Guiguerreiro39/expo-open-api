# Verification Flow: Authentication & RBAC (`auth-and-rbac`)

Validates Better Auth mobile flows, `expo-secure-store` Bearer token hydration, synchronous `Authorization: Bearer` injection, pathless Expo Router Layout Guards, open-redirect sanitization, `<Can />` RBAC, and 401 vs 403 error discipline.

---

## Automated Boundary Gate

```bash
pnpm test src/features/auth/__tests__/ src/shared/lib/__tests__/rbac.test.ts src/shared/ui/__tests__/can.test.tsx src/shared/storage/__tests__/credential-store.test.ts
```

---

## Interactive / Paired Verification Steps

### 1. Pathless Layout Guard Redirection

1. Launch the app with an empty `CredentialStorePort` (unauthenticated state) and attempt to navigate to `/(app)/tasks`.
2. **Assertion**: `AppLayoutGuard` (`app/(app)/_layout.tsx`) redirects to `/(auth)/login?redirect=%2Ftasks`.
3. Supply a malicious redirect query (e.g. `redirect=//evil.example` or `redirect=https://evil.example`):
   - **Assertion**: `sanitizeRedirect` rejects external/protocol-relative targets and falls back safely to `/(app)`.

### 2. Sign-In, Credential Tier Persistence & Synchronous Bearer Cache

1. On `/(auth)/login`, enter valid `hono-open-api` credentials (or register on `/(auth)/register`) and submit.
2. **Assertion**:
   - `POST /api/auth/sign-in/email` succeeds.
   - The session token is written to `CredentialStorePort` (`expo-secure-store`, `AFTER_FIRST_UNLOCK`) AND stored in `cachedBearerToken` (`src/shared/lib/auth-session-bridge.ts`).
   - `AuthLayoutGuard` redirects into `/(app)` and subsequent `customFetch` calls attach `Authorization: Bearer <token>` synchronously without per-request Keychain IPC.
3. Cold-restart the app:
   - **Assertion**: `useAppBootstrap` hydrates `cachedBearerToken`, restores non-auth MMKV queries, verifies `/api/auth/get-session`, and dismisses the splash screen without flashing the login screen.

### 3. RBAC & Declarative `<Can />` Authorization

1. Sign in as a `member` user and inspect `/(app)/tasks` and `/(app)/files`:
   - **Assertion**: Own resources render delete/edit controls; resources owned by other users hide restricted actions via `<Can action="task:delete" resource={task} />`.
2. Sign in as a `viewer` user:
   - **Assertion**: Creation and mutation actions are hidden (`<Can action="task:create" />` fails closed).
3. Sign in as an `admin` user:
   - **Assertion**: `all` scope permits managing resources across users.

### 4. 401 vs 403 Error Discipline & Sign-Out

1. **401 Unauthorized**: Revoke or expire the token and trigger a protected request:
   - **Assertion**: `cachedBearerToken`, `CredentialStorePort`, `["auth", "session"]`, and `QueryClient` are wiped, `ObservabilityPort.clearUserContext()` runs, and `AppLayoutGuard` redirects immediately to `/(auth)/login`.
2. **403 Forbidden**: Trigger an action denied by backend RBAC:
   - **Assertion**: Session remains intact (no redirect to login), an in-place refusal alert renders, and the error logs as a breadcrumb (zero defects).
3. Tap **Sign out** in the `(app)` header:
   - **Assertion**: Tokens and query caches clear cleanly and navigation returns to `/(auth)/login`.
