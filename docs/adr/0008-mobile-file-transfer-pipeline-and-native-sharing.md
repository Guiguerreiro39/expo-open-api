---
status: accepted
date: 2026-11-23
decision-ticket: https://github.com/Guiguerreiro39/expo-open-api/issues/15
---

# Mobile File Transfer Pipeline, Upload Progress, and Native Sharing Architecture

Mobile file transfers require coordinating file picking across disparate native subsystem sources (media library, device camera, iCloud Drive, Google Drive), uploading files reliably over cellular connections with accurate byte progress without exhausting Hermes engine RAM, downloading files for native viewing or local sharing without browser DOM APIs, and tracking failures deterministically without leaking PII. We decided to define a canonical `MobileFileAsset` abstraction and `useMobileFilePicker()` hook unifying `expo-document-picker` and `expo-image-picker`, encapsulate file transfers behind a `FileTransferPort` in `src/features/files/api/` that standardizes on `expo-file-system`'s `createUploadTask` for streaming both direct multipart ($\le$ 10 MB) and 3-step presigned S3 PUT ($\le$ 100 MB) uploads, manage transfer concurrency via `useUploadQueue` (throttled to 2 concurrent transfers with per-item cancellation and retry), standardize file downloads on `FileSystem.downloadAsync` into a dedicated cache directory `${FileSystem.cacheDirectory}transfers/` followed by native share sheet dispatch via `Sharing.shareAsync` (with `WebBrowser.openBrowserAsync` for signed URL previews and 409 `FILE_PENDING` exponential retry backoff), classify transfer failures strictly between Breadcrumbs (cancellations/validations) and actionable Defects (5xx, S3 signature rejections, disk write errors), and deliver mobile-first FSD UI components in `src/features/files/ui/` (`FilePickerCard`, `UploadProgressList`, `FileList`).

## Considered Options

- **Raw XMLHttpRequest with Base64 Payloads**: Using React Native's built-in `XMLHttpRequest` with base64 data URIs for raw binary S3 PUT requests incurs heavy memory overhead (~33% expansion) and frequent Out-Of-Memory (OOM) crashes on large files in the Hermes engine.
- **Single Upload Strategy (Presigned Only)**: Eliminating the direct multipart strategy reduces architecture complexity but breaks 1:1 contract parity with `tanstack-open-api` and introduces unnecessary round-trip latency for small icons and avatars ($\le$ 10 MB).
- **Direct Browser Linking (`Linking.openURL`) without Native Sharing**: Opening download URLs directly in the external system browser bypasses local caching, prevents integration with the iOS "Save to Files" dialog and Android Intent Chooser, and fails to handle authenticated private file streams.
- **Native `expo-file-system` Streaming + `expo-sharing` (Chosen)**: Utilizes native-level file streaming directly from disk for both `MULTIPART` and `BINARY_CONTENT` modes without buffering file bytes in JS memory, provides determinate progress callbacks, supports native task cancellation, routes downloaded files directly to the native share sheet, and enables clean test mocking via `FileTransferPort` and MSW v2 in Vitest.

## Consequences

- `MobileFileAsset` (`{ uri: string; name: string; size: number; mimeType: string }`) in `src/features/files/model/files.ts` serves as the single normalized representation for all picked files.
- `useMobileFilePicker()` encapsulates both `expo-document-picker` (`getDocumentAsync({ copyToCacheDirectory: true })`) and `expo-image-picker` (`launchImageLibraryAsync`, `launchCameraAsync`), automatically normalizing file names and deriving MIME types from extensions when omitted.
- The `FileTransferPort` interface in `src/features/files/api/` defines `uploadDirectMultipart`, `uploadPresigned`, and `downloadFile`, implemented on mobile via `expo-file-system.createUploadTask` / `downloadAsync` and mocked in Vitest via MSW v2 handlers.
- The direct upload strategy handles files $\le$ 10 MB in a single `POST /api/v1/files` multipart request with SecureStore Bearer tokens and W3C `traceparent` headers.
- The presigned upload strategy handles files $\le$ 100 MB across 3 steps: `POST /api/v1/files/presign` via `customFetch`, binary `PUT uploadUrl` via `expo-file-system` (`BINARY_CONTENT`), and `POST /api/v1/files/:id/complete` via `customFetch`.
- `useUploadQueue` manages the queue with a maximum concurrency limit of 2 active transfers, reporting real-time byte progress (`totalBytesSent / totalBytesExpectedToSend`) and supporting per-item `abortController.abort()` and retry.
- Direct downloads save to `${FileSystem.cacheDirectory}transfers/download_${id}_${originalName}` and trigger `Sharing.shareAsync` for iOS/Android native share sheets. On app launch, `useAppBootstrap` prunes temporary files older than 24 hours.
- Presigned downloads fetch signed URLs via `GET /api/v1/files/:id/url`, providing in-app web viewing via `WebBrowser.openBrowserAsync(url)` or native caching and sharing, with exponential retry backoff on 409 `FILE_PENDING` responses.
- Telemetry categorizes user aborts and client validations ($\le$ 0 bytes or $>$ 100 MB) as informational Breadcrumbs, while 5xx errors, S3 403 signature rejections, and storage write defects are routed to `ObservabilityPort.recordDefect`.
- UI components in `src/features/files/ui/` provide a touch-optimized mobile experience mounted at `app/(app)/files.tsx`, featuring `FilePickerCard` with strategy switcher, `UploadProgressList` with RNR `Progress` bars, and `FileList` using virtualized cards with `<Can role="member" action="files:delete" />` deletion guards.
