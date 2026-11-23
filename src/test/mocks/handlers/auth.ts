import { HttpResponse, http } from "msw";

export const TEST_API_BASE = "http://localhost:9999";

export interface TestAuthUser {
  id: string;
  name: string;
  email: string;
  role?: "admin" | "member" | "viewer" | "user" | string;
  image?: string | null;
}

export function buildTestSessionPayload(user: TestAuthUser) {
  const now = new Date().toISOString();
  return {
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      emailVerified: true,
      role: user.role ?? "member",
      image: user.image ?? null,
      createdAt: now,
      updatedAt: now,
    },
    session: {
      id: `session-${user.id}`,
      userId: user.id,
      token: `token-${user.id}`,
      expiresAt: new Date(Date.now() + 86_400_000).toISOString(),
      createdAt: now,
      updatedAt: now,
    },
  };
}

export const authHandlers = [
  http.get(`${TEST_API_BASE}/api/auth/get-session`, () => HttpResponse.json(null)),
  http.post(`${TEST_API_BASE}/api/auth/sign-out`, () => HttpResponse.json({ success: true })),
  http.post(`${TEST_API_BASE}/api/auth/sign-in/email`, async ({ request }) => {
    const body = (await request.json()) as { email?: string };
    const email = body.email ?? "user@example.com";
    const payload = buildTestSessionPayload({
      id: "user-1",
      name: "Test User",
      email,
    });
    return HttpResponse.json(payload);
  }),
  http.post(`${TEST_API_BASE}/api/auth/sign-up/email`, async ({ request }) => {
    const body = (await request.json()) as { email?: string; name?: string };
    const payload = buildTestSessionPayload({
      id: "user-new",
      name: body.name ?? "New User",
      email: body.email ?? "new@example.com",
    });
    return HttpResponse.json(payload, { status: 201 });
  }),
];
