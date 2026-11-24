# Runtime Verification Feature Flows

Step-by-step verification procedures for the 5 core capability areas of `expo-open-api` (Expo SDK 58 · React Native 0.88 · Expo Router).

## Feature Flow Directory

| Feature Flow | Target Route(s) | Core Capabilities Verified | Guide |
| :----------- | :-------------- | :------------------------- | :---- |
| **`showcase-and-theming`** | `/(app)/showcase`, `/(app)` | Tri-layer theme mirroring (NativeWind, React Navigation, Web `document.documentElement`), WCAG AA tokens & `--scrim`, bundled `Quicksand`/`JetBrains Mono` fonts, `ThemeSwitcher`, shadow-compressing `TactilePressable`, rebuilt `Slider`, `<PortalHost />` overlays, top-anchored `ToastProvider`, zero-jump `useAppForm` + `FormScrollView`. | [`showcase-and-theming.md`](./showcase-and-theming.md) |
| **`auth-and-rbac`** | `/(auth)/login`, `/(auth)/register`, `/(app)` | Better Auth mobile client, `expo-secure-store` + synchronous `cachedBearerToken`, themed Layout Guards & single-header `<Tabs>` chrome (`>= 44×44pt` locked `Sign out`), zero-jump auth forms with focus chaining & password toggles, open-redirect blocking, `<Can />` RBAC, 401 vs 403 discipline. | [`auth-and-rbac.md`](./auth-and-rbac.md) |
| **`live-tasks`** | `/(app)/tasks` | Streaming SSE `/api/v1/tasks/live`, `useLiveQuery`, compact wrapping `LiveQueryBadge` strip, skeleton loading & pull-to-refresh, `["tasks", "mutation"]` optimistic updates & anti-clobber buffering, `AlertDialog` delete confirmations, visible mutation/`403` errors, `AppState`/`NetInfo` reconnect, MMKV cache. | [`live-tasks.md`](./live-tasks.md) |
| **`files-upload-and-download`** | `/(app)/files` | `useMobileFilePicker`, direct multipart (<= 10 MB), 3-step presigned (<= 100 MB), 2-slot `useUploadQueue`, shared `<Progress>` bars, visible `<Alert>` refresh/action errors, `AlertDialog` delete confirmations, 409 `FILE_PENDING` backoff, `expo-sharing`. | [`files-upload-and-download.md`](./files-upload-and-download.md) |
| **`observability-and-headers`** | All routes | `X-Request-Id` and W3C `traceparent` injection, `ObservabilityPort` defect vs PII-redacted breadcrumb routing, `SpyObservabilityAdapter.assertNoDefects()`. | [`observability-and-headers.md`](./observability-and-headers.md) |
