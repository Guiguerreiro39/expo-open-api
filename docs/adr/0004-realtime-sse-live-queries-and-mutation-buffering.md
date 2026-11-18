---
status: accepted
date: 2026-11-18
decision-ticket: https://github.com/Guiguerreiro39/expo-open-api/issues/11
---

# Realtime SSE Live Queries, Native Reconnection, and Mutation Buffering

Mobile clients must synchronize query caches with backend server-sent events (`/api/v1/tasks/live`) without third-party native socket libraries, battery drain from background sockets, or race conditions during optimistic UI mutations. We decided to standardize on Expo SDK 52's built-in `expo/fetch` (WinterCG `ReadableStream`) paired with `eventsource-parser` over native `NSURLSession`/`OkHttp`, suspend active streams on `AppState` `'background'` / `'inactive'` transitions and reconnect on `'active'`, enforce exponential backoff with jitter and server `retry: <ms>` overrides, buffer incoming snapshots during active optimistic mutations flushed in `queueMicrotask`, decode event payloads with Effect Schemas routing drifts to `ObservabilityPort.captureDefect()`, and expose a superset of TanStack Query's `useQuery` return interface with streaming status telemetry (`liveStatus`, `streamError`, `lastPingAt`).

## Considered Options

- **`react-native-sse` Polyfill**: Relies on legacy `XMLHttpRequest` `onprogress` callbacks, suffers from known Android OkHttp chunk buffering quirks, introduces an unnecessary native dependency, and cannot leverage modern WinterCG streaming standards.
- **WebSocket Bi-Directional Transport**: Heavier protocol overhead requiring custom reconnection heartbeats, auth handshake frames, and distinct server infrastructure, whereas `hono-open-api` natively exposes HTTP/1.1 and HTTP/2 Server-Sent Events over standard HTTP endpoints (`/api/v1/tasks/live`).
- **Immediate Snapshot Application During Optimistic Mutations**: Merging server SSE snapshots immediately while `useMutation` is in flight causes optimistic UI flicker and duplicate item keys before temporary IDs (`optimistic-*`) are settled by the server response.
- **`expo/fetch` + `eventsource-parser` with AppState Suspension and Microtask Buffering (Chosen)**: Uses Expo SDK 52's native fetch streaming with zero additional native dependencies, injects `Authorization: Bearer` and W3C `traceparent` headers directly into the HTTP request, suspends connections on backgrounding to preserve battery and avoid dead sockets, buffers snapshots during `['tasks', 'mutation']` operations, and parses events with Effect Schema validation.

## Consequences

- `expo/fetch` is the required fetch runtime, leveraging iOS `NSURLSession` and Android `OkHttp` native streaming channels.
- `useLiveQuery` hooks hook into React Native's `AppState` listener, aborting the stream controller when backgrounded and initiating reconnection when returned to the foreground.
- Reconnection implements exponential backoff with random jitter (1s base delay up to 30s ceiling) and immediately reconnects when `NetInfo` signals network connectivity restoration.
- `bufferedSnapshotRef` holds incoming `init` and `update` snapshots whenever `queryClient.isMutating({ mutationKey: ['tasks', 'mutation'] }) > 0`. A microtask (`queueMicrotask`) scheduled upon mutation settlement applies the latest snapshot after `onSuccess` ID swaps have completed.
- Event payloads are decoded via Effect's `Schema.decodeUnknownEither`. Schema decoding failures are captured as defects via `ObservabilityPort.captureDefect()`, maintaining UI stability while alerting on API contract drift.
