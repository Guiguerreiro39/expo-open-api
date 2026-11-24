import { HttpResponse, http } from "msw";
import { TEST_API_BASE } from "./auth";

export const tasksHandlers = [
  http.get(`${TEST_API_BASE}/api/v1/tasks`, () =>
    HttpResponse.json({
      data: [],
      meta: { nextCursor: null, hasMore: false },
    }),
  ),
  http.get(`${TEST_API_BASE}/api/v1/tasks/live`, () => {
    const encoder = new TextEncoder();
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(
          encoder.encode(
            `event: init\ndata: ${JSON.stringify({
              data: [],
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
  }),
  http.post(`${TEST_API_BASE}/api/v1/tasks`, async ({ request }) => {
    const body = (await request.json()) as { name?: string; done?: boolean };
    const now = new Date().toISOString();
    return HttpResponse.json(
      {
        id: "00000000-0000-4000-8000-000000000001",
        name: body.name ?? "Untitled task",
        done: body.done ?? false,
        userId: "user-1",
        createdAt: now,
        updatedAt: now,
      },
      { status: 201 },
    );
  }),
  http.patch(`${TEST_API_BASE}/api/v1/tasks/:id`, async ({ params, request }) => {
    const body = (await request.json()) as { name?: string; done?: boolean };
    const now = new Date().toISOString();
    return HttpResponse.json({
      id: String(params.id),
      name: body.name ?? "Updated task",
      done: Boolean(body.done),
      userId: "user-1",
      createdAt: now,
      updatedAt: now,
    });
  }),
  http.delete(`${TEST_API_BASE}/api/v1/tasks/:id`, () => {
    return new HttpResponse(null, { status: 204 });
  }),
];
