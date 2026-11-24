import { act } from "@testing-library/react-native";
import { ActivityIndicator } from "react-native";
import { describe, expect, it } from "vitest";
import { AppLayoutGuard } from "@/features/auth/ui/app-layout-guard";
import { AuthLayoutGuard } from "@/features/auth/ui/auth-layout-guard";
import { ROUTES } from "@/shared/config/routes";
import { resetAuthSessionCache } from "@/shared/lib/auth-session-bridge";
import { resolveThemeColor } from "@/shared/lib/theme/presets";
import { mockRouterState } from "@/test/mocks/adapters/mock-expo-router";
import { renderWithProviders } from "@/test/render";

describe("layout route guards", () => {
  describe("AppLayoutGuard", () => {
    it("renders a themed loading screen while app bootstrap is still in progress", () => {
      const { getByTestId, queryByTestId, UNSAFE_getByType } = renderWithProviders(
        <AppLayoutGuard />,
        {
          user: null,
          isBootstrapping: true,
          initialPreset: "editorial-slate",
          initialColorScheme: "dark",
        },
      );

      expect(queryByTestId("expo-router-redirect")).toBeNull();
      expect(queryByTestId("expo-router-tabs")).toBeNull();
      expect(String(getByTestId("layout-guard-loading").props.className)).toContain(
        "bg-background",
      );
      expect(UNSAFE_getByType(ActivityIndicator).props.color).toBe(
        resolveThemeColor("editorial-slate", "dark", "primary"),
      );
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

    it("renders authenticated app tabs shell with themed scene background when user is signed in", () => {
      const { getByTestId, queryByTestId } = renderWithProviders(<AppLayoutGuard />, {
        user: {
          id: "user-1",
          name: "Ada",
          email: "ada@example.com",
          role: "member",
        },
        initialPreset: "editorial-slate",
        initialColorScheme: "dark",
      });

      expect(queryByTestId("expo-router-redirect")).toBeNull();
      expect(getByTestId("expo-router-tabs")).toBeTruthy();
      expect(mockRouterState.tabsScreenOptions).toMatchObject({
        sceneStyle: {
          backgroundColor: resolveThemeColor("editorial-slate", "dark", "background"),
        },
        headerStyle: {
          backgroundColor: resolveThemeColor("editorial-slate", "dark", "surface-container-low"),
        },
        headerTintColor: resolveThemeColor("editorial-slate", "dark", "foreground"),
      });
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
    it("renders a themed loading screen while app bootstrap is in progress", () => {
      const { getByTestId, queryByTestId, UNSAFE_getByType } = renderWithProviders(
        <AuthLayoutGuard />,
        {
          user: null,
          isBootstrapping: true,
          initialPreset: "neo-brutalist",
          initialColorScheme: "dark",
        },
      );

      expect(queryByTestId("expo-router-redirect")).toBeNull();
      expect(queryByTestId("expo-router-stack")).toBeNull();
      expect(String(getByTestId("layout-guard-loading").props.className)).toContain(
        "bg-background",
      );
      expect(UNSAFE_getByType(ActivityIndicator).props.color).toBe(
        resolveThemeColor("neo-brutalist", "dark", "primary"),
      );
    });

    it("renders auth stack with themed content background for unauthenticated visitors", () => {
      const { getByTestId, queryByTestId } = renderWithProviders(<AuthLayoutGuard />, {
        user: null,
        initialPreset: "warm-tactile",
        initialColorScheme: "dark",
      });

      expect(queryByTestId("expo-router-redirect")).toBeNull();
      expect(getByTestId("expo-router-stack")).toBeTruthy();
      expect(mockRouterState.stackScreenOptions).toMatchObject({
        headerShown: false,
        contentStyle: {
          backgroundColor: resolveThemeColor("warm-tactile", "dark", "background"),
        },
      });
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
