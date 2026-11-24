import { Schema } from "effect";
import { describe, expect, it } from "vitest";
import {
  AuthEnvelopeSchema,
  SignInSchema,
  SignUpSchema,
  sanitizeRedirect,
} from "@/features/auth/model/schemas";

describe("auth schemas and sanitizeRedirect", () => {
  it("allows safe internal paths in sanitizeRedirect", () => {
    expect(sanitizeRedirect("/(app)")).toBe("/(app)");
    expect(sanitizeRedirect("/(app)/tasks")).toBe("/(app)/tasks");
    expect(sanitizeRedirect("/tasks?scope=own&limit=20")).toBe("/tasks?scope=own&limit=20");
    expect(sanitizeRedirect("/")).toBe("/");
  });

  it("blocks open-redirect vectors in sanitizeRedirect", () => {
    expect(sanitizeRedirect(undefined)).toBeNull();
    expect(sanitizeRedirect(null)).toBeNull();
    expect(sanitizeRedirect("")).toBeNull();
    expect(sanitizeRedirect("   ")).toBeNull();
    expect(sanitizeRedirect("//evil.com")).toBeNull();
    expect(sanitizeRedirect("///evil.com")).toBeNull();
    expect(sanitizeRedirect("https://evil.com/login")).toBeNull();
    expect(sanitizeRedirect("http://evil.com")).toBeNull();
    expect(sanitizeRedirect("expoopenapi://evil")).toBeNull();
    expect(sanitizeRedirect("javascript:alert(1)")).toBeNull();
    expect(sanitizeRedirect("/\\evil.com")).toBeNull();
    expect(sanitizeRedirect("/tasks\\..\\evil")).toBeNull();
    expect(sanitizeRedirect("tasks")).toBeNull();
    expect(sanitizeRedirect("evil.com/tasks")).toBeNull();
    expect(sanitizeRedirect("/\t/evil.com/phish")).toBeNull();
    expect(sanitizeRedirect("/\n/evil.com")).toBeNull();
    expect(sanitizeRedirect("/\r/evil.com")).toBeNull();
  });

  it("validates SignInSchema and SignUpSchema", () => {
    const validSignIn = Schema.decodeUnknownSync(SignInSchema)({
      email: "ada@example.com",
      password: "password123",
    });
    expect(validSignIn).toEqual({
      email: "ada@example.com",
      password: "password123",
    });

    expect(() =>
      Schema.decodeUnknownSync(SignInSchema)({
        email: "not-an-email",
        password: "password123",
      }),
    ).toThrow();

    expect(() =>
      Schema.decodeUnknownSync(SignInSchema)({
        email: "ada@example.com",
        password: "123",
      }),
    ).toThrow();

    const validSignUp = Schema.decodeUnknownSync(SignUpSchema)({
      name: "Ada Lovelace",
      email: "ada@example.com",
      password: "password123",
    });
    expect(validSignUp.name).toBe("Ada Lovelace");

    expect(() =>
      Schema.decodeUnknownSync(SignUpSchema)({
        name: "A",
        email: "ada@example.com",
        password: "password123",
      }),
    ).toThrow();
  });

  it("decodes Better Auth session envelopes with defaults", () => {
    const decoded = Schema.decodeUnknownSync(AuthEnvelopeSchema)({
      user: {
        id: "user-1",
        name: "Ada",
        email: "ada@example.com",
      },
      session: {
        id: "sess-1",
        userId: "user-1",
        token: "tok-1",
        expiresAt: "2030-01-01T00:00:00.000Z",
      },
    });

    expect(decoded.user.role).toBe("viewer");
    expect(decoded.user.emailVerified).toBe(false);
    expect(decoded.user.image).toBeNull();
    expect(decoded.session.token).toBe("tok-1");
  });
});
