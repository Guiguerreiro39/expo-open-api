import { QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react-native";
import { Effect } from "effect";
import { HttpResponse, http } from "msw";
import type { ReactNode } from "react";
import { describe, expect, it } from "vitest";
import { ObservabilityContext } from "@/shared/observability/observability-context";
import { createSpyObservability } from "@/shared/observability/spy-adapter";
import { TEST_API_BASE } from "@/test/mocks/handlers/auth";
import { server } from "@/test/msw-server";
import { createTestQueryClient } from "@/test/render";
import {
  filesQueryKeys,
  useDeleteFileMutation,
  useFilesInfiniteQuery,
  useFilesQuery,
} from "../api/files-query";
import type { FileRecord } from "../model/files";

const FILE_UUID_1 = "11111111-1111-4111-8111-111111111111";
const FILE_UUID_2 = "22222222-2222-4222-8222-222222222222";
const FILE_UUID_DEL = "33333333-3333-4333-8333-333333333333";

function makeFileRecord(id: string, name: string): FileRecord {
  return {
    id,
    userId: "user-1",
    originalName: name,
    mimeType: "application/pdf",
    sizeBytes: 1024,
    checksumSha256: null,
    status: "ready",
    expiresAt: null,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
  };
}

describe("files query hooks with Orval Effect schemas", () => {
  it("fetches and Effect-decodes files list via useFilesQuery", async () => {
    const queryClient = createTestQueryClient();
    const obs = createSpyObservability();
    const wrapper = ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={queryClient}>
        <ObservabilityContext.Provider value={obs}>{children}</ObservabilityContext.Provider>
      </QueryClientProvider>
    );

    server.use(
      http.get(`${TEST_API_BASE}/api/v1/files`, () =>
        HttpResponse.json({
          data: [makeFileRecord(FILE_UUID_1, "brief.pdf")],
          meta: { nextCursor: null, hasMore: false },
        }),
      ),
    );

    const { result } = renderHook(() => useFilesQuery(), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    const decoded = Effect.runSync(result.current.toEffect());
    expect(decoded.data).toHaveLength(1);
    expect(decoded.data[0]?.originalName).toBe("brief.pdf");
    obs.assertNoDefects();
  });

  it("paginates files using nextCursor in useFilesInfiniteQuery", async () => {
    const queryClient = createTestQueryClient();
    const wrapper = ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );

    server.use(
      http.get(`${TEST_API_BASE}/api/v1/files`, ({ request }) => {
        const url = new URL(request.url);
        const cursor = url.searchParams.get("cursor");
        if (!cursor) {
          return HttpResponse.json({
            data: [makeFileRecord(FILE_UUID_1, "page1.pdf")],
            meta: { nextCursor: "cur-2", hasMore: true },
          });
        }
        return HttpResponse.json({
          data: [makeFileRecord(FILE_UUID_2, "page2.pdf")],
          meta: { nextCursor: null, hasMore: false },
        });
      }),
    );

    const { result } = renderHook(() => useFilesInfiniteQuery({ limit: 1 }), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.hasNextPage).toBe(true);

    await act(async () => {
      await result.current.fetchNextPage();
    });

    await waitFor(() => expect(result.current.data?.pages).toHaveLength(2));
    const names = result.current.data?.pages.flatMap((p) => p.data.map((f) => f.originalName));
    expect(names).toEqual(["page1.pdf", "page2.pdf"]);
  });

  it("deletes a file and invalidates filesQueryKeys.all", async () => {
    const queryClient = createTestQueryClient();
    const wrapper = ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );

    let listCalls = 0;
    let deletedId: string | null = null;

    server.use(
      http.get(`${TEST_API_BASE}/api/v1/files`, () => {
        listCalls += 1;
        return HttpResponse.json({
          data: deletedId ? [] : [makeFileRecord(FILE_UUID_DEL, "temp.pdf")],
          meta: { nextCursor: null, hasMore: false },
        });
      }),
      http.delete(`${TEST_API_BASE}/api/v1/files/:id`, ({ params }) => {
        deletedId = String(params.id);
        return new HttpResponse(null, { status: 204 });
      }),
    );

    const { result } = renderHook(
      () => ({
        list: useFilesQuery(),
        del: useDeleteFileMutation(),
      }),
      { wrapper },
    );

    await waitFor(() => expect(result.current.list.data?.data).toHaveLength(1));

    await act(async () => {
      await result.current.del.mutateAsync(FILE_UUID_DEL);
    });

    await waitFor(() => expect(result.current.list.data?.data).toHaveLength(0));
    expect(deletedId).toBe(FILE_UUID_DEL);
    expect(listCalls).toBeGreaterThanOrEqual(2);
    expect(filesQueryKeys.all).toEqual(["files"]);
  });
});
