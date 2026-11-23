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

**Mutation Buffering**:
A concurrency synchronization mechanism in `useLiveQuery` that holds incoming SSE snapshots in an in-memory buffer while optimistic mutations are in flight, flushing the latest server state in a microtask after mutation settlement to eliminate UI flicker and ID collisions.
_Avoid_: Debouncing, optimistic pause, mutation lock

**Defect**:
An unexpected runtime or contract failure (`5xx` server responses, `UnknownError` transport failures, `SchemaDecodeError` contract drift, or uncaught React render/native errors) reported to `ObservabilityPort` as an actionable alert, distinct from expected `4xx` domain errors handled in UI flows.
_Avoid_: Exception, bug, domain error

**Breadcrumb**:
An informational telemetry trail of user actions, lifecycle events, and expected domain outcomes (HTTP 4xx responses) enriched with sanitized metadata and recorded without triggering defect alerts.
_Avoid_: Log event, audit log, minor error

**Trace Correlation**:
The cross-tier propagation of standardized distributed tracing headers (`traceparent` and `X-Request-Id`) across mobile network requests and backend middleware to link frontend user transactions and server-side operations under a unified trace ID.
_Avoid_: Request tagging, span linkage, tracking ID

**Design Token**:
A semantic color or layout property defined in `src/shared/ui/theme.ts` and bound to NativeWind via custom utility classes so components express visual role rather than literal style values.
_Avoid_: Hardcoded hex, magic value, arbitrary color utility

**Test Harness**:
The boundary-interception test assembly in `src/test/` (`renderWithProviders`, MSW `msw-server`, `MockEventSource`, `MockXMLHttpRequest`, and `SpyObservabilityAdapter`) that mounts the real `Composition Root` and replaces external I/O without internal `vi.mock()` calls.
_Avoid_: Mock wrapper, shallow renderer, module mock suite

**Tagged Error**:
A typed error class instantiated via Effect's `Data.TaggedError` representing a distinct HTTP response code or transport anomaly with a unique discriminator tag for pattern matching.
_Avoid_: Custom exception, error code, status error

**Fetch Mutator**:
The client-level HTTP mutator (`customFetch`) injected into Orval-generated endpoints that handles base URL resolution, bearer authentication headers, W3C trace propagation, and mobile multipart uploads.
_Avoid_: Interceptor, HTTP middleware, request transformer

**Match Effect**:
A pattern-matching helper (`matchEffect`) that unpacks an Effect query result into discrete React render states (`onPending`, `onFailure`, `onSuccess`) without uncaught exceptions.
_Avoid_: Error boundary matcher, switch case, render prop wrapper

**Auth Session Bridge**:
A driver-agnostic adapter interface in `src/shared/lib/` registered at the `Composition Root` that exposes the current authentication session and user roles to shared UI primitives (`<Can />`) and mutators without creating an illegal upward dependency on `src/features/auth/`.
_Avoid_: Auth context hook, session singleton, auth helper

**In-Memory Token Cache**:
A synchronous in-memory variable (`cachedBearerToken`) hydrated once from `Credential Tier` during `App Bootstrap` and updated on login/logout, allowing zero-latency `Authorization: Bearer` injection without asynchronous Keychain/KeyStore IPC on every request.
_Avoid_: Token store, volatile JWT, session variable

**Layout Guard**:
A declarative route redirection rule implemented at the root of a pathless Expo Router route group (`app/(auth)/_layout.tsx`, `app/(app)/_layout.tsx`, `app/(public)/_layout.tsx`) that enforces authentication and authorization state transitions before mounting child screens.
_Avoid_: Route middleware, navigation interceptor, protected route wrapper

**RBAC Matrix**:
A pure TypeScript role-and-permission definition (`src/shared/lib/rbac.ts`) that maps system roles (`admin`, `member`, `viewer`) to domain actions and scopes (`own` vs `all`) identically to the backend authorization policy.
_Avoid_: Permission list, role table, access list

**Tactile Elevation**:
Hard zero-blur offset shadow (`boxShadow: 4px 4px 0px 0px ...` on React Native 0.76+) combined with high-contrast structural borders applied to static cards and mechanical pressables.
_Avoid_: Drop shadow, card elevation, material depth

**Theme Preset**:
A curated collection of semantic color tokens (`warm-tactile`, `editorial-slate`, `neo-brutalist`) injected into the React Native component tree via NativeWind `vars()` at the Composition Root and persisted in the Query Cache Tier.
_Avoid_: Theme mode, style pack, skin

**Tactile Pressable**:
An interactive button primitive (`TactilePressable` in `src/shared/ui/`) combining `react-native-reanimated` spring translation with `expo-haptics` (`ImpactFeedbackStyle.Light`) to reproduce physical mechanical button feedback on touch screens.
_Avoid_: Bouncy button, animated touchable, ripple pressable

**Token Channel**:
A space-separated HSL value (`H S% L%`) stored in CSS variables to enable Tailwind's `/alpha` opacity modifiers in React Native's native engine.
_Avoid_: Raw color, HSL string, hex token

**Dual Token Specification**:
The design contract in `DESIGN.md` documenting canonical OKLCH coordinates alongside exact space-separated HSL channels for cross-platform fidelity and native compilation.
_Avoid_: Multi-color spec, color mapping, palette duplication

**Reusables Catalog**:
The owned copy-in UI component library in `src/shared/ui/` built on `@rn-primitives` and NativeWind v4 semantic tokens providing headless, accessible cross-platform primitives.
_Avoid_: Component kit, UI library, widget set, theme components

**Form Primitive**:
A compound layout component (`FormField`, `FormItem`, `FormLabel`, `FormControl`, `FormDescription`, `FormMessage`) in `src/shared/ui/form.tsx` that coordinates field state, error tracking, and native accessibility attributes.
_Avoid_: Form component, field wrapper, input container

**Portal Host**:
The top-level overlay anchor (`<PortalHost />` from `@rn-primitives/portal`) mounted at the Composition Root to render dialogs, sheets, select dropdowns, and popovers above all screens and tab bars.
_Avoid_: Modal root, overlay container, window host

**Form Scroll View**:
A specialized scroll container (`src/shared/ui/form-scroll-view.tsx`) backed by `react-native-keyboard-controller` that handles smooth keyboard avoidance, auto-scrolling to invalid fields, and drag dismissals.
_Avoid_: Keyboard wrapper, scroll avoidance, form view

**Mobile File Asset**:
A normalized, platform-agnostic file representation (`MobileFileAsset` in `src/features/files/model/files.ts`) containing `{ uri, name, size, mimeType }` produced by `useMobileFilePicker()` from either `expo-document-picker` or `expo-image-picker`.
_Avoid_: Picked file, native asset, raw document

**File Transfer Port**:
An abstraction seam (`FileTransferPort` in `src/features/files/api/`) decoupling file upload and download implementations from the concrete runtime transport (`expo-file-system` on mobile native vs in-memory mock transports in Vitest).
_Avoid_: Upload client, transfer service, file manager

**Direct Upload Strategy**:
A single-step multipart upload (`POST /api/v1/files`) transmitting files $\le$ 10 MB directly to the backend API with Bearer token authentication and W3C `traceparent` headers via `FileSystemUploadType.MULTIPART`.
_Avoid_: Multipart transfer, direct stream, API upload

**Presigned Upload Strategy**:
A 3-step file transfer workflow for files $\le$ 100 MB: requesting a presigned URL from the backend (`POST /api/v1/files/presign`), streaming binary content directly to storage via `FileSystemUploadType.BINARY_CONTENT` with `PUT`, and notifying the backend of completion (`POST /api/v1/files/:id/complete`).
_Avoid_: S3 upload, signed transfer, 3-step flow

**Upload Queue**:
A concurrency-throttled transfer manager (`useUploadQueue` in `src/features/files/model/`) limiting active uploads to 2 concurrent streams, maintaining determinate byte-level progress metrics, and supporting individual item aborts and retries.
_Avoid_: Transfer manager, upload array, progress tracker

**Native Share Sheet**:
The system-level sharing interface invoked via `expo-sharing` (`Sharing.shareAsync`) that allows users to save downloaded files to their local filesystem ("Save to Files"), AirDrop, or dispatch to external mobile applications.
_Avoid_: System share, activity controller, native export

**Spy Observability Adapter**:
An in-memory test double of `ObservabilityPort` that records telemetry events, defects, and render crashes in memory, enabling test assertions and preventing test runs from emitting remote telemetry.
_Avoid_: Mock logger, test tracer, observability stub

**Continuous Native Generation (CNG) Validation**:
The prebuild verification step (`expo prebuild --clean --no-install`) ensuring that native iOS and Android configuration plugins, entitlements, and manifests synthesize deterministically without local build errors.
_Avoid_: Native build check, prebuild run, gradle test

**Runtime Verification Skill**:
The automated agent verification procedure (`verify-expo-open-api`) executing the 5-phase loop (`Launch`, `Doctor`, `Drive`, `Evidence`, `Cleanup`) to guarantee end-to-end runtime health before PR submission.
_Avoid_: Integration test script, smoke runner, QA workflow

**Metro Static Export**:
The multi-platform bundle compilation process (`expo export --platform all`) generating optimized production bundles for iOS, Android, and web in CI to detect bundle-level syntax or module resolution failures without running native compilers.
_Avoid_: Metro build, web export, bundle check

**Release-Please Automation**:
The automated release workflow (`release-please-action@v4`) triggered on `main` that generates semantic version bumps, updates `CHANGELOG.md`, tags the repository, and creates GitHub releases derived from Conventional Commits.
_Avoid_: Semantic release, auto tagger, version bot

**Lefthook Git Hooks**:
The local Git hook manager (`lefthook.yml`) enforcing pre-commit Biome checks, commit-msg Commitlint validation, and pre-push branch protections prior to pushing to remote repositories.
_Avoid_: Husky hooks, git scripts, commit interceptor






