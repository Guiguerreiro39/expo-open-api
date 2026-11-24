# Verification Flow: Live Tasks & Realtime SSE (`live-tasks`)

Validates realtime Server-Sent Events synchronization via `useLiveQuery`, single-header compact status chrome, skeleton loading & pull-to-refresh, optimistic mutations, `["tasks", "mutation"]` microtask anti-clobber buffering, `AlertDialog` delete confirmation, visible mutation/`403` error feedback, `AppState`/`NetInfo` lifecycle resilience, and MMKV offline cache persistence on `/(app)/tasks`.

---

## Automated Boundary Gate

```bash
pnpm test src/features/tasks/__tests__/ src/shared/lib/hooks/__tests__/ src/shared/storage/__tests__/query-persister.test.ts src/shared/ui/__tests__/live-query-badge.test.tsx
```

---

## Interactive / Paired Verification Steps

### 1. Single-Header Status Strip, Streaming SSE & `LiveQueryBadge`

1. Navigate to the **Tasks** tab (`/(app)/tasks`) as an authenticated user.
2. **Assertion**:
   - No duplicate `"Tasks"` heading or redundant top `SafeAreaView` inset stacks below the `<Tabs>` header; a compact wrapping status strip houses task counts and `LiveQueryBadge` cleanly on 320–375px screens.
   - Initial loading renders `<Skeleton>` placeholders rather than plain loading text, and the task list supports pull-to-refresh and `keyboardDismissMode="on-drag"`.
   - `useLiveQuery` opens `GET /api/v1/tasks/live` over streaming `expo/fetch` with `Authorization: Bearer <token>`, `Accept: text/event-stream`, `X-Request-Id`, and `traceparent` (never `?token=` in query params).
   - Incoming `event: init` and `event: update` payloads decode through Effect `GetApiV1Tasks200Response` and populate the TanStack Query cache (`staleTime: Infinity` while connected), transitioning `LiveQueryBadge` to `"Connected"`.

### 2. Optimistic Create/Toggle, Delete Confirmation & Visible Error Feedback

1. Create a new task from the Tasks form:
   - **Assertion**: An optimistic row (`optimistic-<uuid>`) appears immediately; once `POST /api/v1/tasks` returns `201`, the optimistic ID swaps seamlessly to the server UUID. Filter pills wrap cleanly on narrow screens with constant preset border widths, completion toggles provide `>= 44×44pt` touch targets, and long unspaced titles truncate/wrap without pushing delete actions off-card.
2. Tap a task's delete button:
   - **Assertion**: An `<AlertDialog>` confirmation opens (`Cancel` / `Delete`); cancelling keeps the task intact, and confirming executes `DELETE /api/v1/tasks/{id}`.
3. Simulate a `403 Forbidden` or `500` server failure on create, toggle, or delete:
   - **Assertion**: Optimistic state rolls back cleanly AND a visible `<Alert>` / `<Toast>` error surfaces the failure to the user (`403` records a breadcrumb with zero defects; `500` reports a defect via `ObservabilityPort`).

### 3. Mutation Buffering & Anti-Clobber Merge

1. Trigger a task create/toggle mutation keyed under `["tasks", "mutation"]`.
2. While `queryClient.isMutating({ mutationKey: ["tasks", "mutation"] }) > 0`, deliver a peer SSE `update` frame that predates the new task:
   - **Assertion**: `useLiveQuery` holds the incoming snapshot in `bufferedSnapshotRef` rather than overwriting the cache mid-flight.
   - Once mutations settle, a `queueMicrotask` merges the buffered snapshot while preserving newly created server tasks (`!id.startsWith("optimistic-")`).

### 4. Mobile Lifecycle & Offline MMKV Persistence

1. Background the app (`AppState` -> `"background"`):
   - **Assertion**: Active SSE `AbortController` aborts cleanly to prevent battery drain.
2. Foreground the app (`AppState` -> `"active"`) or recover network via `NetInfo`:
   - **Assertion**: Backoff resets and SSE reconnects immediately.
3. Restart offline:
   - **Assertion**: Cached tasks hydrate from `KeyValueStorePort` (MMKV), while `["auth", "session"]` is strictly excluded from MMKV storage (`shouldDehydrateAppQuery`).
