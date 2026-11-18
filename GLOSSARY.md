# Expo OpenAPI Starter

A reusable mobile React Native starter built on Expo SDK 52+, Expo Router v4, Feature-Sliced Design, TanStack Query with offline cache persistence, Effect, Orval OpenAPI contracts, Better Auth, and NativeWind v4 + React Native Reusables, paired with `hono-open-api`.

## Language

**Layer**:
One of the four top-level horizontal tiers in the Feature-Sliced Design hierarchy (`app`, `routes` / route façades, `features`, `shared`), ordered strictly by responsibility and unidirectional import rules.
_Avoid_: Tier, bucket, package

**Route Façade**:
A thin (5–10 line) file-based routing entry point in `app/` that mounts a screen component from `src/features/<slice>/ui/<ScreenName>.tsx` without containing domain logic or state.
_Avoid_: Screen file, page wrapper, router shim

**Feature Slice**:
A self-contained vertical capability (`auth`, `tasks`, `files`, `showcase`) inside the `features` layer that owns the user-facing workflows, API bindings, and state for one domain area.
_Avoid_: Feature module, domain module, plugin, service

**Segment**:
A technical grouping inside a `Feature Slice` (`api`, `model`, `ui`) or inside the `shared` layer (`ui`, `api`, `config`, `observability`, `lib`) that organizes code by its purpose rather than domain concept.
_Avoid_: Subfolder, category, layer

**Composition Root**:
The single side-effect-free assembly boundary (`createAppComposition` and `createAppRuntime`) where the query client, Effect runtime, and observability adapters are wired together per app mount or test.
_Avoid_: Bootstrap, global singleton, container

**App Bootstrap**:
The unified initialization coordinator (`useAppBootstrap`) in `src/app/` that synchronizes storage initialization, query cache restoration, Better Auth session check, and native splash-screen dismissal.
_Avoid_: App ready, startup hook, splash controller

**Port**:
A driver-agnostic Effect service interface in `shared` (such as `ObservabilityPort`) that defines a seam without coupling callers to a third-party SDK.
_Avoid_: Client, gateway, provider

**Adapter**:
A concrete implementation of a `Port` (such as Sentry, Datadog, Console, Noop, or Composite) wired into the Effect runtime at the `Composition Root`.
_Avoid_: Driver, plugin, mock (reserve mock for test-framework spies)

**Credential Tier**:
The hardware-backed secure storage boundary (`expo-secure-store`) reserved exclusively for sensitive authentication credentials (JWT tokens, session cookies, biometric keys).
_Avoid_: Keyring, auth store, persistent tokens

**Query Cache Tier**:
The synchronous key-value storage engine (`react-native-mmkv` with fallback to `expo-sqlite/kv-store`) used by TanStack Query persister to restore queries across app launches and offline sessions.
_Avoid_: Local cache, offline DB, state store

**Contract**:
A declarative binding (`FunctionDescriptor` created via `defineContract`) that pairs an OpenAPI operation, its generated Effect `Schema`, and its error decoder to bridge Orval's transport hooks with Effect's typed error channel.
_Avoid_: DTO, endpoint wrapper, service method

**Live Query**:
A TanStack Query cache entry synchronized with a mobile server-sent event (`SSE`) stream that hydrates and updates via Effect-validated `init` and `update` snapshots rather than polling.
_Avoid_: Subscription, polling query, websocket channel

**Defect**:
An unexpected runtime or contract failure (`5xx` server responses, `UnknownError` transport failures, `SchemaDecodeError` contract drift, or uncaught React render/native errors) reported to `ObservabilityPort` as an actionable alert, distinct from expected `4xx` domain errors handled in UI flows.
_Avoid_: Exception, bug, domain error

**Design Token**:
A semantic color or layout property defined in `src/shared/ui/theme.ts` and bound to NativeWind via custom utility classes so components express visual role rather than literal style values.
_Avoid_: Hardcoded hex, magic value, arbitrary color utility

**Test Harness**:
The boundary-interception test assembly in `src/test/` (`renderWithProviders`, MSW `msw-server`, `MockEventSource`, `MockXMLHttpRequest`, and `SpyObservabilityAdapter`) that mounts the real `Composition Root` and replaces external I/O without internal `vi.mock()` calls.
_Avoid_: Mock wrapper, shallow renderer, module mock suite
