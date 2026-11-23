import { act, fireEvent, waitFor } from "@testing-library/react-native";
import { HttpResponse, http } from "msw";
import { describe, expect, it } from "vitest";
import { TasksScreen } from "@/features/tasks/ui/tasks-screen";
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

    const { getByLabelText, getByText, queryByText, unmount } = renderWithProviders(
      <TasksScreen />,
      {
        user: { id: "member-1", name: "Alice", email: "alice@example.com", role: "member" },
      },
    );

    const deleteButton = await waitFor(() => getByLabelText("Delete task Build SSE transport"));
    fireEvent.press(deleteButton);

    // Immediately removed optimistically
    await waitFor(() => {
      expect(queryByText("Build SSE transport")).toBeNull();
    });

    // Server fails with 500 -> task reappears via rollback
    await act(async () => {
      releaseDelete?.();
    });

    await waitFor(() => {
      expect(getByText("Build SSE transport")).toBeTruthy();
    });

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
