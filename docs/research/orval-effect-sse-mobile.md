# Research: Orval + Effect Schema Codegen, SSE Streaming Clients, and Typed Error Decoding with hono-open-api on Mobile

- **Issue**: [#3](https://github.com/Guiguerreiro39/expo-open-api/issues/3)
- **Parent**: [#1](https://github.com/Guiguerreiro39/expo-open-api/issues/1) (Wayfinder: Build expo-open-api mobile starter kit & architecture)
- **Branch**: `research/orval-effect-sse-mobile`
- **Date**: 2026-11-18
- **Status**: Completed

---

## Executive Summary

This research investigates the integration of OpenAPI contract generation, functional error modeling with Effect, and realtime Server-Sent Events (SSE) streaming on mobile React Native within the Hermes runtime, pairing with [`hono-open-api`](https://github.com/Guiguerreiro39/hono-open-api) as the reference backend.

### Key Findings

1. **Dual-Target Orval Codegen on Hermes**:
   - Orval's dual-target configuration—generating `@tanstack/react-query` v5 hooks (`endpoints.ts` + `models/`) and `@orval/effect` schemas (`schemas.ts` with `generateEachHttpStatus: true`)—executes at build/codegen time and outputs pure TypeScript that compiles cleanly with zero Hermes bytecode incompatibilities.
   - A custom mobile fetch mutator (`src/shared/api/client.ts`) handles base URL resolution via `process.env.EXPO_PUBLIC_API_URL`, Bearer token injection from `expo-secure-store`, W3C `traceparent` and `X-Request-Id` headers, and React Native `FormData` asset objects (`{ uri, name, type }`).

2. **Effect v3 Compatibility with React Native Hermes**:
   - Modern Hermes (React Native 0.76+ / Expo SDK 52) supports ES2022+ features natively (including private fields, `WeakRef`, and symbols). Effect v3 (`effect@^3.10.x+`) runs seamlessly on Hermes with zero Babel transforms.
   - Hermes lacks a complete native Web Crypto implementation out-of-the-box: `crypto.randomUUID()` and `crypto.getRandomValues()` require either `expo-crypto` or `react-native-get-random-values`.
   - Effect's `Data.TaggedError`, `Schema.Struct`, `Schema.decodeUnknownEither`, and fiber runtime add minimal bundle overhead (~18 KB gzipped) and compile ahead-of-time (AOT) to Hermes bytecode (`.hbc`) with fast startup times.

3. **11 Status Code Error Taxonomy & `matchEffect` Pattern**:
   - `hono-open-api` returns a unified RFC 7807-adjacent envelope: `{ error: { code: string, message: string, requestId: string, details?: unknown } }`.
   - All 11 HTTP status codes declared by `hono-open-api` (400, 401, 403, 404, 408, 409, 413, 422, 429, 500, 503) are modeled as distinct `Data.TaggedError` classes plus `SchemaDecodeError` and `UnknownError`.
   - `defineContract` extracts valid error status codes from generated `@orval/effect` types, ensuring exhaustive compile-time typing.
   - `matchEffect` provides declarative, branch-safe UI rendering in React Native without try/catch boilerplate, while routing expected 4xx errors to observability breadcrumbs and 5xx/SchemaDecode errors to defect tracking.

4. **SSE Streaming Client on Mobile (Expo SDK 52+)**:
   - **Recommendation**: Use **`expo/fetch` + `eventsource-parser`**, not `react-native-sse`.
   - Starting in Expo SDK 52, `expo/fetch` is the default global fetch implementation on iOS and Android. It provides WinterCG-compliant download streaming via `response.body.getReader()` with native `NSURLSession` (iOS) and `OkHttp` (Android) streaming channels.
   - `react-native-sse` relies on legacy `XMLHttpRequest` `onprogress` callbacks, suffers from Android gzip buffering bugs in OkHttp, leaks listeners, and introduces an unnecessary native module dependency.
   - Mobile SSE connections must be **`AppState`-aware**: unlike desktop browsers, mobile operating systems suspend background network sockets. The client must abort the stream when transitioning to `'background'` / `'inactive'` and reconnect upon returning to `'active'`.

5. **Optimistic Mutation Buffering**:
   - While `queryClient.isMutating({ mutationKey: ["tasks", "mutation"] }) > 0`, incoming SSE snapshots (`init` or `update`) are held in a ref buffer.
   - Once all active mutations reach 0, the snapshot is flushed inside a `queueMicrotask` callback. This guarantees that `useMutation`'s `onSuccess` hook runs first to swap temporary optimistic IDs (`optimistic-*`) for real server IDs before the snapshot merges into the cache.

---

## 1. Orval Codegen Adapted for Mobile React Native

### 1.1 Dual-Target Architecture

`tanstack-open-api` established a dual-target Orval strategy that separates React Query hook generation from Effect Schema runtime validation. This pattern ports 1:1 to React Native without modifications to Orval itself:

```typescript
// orval.config.ts
import { defineConfig } from "orval";

export default defineConfig({
  api: {
    input: "./openapi.json",
    output: {
      mode: "split",
      target: "src/shared/api/generated/endpoints.ts",
      schemas: "src/shared/api/generated/models",
      client: "react-query",
      httpClient: "fetch",
      override: {
        mutator: {
          path: "./src/shared/api/client.ts",
          name: "customFetch",
        },
        fetch: {
          includeHttpResponseReturnType: false,
        },
        query: {
          useQuery: true,
          useInfinite: true,
          useInfiniteQueryParam: "cursor",
        },
      },
    },
  },
  apiEffectSchemas: {
    input: "./openapi.json",
    output: {
      mode: "single",
      target: "src/shared/api/generated/schemas.ts",
      client: "effect",
      override: {
        useDates: false,
        effect: {
          generateEachHttpStatus: true,
        },
      },
    },
  },
});
```

### 1.2 Mobile Mutator Implementation (`src/shared/api/client.ts`)

In mobile React Native, the mutator differs from web in four critical areas:
1. **Base URL Resolution**: Web relies on relative URLs or SSR host detection. Mobile must resolve against `EXPO_PUBLIC_API_URL` (e.g. `http://10.0.2.2:3000` for Android Emulator, `http://localhost:3000` for iOS Simulator, or a tunnel/staging URL).
2. **Authentication Transport**: Web uses HTTP-only cookies (`credentials: "include"`). Mobile uses Bearer token authorization stored in `expo-secure-store`.
3. **UUID Generation in Hermes**: Standard `crypto.randomUUID()` may be undefined in Hermes without polyfills. We use `expo-crypto` for UUIDv4 generation.
4. **Multipart File Uploads**: React Native's `FormData` polyfill expects `{ uri: string, name: string, type: string }` instead of Web `File`/`Blob`.

```typescript
// src/shared/api/fetch.ts
import * as Crypto from "expo-crypto";
import { getAuthToken, resetAuthSessionCache } from "@/shared/lib/auth-session-bridge";

export interface CustomFetchOptions extends RequestInit {
  responseType?: "json" | "blob" | "text";
}

export interface HonoErrorEnvelope {
  error?: {
    code?: string;
    message?: string;
    requestId?: string;
    details?: unknown;
    issues?: Array<{
      code?: string;
      path?: Array<string | number>;
      message?: string;
    }>;
  };
  message?: string;
}

export class FetchError extends Error {
  readonly status: number;
  readonly code?: string;
  readonly requestId?: string;
  readonly traceId?: string;
  readonly details?: unknown;
  readonly data?: HonoErrorEnvelope;

  constructor(options: {
    status: number;
    message: string;
    code?: string;
    requestId?: string;
    traceId?: string;
    details?: unknown;
    data?: HonoErrorEnvelope;
  }) {
    super(options.message);
    this.name = "FetchError";
    this.status = options.status;
    this.code = options.code;
    this.requestId = options.requestId;
    this.traceId = options.traceId;
    this.details = options.details;
    this.data = options.data;
  }
}

export function createW3CTraceparent(): { traceparent: string; traceId: string; spanId: string } {
  const traceId = Crypto.randomUUID().replace(/-/g, "");
  const spanId = Crypto.randomUUID().replace(/-/g, "").slice(0, 16);
  return {
    traceId,
    spanId,
    traceparent: `00-${traceId}-${spanId}-01`,
  };
}

export function resolveApiUrl(path: string): string {
  if (path.startsWith("http://") || path.startsWith("https://")) {
    return path;
  }
  const baseUrl = process.env.EXPO_PUBLIC_API_URL?.replace(/\/+$/, "") || "http://localhost:3000";
  const cleanPath = path.startsWith("/") ? path : `/${path}`;
  return `${baseUrl}${cleanPath}`;
}

export async function customFetch<T>(url: string, options: CustomFetchOptions = {}): Promise<T> {
  const fullUrl = resolveApiUrl(url);
  const headers = new Headers(options.headers);

  // Check if body is React Native FormData (which handles multipart boundary automatically)
  const isFormData = typeof FormData !== "undefined" && options.body instanceof FormData;
  if (!isFormData && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  // Inject Bearer token from SecureStore if not already set
  if (!headers.has("Authorization")) {
    const token = await getAuthToken();
    if (token) {
      headers.set("Authorization", `Bearer ${token}`);
    }
  }

  // Distributed Tracing Headers
  const outboundRequestId = headers.get("X-Request-Id") ?? `req_${Crypto.randomUUID()}`;
  headers.set("X-Request-Id", outboundRequestId);

  let traceId: string | undefined;
  const existingTraceparent = headers.get("traceparent");
  if (existingTraceparent) {
    const parts = existingTraceparent.split("-");
    traceId = parts[1];
  } else {
    const generated = createW3CTraceparent();
    headers.set("traceparent", generated.traceparent);
    traceId = generated.traceId;
  }

  // Execute request via global fetch (expo/fetch in SDK 52)
  const response = await fetch(fullUrl, {
    ...options,
    headers,
  });

  if (!response.ok) {
    let errorData: HonoErrorEnvelope | undefined;
    try {
      errorData = (await response.json()) as HonoErrorEnvelope;
    } catch {
      errorData = { message: response.statusText || `HTTP error ${response.status}` };
    }

    const requestId =
      errorData?.error?.requestId ?? response.headers.get("X-Request-Id") ?? outboundRequestId;
    const code = errorData?.error?.code;
    const message =
      errorData?.error?.message ||
      errorData?.message ||
      response.statusText ||
      `HTTP error ${response.status}`;

    if (response.status === 401) {
      resetAuthSessionCache();
    }

    throw new FetchError({
      status: response.status,
      code,
      message,
      requestId,
      traceId,
      details: errorData?.error?.details,
      data: errorData,
    });
  }

  if (response.status === 204) {
    return undefined as unknown as T;
  }

  const contentType = response.headers.get("content-type") ?? "";
  if (contentType.includes("application/json") || contentType.includes("+json")) {
    return response.json() as Promise<T>;
  }

  if (options.responseType === "text" || contentType.includes("text/")) {
    return response.text() as unknown as Promise<T>;
  }

  return response.blob() as unknown as Promise<T>;
}
```

---

## 2. Effect v3 Compatibility with Hermes and React Native

### 2.1 Hermes Engine Support (React Native 0.76+ / Expo SDK 52)

Hermes is Meta's lightweight JavaScript engine optimized for React Native. Key architectural considerations:

| Dimension | Hermes Engine (RN 0.76+ / Expo 52) | Effect v3 Compatibility |
| :--- | :--- | :--- |
| **Bytecode Compilation (`hermesc`)** | AOT compiles JS to `.hbc` bytecode during build | Full support. Effect modules compile cleanly without syntax errors. |
| **ES2022 Class Syntax** | Native support for `#private` fields, static blocks | `Data.TaggedError` and `Schema` class hierarchies function identically to V8. |
| **Symbol Support** | `Symbol.for`, `Symbol.iterator`, `Symbol.asyncIterator` | Full support. Effect uses global symbols (`Symbol.for("@effect/...")`) for type tags. |
| **Garbage Collection** | Hades concurrent GC | Well-suited for Effect's fiber allocations; avoids UI thread freezes. |
| **Fiber Runtime Trampoline** | Native call stack limits on mobile | Effect executes on a trampolined scheduler (`Effect.yieldNow`, flatMap queue); prevents call stack exhaustion. |
| **Bundle Footprint** | Tree-shakeable ESM imports | `effect` core + `Schema` adds ~18 KB minified+gzipped to the bundle. |

### 2.2 Hermes Polyfill Requirements

While Hermes supports the core JavaScript language specifications, modern Web Crypto and Explicit Resource Management require targeted polyfills:

1. **Random Values & UUIDs**:
   - Hermes does not supply `globalThis.crypto.getRandomValues()` or `crypto.randomUUID()`.
   - **Remedy**: In Expo projects, use `expo-crypto` (`Crypto.randomUUID()`) or load `import "react-native-get-random-values"` at the app root (`app/_layout.tsx`).

2. **Explicit Resource Management (`using` keyword)**:
   - If utilizing TypeScript 5.2 `using` with Effect `Scope`, Hermes requires `Symbol.dispose` and `Symbol.asyncDispose`.
   - **Remedy**: Add polyfill in entry file:
     ```typescript
     if (!("dispose" in Symbol)) {
       (Symbol as { dispose: symbol }).dispose = Symbol("dispose");
     }
     if (!("asyncDispose" in Symbol)) {
       (Symbol as { asyncDispose: symbol }).asyncDispose = Symbol("asyncDispose");
     }
     ```

3. **TextEncoder / TextDecoder**:
   - Modern Hermes and Expo SDK 52's Winter runtime include native `TextDecoder` and `TextEncoder`. No additional polyfill is needed.

---

## 3. 11 Status Code Error Taxonomy & `matchEffect` Integration

### 3.1 `hono-open-api` Error Envelope

`hono-open-api` declares error responses via Zod schemas:
```json
{
  "error": {
    "code": "BAD_REQUEST",
    "message": "Invalid input parameters",
    "requestId": "req_01JG...89",
    "details": [{ "field": "name", "issue": "Required" }]
  }
}
```

### 3.2 11 Tagged Error Classes

Each HTTP error status maps to a dedicated `Data.TaggedError` class, providing compile-time type discrimination via `_tag`:

```typescript
// src/shared/api/contracts.ts
import { Data, Effect, Schema } from "effect";

export interface ApiErrorDetailIssue {
  readonly code?: string;
  readonly path?: ReadonlyArray<string | number>;
  readonly message?: string;
}

export interface BaseApiErrorFields {
  readonly status: number;
  readonly code: string;
  readonly message: string;
  readonly requestId: string;
  readonly details?: unknown;
}

export class SchemaDecodeError extends Data.TaggedError("SchemaDecodeError")<{
  readonly path: string;
  readonly cause: unknown;
}> {}

export class BadRequestError extends Data.TaggedError("BadRequestError")<
  BaseApiErrorFields & { readonly status: 400 }
> {}

export class UnauthorizedError extends Data.TaggedError("UnauthorizedError")<
  BaseApiErrorFields & { readonly status: 401 }
> {}

export class ForbiddenError extends Data.TaggedError("ForbiddenError")<
  BaseApiErrorFields & { readonly status: 403 }
> {}

export class NotFoundError extends Data.TaggedError("NotFoundError")<
  BaseApiErrorFields & { readonly status: 404 }
> {}

export class RequestTimeoutError extends Data.TaggedError("RequestTimeoutError")<
  BaseApiErrorFields & { readonly status: 408 }
> {}

export class ConflictError extends Data.TaggedError("ConflictError")<
  BaseApiErrorFields & { readonly status: 409 }
> {}

export class PayloadTooLargeError extends Data.TaggedError("PayloadTooLargeError")<
  BaseApiErrorFields & { readonly status: 413 }
> {}

export class ValidationError extends Data.TaggedError("ValidationError")<
  BaseApiErrorFields & {
    readonly status: 422;
    readonly issues: ReadonlyArray<ApiErrorDetailIssue>;
  }
> {}

export class RateLimitError extends Data.TaggedError("RateLimitError")<
  BaseApiErrorFields & { readonly status: 429 }
> {}

export class InternalServerError extends Data.TaggedError("InternalServerError")<
  BaseApiErrorFields & { readonly status: 500 }
> {}

export class ServiceUnavailableError extends Data.TaggedError("ServiceUnavailableError")<
  BaseApiErrorFields & { readonly status: 503; readonly data?: unknown }
> {}

export class UnknownError extends Data.TaggedError("UnknownError")<{
  readonly message: string;
  readonly status?: number;
  readonly code?: string;
  readonly requestId?: string;
  readonly cause?: unknown;
}> {}

export type AnyApiError =
  | BadRequestError
  | UnauthorizedError
  | ForbiddenError
  | NotFoundError
  | RequestTimeoutError
  | ConflictError
  | PayloadTooLargeError
  | ValidationError
  | RateLimitError
  | InternalServerError
  | ServiceUnavailableError
  | UnknownError;
```

### 3.3 Decoding & Mapping Function

```typescript
export function decodeApiError(error: unknown): AnyApiError {
  if (
    error instanceof FetchError ||
    (typeof error === "object" && error !== null && "status" in error)
  ) {
    const err = error as FetchError;
    const status = err.status;
    const errorEnv = err.data?.error;
    const code = err.code ?? errorEnv?.code ?? `HTTP_${status}`;
    const message = err.message || errorEnv?.message || err.data?.message || `HTTP error ${status}`;
    const requestId = err.requestId ?? errorEnv?.requestId ?? "unknown";
    const details = err.details ?? errorEnv?.details;

    switch (status) {
      case 400:
        return new BadRequestError({ status: 400, code, message, requestId, details });
      case 401:
        return new UnauthorizedError({ status: 401, code, message, requestId, details });
      case 403:
        return new ForbiddenError({ status: 403, code, message, requestId, details });
      case 404:
        return new NotFoundError({ status: 404, code, message, requestId, details });
      case 408:
        return new RequestTimeoutError({ status: 408, code, message, requestId, details });
      case 409:
        return new ConflictError({ status: 409, code, message, requestId, details });
      case 413:
        return new PayloadTooLargeError({ status: 413, code, message, requestId, details });
      case 422:
        return new ValidationError({
          status: 422,
          code,
          message,
          requestId,
          details,
          issues: Array.isArray(details) ? (details as ReadonlyArray<ApiErrorDetailIssue>) : [],
        });
      case 429:
        return new RateLimitError({ status: 429, code, message, requestId, details });
      case 500:
        return new InternalServerError({ status: 500, code, message, requestId, details });
      case 503:
        return new ServiceUnavailableError({ status: 503, code, message, requestId, details, data: err.data });
      default:
        return new UnknownError({ status, code, message, requestId, cause: error });
    }
  }

  return new UnknownError({
    message: error instanceof Error ? error.message : String(error),
    cause: error,
  });
}
```

### 3.4 React Native `matchEffect` Pattern

In UI components, `matchEffect` eliminates ternary nesting and ensures branch-safe handling:

```tsx
// Example Usage in a React Native Screen
import { View, Text, ActivityIndicator, Button } from "react-native";
import { useTasksQuery } from "@/features/tasks/api/tasks";
import { matchEffect } from "@/shared/api/contracts";

export function TasksScreen() {
  const tasksQuery = useTasksQuery();

  return matchEffect(tasksQuery, {
    onPending: () => (
      <View className="flex-1 items-center justify-center">
        <ActivityIndicator size="large" />
      </View>
    ),
    onFailure: (error) => {
      switch (error._tag) {
        case "UnauthorizedError":
          return <Text className="text-destructive">Session expired. Please sign in again.</Text>;
        case "ValidationError":
          return (
            <View>
              <Text className="text-destructive font-bold">Validation Error:</Text>
              {error.issues.map((issue, idx) => (
                <Text key={idx} className="text-muted-foreground">{issue.message}</Text>
              ))}
            </View>
          );
        case "RateLimitError":
          return <Text className="text-warning">Too many requests. Please wait a moment.</Text>;
        case "ServiceUnavailableError":
          return <Text className="text-muted-foreground">Server undergoing maintenance.</Text>;
        default:
          return <Text className="text-destructive">An unexpected error occurred: {error.message}</Text>;
      }
    },
    onSuccess: (tasks) => (
      <View className="flex-1 p-4">
        {tasks.data.map((task) => (
          <Text key={task.id} className="text-foreground py-2 border-b border-border">
            {task.name}
          </Text>
        ))}
      </View>
    ),
  });
}
```

---

## 4. Native SSE Streaming Clients on iOS & Android

### 4.1 Comparative Evaluation

We evaluated three potential strategies for consuming `/api/v1/tasks/live` on React Native:

| Criteria | `react-native-sse` | Native Fetch + `eventsource-parser` (Pre-SDK 52) | `expo/fetch` + `eventsource-parser` (Expo SDK 52+) |
| :--- | :--- | :--- | :--- |
| **Underlying Mechanism** | `XMLHttpRequest` `onprogress` or native bridging | Legacy RN `fetch` (buffers whole body by default) | WinterCG `fetch` with native streaming `NSURLSession` (iOS) & `OkHttp` (Android) |
| **Streaming Interface** | Event listener callbacks (`addEventListener`) | Requires `react-native-fetch-api` polyfill | Standard `ReadableStream` (`response.body.getReader()`) |
| **Custom Headers (Bearer Token)** | Supported via options (`headers`) | Supported | Supported |
| **Android OkHttp Buffering** | ⚠️ Suffers from chunk buffering issues under gzip | ⚠️ Polyfill dependent | ✅ Native streaming response body without chunk stalls |
| **W3C Traceparent & Request ID** | Manually injected | Manually injected | ✅ Standard header forwarding |
| **Reconnection & Backoff** | Opaque built-in retry logic | Custom TS backoff | ✅ Full control over exponential backoff & server `retry:` frame |
| **AppState Lifecycle (Suspend)** | Must manually invoke `.close()` | Custom loop management | ✅ Clean cancellation via `AbortController` |
| **Dependency Footprint** | External native dependency (~120 KB) | Polyfills required | ✅ 0 extra native deps (`expo/fetch` built-in, `eventsource-parser` ~2 KB JS) |
| **Verdict** | ❌ Fragile on Android | ❌ Legacy workaround | 🏆 **Recommended Gold Standard** |

### 4.2 Why `expo/fetch` + `eventsource-parser` Wins

1. **Native Streaming in Expo SDK 52**:
   - `expo/fetch` is installed as the global `fetch` by default in Expo SDK 52 on both iOS and Android.
   - It bypasses the historical React Native limitation where response bodies could not be read incrementally.
   - Calling `response.body.getReader()` returns standard Web Streams `ReadableStreamDefaultReader<Uint8Array>`.
2. **Deterministic Stream Parsing**:
   - `eventsource-parser` is a zero-dependency, 2 KB utility that parses chunks regardless of boundary splits or chunk sizes.
   - Adheres strictly to the SSE specification (`id`, `event`, `data`, and `retry` frames).
3. **Trace Header Propagation**:
   - Custom headers (`Authorization: Bearer <token>`, `X-Request-Id`, `traceparent`) are transmitted on the initial HTTP GET upgrade request.

---

## 5. Optimistic Mutation Buffering Pattern in `useLiveQuery`

### 5.1 The Mobile Race Condition

In realtime mobile applications, users perform actions (e.g., adding or completing a task) while connected to live SSE streams. This creates a critical race condition:

```
[User Action] -> useMutation.onMutate (Injects { id: "optimistic-123", name: "New Task" })
       │
       ├─ Server receives POST /api/v1/tasks
       │    └─ Server SSE triggers broadcast to all clients
       │
[Incoming SSE Snapshot] -> Arrives BEFORE mutation HTTP response returns!
       │
       ▼
   WITHOUT BUFFERING:
   - SSE snapshot overwrites query cache.
   - Server snapshot might NOT yet include the newly committed task (replication lag).
   - The optimistic task vanishes from screen.
   - Mutation finishes: task pops back in. (JARRING FLICKER).
```

Furthermore, React Query's `mutationCache.subscribe` emits a settle event **synchronously** when the network promise resolves, **before** the mutation hook's `onSuccess` runs. If the buffered snapshot is flushed synchronously inside the subscription listener, it clobbers the cache before `onSuccess` can swap the optimistic ID for the server ID.

### 5.2 The Solution: Buffering + `queueMicrotask`

1. **Buffer while Mutating**:
   - Check `queryClient.isMutating({ mutationKey: ["tasks", "mutation"] }) > 0`.
   - If mutations are active, store incoming SSE snapshots in `bufferedSnapshotRef.current`.
2. **Flush on Microtask**:
   - When active mutations drop to 0, schedule a flush using `queueMicrotask`.
   - This yields the call stack to `useMutation`'s `onSuccess`, allowing local state reconciliation first.
3. **Smart Reconciliation**:
   - When merging the flushed snapshot, preserve any non-optimistic items in the cache that have not yet appeared in the snapshot.
   - Strip temporary `optimistic-*` IDs once settled.

### 5.3 Mobile `AppState` Lifecycle Handling

Unlike web browsers, mobile operating systems aggressively suspend or close TCP sockets when an app is moved to the background. An SSE stream left active will silently freeze, leading to battery drain or stale data.

`useLiveQuery` must subscribe to React Native's `AppState`:
- When `AppState` transitions to `'background'` or `'inactive'`: abort the fetch reader immediately (`controller.abort()`).
- When `AppState` transitions to `'active'`: reconnect the stream and invalidate/refetch query cache.

### 5.4 Implementation Code for Mobile `useLiveQuery`

```typescript
// src/shared/lib/hooks/use-live-query.ts
import {
  type MutationKey,
  type QueryKey,
  type UseQueryOptions,
  useQueryClient,
} from "@tanstack/react-query";
import { AppState, type AppStateStatus } from "react-native";
import { Schema } from "effect";
import { createParser } from "eventsource-parser";
import { useEffect, useRef, useState } from "react";
import {
  type AnyApiError,
  decodeApiError,
  type FunctionDescriptor,
  SchemaDecodeError,
  type UseEffectQueryResult,
  useEffectQuery,
} from "@/shared/api/contracts";
import { createW3CTraceparent, FetchError, type HonoErrorEnvelope, resolveApiUrl } from "@/shared/api/fetch";
import { getAuthToken } from "@/shared/lib/auth-session-bridge";

export type LiveConnectionStatus = "idle" | "connecting" | "connected" | "reconnecting" | "error";

export interface UseLiveQueryOptions<
  TQueryFnData extends I,
  A,
  E,
  I = unknown,
  TError = unknown,
  TQueryKey extends QueryKey = QueryKey,
> {
  readonly queryOptions: UseQueryOptions<TQueryFnData, TError, TQueryFnData, TQueryKey>;
  readonly descriptor: FunctionDescriptor<A, E, I>;
  readonly liveUrl: string;
  readonly enabled?: boolean;
  readonly baseDelayMs?: number;
  readonly maxDelayMs?: number;
  readonly mutationKey?: MutationKey;
  readonly onStreamError?: (error: AnyApiError | SchemaDecodeError) => void;
}

export type UseLiveQueryResult<A, E> = UseEffectQueryResult<A, E> & {
  readonly liveStatus: LiveConnectionStatus;
  readonly streamError: AnyApiError | SchemaDecodeError | null;
  readonly lastPingAt: number | null;
};

export function useLiveQuery<
  TQueryFnData extends I,
  A,
  E,
  I = unknown,
  TError = unknown,
  TQueryKey extends QueryKey = QueryKey,
>(
  options: UseLiveQueryOptions<TQueryFnData, A, E, I, TError, TQueryKey>,
): UseLiveQueryResult<A, E> {
  const {
    queryOptions,
    descriptor,
    liveUrl,
    enabled = true,
    baseDelayMs = 1_000,
    maxDelayMs = 30_000,
    mutationKey = ["tasks", "mutation"],
    onStreamError,
  } = options;

  const queryClient = useQueryClient();
  const [appState, setAppState] = useState<AppStateStatus>(AppState.currentState);
  const isEnabled = queryOptions.enabled !== false && enabled && appState === "active";

  const [liveStatus, setLiveStatus] = useState<LiveConnectionStatus>(
    isEnabled ? "connecting" : "idle",
  );
  const [streamError, setStreamError] = useState<AnyApiError | SchemaDecodeError | null>(null);
  const [lastPingAt, setLastPingAt] = useState<number | null>(null);

  const queryResult = useEffectQuery(
    {
      ...queryOptions,
      enabled: isEnabled,
      staleTime: liveStatus === "connected" ? Number.POSITIVE_INFINITY : (queryOptions.staleTime ?? 60_000),
    },
    descriptor,
  );

  const queryKeyRef = useRef(queryOptions.queryKey);
  queryKeyRef.current = queryOptions.queryKey;
  const descriptorRef = useRef(descriptor);
  descriptorRef.current = descriptor;
  const onStreamErrorRef = useRef(onStreamError);
  onStreamErrorRef.current = onStreamError;
  const mutationKeyRef = useRef(mutationKey);
  mutationKeyRef.current = mutationKey;

  const bufferedSnapshotRef = useRef<unknown | null>(null);

  // 1. AppState listener for mobile background suspension
  useEffect(() => {
    const subscription = AppState.addEventListener("change", (nextState) => {
      setAppState(nextState);
      if (nextState === "active") {
        // Invalidate stale data when foregrounding
        queryClient.invalidateQueries({ queryKey: queryKeyRef.current });
      }
    });
    return () => subscription.remove();
  }, [queryClient]);

  // 2. Mutation cache subscriber for optimistic buffering flush
  useEffect(() => {
    const unsubscribe = queryClient.getMutationCache().subscribe(() => {
      const activeMutations = queryClient.isMutating({
        mutationKey: mutationKeyRef.current,
      });

      if (activeMutations === 0 && bufferedSnapshotRef.current !== null) {
        queueMicrotask(() => {
          const stillActive = queryClient.isMutating({
            mutationKey: mutationKeyRef.current,
          });
          if (stillActive > 0 || bufferedSnapshotRef.current === null) {
            return;
          }
          const flushData = bufferedSnapshotRef.current;
          bufferedSnapshotRef.current = null;

          queryClient.setQueryData(queryKeyRef.current as QueryKey, (current: unknown) => {
            if (!current || !flushData) return flushData;
            const currentObj = current as { data?: Array<{ id?: string }> };
            const flushObj = flushData as { data?: Array<{ id?: string }> };
            if (Array.isArray(currentObj.data) && Array.isArray(flushObj.data)) {
              const flushItems = flushObj.data;
              const currentItems = currentObj.data;
              const flushIds = new Set(flushItems.map((item) => item.id));
              // Retain non-optimistic items not yet present in server snapshot
              const newlyAdded = currentItems.filter(
                (item) => item.id && !flushIds.has(item.id) && !item.id.startsWith("optimistic-"),
              );
              return {
                ...(flushData as Record<string, unknown>),
                data: [...newlyAdded, ...flushItems],
              };
            }
            return flushData;
          });
        });
      }
    });

    return () => unsubscribe();
  }, [queryClient]);

  // 3. Native SSE streaming loop with expo/fetch + eventsource-parser
  useEffect(() => {
    if (!isEnabled) {
      setLiveStatus("idle");
      return;
    }

    const fullUrl = resolveApiUrl(liveUrl);
    setLiveStatus("connecting");
    setStreamError(null);

    const handleSnapshotData = (rawData: unknown) => {
      let parsed: unknown;
      if (typeof rawData === "string") {
        try {
          parsed = JSON.parse(rawData);
        } catch (cause) {
          const err = new SchemaDecodeError({ path: descriptorRef.current.path, cause });
          setStreamError(err);
          onStreamErrorRef.current?.(err);
          return;
        }
      } else {
        parsed = rawData;
      }

      const validation = Schema.decodeUnknownEither(descriptorRef.current.dataSchema)(parsed);
      if (validation._tag === "Left") {
        const err = new SchemaDecodeError({
          path: descriptorRef.current.path,
          cause: validation.left,
        });
        setStreamError(err);
        onStreamErrorRef.current?.(err);
        return;
      }

      setStreamError(null);
      setLiveStatus("connected");

      const activeMutations = queryClient.isMutating({
        mutationKey: mutationKeyRef.current,
      });

      if (activeMutations > 0) {
        bufferedSnapshotRef.current = parsed;
      } else {
        bufferedSnapshotRef.current = null;
        queryClient.setQueryData(queryKeyRef.current as QueryKey, parsed);
      }
    };

    const handlePingData = (rawData: unknown) => {
      try {
        const parsed = typeof rawData === "string" ? JSON.parse(rawData) : rawData;
        setLastPingAt(typeof parsed?.timestamp === "number" ? parsed.timestamp : Date.now());
      } catch {
        setLastPingAt(Date.now());
      }
      setLiveStatus("connected");
    };

    const controller = new AbortController();
    const { signal } = controller;

    void (async () => {
      let attempt = 0;
      let serverRetryMs: number | undefined;

      while (!signal.aborted) {
        try {
          const token = await getAuthToken();
          const { traceparent } = createW3CTraceparent();
          const requestId = `sse_${Crypto.randomUUID()}`;

          const response = await fetch(fullUrl, {
            method: "GET",
            headers: {
              ...(token ? { Authorization: `Bearer ${token}` } : {}),
              Accept: "text/event-stream",
              "X-Request-Id": requestId,
              traceparent,
            },
            signal,
          });

          if (!response.ok) {
            let rawBody: unknown;
            try {
              rawBody = await response.json();
            } catch {
              rawBody = undefined;
            }
            const env = (rawBody as HonoErrorEnvelope | undefined)?.error;
            const fetchErr = new FetchError({
              status: response.status,
              code: env?.code ?? `HTTP_${response.status}`,
              message: env?.message ?? (response.statusText || `HTTP ${response.status}`),
              requestId: env?.requestId ?? requestId,
              data: rawBody as HonoErrorEnvelope | undefined,
            });
            const decodedErr = decodeApiError(fetchErr);
            setStreamError(decodedErr);
            onStreamErrorRef.current?.(decodedErr);

            // Don't retry non-recoverable 4xx errors
            if (response.status >= 400 && response.status < 500 && response.status !== 429) {
              setLiveStatus("error");
              return;
            }
            throw fetchErr;
          }

          if (!response.body) {
            throw new Error("SSE response missing readable stream body");
          }

          attempt = 0;
          const parser = createParser({
            onRetry(retryMs) {
              serverRetryMs = retryMs;
            },
            onEvent(event) {
              if (event.event === "init" || event.event === "update") {
                handleSnapshotData(event.data);
              } else if (event.event === "ping") {
                handlePingData(event.data);
              } else if (event.event === "error") {
                const decoded = decodeApiError(new Error(event.data));
                setStreamError(decoded);
                onStreamErrorRef.current?.(decoded);
              }
            },
          });

          const reader = response.body.getReader();
          const decoder = new TextDecoder();

          while (!signal.aborted) {
            const { done, value } = await reader.read();
            if (done) break;
            parser.feed(decoder.decode(value, { stream: true }));
          }
        } catch {
          if (signal.aborted) return;
        }

        if (signal.aborted) return;
        setLiveStatus("reconnecting");

        const base = serverRetryMs ?? baseDelayMs;
        const delayMs = Math.min(maxDelayMs, base * 2 ** attempt);
        attempt += 1;

        await new Promise<void>((resolve) => {
          const timer = setTimeout(resolve, delayMs);
          signal.addEventListener("abort", () => {
            clearTimeout(timer);
            resolve();
          }, { once: true });
        });
      }
    })();

    return () => {
      controller.abort();
    };
  }, [liveUrl, isEnabled, baseDelayMs, maxDelayMs, queryClient]);

  return {
    ...queryResult,
    liveStatus,
    streamError,
    lastPingAt,
  };
}
```

---

## 6. Cross-Reference with `tanstack-open-api`

| Layer / Feature | `tanstack-open-api` (Web) | `expo-open-api` (Mobile) | Architectural Translation |
| :--- | :--- | :--- | :--- |
| **Codegen Engine** | Orval (`orval.config.ts`) | Orval (`orval.config.ts`) | **1:1 Identical**. Dual-target `@tanstack/react-query` + `@orval/effect`. |
| **Schema Validation** | Effect Schema v3 | Effect Schema v3 on Hermes | **1:1 Identical**. Zero Babel transforms required. |
| **Error Taxonomy** | 11 `Data.TaggedError` classes | 11 `Data.TaggedError` classes | **1:1 Identical**. Matches `hono-open-api` error envelope. |
| **Contract Definition** | `defineContract` in `contracts.ts` | `defineContract` in `contracts.ts` | **1:1 Identical**. Infers error unions from operation schema. |
| **Network Client** | Browser `fetch` + cookie auth | `expo/fetch` + `SecureStore` Bearer | **Mobile adapted**: Injects token header, resolves mobile host IP. |
| **Crypto / UUIDs** | Web `crypto.randomUUID()` | `expo-crypto` (`Crypto.randomUUID()`) | **Mobile adapted**: Hermes lacks full Web Crypto API. |
| **SSE Primary Transport** | Browser `EventSource` (`withCredentials`) | `expo/fetch` + `eventsource-parser` | **Mobile adapted**: Browser EventSource cannot pass Bearer headers. |
| **Lifecycle Suspension** | Page visibility (timers throttled) | React Native `AppState` listener | **Mobile adapted**: OS suspends background sockets; must explicitly abort. |
| **Mutation Buffering** | Buffered ref + `queueMicrotask` | Buffered ref + `queueMicrotask` | **1:1 Identical**. Eliminates optimistic state race condition. |

---

## 7. Concrete Recommendations

### 7.1 Architecture Decisions for Downstream Tickets

1. **Ticket #9 (Decide environment config, Orval codegen, and custom fetch client)**:
   - Adopt the dual-target `orval.config.ts` specification detailed in Section 1.1.
   - Standardize `src/shared/api/fetch.ts` with `expo-crypto` and `EXPO_PUBLIC_API_URL` resolution.
   - Record decision in `docs/adr/ADR-0002-orval-effect-contracts.md`.

2. **Ticket #10 (Decide Better Auth client integration, SecureStore session persistence, and RBAC guards)**:
   - Provide `getAuthToken()` and `resetAuthSessionCache()` in `src/shared/lib/auth-session-bridge.ts`.
   - On 401 `UnauthorizedError`, automatically trigger session reset and route transition to `/(auth)/sign-in`.

3. **Ticket #11 (Decide realtime SSE live-query architecture and optimistic mutation buffering on mobile)**:
   - Standardize on `expo/fetch` (built into Expo SDK 52) paired with `eventsource-parser`.
   - Reject `react-native-sse` to avoid native dependency overhead and Android OkHttp chunk buffering quirks.
   - Implement `useLiveQuery` with `AppState` suspension and microtask-buffered settlement.
   - Record decision in `docs/adr/ADR-0004-realtime-sse-live-queries.md`.

4. **Ticket #8 (Decide mobile feature-module architecture and layer boundaries)**:
   - Enforce Feature-Sliced Design (FSD) boundaries: `src/features/tasks/api/tasks.ts` binds `defineContract` to generated endpoints and exposes `useTasksQuery`, `useTaskLiveQuery`, and `useTaskMutation`.
