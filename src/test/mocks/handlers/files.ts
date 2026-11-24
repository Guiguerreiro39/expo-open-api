import { HttpResponse, http } from "msw";
import { TEST_API_BASE } from "./auth";

export const filesHandlers = [
  http.get(`${TEST_API_BASE}/api/v1/files`, () =>
    HttpResponse.json({
      data: [],
      meta: { nextCursor: null, hasMore: false },
    }),
  ),
];
