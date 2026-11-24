import { fireEvent, waitFor } from "@testing-library/react-native";
import { http } from "msw";
import { ScrollView } from "react-native";
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

    // Editing email clears the 422 server validation error via FormControl
    fireEvent.changeText(getByLabelText("Email"), "fresh@example.com");
    await waitFor(() => {
      expect(getByLabelText("Email").props.accessibilityState).toMatchObject({
        invalid: false,
      });
    });
  });

  it("uses top-anchored FormScrollView with keyboardDismissMode='on-drag' and accessible password toggle on LoginScreen", () => {
    const { getByLabelText, getByRole, UNSAFE_getByType } = renderWithProviders(<LoginScreen />, {
      user: null,
    });

    const scrollView = UNSAFE_getByType(ScrollView);
    expect(scrollView.props.keyboardDismissMode).toBe("on-drag");
    expect(scrollView.props.keyboardShouldPersistTaps).toBe("handled");
    expect(String(scrollView.props.contentContainerClassName ?? "")).not.toContain(
      "justify-center",
    );

    const passwordInput = getByLabelText("Password");
    expect(passwordInput.props.secureTextEntry).toBe(true);

    const showButton = getByRole("button", { name: "Show password" });
    expect(String(showButton.props.className ?? "")).toContain("min-h-11");
    expect(String(showButton.props.className ?? "")).toContain("min-w-11");

    fireEvent.press(showButton);
    expect(getByLabelText("Password").props.secureTextEntry).toBe(false);

    const hideButton = getByRole("button", { name: "Hide password" });
    fireEvent.press(hideButton);
    expect(getByLabelText("Password").props.secureTextEntry).toBe(true);
  });

  it("chains keyboard return keys from Email to Password and submits on Password done on LoginScreen", async () => {
    const { getByLabelText, credentialStore, observability } = renderWithProviders(
      <LoginScreen />,
      { user: null },
    );

    const emailInput = getByLabelText("Email");
    const passwordInput = getByLabelText("Password");

    expect(emailInput.props.returnKeyType).toBe("next");
    expect(passwordInput.props.returnKeyType).toBe("done");

    const passwordRef = passwordInput.props.ref as { current: { focus: unknown } };
    expect(passwordRef.current).toBeTruthy();

    fireEvent.changeText(emailInput, "ada@example.com");
    fireEvent(emailInput, "submitEditing");
    expect(passwordRef.current.focus).toHaveBeenCalledTimes(1);

    fireEvent.changeText(passwordInput, "password123");
    fireEvent(passwordInput, "submitEditing");

    await waitFor(async () => {
      expect(await credentialStore.getItem(BEARER_TOKEN_STORAGE_KEY)).toBe("token-user-1");
    });
    observability.assertNoDefects();
  });

  it("prevents concurrent double submissions on LoginScreen while request is in flight", async () => {
    let requestCount = 0;
    let releaseRequest!: () => void;
    const gate = new Promise<void>((resolve) => {
      releaseRequest = resolve;
    });

    server.use(
      http.post(`${TEST_API_BASE}/api/auth/sign-in/email`, async () => {
        requestCount += 1;
        await gate;
        return honoErrorResponse(401, "UNAUTHORIZED", "Invalid email or password");
      }),
    );

    const { getByLabelText, getByText, observability } = renderWithProviders(<LoginScreen />, {
      user: null,
    });

    fireEvent.changeText(getByLabelText("Email"), "ada@example.com");
    fireEvent.changeText(getByLabelText("Password"), "password123");

    const submitBtn = getByText("Sign In");
    fireEvent.press(submitBtn);
    fireEvent.press(submitBtn);

    await waitFor(() => {
      expect(requestCount).toBe(1);
    });

    releaseRequest();
    await waitFor(() => {
      expect(getByText("Invalid email or password")).toBeTruthy();
    });
    observability.assertNoDefects();
  });

  it("uses top-anchored FormScrollView, chains Name -> Email -> Password -> submit, and toggles password visibility on RegisterScreen", async () => {
    const { getByLabelText, getByRole, UNSAFE_getByType, credentialStore, observability } =
      renderWithProviders(<RegisterScreen />, { user: null });

    const scrollView = UNSAFE_getByType(ScrollView);
    expect(scrollView.props.keyboardDismissMode).toBe("on-drag");
    expect(scrollView.props.keyboardShouldPersistTaps).toBe("handled");
    expect(String(scrollView.props.contentContainerClassName ?? "")).not.toContain(
      "justify-center",
    );

    const nameInput = getByLabelText("Full name");
    const emailInput = getByLabelText("Email");
    const passwordInput = getByLabelText("Password");

    expect(nameInput.props.returnKeyType).toBe("next");
    expect(emailInput.props.returnKeyType).toBe("next");
    expect(passwordInput.props.returnKeyType).toBe("done");
    expect(passwordInput.props.secureTextEntry).toBe(true);

    fireEvent.press(getByRole("button", { name: "Show password" }));
    expect(getByLabelText("Password").props.secureTextEntry).toBe(false);

    const emailRef = emailInput.props.ref as { current: { focus: unknown } };
    const passwordRef = passwordInput.props.ref as { current: { focus: unknown } };
    expect(emailRef.current).toBeTruthy();
    expect(passwordRef.current).toBeTruthy();

    fireEvent.changeText(nameInput, "Grace Hopper");
    fireEvent(nameInput, "submitEditing");
    expect(emailRef.current.focus).toHaveBeenCalledTimes(1);

    fireEvent.changeText(emailInput, "grace@example.com");
    fireEvent(emailInput, "submitEditing");
    expect(passwordRef.current.focus).toHaveBeenCalledTimes(1);

    fireEvent.changeText(passwordInput, "password123");
    fireEvent(passwordInput, "submitEditing");

    await waitFor(async () => {
      expect(await credentialStore.getItem(BEARER_TOKEN_STORAGE_KEY)).toBe("token-user-new");
    });
    observability.assertNoDefects();
  });
});
