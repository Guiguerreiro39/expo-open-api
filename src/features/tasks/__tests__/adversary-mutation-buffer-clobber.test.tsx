import { act, fireEvent, waitFor } from "@testing-library/react-native";
import { HttpResponse, http } from "msw";
import { Pressable, Text, View } from "react-native";
import { describe, expect, it } from "vitest";
import { useCreateTaskMutation, useTaskLiveQuery } from "@/features/tasks/api/tasks";
import { server, TEST_API_BASE } from "@/test/msw-server";
import { renderWithProviders } from "@/test/render";

function createControlledStream() {
  const encoder = new TextEncoder();
  let controllerRef: ReadableStreamDefaultController<Uint8Array> | null = null;
  const queued: string[] = [];

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      controllerRef = controller;
      for (const chunk of queued) {
        controller.enqueue(encoder.encode(chunk));
      }
      queued.length = 0;
    },
  });

  return {
    stream,
    send(chunk: string) {
      if (controllerRef) {
        controllerRef.enqueue(encoder.encode(chunk));
      } else {
        queued.push(chunk);
      }
    },
    close() {
      controllerRef?.close();
    },
  };
}

function AdversaryTasksProbe() {
  const { data, liveStatus } = useTaskLiveQuery();
  const createMutation = useCreateTaskMutation();

  return (
    <View>
      <Text testID="live-status">{liveStatus}</Text>
      <Pressable
        testID="create-task-btn"
        onPress={() => createMutation.mutate({ name: "My Critical Task", done: false })}
      >
        <Text>Create</Text>
      </Pressable>
      <Text testID="task-ids">{JSON.stringify((data?.data ?? []).map((t) => t.id))}</Text>
      <Text testID="task-names">{JSON.stringify((data?.data ?? []).map((t) => t.name))}</Text>
    </View>
  );
}

describe("Adversarial SSE mutation buffering & anti-clobber invariant", () => {
  it("never flickers or erases a newly-created server task when a stale peer SSE snapshot arrives mid-mutation", async () => {
    const existingTask = {
      id: "11111111-1111-4111-8111-111111111111",
      name: "Existing Task",
      done: false,
      userId: "user-1",
      createdAt: "2026-03-01T10:00:00.000Z",
      updatedAt: "2026-03-01T10:00:00.000Z",
    };

    const peerTask = {
      id: "22222222-2222-4222-8222-222222222222",
      name: "Peer Task From Another Device",
      done: false,
      userId: "user-2",
      createdAt: "2026-03-01T10:01:00.000Z",
      updatedAt: "2026-03-01T10:01:00.000Z",
    };

    const serverCreatedTask = {
      id: "33333333-3333-4333-8333-333333333333",
      name: "My Critical Task",
      done: false,
      userId: "user-1",
      createdAt: "2026-03-01T10:02:00.000Z",
      updatedAt: "2026-03-01T10:02:00.000Z",
    };

    let releasePost: (() => void) | null = null;
    const postGate = new Promise<void>((resolve) => {
      releasePost = resolve;
    });

    const sse = createControlledStream();

    server.use(
      http.get(`${TEST_API_BASE}/api/v1/tasks`, () =>
        HttpResponse.json({
          data: [existingTask],
          meta: { nextCursor: null, hasMore: false },
        }),
      ),
      http.get(`${TEST_API_BASE}/api/v1/tasks/live`, () => {
        return new HttpResponse(sse.stream, {
          status: 200,
          headers: { "Content-Type": "text/event-stream" },
        });
      }),
      http.post(`${TEST_API_BASE}/api/v1/tasks`, async () => {
        await postGate;
        return HttpResponse.json(serverCreatedTask, { status: 201 });
      }),
    );

    const { getByTestId, unmount } = renderWithProviders(<AdversaryTasksProbe />, {
      user: { id: "user-1", name: "Alice", email: "alice@example.com", role: "member" },
    });

    await waitFor(() => {
      expect(getByTestId("task-ids").props.children).toBe(JSON.stringify([existingTask.id]));
    });

    // Establish connected SSE stream with initial snapshot
    await act(async () => {
      sse.send(
        `event: init\ndata: ${JSON.stringify({
          data: [existingTask],
          meta: { nextCursor: null, hasMore: false },
        })}\n\n`,
      );
    });

    await waitFor(() => {
      expect(getByTestId("live-status").props.children).toBe("connected");
    });

    // 1. User triggers create mutation -> optimistic task inserted immediately
    fireEvent.press(getByTestId("create-task-btn"));

    await waitFor(() => {
      const ids = JSON.parse(getByTestId("task-ids").props.children as string) as string[];
      expect(ids.some((id) => id.startsWith("optimistic-"))).toBe(true);
    });

    // 2. While POST /api/v1/tasks is STILL IN FLIGHT, a peer SSE snapshot arrives
    //    containing [peerTask, existingTask] WITHOUT serverCreatedTask!
    await act(async () => {
      sse.send(
        `event: update\ndata: ${JSON.stringify({
          data: [peerTask, existingTask],
          meta: { nextCursor: null, hasMore: false },
        })}\n\n`,
      );
    });

    // 3. Optimistic task MUST remain visible (snapshot buffered, zero flicker!)
    await new Promise((resolve) => setTimeout(resolve, 25));
    const midFlightIds = JSON.parse(getByTestId("task-ids").props.children as string) as string[];
    expect(midFlightIds.some((id) => id.startsWith("optimistic-"))).toBe(true);
    expect(midFlightIds).not.toContain(peerTask.id);

    // 4. POST settles with serverCreatedTask -> onSuccess swaps optimistic-* to serverCreatedTask.id
    //    and queueMicrotask flushes buffered SSE snapshot preserving serverCreatedTask + merging peerTask!
    await act(async () => {
      releasePost?.();
    });

    await waitFor(() => {
      const finalIds = JSON.parse(getByTestId("task-ids").props.children as string) as string[];
      expect(finalIds).toContain(serverCreatedTask.id);
      expect(finalIds).toContain(peerTask.id);
      expect(finalIds).toContain(existingTask.id);
      expect(finalIds.some((id) => id.startsWith("optimistic-"))).toBe(false);
    });

    const finalNames = JSON.parse(getByTestId("task-names").props.children as string) as string[];
    expect(finalNames).toContain("My Critical Task");
    expect(finalNames).toContain("Peer Task From Another Device");

    sse.close();
    unmount();
  });
});
