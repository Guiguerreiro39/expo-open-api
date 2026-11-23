import { HttpResponse, http } from "msw";
import { TEST_API_BASE } from "./auth";

export const tasksHandlers = [
  http.get(`${TEST_API_BASE}/api/v1/tasks`, () =>
    HttpResponse.json({
      data: [],
      meta: { nextCursor: null, hasMore: false },
    }),
  ),
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
];
