import { HttpResponse, http } from "msw";
import { setupServer } from "msw/node";
import {
  authHandlers,
  buildTestSessionPayload,
  TEST_API_BASE,
  type TestAuthUser,
} from "./mocks/handlers/auth";
import { filesHandlers } from "./mocks/handlers/files";
import { healthHandlers } from "./mocks/handlers/health";
import { tasksHandlers } from "./mocks/handlers/tasks";

export type { TestAuthUser };
export { TEST_API_BASE };

export const defaultHandlers = [
  ...healthHandlers,
  ...authHandlers,
  ...tasksHandlers,
  ...filesHandlers,
];

export const server = setupServer(...defaultHandlers);

export function mockAuthSession(user: TestAuthUser | null) {
  const handler = () => {
    if (!user) {
      return HttpResponse.json(null);
    }
    return HttpResponse.json(buildTestSessionPayload(user));
  };

  server.use(http.get(`${TEST_API_BASE}/api/auth/get-session`, handler));
}

export function honoErrorResponse(
  status: 400 | 401 | 403 | 404 | 408 | 409 | 413 | 422 | 429 | 500 | 503,
  code: string,
  message: string,
  details?: unknown,
) {
  return HttpResponse.json(
    {
      error: {
        code,
        message,
        requestId: "req-test-123",
        ...(details !== undefined ? { details } : {}),
      },
    },
    {
      status,
      headers: { "X-Request-Id": "req-test-123" },
    },
  );
}
