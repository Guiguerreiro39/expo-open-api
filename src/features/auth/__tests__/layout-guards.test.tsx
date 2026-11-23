import { act } from "@testing-library/react-native";
import { describe, expect, it } from "vitest";
import { AppLayoutGuard } from "@/features/auth/ui/app-layout-guard";
import { AuthLayoutGuard } from "@/features/auth/ui/auth-layout-guard";
import { ROUTES } from "@/shared/config/routes";
import { resetAuthSessionCache } from "@/shared/lib/auth-session-bridge";
import { mockRouterState } from "@/test/mocks/adapters/mock-expo-router";
import { renderWithProviders } from "@/test/render";

describe("layout route guards", () => {
  describe("AppLayoutGuard", () => {
    it("renders nothing while app bootstrap is still in progress", () => {
      const { queryByTestId } = renderWithProviders(<AppLayoutGuard />, {
        user: null,
        isBootstrapping: true,
      });

      expect(queryByTestId("expo-router-redirect")).toBeNull();
      expect(queryByTestId("expo-router-tabs")).toBeNull();
    });

    it("redirects unauthenticated users to login while preserving sanitized redirect path", () => {
      mockRouterState.setPathname("/(app)/tasks");

      const { getByTestId } = renderWithProviders(<AppLayoutGuard />, {
        user: null,
      });

      expect(getByTestId("expo-router-redirect")).toBeTruthy();
      expect(getByTestId("expo-router-redirect-href").props.children).toBe(
        JSON.stringify({
          pathname: ROUTES.AUTH_LOGIN,
          params: { redirect: "/(app)/tasks" },
        }),
      );
    });

    it("renders authenticated app tabs shell when user is signed in", () => {
      const { getByTestId, queryByTestId } = renderWithProviders(<AppLayoutGuard />, {
        user: {
          id: "user-1",
          name: "Ada",
          email: "ada@example.com",
          role: "member",
        },
      });

      expect(queryByTestId("expo-router-redirect")).toBeNull();
      expect(getByTestId("expo-router-tabs")).toBeTruthy();
    });

    it("redirects to login when an unauthorized 401 session reset fires", async () => {
      mockRouterState.setPathname("/(app)/files");
      renderWithProviders(<AppLayoutGuard />, {
        user: {
          id: "user-1",
          name: "Ada",
          email: "ada@example.com",
          role: "member",
        },
      });

      await act(async () => {
        resetAuthSessionCache();
      });

      expect(
        mockRouterState.history.some(
          (entry) =>
            (entry.type === "replace" || entry.type === "redirect") &&
            typeof entry.href === "object" &&
            entry.href?.pathname === ROUTES.AUTH_LOGIN,
        ),
      ).toBe(true);
    });
  });

  describe("AuthLayoutGuard", () => {
    it("renders nothing while app bootstrap is in progress", () => {
      const { queryByTestId } = renderWithProviders(<AuthLayoutGuard />, {
        user: null,
        isBootstrapping: true,
      });

      expect(queryByTestId("expo-router-redirect")).toBeNull();
      expect(queryByTestId("expo-router-stack")).toBeNull();
    });

    it("renders auth stack for unauthenticated visitors", () => {
      const { getByTestId, queryByTestId } = renderWithProviders(<AuthLayoutGuard />, {
        user: null,
      });

      expect(queryByTestId("expo-router-redirect")).toBeNull();
      expect(getByTestId("expo-router-stack")).toBeTruthy();
    });

    it("redirects authenticated users to /(app) by default", () => {
      const { getByTestId } = renderWithProviders(<AuthLayoutGuard />, {
        user: {
          id: "user-1",
          name: "Ada",
          email: "ada@example.com",
          role: "member",
        },
      });

      expect(getByTestId("expo-router-redirect-href").props.children).toBe(ROUTES.APP_HOME);
    });

    it("redirects authenticated users to a safe internal redirect param", () => {
      mockRouterState.setParams({ redirect: "/(app)/tasks" });

      const { getByTestId } = renderWithProviders(<AuthLayoutGuard />, {
        user: {
          id: "user-1",
          name: "Ada",
          email: "ada@example.com",
          role: "member",
        },
      });

      expect(getByTestId("expo-router-redirect-href").props.children).toBe("/(app)/tasks");
    });

    it("blocks malicious open redirects and falls back to /(app)", () => {
      mockRouterState.setParams({ redirect: "https://evil.example/phish" });

      const { getByTestId } = renderWithProviders(<AuthLayoutGuard />, {
        user: {
          id: "user-1",
          name: "Ada",
          email: "ada@example.com",
          role: "member",
        },
      });

      expect(getByTestId("expo-router-redirect-href").props.children).toBe(ROUTES.APP_HOME);
    });
  });
});
