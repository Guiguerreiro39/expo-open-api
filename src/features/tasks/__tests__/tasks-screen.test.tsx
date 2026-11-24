import { act, fireEvent, waitFor } from "@testing-library/react-native";
import { HttpResponse, http } from "msw";
import { FlatList, RefreshControl } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { describe, expect, it } from "vitest";
import { TasksScreen } from "@/features/tasks/ui/tasks-screen";
import { resolveThemeColor } from "@/shared/lib/theme/presets";
import { emitMockNetInfoState } from "@/test/mocks/adapters/mock-netinfo";
import { honoErrorResponse, server, TEST_API_BASE } from "@/test/msw-server";
import { renderWithProviders } from "@/test/render";

const FIRST_TASK = {
  id: "11111111-1111-4111-8111-111111111111",
  name: "Build SSE transport",
  done: false,
  userId: "member-1",
  createdAt: "2026-03-01T10:00:00.000Z",
  updatedAt: "2026-03-01T10:00:00.000Z",
};

const SEED_TASKS = [
  FIRST_TASK,
  {
    id: "22222222-2222-4222-8222-222222222222",
    name: "Verify MMKV persistence",
    done: true,
    userId: "member-1",
    createdAt: "2026-03-01T10:05:00.000Z",
    updatedAt: "2026-03-01T10:05:00.000Z",
  },
  {
    id: "33333333-3333-4333-8333-333333333333",
    name: "Other teammate task",
    done: false,
    userId: "other-user-2",
    createdAt: "2026-03-01T10:10:00.000Z",
    updatedAt: "2026-03-01T10:10:00.000Z",
  },
];

function createInitSseResponse(tasks = SEED_TASKS) {
  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(
        encoder.encode(
          `event: init\ndata: ${JSON.stringify({
            data: tasks,
            meta: { nextCursor: null, hasMore: false },
          })}\n\n`,
        ),
      );
    },
  });
  return new HttpResponse(stream, {
    status: 200,
    headers: { "Content-Type": "text/event-stream" },
  });
}

describe("TasksScreen", () => {
  it("validates create input, creates a task optimistically, and filters by all/active/completed", async () => {
    server.use(
      http.get(`${TEST_API_BASE}/api/v1/tasks`, () =>
        HttpResponse.json({
          data: SEED_TASKS.slice(0, 2),
          meta: { nextCursor: null, hasMore: false },
        }),
      ),
      http.get(`${TEST_API_BASE}/api/v1/tasks/live`, () =>
        createInitSseResponse(SEED_TASKS.slice(0, 2)),
      ),
      http.post(`${TEST_API_BASE}/api/v1/tasks`, async ({ request }) => {
        const body = (await request.json()) as { name: string; done?: boolean };
        const now = new Date().toISOString();
        return HttpResponse.json(
          {
            id: "44444444-4444-4444-8444-444444444444",
            name: body.name,
            done: Boolean(body.done),
            userId: "member-1",
            createdAt: now,
            updatedAt: now,
          },
          { status: 201 },
        );
      }),
    );

    const { getByLabelText, getByPlaceholderText, getByText, queryByText, unmount } =
      renderWithProviders(<TasksScreen />, {
        user: { id: "member-1", name: "Alice", email: "alice@example.com", role: "member" },
      });

    await waitFor(() => {
      expect(getByText("Build SSE transport")).toBeTruthy();
      expect(getByText("Verify MMKV persistence")).toBeTruthy();
      expect(getByText("Live Connected")).toBeTruthy();
    });

    // Submitting empty title displays Effect Schema validation error
    fireEvent.press(getByLabelText("Add task"));
    expect(getByText("Task title is required")).toBeTruthy();

    // Valid submission creates task optimistically and clears input
    const input = getByPlaceholderText("Add a new task...");
    fireEvent.changeText(input, "Ship mobile release");
    fireEvent.press(getByLabelText("Add task"));

    await waitFor(() => {
      expect(getByText("Ship mobile release")).toBeTruthy();
    });

    // Filter: Completed
    fireEvent.press(getByLabelText("Filter tasks: Completed"));
    await waitFor(() => {
      expect(getByText("Verify MMKV persistence")).toBeTruthy();
      expect(queryByText("Build SSE transport")).toBeNull();
      expect(queryByText("Ship mobile release")).toBeNull();
    });

    // Filter: Active
    fireEvent.press(getByLabelText("Filter tasks: Active"));
    await waitFor(() => {
      expect(getByText("Build SSE transport")).toBeTruthy();
      expect(getByText("Ship mobile release")).toBeTruthy();
      expect(queryByText("Verify MMKV persistence")).toBeNull();
    });

    // Filter: All
    fireEvent.press(getByLabelText("Filter tasks: All"));
    await waitFor(() => {
      expect(getByText("Verify MMKV persistence")).toBeTruthy();
      expect(getByText("Build SSE transport")).toBeTruthy();
    });

    unmount();
  });

  it("optimistically toggles a task and rolls back on HTTP 500 error", async () => {
    let releasePatch: (() => void) | null = null;
    const patchGate = new Promise<void>((resolve) => {
      releasePatch = resolve;
    });

    server.use(
      http.get(`${TEST_API_BASE}/api/v1/tasks`, () =>
        HttpResponse.json({
          data: [FIRST_TASK],
          meta: { nextCursor: null, hasMore: false },
        }),
      ),
      http.get(`${TEST_API_BASE}/api/v1/tasks/live`, () => createInitSseResponse([FIRST_TASK])),
      http.patch(`${TEST_API_BASE}/api/v1/tasks/:id`, async () => {
        await patchGate;
        return honoErrorResponse(500, "INTERNAL_SERVER_ERROR", "Database write failed");
      }),
    );

    const { getByLabelText, observability, unmount } = renderWithProviders(<TasksScreen />, {
      user: { id: "member-1", name: "Alice", email: "alice@example.com", role: "member" },
    });

    const toggleButton = await waitFor(() => getByLabelText("Toggle task Build SSE transport"));
    expect(toggleButton.props.accessibilityState?.checked).toBe(false);

    fireEvent.press(toggleButton);

    // Immediately reflects optimistic done=true
    await waitFor(() => {
      expect(
        getByLabelText("Toggle task Build SSE transport").props.accessibilityState?.checked,
      ).toBe(true);
    });

    // Server responds with 500 -> must roll back to done=false and record defect
    await act(async () => {
      releasePatch?.();
    });

    await waitFor(() => {
      expect(
        getByLabelText("Toggle task Build SSE transport").props.accessibilityState?.checked,
      ).toBe(false);
      expect(observability.defects.length).toBeGreaterThanOrEqual(1);
    });

    unmount();
  });

  it("optimistically deletes a task and rolls back on HTTP 500 error", async () => {
    let releaseDelete: (() => void) | null = null;
    const deleteGate = new Promise<void>((resolve) => {
      releaseDelete = resolve;
    });

    server.use(
      http.get(`${TEST_API_BASE}/api/v1/tasks`, () =>
        HttpResponse.json({
          data: [FIRST_TASK],
          meta: { nextCursor: null, hasMore: false },
        }),
      ),
      http.get(`${TEST_API_BASE}/api/v1/tasks/live`, () => createInitSseResponse([FIRST_TASK])),
      http.delete(`${TEST_API_BASE}/api/v1/tasks/:id`, async () => {
        await deleteGate;
        return honoErrorResponse(500, "INTERNAL_SERVER_ERROR", "Delete failed");
      }),
    );

    const { getByLabelText, getByText, getAllByText, queryByText, unmount } = renderWithProviders(
      <TasksScreen />,
      {
        user: { id: "member-1", name: "Alice", email: "alice@example.com", role: "member" },
      },
    );

    const deleteButton = await waitFor(() => getByLabelText("Delete task Build SSE transport"));
    fireEvent.press(deleteButton);

    // Must ask for confirmation first — task remains visible until confirmed
    await waitFor(() => {
      expect(getByText("Delete task?")).toBeTruthy();
    });
    expect(getByText("Build SSE transport")).toBeTruthy();

    fireEvent.press(getByText("Delete"));

    // Immediately removed optimistically after confirmation
    await waitFor(() => {
      expect(queryByText("Build SSE transport")).toBeNull();
    });

    // Server fails with 500 -> task reappears via rollback and shows visible error feedback
    await act(async () => {
      releaseDelete?.();
    });

    await waitFor(() => {
      expect(getByText("Build SSE transport")).toBeTruthy();
      expect(getAllByText(/Delete failed/i).length).toBeGreaterThanOrEqual(1);
    });

    unmount();
  });

  it("cancels task deletion in AlertDialog without calling DELETE API", async () => {
    let deleteCalls = 0;
    server.use(
      http.get(`${TEST_API_BASE}/api/v1/tasks`, () =>
        HttpResponse.json({
          data: [FIRST_TASK],
          meta: { nextCursor: null, hasMore: false },
        }),
      ),
      http.get(`${TEST_API_BASE}/api/v1/tasks/live`, () => createInitSseResponse([FIRST_TASK])),
      http.delete(`${TEST_API_BASE}/api/v1/tasks/:id`, () => {
        deleteCalls += 1;
        return new HttpResponse(null, { status: 204 });
      }),
    );

    const { getByLabelText, getByText, queryByText, observability, unmount } = renderWithProviders(
      <TasksScreen />,
      {
        user: { id: "member-1", name: "Alice", email: "alice@example.com", role: "member" },
      },
    );

    const deleteButton = await waitFor(() => getByLabelText("Delete task Build SSE transport"));
    fireEvent.press(deleteButton);

    await waitFor(() => {
      expect(getByText("Delete task?")).toBeTruthy();
    });

    fireEvent.press(getByText("Cancel"));

    await waitFor(() => {
      expect(queryByText("Delete task?")).toBeNull();
    });

    expect(getByText("Build SSE transport")).toBeTruthy();
    expect(deleteCalls).toBe(0);
    observability.assertNoDefects();
    unmount();
  });

  it("surfaces visible 403 ForbiddenError feedback on toggle/create failures without reporting defects", async () => {
    server.use(
      http.get(`${TEST_API_BASE}/api/v1/tasks`, () =>
        HttpResponse.json({
          data: [FIRST_TASK],
          meta: { nextCursor: null, hasMore: false },
        }),
      ),
      http.get(`${TEST_API_BASE}/api/v1/tasks/live`, () => createInitSseResponse([FIRST_TASK])),
      http.patch(`${TEST_API_BASE}/api/v1/tasks/:id`, () =>
        honoErrorResponse(403, "FORBIDDEN", "Not allowed to edit this task"),
      ),
    );

    const { getByLabelText, getAllByText, observability, unmount } = renderWithProviders(
      <TasksScreen />,
      {
        user: { id: "member-1", name: "Alice", email: "alice@example.com", role: "member" },
      },
    );

    const toggleButton = await waitFor(() => getByLabelText("Toggle task Build SSE transport"));
    fireEvent.press(toggleButton);

    await waitFor(() => {
      expect(getAllByText(/Access denied/i).length).toBeGreaterThanOrEqual(1);
      expect(getAllByText(/Not allowed to edit this task/i).length).toBeGreaterThanOrEqual(1);
      expect(
        getByLabelText("Toggle task Build SSE transport").props.accessibilityState?.checked,
      ).toBe(false);
    });

    observability.assertNoDefects();
    unmount();
  });

  it("renders skeleton loading, horizontal-only safe area, compact status strip, >=44pt toggles, wrapping filter pills, and themed pull-to-refresh", async () => {
    let releaseGet: (() => void) | null = null;
    const getGate = new Promise<void>((resolve) => {
      releaseGet = resolve;
    });
    let getCalls = 0;

    server.use(
      http.get(`${TEST_API_BASE}/api/v1/tasks`, async () => {
        getCalls += 1;
        if (getCalls === 1) {
          await getGate;
        }
        return HttpResponse.json({
          data: [FIRST_TASK],
          meta: { nextCursor: null, hasMore: false },
        });
      }),
      http.get(`${TEST_API_BASE}/api/v1/tasks/live`, () => createInitSseResponse([FIRST_TASK])),
    );

    const { getByTestId, getByLabelText, queryByText, UNSAFE_getByType, observability, unmount } =
      renderWithProviders(<TasksScreen />, {
        user: { id: "member-1", name: "Alice", email: "alice@example.com", role: "member" },
        initialPreset: "neo-brutalist",
        initialColorScheme: "dark",
      });

    // Horizontal-only SafeAreaView edges (single top header belongs to <Tabs>)
    expect(UNSAFE_getByType(SafeAreaView).props.edges).toEqual(["left", "right"]);

    // No duplicate giant "Tasks" screen heading
    expect(queryByText("Tasks")).toBeNull();

    // Compact wrapping status strip
    expect(String(getByTestId("tasks-status-strip").props.className)).toContain("flex-wrap");

    // Shows Skeleton loading while pending
    expect(getByTestId("tasks-loading-skeleton")).toBeTruthy();

    // Release initial query
    await act(async () => {
      releaseGet?.();
    });

    const toggleButton = await waitFor(() => getByLabelText("Toggle task Build SSE transport"));
    expect(String(toggleButton.props.className)).toContain("min-h-11");
    expect(String(toggleButton.props.className)).toContain("min-w-11");

    // Filter pills wrap and keep constant border-2 in neo-brutalist
    const allPill = getByLabelText("Filter tasks: All");
    const activePill = getByLabelText("Filter tasks: Active");
    expect(String(allPill.props.className)).toContain("border-2");
    expect(String(activePill.props.className)).toContain("border-2");

    // FlatList keyboardDismissMode="on-drag" & themed RefreshControl
    const flatList = UNSAFE_getByType(FlatList);
    expect(flatList.props.keyboardDismissMode).toBe("on-drag");
    const refreshControl = UNSAFE_getByType(RefreshControl);
    expect(refreshControl.props.tintColor).toBe(
      resolveThemeColor("neo-brutalist", "dark", "primary"),
    );

    await act(async () => {
      refreshControl.props.onRefresh?.();
    });

    await waitFor(() => {
      expect(getCalls).toBeGreaterThanOrEqual(2);
    });

    observability.assertNoDefects();
    unmount();
  });

  it("shows offline indicator banner when NetInfo goes offline and hides it on reconnect", async () => {
    server.use(
      http.get(`${TEST_API_BASE}/api/v1/tasks`, () =>
        HttpResponse.json({
          data: [FIRST_TASK],
          meta: { nextCursor: null, hasMore: false },
        }),
      ),
      http.get(`${TEST_API_BASE}/api/v1/tasks/live`, () => createInitSseResponse([FIRST_TASK])),
    );

    const { getByText, queryByText, unmount } = renderWithProviders(<TasksScreen />, {
      user: { id: "member-1", name: "Alice", email: "alice@example.com", role: "member" },
    });

    await waitFor(() => {
      expect(getByText("Build SSE transport")).toBeTruthy();
    });
    expect(queryByText(/You are offline/i)).toBeNull();

    await act(async () => {
      emitMockNetInfoState({ isConnected: false, isInternetReachable: false });
    });

    await waitFor(() => {
      expect(getByText(/You are offline/i)).toBeTruthy();
    });

    await act(async () => {
      emitMockNetInfoState({ isConnected: true, isInternetReachable: true });
    });

    await waitFor(() => {
      expect(queryByText(/You are offline/i)).toBeNull();
    });

    unmount();
  });

  it("disables toggle and delete controls on optimistic tasks until server creation settles", async () => {
    const patchIds: string[] = [];
    const deleteIds: string[] = [];
    let initialGetSettled = false;
    let releasePost!: () => void;
    const postGate = new Promise<void>((resolve) => {
      releasePost = resolve;
    });

    server.use(
      http.get(`${TEST_API_BASE}/api/v1/tasks`, () => {
        initialGetSettled = true;
        return HttpResponse.json({ data: [], meta: { nextCursor: null, hasMore: false } });
      }),
      http.get(`${TEST_API_BASE}/api/v1/tasks/live`, () => createInitSseResponse([])),
      http.post(`${TEST_API_BASE}/api/v1/tasks`, async ({ request }) => {
        const body = (await request.json()) as { name: string };
        await postGate;
        const now = new Date().toISOString();
        return HttpResponse.json(
          {
            id: "44444444-4444-4444-8444-444444444444",
            name: body.name,
            done: false,
            userId: "member-1",
            createdAt: now,
            updatedAt: now,
          },
          { status: 201 },
        );
      }),
      http.patch(`${TEST_API_BASE}/api/v1/tasks/:id`, ({ params }) => {
        patchIds.push(String(params.id));
        return honoErrorResponse(404, "NOT_FOUND", "Task not found");
      }),
      http.delete(`${TEST_API_BASE}/api/v1/tasks/:id`, ({ params }) => {
        deleteIds.push(String(params.id));
        return honoErrorResponse(404, "NOT_FOUND", "Task not found");
      }),
    );

    const { getByPlaceholderText, getByLabelText, getByText, queryByText, queryClient, unmount } =
      renderWithProviders(<TasksScreen />, {
        user: { id: "member-1", name: "Alice", email: "alice@example.com", role: "member" },
      });

    await waitFor(() => {
      expect(initialGetSettled).toBe(true);
      expect(queryClient.isFetching()).toBe(0);
      expect(getByText("No tasks to show")).toBeTruthy();
      expect(getByText("Live Connected")).toBeTruthy();
    });

    fireEvent.changeText(getByPlaceholderText("Add a new task..."), "Brand new task");
    fireEvent.press(getByLabelText("Add task"));

    const toggleOpt = await waitFor(() => getByLabelText("Toggle task Brand new task"));
    const deleteOpt = getByLabelText("Delete task Brand new task");

    expect(toggleOpt.props.accessibilityState?.disabled).toBe(true);
    expect(deleteOpt.props.accessibilityState?.disabled).toBe(true);

    fireEvent.press(toggleOpt);
    fireEvent.press(deleteOpt);
    expect(queryByText("Delete task?")).toBeNull();

    await act(async () => {
      releasePost();
    });

    await waitFor(() => {
      expect(getByLabelText("Toggle task Brand new task").props.accessibilityState?.disabled).toBe(
        false,
      );
    });

    expect(patchIds).toEqual([]);
    expect(deleteIds).toEqual([]);
    unmount();
  });

  it("enforces RBAC <Can /> guards across viewer, member (ownership), and admin roles", async () => {
    server.use(
      http.get(`${TEST_API_BASE}/api/v1/tasks`, () =>
        HttpResponse.json({
          data: SEED_TASKS,
          meta: { nextCursor: null, hasMore: false },
        }),
      ),
      http.get(`${TEST_API_BASE}/api/v1/tasks/live`, () => createInitSseResponse(SEED_TASKS)),
    );

    // 1. Viewer: read-only (no create form, no toggle button, no delete button)
    const viewerView = renderWithProviders(<TasksScreen />, {
      user: { id: "viewer-1", name: "Val", email: "val@example.com", role: "viewer" },
    });

    await waitFor(() => {
      expect(viewerView.getByText("Build SSE transport")).toBeTruthy();
    });
    expect(viewerView.queryByLabelText("Add task")).toBeNull();
    expect(viewerView.queryByLabelText("Toggle task Build SSE transport")).toBeNull();
    expect(viewerView.queryByLabelText("Delete task Build SSE transport")).toBeNull();
    viewerView.unmount();

    // 2. Member: can create, can toggle/delete OWN task, CANNOT toggle/delete other teammate's task
    const memberView = renderWithProviders(<TasksScreen />, {
      user: { id: "member-1", name: "Alice", email: "alice@example.com", role: "member" },
    });

    await waitFor(() => {
      expect(memberView.getByText("Other teammate task")).toBeTruthy();
    });
    expect(memberView.getByLabelText("Add task")).toBeTruthy();
    expect(memberView.getByLabelText("Toggle task Build SSE transport")).toBeTruthy();
    expect(memberView.getByLabelText("Delete task Build SSE transport")).toBeTruthy();
    expect(memberView.queryByLabelText("Toggle task Other teammate task")).toBeNull();
    expect(memberView.queryByLabelText("Delete task Other teammate task")).toBeNull();
    memberView.unmount();

    // 3. Admin: can create and toggle/delete ANY task
    const adminView = renderWithProviders(<TasksScreen />, {
      user: { id: "admin-1", name: "Root", email: "root@example.com", role: "admin" },
    });

    await waitFor(() => {
      expect(adminView.getByText("Other teammate task")).toBeTruthy();
    });
    expect(adminView.getByLabelText("Add task")).toBeTruthy();
    expect(adminView.getByLabelText("Toggle task Other teammate task")).toBeTruthy();
    expect(adminView.getByLabelText("Delete task Other teammate task")).toBeTruthy();
    adminView.unmount();
  });
});
