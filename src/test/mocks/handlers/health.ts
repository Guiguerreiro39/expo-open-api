import { HttpResponse, http } from "msw";
import { TEST_API_BASE } from "./auth";

export const healthHandlers = [
  http.get(`${TEST_API_BASE}/`, () =>
    HttpResponse.json({
      name: "hono-open-api",
      status: "ok",
    }),
  ),
  http.get(`${TEST_API_BASE}/health`, () =>
    HttpResponse.json({
      status: "ok",
      timestamp: new Date().toISOString(),
    }),
  ),
  http.get(`${TEST_API_BASE}/ready`, () =>
    HttpResponse.json({
      status: "ok",
      timestamp: new Date().toISOString(),
      checks: { database: "ok" },
    }),
  ),
];
