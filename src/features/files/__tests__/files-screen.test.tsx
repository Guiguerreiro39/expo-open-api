import { fireEvent, waitFor } from "@testing-library/react-native";
import { HttpResponse, http } from "msw";
import { describe, expect, it } from "vitest";
import { TEST_API_BASE } from "@/test/mocks/handlers/auth";
import { server } from "@/test/msw-server";
import { renderWithProviders } from "@/test/render";
import { createInMemoryFileTransferPort } from "../api/transfer-port";
import type { FileRecord, MobileFileAsset } from "../model/files";
import type { MobileFilePickerAdapter } from "../model/use-mobile-file-picker";
import { FilesScreen } from "../ui/files-screen";

const OWN_FILE_ID = "11111111-1111-4111-8111-111111111111";
const OTHER_FILE_ID = "22222222-2222-4222-8222-222222222222";
const UPLOADED_FILE_ID = "33333333-3333-4333-8333-333333333333";

function makeFileRecord(overrides: Partial<FileRecord> = {}): FileRecord {
  return {
    id: OWN_FILE_ID,
    userId: "user-member-1",
    originalName: "quarterly-notes.pdf",
    mimeType: "application/pdf",
    sizeBytes: 2048,
    checksumSha256: null,
    status: "ready",
    expiresAt: null,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

function makePickerAdapter(nextDoc: MobileFileAsset | null = null): MobileFilePickerAdapter {
  return {
    pickDocument: async () => nextDoc,
    pickImageFromLibrary: async () => null,
    capturePhotoWithCamera: async () => null,
  };
}

describe("FilesScreen integration", () => {
  it("prunes expired cache on mount, lists files, and enforces RBAC delete ownership", async () => {
    const port = createInMemoryFileTransferPort();

    server.use(
      http.get(`${TEST_API_BASE}/api/v1/files`, () =>
        HttpResponse.json({
          data: [
            makeFileRecord({ id: OWN_FILE_ID, userId: "user-member-1", originalName: "mine.pdf" }),
            makeFileRecord({
              id: OTHER_FILE_ID,
              userId: "user-other-99",
              originalName: "teammate.pdf",
            }),
          ],
          meta: { nextCursor: null, hasMore: false },
        }),
      ),
    );

    const screen = renderWithProviders(
      <FilesScreen transferPort={port} pickerAdapter={makePickerAdapter()} />,
      {
        user: {
          id: "user-member-1",
          name: "Alex Member",
          email: "alex@example.com",
          role: "member",
        },
      },
    );

    await waitFor(() => {
      expect(screen.getByText("mine.pdf")).toBeTruthy();
      expect(screen.getByText("teammate.pdf")).toBeTruthy();
    });

    expect(port.pruneCalls).toHaveLength(1);
    expect(screen.getByLabelText("Pick Document")).toBeTruthy();
    expect(screen.getByLabelText("Delete mine.pdf")).toBeTruthy();
    expect(screen.queryByLabelText("Delete teammate.pdf")).toBeNull();
    screen.observability.assertNoDefects();
  });

  it("hides upload controls and delete actions for read-only viewer role", async () => {
    const port = createInMemoryFileTransferPort();

    server.use(
      http.get(`${TEST_API_BASE}/api/v1/files`, () =>
        HttpResponse.json({
          data: [
            makeFileRecord({
              id: OWN_FILE_ID,
              userId: "user-viewer-1",
              originalName: "handbook.pdf",
            }),
          ],
          meta: { nextCursor: null, hasMore: false },
        }),
      ),
    );

    const screen = renderWithProviders(
      <FilesScreen transferPort={port} pickerAdapter={makePickerAdapter()} />,
      {
        user: {
          id: "user-viewer-1",
          name: "Sam Viewer",
          email: "sam@example.com",
          role: "viewer",
        },
      },
    );

    await waitFor(() => {
      expect(screen.getByText("handbook.pdf")).toBeTruthy();
    });

    expect(screen.queryByLabelText("Pick Document")).toBeNull();
    expect(screen.getByText(/read-only access/i)).toBeTruthy();
    expect(screen.queryByLabelText("Delete handbook.pdf")).toBeNull();
    expect(screen.getByLabelText("Download and share handbook.pdf")).toBeTruthy();
    screen.observability.assertNoDefects();
  });

  it("uploads a picked document using selected presigned strategy and refreshes the list", async () => {
    const port = createInMemoryFileTransferPort();
    const files: FileRecord[] = [];

    server.use(
      http.get(`${TEST_API_BASE}/api/v1/files`, () =>
        HttpResponse.json({
          data: files,
          meta: { nextCursor: null, hasMore: false },
        }),
      ),
      http.post(`${TEST_API_BASE}/api/v1/files/presign`, async ({ request }) => {
        const body = (await request.json()) as {
          originalName: string;
          mimeType: string;
          sizeBytes: number;
        };
        return HttpResponse.json(
          {
            file: makeFileRecord({
              id: UPLOADED_FILE_ID,
              originalName: body.originalName,
              mimeType: body.mimeType,
              sizeBytes: body.sizeBytes,
              status: "pending",
            }),
            uploadUrl: "https://storage.example.com/signed-put-url",
          },
          { status: 201 },
        );
      }),
      http.post(`${TEST_API_BASE}/api/v1/files/:id/complete`, () => {
        const ready = makeFileRecord({
          id: UPLOADED_FILE_ID,
          originalName: "architecture.pdf",
          sizeBytes: 4096,
          status: "ready",
        });
        files.push(ready);
        return HttpResponse.json(ready);
      }),
    );

    const picker = makePickerAdapter({
      uri: "file:///cache/architecture.pdf",
      name: "architecture.pdf",
      size: 4096,
      mimeType: "application/pdf",
    });

    const screen = renderWithProviders(<FilesScreen transferPort={port} pickerAdapter={picker} />, {
      user: {
        id: "user-member-1",
        name: "Alex Member",
        email: "alex@example.com",
        role: "member",
      },
    });

    await waitFor(() => {
      expect(screen.getByLabelText("Presigned strategy")).toBeTruthy();
    });

    fireEvent.press(screen.getByLabelText("Presigned strategy"));
    fireEvent.press(screen.getByLabelText("Pick Document"));

    await waitFor(() => {
      expect(port.presignedUploads).toHaveLength(1);
      expect(screen.getAllByText("architecture.pdf").length).toBeGreaterThanOrEqual(1);
    });

    expect(port.presignedUploads[0]?.headers.Authorization).toBeUndefined();
    screen.observability.assertNoDefects();
  });

  it("downloads/shares, opens preview URL, and deletes an owned file", async () => {
    const port = createInMemoryFileTransferPort();
    let files = [
      makeFileRecord({
        id: OWN_FILE_ID,
        userId: "user-member-1",
        originalName: "budget.pdf",
      }),
    ];

    server.use(
      http.get(`${TEST_API_BASE}/api/v1/files`, () =>
        HttpResponse.json({
          data: files,
          meta: { nextCursor: null, hasMore: false },
        }),
      ),
      http.get(`${TEST_API_BASE}/api/v1/files/:id/url`, () =>
        HttpResponse.json({
          url: "https://cdn.example.com/preview/budget.pdf",
          expiresInSeconds: 300,
        }),
      ),
      http.delete(`${TEST_API_BASE}/api/v1/files/:id`, ({ params }) => {
        files = files.filter((f) => f.id !== String(params.id));
        return new HttpResponse(null, { status: 204 });
      }),
    );

    const screen = renderWithProviders(
      <FilesScreen transferPort={port} pickerAdapter={makePickerAdapter()} />,
      {
        user: {
          id: "user-member-1",
          name: "Alex Member",
          email: "alex@example.com",
          role: "member",
        },
      },
    );

    await waitFor(() => {
      expect(screen.getByText("budget.pdf")).toBeTruthy();
    });

    fireEvent.press(screen.getByLabelText("Download and share budget.pdf"));
    await waitFor(() => {
      expect(port.downloads).toHaveLength(1);
      expect(port.shares).toHaveLength(1);
    });

    fireEvent.press(screen.getByLabelText("Preview budget.pdf"));
    await waitFor(() => {
      expect(port.openedPreviewUrls).toEqual(["https://cdn.example.com/preview/budget.pdf"]);
    });

    fireEvent.press(screen.getByLabelText("Delete budget.pdf"));
    await waitFor(() => {
      expect(screen.queryByText("budget.pdf")).toBeNull();
    });

    screen.observability.assertNoDefects();
  });

  it("displays upload progress queue with cancel and retry controls", async () => {
    let attempt = 0;
    const port = createInMemoryFileTransferPort({
      uploadDirectMultipart: (_url, asset, options) => {
        attempt += 1;
        if (attempt === 1) {
          return new Promise((_resolve, reject) => {
            options?.signal?.addEventListener(
              "abort",
              () => {
                const err = new Error("Aborted");
                err.name = "AbortError";
                reject(err);
              },
              { once: true },
            );
          });
        }
        options?.onProgress?.({ loaded: asset.size, total: asset.size, percentage: 100 });
        return Promise.resolve(
          makeFileRecord({ id: UPLOADED_FILE_ID, originalName: asset.name, sizeBytes: asset.size }),
        );
      },
    });

    const picker = makePickerAdapter({
      uri: "file:///cache/slides.pdf",
      name: "slides.pdf",
      size: 1024,
      mimeType: "application/pdf",
    });

    const screen = renderWithProviders(<FilesScreen transferPort={port} pickerAdapter={picker} />, {
      user: {
        id: "user-member-1",
        name: "Alex Member",
        email: "alex@example.com",
        role: "member",
      },
    });

    await waitFor(() => {
      expect(screen.getByLabelText("Pick Document")).toBeTruthy();
    });

    fireEvent.press(screen.getByLabelText("Pick Document"));

    await waitFor(() => {
      expect(screen.getByLabelText("Cancel slides.pdf")).toBeTruthy();
    });

    fireEvent.press(screen.getByLabelText("Cancel slides.pdf"));

    await waitFor(() => {
      expect(screen.getByText("Canceled")).toBeTruthy();
      expect(screen.getByLabelText("Retry slides.pdf")).toBeTruthy();
    });

    fireEvent.press(screen.getByLabelText("Retry slides.pdf"));

    await waitFor(() => {
      expect(screen.getByText("Completed")).toBeTruthy();
      expect(screen.getByLabelText("Clear completed uploads")).toBeTruthy();
    });

    fireEvent.press(screen.getByLabelText("Clear completed uploads"));

    await waitFor(() => {
      expect(screen.queryByText("Transfer Queue (1)")).toBeNull();
    });

    screen.observability.assertNoDefects();
  });
});
