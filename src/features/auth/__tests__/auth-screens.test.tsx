import { fireEvent, waitFor } from "@testing-library/react-native";
import { http } from "msw";
import { describe, expect, it } from "vitest";
import { LoginScreen } from "@/features/auth/ui/login-screen";
import { RegisterScreen } from "@/features/auth/ui/register-screen";
import { ROUTES } from "@/shared/config/routes";
import { BEARER_TOKEN_STORAGE_KEY, getCachedBearerToken } from "@/shared/lib/auth-session-bridge";
import { mockRouterState } from "@/test/mocks/adapters/mock-expo-router";
import { honoErrorResponse, server, TEST_API_BASE } from "@/test/msw-server";
import { renderWithProviders } from "@/test/render";

describe("LoginScreen and RegisterScreen", () => {
  it("validates login inputs before submitting and surfaces client errors", async () => {
    const { getByLabelText, getByText } = renderWithProviders(<LoginScreen />, {
      user: null,
    });

    fireEvent.changeText(getByLabelText("Email"), "not-an-email");
    fireEvent.changeText(getByLabelText("Password"), "123");
    fireEvent.press(getByText("Sign In"));

    await waitFor(() => {
      expect(getByText("Please enter a valid email address")).toBeTruthy();
      expect(getByText("Password must be at least 6 characters")).toBeTruthy();
    });
  });

  it("signs in against MSW, persists bearer token to CredentialStorePort and cache, and redirects", async () => {
    mockRouterState.setParams({ redirect: "/(app)/tasks" });

    const { getByLabelText, getByText, credentialStore } = renderWithProviders(<LoginScreen />, {
      user: null,
    });

    fireEvent.changeText(getByLabelText("Email"), "ada@example.com");
    fireEvent.changeText(getByLabelText("Password"), "password123");
    fireEvent.press(getByText("Sign In"));

    await waitFor(async () => {
      expect(getCachedBearerToken()).toBe("token-user-1");
      expect(await credentialStore.getItem(BEARER_TOKEN_STORAGE_KEY)).toBe("token-user-1");
    });

    expect(
      mockRouterState.history.some(
        (entry) => entry.type === "replace" && entry.href === "/(app)/tasks",
      ),
    ).toBe(true);
  });

  it("displays an error alert on 401 unauthorized login", async () => {
    server.use(
      http.post(`${TEST_API_BASE}/api/auth/sign-in/email`, () =>
        honoErrorResponse(401, "UNAUTHORIZED", "Invalid email or password"),
      ),
    );

    const { getByLabelText, getByText, credentialStore } = renderWithProviders(<LoginScreen />, {
      user: null,
    });

    fireEvent.changeText(getByLabelText("Email"), "ada@example.com");
    fireEvent.changeText(getByLabelText("Password"), "wrongpass");
    fireEvent.press(getByText("Sign In"));

    await waitFor(() => {
      expect(getByText("Invalid email or password")).toBeTruthy();
    });

    expect(getCachedBearerToken()).toBeNull();
    expect(await credentialStore.getItem(BEARER_TOKEN_STORAGE_KEY)).toBeNull();
  });

  it("displays in-place access denied message on 403 while preserving any active session", async () => {
    server.use(
      http.post(`${TEST_API_BASE}/api/auth/sign-in/email`, () =>
        honoErrorResponse(403, "FORBIDDEN", "Account access restricted"),
      ),
    );

    const { getByLabelText, getByText } = renderWithProviders(<LoginScreen />, {
      user: {
        id: "user-existing",
        name: "Existing",
        email: "existing@example.com",
        role: "viewer",
      },
    });

    fireEvent.changeText(getByLabelText("Email"), "ada@example.com");
    fireEvent.changeText(getByLabelText("Password"), "password123");
    fireEvent.press(getByText("Sign In"));

    await waitFor(() => {
      expect(getByText(/Access denied/i)).toBeTruthy();
      expect(getByText(/Account access restricted/i)).toBeTruthy();
    });

    // Session token preserved on 403
    expect(getCachedBearerToken()).toBe("token-user-existing");
  });

  it("registers a new account, persists bearer token, and redirects to /(app)", async () => {
    const { getByLabelText, getByText, credentialStore } = renderWithProviders(<RegisterScreen />, {
      user: null,
    });

    fireEvent.changeText(getByLabelText("Full name"), "Grace Hopper");
    fireEvent.changeText(getByLabelText("Email"), "grace@example.com");
    fireEvent.changeText(getByLabelText("Password"), "password123");
    fireEvent.press(getByText("Create Account"));

    await waitFor(async () => {
      expect(getCachedBearerToken()).toBe("token-user-new");
      expect(await credentialStore.getItem(BEARER_TOKEN_STORAGE_KEY)).toBe("token-user-new");
    });

    expect(
      mockRouterState.history.some(
        (entry) => entry.type === "replace" && entry.href === ROUTES.APP_HOME,
      ),
    ).toBe(true);
  });

  it("surfaces 422 server validation errors on registration", async () => {
    server.use(
      http.post(`${TEST_API_BASE}/api/auth/sign-up/email`, () =>
        honoErrorResponse(422, "VALIDATION_ERROR", "Validation failed", [
          { path: ["email"], message: "Email is already registered" },
        ]),
      ),
    );

    const { getByLabelText, getByText } = renderWithProviders(<RegisterScreen />, {
      user: null,
    });

    fireEvent.changeText(getByLabelText("Full name"), "Grace Hopper");
    fireEvent.changeText(getByLabelText("Email"), "taken@example.com");
    fireEvent.changeText(getByLabelText("Password"), "password123");
    fireEvent.press(getByText("Create Account"));

    await waitFor(() => {
      expect(getByText("Email is already registered")).toBeTruthy();
    });
  });
});
