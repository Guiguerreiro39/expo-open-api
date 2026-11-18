# Expo SDK 52+, Expo Router v4, and Offline TanStack Query Cache Persistence on React Native

> **Research Ticket:** [Guiguerreiro39/expo-open-api#2](https://github.com/Guiguerreiro39/expo-open-api/issues/2)  
> **Parent Epic:** [Guiguerreiro39/expo-open-api#1](https://github.com/Guiguerreiro39/expo-open-api/issues/1)  
> **Reference Codebases:** `Guiguerreiro39/tanstack-open-api` (React 19 + TanStack Start/Router/Query + Effect), `Guiguerreiro39/hono-open-api` (Hono + Better Auth + Zod OpenAPI), and `Guiguerreiro39/expo-open-api` (Expo SDK 52 + Expo Router v4 + React Native 0.76).

---

## Executive Summary (Decision Gist)

Adopt **Expo SDK 52+ with the New Architecture enabled by default** (React Native 0.76.x, Hermes, TurboModules, Bridgeless mode, and Fabric renderer) managed strictly via **Continuous Native Generation (CNG / Prebuild)** with an ephemeral native boundary. Structure navigation using **Expo Router v4** paired with **React Navigation v7 primitives**, organizing screens into pathless route groups (`app/(auth)` and `app/(app)`) with declarative layout guards backed by Better Auth session state and splash-screen gating.

To preserve **Feature-Sliced Design (FSD)** without conflicting with Expo Router's file-based route resolution, implement the **Route Façade Pattern**: `app/` files serve strictly as thin routing entry points (5–10 lines) delegating directly to domain components in `src/features/<slice>/ui/<ScreenName>.tsx`.

For offline data persistence, implement a **Dual-Tier Storage Architecture**:
1. **Credential Tier**: Use `expo-secure-store` exclusively for sensitive authentication credentials (JWT access/refresh tokens, session IDs, and biometric secrets), respecting the Android Keystore 2048-byte per-item limit.
2. **Query Cache Tier**: Use `@tanstack/react-query-persist-client` paired with `@tanstack/query-sync-storage-persister` backed by a synchronous key-value storage engine. For standard Continuous Native Generation (CNG) and production builds, select **`react-native-mmkv` v3+** (pure C++ TurboModule with optional AES encryption and sub-millisecond synchronous reads/writes); for zero-native-build Expo Go workflows, support **`expo-sqlite/kv-store`** (new synchronous SQLite-backed KV store introduced in SDK 52) as an interchangeable adapter.

Wire network reconnection lifecycle via `@react-native-community/netinfo` into `onlineManager.setEventListener`, and synchronize application lifecycle via React Native `AppState` into `focusManager.setFocused`. Maintain complete cross-cutting architectural parity with `tanstack-open-api` by porting the 11 `Data.TaggedError` classes, `defineContract`, `useEffectQuery`, `useEffectMutation`, `matchEffect`, and mobile-adapted `customFetch` with W3C `traceparent` and `X-Request-Id` headers.

---

## 1. Expo SDK 52+ & Modern React Native Core Architecture

Expo SDK 52 (released November 2024) marks a structural milestone for the React Native ecosystem, establishing the New Architecture as the default runtime environment and deprecating legacy bridge patterns.

```
+-----------------------------------------------------------------------------------+
|                                  JavaScript Engine                                |
|                               (Hermes / JSC Dropped)                              |
+-----------------------------------------------------------------------------------+
                               |                     |
           JSI (JavaScript Interface)       TurboModules (Direct C++)
                               |                     |
+-----------------------------------------------------------------------------------+
|                             React Native 0.76 Core                                |
|  - Bridgeless Mode (No JSON Queue)         - Fabric Renderer (Sync Layout)         |
|  - Event Loop Concurrency                  - Native CSS (boxShadow, filter)       |
+-----------------------------------------------------------------------------------+
                               |                     |
                   Continuous Native Generation (CNG / Prebuild)
                               |                     |
+-----------------------------------------+-----------------------------------------+
|             iOS Native Target           |           Android Native Target         |
|         (Xcode 16 / iOS 15.1+)          |        (SDK 35 / Min SDK 24 / NDK)      |
+-----------------------------------------+-----------------------------------------+
```

### 1.1 The New Architecture Enabled by Default

In SDK 52, `newArchEnabled: true` is configured automatically in new templates and enforced inside Expo Go:
- **Bridgeless Mode**: Eliminates the asynchronous serialized JSON message queue between the JavaScript VM and native threads. JavaScript communicates synchronously or concurrently with native modules using C++ pointers via the JavaScript Interface (JSI).
- **TurboModules**: Native modules load lazily on first access and run direct C++ implementations. Libraries like `react-native-mmkv` v3+ compile directly into TurboModule bindings without legacy Java/Objective-C reflection overhead.
- **Fabric Renderer**: Replaces the legacy Paper renderer. Layout calculations (Yoga) and view tree reconciliations occur synchronously on background threads, eliminating UI flicker, white flashes on navigation push/pop, and thread synchronization latency.
- **Hermes Standardized**: JavaScriptCore (JSC) is completely dropped from Expo Go. Hermes is the universal runtime across Android, iOS, and macOS/Windows targets.
- **Modern Styling Primitives**: React Native 0.76 introduces native engine support for standard CSS properties including `boxShadow`, `filter`, and percentage-based transforms, simplifying NativeWind v4 token compilation.

### 1.2 Continuous Native Generation (CNG / Prebuild)

Continuous Native Generation replaces the fragile practice of maintaining committed `/android` and `/ios` project directories:
- **Single Source of Truth**: The native configuration is derived entirely from `app.config.ts` (or `app.json`), `package.json`, and modular Expo Config Plugins (`plugins: [...]`).
- **Deterministic Ephemeral Builds**: Native folders are generated on-demand via `npx expo prebuild --clean` locally or within CI/CD pipelines (e.g., GitHub Actions, EAS Build).
- **Git Hygiene**: `/android` and `/ios` are added to `.gitignore`. Upgrading SDK versions or native dependencies involves updating npm specifiers and re-running `prebuild`, eliminating merge conflicts in `.pbxproj` and `build.gradle` files.
- **Config Plugins**: Native capabilities (e.g., biometric permissions, URL schemes, background modes, custom Android manifest properties) are injected via declarative config plugins:
  ```ts
  // app.config.ts
  import type { ExpoConfig } from "expo/config";

  const config: ExpoConfig = {
    name: "expo-open-api",
    slug: "expo-open-api",
    scheme: "expoopenapi",
    version: "1.0.0",
    newArchEnabled: true,
    ios: {
      supportsTablet: true,
      bundleIdentifier: "com.guiguerreiro.expoopenapi",
    },
    android: {
      adaptiveIcon: {
        foregroundImage: "./assets/adaptive-icon.png",
        backgroundColor: "#ffffff",
      },
      package: "com.guiguerreiro.expoopenapi",
    },
    plugins: [
      "expo-router",
      "expo-secure-store",
      [
        "expo-splash-screen",
        {
          backgroundColor: "#09090b",
          image: "./assets/splash-icon.png",
          dark: {
            backgroundColor: "#09090b",
            image: "./assets/splash-icon.png",
          },
        },
      ],
    ],
  };

  export default config;
  ```

### 1.3 React Version Compatibility

- **Baseline Runtime**: Expo SDK 52 pairs with **React Native 0.76.3**, which pins **React 18.3.1** and **React DOM 18.3.1** (for web output).
- **React 19 Alignment**: While React 19 stable is available for modern web applications (as used in `tanstack-open-api`), React Native's official adoption lands in React Native 0.77+ / Expo SDK 53. Expo SDK 52 includes experimental React 19 canary flags, but production mobile stability requires adhering to React 18.3.1.
- **Architectural Parity Note**: All application logic (Effect schemas, tagged error classes, TanStack Query hooks, Better Auth client, and FSD slice domain modules) is 100% identical between React 18.3 and React 19. The difference is confined to React 19-specific server action hooks (`useActionState`, `useFormStatus`), which are not required in client-side React Native apps.

---

## 2. Package Audit & Recommended Dependency Matrix for Expo SDK 52+

The following dependency matrix represents the production-verified stack for `expo-open-api` on Expo SDK 52+:

| Category | Package | Specifier | Resolved Version | Role & Architectural Justification |
| :--- | :--- | :--- | :--- | :--- |
| **Core Framework** | `expo` | `~52.0.28` | `52.0.28` | Core runtime SDK, CNG prebuild tools, Hermes engine configuration. |
| **Core Framework** | `react-native` | `0.76.6` | `0.76.6` | React Native 0.76 with Bridgeless New Architecture and Fabric renderer. |
| **Core Framework** | `react` | `18.3.1` | `18.3.1` | Supported React runtime for React Native 0.76. |
| **Core Framework** | `react-dom` | `18.3.1` | `18.3.1` | Required for optional universal Expo web target. |
| **Navigation** | `expo-router` | `~4.0.17` | `4.0.17` | File-based routing v4, typed routes, nested layouts, pathless route groups. |
| **Navigation** | `react-native-screens` | `~3.34.0` | `3.34.0` | Native view controllers (`UINavigationController` / Android `Fragment`) underlying Expo Router. |
| **Navigation** | `react-native-safe-area-context` | `4.12.0` | `4.12.0` | Native inset handling for notch, dynamic island, and home indicator. |
| **Navigation** | `expo-linking` | `~7.0.4` | `7.0.4` | Deep linking parsing, Universal Links, and custom URL scheme handling. |
| **State & Query** | `@tanstack/react-query` | `^5.62.0` | `5.62.8` | Server state management, cache queries/mutations, optimistic updates. |
| **State & Query** | `@tanstack/react-query-persist-client` | `^5.62.0` | `5.62.8` | Offline query cache persistence and automatic rehydration wrapper. |
| **State & Query** | `@tanstack/query-sync-storage-persister` | `^5.62.0` | `5.62.8` | Synchronous cache persistence adapter for MMKV and SQLite KV-store. |
| **State & Query** | `@react-native-community/netinfo` | `11.4.1` | `11.4.1` | Realtime network status monitoring wired to `onlineManager`. |
| **Storage & Cache** | `react-native-mmkv` | `^3.2.0` | `3.2.0` | High-speed C++ TurboModule synchronous key-value storage for query cache. |
| **Storage & Cache** | `expo-sqlite` | `~15.0.6` | `15.0.6` | Provides `expo-sqlite/kv-store` for zero-native-build fallback storage. |
| **Auth & Security** | `expo-secure-store` | `~14.0.1` | `14.0.1` | Hardware-backed encrypted keychain/keystore for auth tokens and biometric secrets. |
| **Auth & Security** | `better-auth` | `^1.1.14` | `1.1.14` | Client auth engine, isomorphic session types, and OAuth flows. |
| **Auth & Security** | `@better-auth/expo` | `^1.1.14` | `1.1.14` | Better Auth Expo plugin providing deep link listeners and token persistence. |
| **Contracts & Errors**| `effect` | `^3.11.8` | `3.11.8` | Functional type system, `Data.TaggedError` 11-status taxonomy, Schema decoding. |
| **Design System** | `nativewind` | `^4.1.23` | `4.1.23` | Tailwind CSS v4 compiler for React Native using Fabric style props. |
| **Design System** | `tailwindcss` | `^3.4.17` | `3.4.17` | Tailwind compiler required by NativeWind v4. |
| **Design System** | `react-native-reusables` | `latest` | `latest` | Accessible, unstyled React Native primitives modeled on Radix UI. |
| **Design System** | `lucide-react-native` | `^0.468.0` | `0.468.0` | Iconography matching `lucide-react` from `tanstack-open-api`. |
| **Observability** | `@sentry/react-native` | `~6.3.0` | `6.3.0` | Native crash reporting, performance tracing, and offline breadcrumbs. |
| **Observability** | `@datadog/mobile-react-native` | `~2.4.0` | `2.4.0` | Mobile RUM, network tracing, and telemetry adapter. |
| **Tooling & Dev** | `@biomejs/biome` | `1.9.4` | `1.9.4` | Fast linter, formatter, and import sorter matching `tanstack-open-api`. |
| **Tooling & Dev** | `vitest` | `^2.1.8` | `2.1.8` | Unit and integration testing harness with MSW v2. |
| **Tooling & Dev** | `orval` | `^7.3.0` | `7.3.0` | OpenAPI client and Effect schema codegen. |

### 2.1 Explicitly Deprecated / Excluded Packages

1. **`@react-native-async-storage/async-storage`**: Deprecated in favor of `expo-sqlite/kv-store` (first-party Expo synchronous KV store) or `react-native-mmkv` (C++ TurboModule). `AsyncStorage` introduces asynchronous bridge latency during app startup, causing visual flash during query rehydration.
2. **`expo-av`**: Deprecated by the Expo team in SDK 52. Replaced by `expo-video` and `expo-audio`.
3. **`@tanstack/react-router` on React Native**: While TanStack Router has experimental native prototypes, **Expo Router v4** is the production standard for React Native. It integrates directly with Apple's `UINavigationController` and Android's `FragmentManager` through `react-native-screens`, supporting native transition physics, swipe-back gestures, dynamic header animations, and native tab bars.
4. **`react-native-fs` / `expo-file-system` for Query Caching**: Inefficient overhead for key-value document serialization compared to MMKV or SQLite.

---

## 3. Architectural Comparison: TanStack Router vs Expo Router v4 & FSD Mapping

### 3.1 Architectural Comparison Matrix

| Architectural Dimension | TanStack Router (Web / `tanstack-open-api`) | Expo Router v4 (Mobile / `expo-open-api`) |
| :--- | :--- | :--- |
| **Target Platform** | DOM / Web Browser / Node SSR | iOS, Android, and Universal Web via React Native |
| **Navigation Primitive** | Virtual DOM Tree & History API | Native `UINavigationController`, Android `FragmentStack`, and Native Tabs |
| **Route Definition** | File routes with `createFileRoute("/path")` and generated `routeTree.gen.ts` | File-system routing with directory naming conventions (`_layout.tsx`, `index.tsx`, `[id].tsx`) |
| **Layout Guards** | Imperative `beforeLoad` throwing `redirect({ to: "/login" })` | Declarative layout components returning `<Redirect href="/(auth)/login" />` |
| **Session Hydration** | SSR `createIsomorphicFn` reading request cookies (`cookie`, `authorization`) | Client-side SecureStore retrieval of Bearer token via `@better-auth/expo` |
| **Route Masking / Groups**| Pathless layouts `_app.tsx` without URL prefix | Pathless route groups `(app)` and `(auth)` enclosed in parentheses |
| **Deep Linking** | Standard Web URLs (`https://domain.com/path`) | Custom URI Schemes (`expoopenapi://path`) + Universal Links / App Links (`https://domain.com/path`) |
| **Screen Transitions** | CSS View Transitions / Framer Motion | Native operating system transition animations (push, modal sheet, fade) |
| **Data Preloading** | `defaultPreload: "intent"` on link hover | Preloading queries via TanStack Query `queryClient.prefetchQuery()` on screen focus |

### 3.2 Layout Guards: Imperative `beforeLoad` vs Declarative `<Redirect>`

In `tanstack-open-api`, route guarding is synchronous and occurs before the route component mounts:

```tsx
// tanstack-open-api: src/routes/_app.tsx (Imperative beforeLoad)
export const Route = createFileRoute("/_app")({
  beforeLoad: async ({ context, location }) => {
    const sessionData = await context.queryClient.ensureQueryData(authSessionQueryOptions);
    if (!sessionData?.user) {
      throw redirect({
        to: "/login",
        search: { redirect: location.href },
      });
    }
    return { user: sessionData.user, session: sessionData.session };
  },
  component: AppLayout,
});
```

In React Native and Expo Router v4, route transitions cannot block the native thread. Instead, route guarding uses **Declarative Layout Guards** inside the pathless route group `app/(app)/_layout.tsx`:

```tsx
// expo-open-api: app/(app)/_layout.tsx (Declarative Layout Guard)
import { Redirect, Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { useEffect } from "react";
import { useAuthSession } from "@/features/auth/api/session";
import { FullScreenLoading } from "@/shared/ui/full-screen-loading";

export default function ProtectedAppLayout() {
  const { user, isLoading } = useAuthSession();

  useEffect(() => {
    if (!isLoading) {
      SplashScreen.hideAsync().catch(() => {});
    }
  }, [isLoading]);

  // 1. Keep native splash or render skeleton while session rehydrates from SecureStore
  if (isLoading) {
    return <FullScreenLoading />;
  }

  // 2. Unauthenticated: declaratively redirect to auth group
  if (!user) {
    return <Redirect href="/(auth)/login" />;
  }

  // 3. Authenticated: render protected native navigation stack
  return (
    <Stack
      screenOptions={{
        headerShown: true,
        headerStyle: { backgroundColor: "#09090b" },
        headerTintColor: "#fafafa",
        headerTitleStyle: { fontWeight: "600" },
        contentStyle: { backgroundColor: "#09090b" },
      }}
    >
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen name="tasks/[id]" options={{ title: "Task Details", presentation: "card" }} />
      <Stack.Screen name="tasks/new" options={{ title: "New Task", presentation: "modal" }} />
      <Stack.Screen name="showcase" options={{ title: "Design System Showcase" }} />
    </Stack>
  );
}
```

Similarly, the authentication group `app/(auth)/_layout.tsx` prevents authenticated users from re-entering the login screen:

```tsx
// expo-open-api: app/(auth)/_layout.tsx
import { Redirect, Stack } from "expo-router";
import { useAuthSession } from "@/features/auth/api/session";

export default function AuthLayout() {
  const { user, isLoading } = useAuthSession();

  if (isLoading) {
    return null;
  }

  if (user) {
    return <Redirect href="/(app)/(tabs)/tasks" />;
  }

  return (
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: "#09090b" } }}>
      <Stack.Screen name="login" />
      <Stack.Screen name="register" />
    </Stack>
  );
}
```

### 3.3 Feature-Sliced Design (FSD) Mapping: The Route Façade Pattern

A fundamental tension exists between Expo Router (which dictates that all route files reside under `app/`) and Feature-Sliced Design (which isolates domain logic under `src/features/<slice>/`).

**The Solution: The Route Façade Pattern**
- Treat `app/` exclusively as an **Infrastructure / Route Registration Layer**.
- Never write domain logic, heavy JSX, forms, or data queries directly inside files in `app/`.
- Every leaf route file in `app/` is a 5-to-10 line façade that imports and mounts the screen component from `src/features/<slice>/ui/<ScreenName>.tsx`.

```
expo-open-api/
├── app/                                 # [Expo Router Façade Layer]
│   ├── _layout.tsx                      # Root Layout: Theme, QueryClient, Observability
│   ├── index.tsx                        # Root Entry: Redirects to (auth) or (app)
│   ├── (auth)/                          # Public Route Group
│   │   ├── _layout.tsx                  # Public Guard Layout
│   │   ├── login.tsx                    # Façade -> LoginScreen
│   │   └── register.tsx                 # Façade -> RegisterScreen
│   └── (app)/                           # Protected Route Group
│       ├── _layout.tsx                  # Protected Guard Layout (Checks useAuthSession)
│       ├── (tabs)/                      # Tab Navigator Group
│       │   ├── _layout.tsx              # Native Tab Bar definition
│       │   ├── tasks.tsx                # Façade -> TasksListScreen
│       │   ├── files.tsx                # Façade -> FilesListScreen
│       │   └── profile.tsx              # Façade -> ProfileScreen
│       ├── tasks/
│       │   ├── [id].tsx                 # Façade -> TaskDetailScreen
│       │   └── new.tsx                  # Façade -> CreateTaskScreen
│       └── showcase.tsx                 # Façade -> ShowcaseScreen
│
└── src/                                 # [Feature-Sliced Design Root]
    ├── app/                             # Application Initialization
    │   ├── runtime.ts                   # Effect ManagedRuntime & AppRuntime
    │   └── providers.tsx                # PersistQueryClientProvider & ThemeProvider
    ├── features/                        # Domain Feature Slices
    │   ├── auth/                        # Auth Slice
    │   │   ├── api/                     # session.ts, client.ts
    │   │   ├── model/                   # auth-state.ts
    │   │   └── ui/                      # LoginScreen.tsx, RegisterScreen.tsx, UserMenu.tsx
    │   ├── tasks/                       # Tasks Slice
    │   │   ├── api/                     # get-tasks.ts, create-task.ts, live-tasks.ts
    │   │   ├── model/                   # task-schema.ts
    │   │   └── ui/                      # TasksListScreen.tsx, TaskDetailScreen.tsx
    │   ├── files/                       # Files Slice
    │   │   ├── api/                     # upload-file.ts, download-file.ts
    │   │   └── ui/                      # FilesListScreen.tsx, FileUploadButton.tsx
    │   └── showcase/                    # Design System Showcase Slice
    │       └── ui/                      # ShowcaseScreen.tsx
    └── shared/                          # Shared Kernel
        ├── api/                         # contracts.ts, fetch.ts, generated/
        ├── config/                      # env.ts
        ├── lib/                         # query-persister.ts, rbac.ts, netinfo.ts
        ├── observability/               # port.ts, sentry.ts, datadog.ts
        └── ui/                          # Button, Text, Card, Form, Can, etc.
```

**Concrete Route Façade Example:**

```tsx
// app/(app)/(tabs)/tasks.tsx
import { TasksListScreen } from "@/features/tasks/ui/tasks-list-screen";

export default function TasksRoute() {
  return <TasksListScreen />;
}
```

This pattern preserves 100% compliance with Biome's `style/noRestrictedImports` rule, keeps cross-slice dependencies at zero, allows full component unit testing without mocking navigation trees, and maintains complete parity with `tanstack-open-api`.

---

## 4. QueryClient Offline Persistence & Mobile Lifecycle Management

### 4.1 Storage Engine Evaluation: Credential Tier vs Cache Tier

A common architectural vulnerability in mobile applications is using `expo-secure-store` for general data caching, or `@react-native-async-storage/async-storage` for high-frequency reads.

| Storage Solution | Read/Write Latency | Max Storage Size | Hardware Encryption | TurboModule / Sync API | Best Fit in `expo-open-api` |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **`expo-secure-store`** | High (5–25ms) | **2048 bytes** on Android | Yes (iOS Keychain / Android Keystore) | Async only | **Credential Tier Only**: Auth JWT tokens, session IDs, biometrics. |
| **`@react-native-async-storage/async-storage`** | Moderate (2–10ms) | ~6MB default (Android) | No | Async only | **Not Recommended**: Slow startup, asynchronous rehydration delay. |
| **`expo-sqlite/kv-store`** | Low (0.5–2ms) | Multi-GB (SQLite DB) | Optional (SQLCipher) | **Yes (`getItemSync`)** | **Universal / Expo Go Cache**: Zero native compilation, drop-in sync store. |
| **`react-native-mmkv` v3+** | **Ultra-Low (<0.1ms)** | Multi-GB (Memory-mapped) | Yes (AES-CFB-128) | **Yes (Pure C++ TurboModule)** | **Production CNG Cache**: Hardware-accelerated memory-mapped files. |

### 4.2 The Dual-Storage Architecture

```
+-----------------------------------------------------------------------------------+
|                                  Mobile Application                               |
+-----------------------------------------------------------------------------------+
                       |                                     |
    [Sensitive Auth Tokens & Keys]             [Non-Sensitive Query Cache & DTOs]
                       |                                     |
        Tier 1: Hardware-Backed Vault            Tier 2: Synchronous High-Speed Cache
                       |                                     |
          +-------------------------+             +-------------------------+
          |    expo-secure-store    |             |    react-native-mmkv    |
          | (Keychain / Keystore)   |             |  (or expo-sqlite/kv)    |
          | - Bearer JWT Token      |             | - Query Snapshot JSON   |
          | - Refresh Token         |             | - Optimistic Mutations  |
          | - Biometric Master Key  |             | - Stale DTO Records     |
          +-------------------------+             +-------------------------+
```

1. **Tier 1 (SecureStore)**: Handles Better Auth session cookies/tokens. If the cache is wiped or corrupted, authentication remains intact. If the device is compromised, encrypted keys cannot be dumped from raw storage.
2. **Tier 2 (MMKV / SQLite KV)**: Handles the TanStack Query dehydration payload (which can grow to 5MB–50MB). Serialized synchronously on native startup so queries are rehydrated *before* React renders the first frame, eliminating layout shifts and skeleton flashes.

### 4.3 Pluggable Synchronous Storage Persister Implementation

We define an abstraction layer in `src/shared/lib/query-persister.ts` supporting both MMKV and SQLite KV-store:

```ts
// src/shared/lib/query-persister.ts
import { createSyncStoragePersister } from "@tanstack/query-sync-storage-persister";
import type { SyncStorage } from "@tanstack/query-sync-storage-persister";

export interface StorageAdapter {
  getItem: (key: string) => string | null;
  setItem: (key: string, value: string) => void;
  removeItem: (key: string) => void;
}

/**
 * Creates an MMKV-backed synchronous storage adapter.
 * Used for Continuous Native Generation (CNG) and production builds.
 */
export function createMmkvStorageAdapter(): StorageAdapter {
  try {
    const { MMKV } = require("react-native-mmkv");
    const storage = new MMKV({ id: "tanstack-query-cache" });

    return {
      getItem: (key: string) => storage.getString(key) ?? null,
      setItem: (key: string, value: string) => storage.set(key, value),
      removeItem: (key: string) => storage.delete(key),
    };
  } catch (error) {
    console.warn("[StorageAdapter] MMKV not available, falling back to SQLite KV-store", error);
    return createSqliteKvStorageAdapter();
  }
}

/**
 * Creates an Expo SQLite KV-store synchronous storage adapter.
 * Used for Expo Go compatibility and fallback environments.
 */
export function createSqliteKvStorageAdapter(): StorageAdapter {
  const Storage = require("expo-sqlite/kv-store").default;

  return {
    getItem: (key: string) => Storage.getItemSync(key),
    setItem: (key: string, value: string) => Storage.setItemSync(key, value),
    removeItem: (key: string) => Storage.removeItemSync(key),
  };
}

/**
 * Factory creating the TanStack Query sync persister.
 */
export function createQueryClientPersister(adapter: StorageAdapter = createMmkvStorageAdapter()) {
  const syncStorage: SyncStorage = {
    getItem: (key) => adapter.getItem(key),
    setItem: (key, value) => adapter.setItem(key, value),
    removeItem: (key) => adapter.removeItem(key),
  };

  return createSyncStoragePersister({
    storage: syncStorage,
    key: "EXPO_QUERY_OFFLINE_CACHE",
    throttleTime: 1000, // Debounce native writes to 1s to preserve flash memory
    serialize: JSON.stringify,
    deserialize: JSON.parse,
  });
}
```

### 4.4 Lifecycle Listeners: NetInfo & AppState Integration

React Native lacks native browser `window.addEventListener("online")` and `window.addEventListener("focus")` events. TanStack Query provides `onlineManager` and `focusManager` to bridge native operating system events.

```ts
// src/shared/lib/lifecycle-manager.ts
import NetInfo from "@react-native-community/netinfo";
import { focusManager, onlineManager } from "@tanstack/react-query";
import { AppState, type AppStateStatus, Platform } from "react-native";

/**
 * Binds device network state to TanStack Query onlineManager.
 * Automatically triggers background query refetches upon reconnection.
 */
export function setupNetworkLifecycle(): () => void {
  return onlineManager.setEventListener((setOnline) => {
    return NetInfo.addEventListener((state) => {
      const isOnline = Boolean(state.isConnected && state.isInternetReachable !== false);
      setOnline(isOnline);
    });
  });
}

/**
 * Binds React Native AppState to TanStack Query focusManager.
 * Refetches stale queries when the user returns from background to active foreground.
 */
export function setupAppStateLifecycle(): () => void {
  const onAppStateChange = (status: AppStateStatus) => {
    if (Platform.OS !== "web") {
      focusManager.setFocused(status === "active");
    }
  };

  const subscription = AppState.addEventListener("change", onAppStateChange);
  return () => subscription.remove();
}
```

### 4.5 QueryClient Initialization & Cache Dehydration Discipline

To prevent immediate garbage collection of persisted offline data on startup, `gcTime` (formerly `cacheTime`) must be configured to at least 24 hours:

```tsx
// src/app/providers.tsx
import { QueryClient } from "@tanstack/react-query";
import { PersistQueryClientProvider } from "@tanstack/react-query-persist-client";
import { type ReactNode, useEffect, useMemo } from "react";
import { setupAppStateLifecycle, setupNetworkLifecycle } from "@/shared/lib/lifecycle-manager";
import { createQueryClientPersister } from "@/shared/lib/query-persister";

export function AppProviders({ children }: { children: ReactNode }) {
  // 1. Configure QueryClient with offline-friendly stale and GC thresholds
  const queryClient = useMemo(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 5 * 60 * 1000, // 5 minutes fresh
            gcTime: 24 * 60 * 60 * 1000, // Retain offline cache for 24 hours
            retry: (failureCount, error: any) => {
              // Do not retry 4xx client domain errors
              if (error?.status >= 400 && error?.status < 500) return false;
              return failureCount < 3;
            },
            networkMode: "offlineFirst", // Serve from cache when offline, fetch when online
          },
          mutations: {
            networkMode: "offlineFirst", // Queue mutations while offline
          },
        },
      }),
    [],
  );

  const persister = useMemo(() => createQueryClientPersister(), []);

  // 2. Wire native lifecycle listeners on mount
  useEffect(() => {
    const unsubNet = setupNetworkLifecycle();
    const unsubApp = setupAppStateLifecycle();
    return () => {
      unsubNet();
      unsubApp();
    };
  }, []);

  return (
    <PersistQueryClientProvider
      client={queryClient}
      persistOptions={{
        persister,
        maxAge: 24 * 60 * 60 * 1000,
        buster: "v1.0.0", // Increment on breaking schema migrations to clear stale cache
        dehydrateOptions: {
          // Only persist successful queries, never persist temporary query errors
          shouldDehydrateQuery: (query) => {
            return query.state.status === "success";
          },
        },
      }}
    >
      {children}
    </PersistQueryClientProvider>
  );
}
```

---

## 5. Cross-Cutting Architectural Parity with `tanstack-open-api`

### 5.1 Effect Contracts & The 11 Status `Data.TaggedError` Taxonomy

`tanstack-open-api` achieves zero runtime defect leakage by categorizing all HTTP error codes into 11 immutable Effect `Data.TaggedError` classes. This taxonomy is 100% portable to React Native:

```ts
// src/shared/api/contracts.ts
import { Data, Effect, Schema } from "effect";

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
  BaseApiErrorFields & { readonly status: 422; readonly issues: ReadonlyArray<any> }
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
```

The hooks `useEffectQuery`, `useEffectMutation`, and matcher `matchEffect` remain identical to their web counterparts, providing exhaustive pattern matching for React Native screens without uncaught promise exceptions.

### 5.2 Mobile Network Fetch Layer (`customFetch`) with SecureStore Token Injection

In React Native, cookies are not automatically passed across native HTTP stacks unless explicitly configured via cookie managers. Better Auth on Expo (`@better-auth/expo`) standardizes on **Bearer token transport** stored in `expo-secure-store`.

Our mobile `customFetch` implementation injects the Bearer token, preserves W3C `traceparent` propagation, and handles 401 session expiration:

```ts
// src/shared/api/fetch.ts
import * as SecureStore from "expo-secure-store";
import { resolveApiUrl } from "@/shared/config/env";
import { resetAuthSessionCache } from "@/shared/lib/auth-session-bridge";

export interface CustomFetchOptions extends RequestInit {
  responseType?: "json" | "blob" | "text";
}

const SECURE_AUTH_TOKEN_KEY = "better_auth_token";

function randomHex(bytes: number): string {
  const chars = "0123456789abcdef";
  let result = "";
  for (let i = 0; i < bytes * 2; i++) {
    result += chars[Math.floor(Math.random() * 16)];
  }
  return result;
}

export function createW3CTraceparent(): { traceparent: string; traceId: string; spanId: string } {
  const traceId = randomHex(16);
  const spanId = randomHex(8);
  return {
    traceId,
    spanId,
    traceparent: `00-${traceId}-${spanId}-01`,
  };
}

export async function customFetch<T>(url: string, options: CustomFetchOptions = {}): Promise<T> {
  const fullUrl = resolveApiUrl(url);
  const headers = new Headers(options.headers);

  if (!headers.has("Content-Type") && !(options.body instanceof FormData)) {
    headers.set("Content-Type", "application/json");
  }

  // 1. Inject W3C Distributed Tracing Headers
  const outboundRequestId = headers.get("X-Request-Id") ?? `req_${randomHex(8)}`;
  headers.set("X-Request-Id", outboundRequestId);

  let traceId: string | undefined;
  const existingTraceparent = headers.get("traceparent");
  if (existingTraceparent) {
    traceId = existingTraceparent.split("-")[1];
  } else {
    const generated = createW3CTraceparent();
    headers.set("traceparent", generated.traceparent);
    traceId = generated.traceId;
  }

  // 2. Inject Bearer Token from SecureStore if available
  if (!headers.has("Authorization")) {
    try {
      const token = await SecureStore.getItemAsync(SECURE_AUTH_TOKEN_KEY);
      if (token) {
        headers.set("Authorization", `Bearer ${token}`);
      }
    } catch {
      // SecureStore read failure or unauthenticated
    }
  }

  // 3. Dispatch Native Fetch (WinterCG compliant in Expo SDK 52)
  const response = await fetch(fullUrl, {
    ...options,
    headers,
  });

  if (!response.ok) {
    let errorData: any;
    try {
      errorData = await response.json();
    } catch {
      errorData = { message: response.statusText || `HTTP error ${response.status}` };
    }

    // 4. Handle 401 Session Expiration
    if (response.status === 401) {
      try {
        await SecureStore.deleteItemAsync(SECURE_AUTH_TOKEN_KEY);
      } catch {}
      resetAuthSessionCache();
    }

    throw {
      name: "FetchError",
      status: response.status,
      code: errorData?.error?.code,
      message: errorData?.error?.message || response.statusText,
      requestId: errorData?.error?.requestId ?? outboundRequestId,
      traceId,
      details: errorData?.error?.details,
      data: errorData,
    };
  }

  if (response.status === 204) {
    return undefined as unknown as T;
  }

  return response.json() as Promise<T>;
}
```

### 5.3 Realtime Server-Sent Events (SSE) on Mobile

In `tanstack-open-api`, tasks sync in realtime via `/api/v1/tasks/live` using the browser `EventSource`. On React Native, global `EventSource` is absent in standard Hermes runtimes.

In `expo-open-api`, realtime SSE subscription is handled via the streaming capabilities of `expo/fetch` (introduced in SDK 52) paired with `eventsource-parser`, maintaining the exact same optimistic mutation buffering pattern:
- Live updates to `["tasks", "list"]` buffer in memory while active mutations exist under `["tasks", "mutation"]`.
- Incoming SSE snapshots flush after a `queueMicrotask` tick once the local optimistic mutation completes.

---

## 6. Concrete Recommendations & Implementation Blueprint for `expo-open-api`

### 6.1 Repository Configuration & Workflow Blueprint

1. **Prebuild & Native Exclusions**:
   - Add `/android` and `/ios` to `.gitignore`.
   - Never commit generated native directories. CI workflows run `npx expo prebuild --clean` before executing native builds.
2. **Deep Linking Scheme**:
   - Configure `scheme: "expoopenapi"` in `app.config.ts`.
   - Register OAuth callback route: `app/(auth)/callback.tsx` for social auth redirects.
3. **Biome & Linting Guardrails**:
   - Adopt `biome.json` mirroring `tanstack-open-api`, enforcing strict FSD layer boundaries via `style/noRestrictedImports`:
     - Disallow importing from other feature slices (`src/features/*` cannot import `src/features/*`).
     - Disallow importing from `app/` into `src/`.
     - Permit `app/` to import from `src/features/*/ui` (Route Façade pattern).
4. **Testing Strategy**:
   - Use Vitest with `react-native-testing-library` and MSW v2 (`setupServer`).
   - Mock native modules via standard Jest/Vitest setup: mock `expo-secure-store` with an in-memory Map, and mock `react-native-mmkv` with an in-memory Map.

### 6.2 Ticket Slicing Validation

This research validates that the implementation of `expo-open-api` can proceed cleanly across the following sequential milestones:

```
+-----------------------------------------------------------------------------+
| 1. Architecture & Base Scaffolding (Expo SDK 52, Biome, FSD Structure)     |
+-----------------------------------------------------------------------------+
                                       |
+-----------------------------------------------------------------------------+
| 2. Query Persistence & Lifecycle (MMKV/SQLite KV, NetInfo, AppState)        |
+-----------------------------------------------------------------------------+
                                       |
+-----------------------------------------------------------------------------+
| 3. Auth & Session Guards (Better Auth Expo, SecureStore, Pathless Routes)   |
+-----------------------------------------------------------------------------+
                                       |
+-----------------------------------------------------------------------------+
| 4. Contracts & Error Handling (Effect TaggedErrors, Orval Codegen, Fetch)   |
+-----------------------------------------------------------------------------+
                                       |
+-----------------------------------------------------------------------------+
| 5. Design System & Feature Slices (NativeWind v4, Tasks, Files, Showcase)   |
+-----------------------------------------------------------------------------+
```

---

## 7. Context Pointers & Related Documentation

- Parent Wayfinder Epic: [Guiguerreiro39/expo-open-api#1](https://github.com/Guiguerreiro39/expo-open-api/issues/1)
- Reference Web Architecture: [Guiguerreiro39/tanstack-open-api](https://github.com/Guiguerreiro39/tanstack-open-api)
- Reference Backend OpenAPI Server: [Guiguerreiro39/hono-open-api](https://github.com/Guiguerreiro39/hono-open-api)
- Official Documentation:
  - [Expo SDK 52 Release Notes](https://expo.dev/changelog/2024/11-12-sdk-52)
  - [Expo Router v4 Documentation](https://docs.expo.dev/router/introduction/)
  - [TanStack Query Offline Persistence](https://tanstack.com/query/v5/docs/framework/react/plugins/persistQueryClient)
  - [Better Auth Expo Guide](https://www.better-auth.com/docs/integrations/expo)
