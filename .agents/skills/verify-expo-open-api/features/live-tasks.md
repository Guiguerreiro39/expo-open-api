# Verification Flow: Live Tasks & Realtime SSE (`live-tasks`)

Validates realtime Server-Sent Events synchronization via `useLiveQuery`, optimistic mutations, `["tasks", "mutation"]` microtask anti-clobber buffering, `AppState`/`NetInfo` lifecycle resilience, and MMKV offline cache persistence on `/(app)/tasks`.

---

## Automated Boundary Gate

```bash
pnpm test src/features/tasks/__tests__/ src/shared/lib/hooks/__tests__/ src/shared/storage/__tests__/query-persister.test.ts src/shared/ui/__tests__/live-query-badge.test.tsx
```

---

## Interactive / Paired Verification Steps

### 1. Streaming SSE Connection & `LiveQueryBadge`

1. Navigate to the **Tasks** tab (`/(app)/tasks`) as an authenticated user.
2. **Assertion**:
   - `useLiveQuery` opens `GET /api/v1/tasks/live` over streaming `expo/fetch` with `Authorization: Bearer <token>`, `Accept: text/event-stream`, `X-Request-Id`, and `traceparent` (never `?token=` in query params).
   - Incoming `event: init` and `event: update` payloads decode through Effect `GetApiV1Tasks200Response` and populate the TanStack Query cache (`staleTime: Infinity` while connected).
   - `LiveQueryBadge` transitions to `"Connected"`.

### 2. Optimistic Create, Toggle & Rollback

1. Create a new task from the Tasks form:
   - **Assertion**: An optimistic row (`optimistic-<uuid>`) appears immediately; once `POST /api/v1/tasks` returns `201`, the optimistic ID swaps seamlessly to the server UUID.
2. Toggle task completion and simulate a `500` server failure:
   - **Assertion**: UI rolls back to the prior state cleanly and reports a defect via `ObservabilityPort`.

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
