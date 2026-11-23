# Runtime Verification Feature Flows

Step-by-step verification procedures for the 5 core capability areas of `expo-open-api`.

## Feature Flow Directory

| Feature Flow | Target Route(s) | Core Capabilities Verified | Guide |
| :----------- | :-------------- | :------------------------- | :---- |
| **`showcase-and-theming`** | `/(app)/showcase` | OKLCH-to-HSL presets (`warm-tactile`, `editorial-slate`, `neo-brutalist`), `ThemeSwitcher`, `TactilePressable`, Reusables overlays (`<PortalHost />`), `ToastProvider`, `useAppForm` + `FormScrollView`. | [`showcase-and-theming.md`](./showcase-and-theming.md) |
| **`auth-and-rbac`** | `/(auth)/login`, `/(auth)/register`, `/(app)` | Better Auth mobile client, `expo-secure-store` + synchronous `cachedBearerToken`, pathless Layout Guards, open-redirect blocking, `<Can />` RBAC, 401 vs 403 discipline. | [`auth-and-rbac.md`](./auth-and-rbac.md) |
| **`live-tasks`** | `/(app)/tasks` | Streaming SSE `/api/v1/tasks/live`, `useLiveQuery`, `["tasks", "mutation"]` optimistic updates & microtask anti-clobber buffering, `AppState`/`NetInfo` reconnect, MMKV cache. | [`live-tasks.md`](./live-tasks.md) |
| **`files-upload-and-download`** | `/(app)/files` | `useMobileFilePicker`, direct multipart (<= 10 MB), 3-step presigned (<= 100 MB), 2-slot `useUploadQueue`, abort/retry, 409 `FILE_PENDING` backoff, `expo-sharing`. | [`files-upload-and-download.md`](./files-upload-and-download.md) |
| **`observability-and-headers`** | All routes | `X-Request-Id` and W3C `traceparent` injection, `ObservabilityPort` defect vs PII-safe breadcrumb routing, `SpyObservabilityAdapter.assertNoDefects()`. | [`observability-and-headers.md`](./observability-and-headers.md) |
