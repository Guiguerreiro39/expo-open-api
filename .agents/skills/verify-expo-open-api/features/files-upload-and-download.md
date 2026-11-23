# Verification Flow: Files Upload & Download (`files-upload-and-download`)

Validates unified file picking (`useMobileFilePicker`), dual upload strategies (direct multipart <= 10 MB and 3-step presigned <= 100 MB), 2-slot concurrency throttling (`useUploadQueue`), cancellation/retry, 409 `FILE_PENDING` backoff, and native sharing (`expo-sharing`) on `/(app)/files`.

---

## Automated Boundary Gate

```bash
pnpm test src/features/files/__tests__/
```

---

## Interactive / Paired Verification Steps

### 1. Unified File Picker & Client Validation Boundaries

1. Open the **Files** tab (`/(app)/files`) and pick a file via Document Picker, Photo Library, or Camera (`useMobileFilePicker`).
2. Verify boundary validation (`validateUploadFile`):
   - `0` bytes -> rejected before network egress (breadcrumb only, zero defects).
   - `> 10 MB` with strategy forced to `"direct"` -> rejected with actionable guidance.
   - `> 100 MB` -> rejected across all strategies.

### 2. Direct Multipart Upload (<= 10 MB)

1. Pick a file `<= 10 MB` under `"auto"` or `"direct"` strategy.
2. **Assertion**:
   - Single `POST /api/v1/files` executes via `FileTransferPort.uploadDirectMultipart` (`FileSystemUploadType.MULTIPART`, field `file`) with `Authorization: Bearer`, `X-Request-Id`, and `traceparent`.
   - Upload progress updates smoothly and `filesQueryKeys.all` invalidates on completion.

### 3. Three-Step Presigned Upload (<= 100 MB)

1. Pick a file `> 10 MB` (or select `"presigned"` strategy).
2. **Assertion**:
   - **Step 1**: `POST /api/v1/files/presign` returns `{ file, uploadUrl }` with status `"pending"`.
   - **Step 2**: `PUT <uploadUrl>` streams binary bytes via `FileTransferPort.uploadPresignedBinary` (`FileSystemUploadType.BINARY_CONTENT`) with **no** `Authorization` header sent to object storage, reporting determinate byte progress.
   - **Step 3**: `POST /api/v1/files/{id}/complete` promotes the record to `"ready"`.

### 4. Concurrency Cap, Abort & Retry

1. Enqueue 3 files simultaneously into `useUploadQueue`:
   - **Assertion**: At most **2** streams are actively `"uploading"` while the 3rd stays `"queued"` until a slot opens.
2. Cancel an active upload:
   - **Assertion**: `AbortSignal` aborts the transfer, transitions status to `"aborted"`, records a breadcrumb (zero defects), and allows clean retry via `retry(id)`.

### 5. Download, 409 `FILE_PENDING` Backoff & Native Share Sheet

1. Tap **Download / Share** on a ready file:
   - **Assertion**: `GET /api/v1/files/{id}/download` writes to `${cacheDirectory}transfers/` with Bearer + trace headers and opens `Sharing.shareAsync(localUri)`.
   - If the backend responds `409 FILE_PENDING`, the downloader retries up to 3 attempts with exponential backoff before failing.
2. Tap **Preview** on a ready file:
   - **Assertion**: `GET /api/v1/files/{id}/url` resolves a temporary URL and opens it in-app via `WebBrowser.openBrowserAsync`.
