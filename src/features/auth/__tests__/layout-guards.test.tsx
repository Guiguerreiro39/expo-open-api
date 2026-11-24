import { act, fireEvent, waitFor } from "@testing-library/react-native";
import { HttpResponse, http } from "msw";
import { ActivityIndicator } from "react-native";
import { describe, expect, it } from "vitest";
import { AppLayoutGuard } from "@/features/auth/ui/app-layout-guard";
import { AuthLayoutGuard } from "@/features/auth/ui/auth-layout-guard";
import { ROUTES } from "@/shared/config/routes";
import { getCachedBearerToken, resetAuthSessionCache } from "@/shared/lib/auth-session-bridge";
import { getThemeElevation, resolveThemeColor } from "@/shared/lib/theme/presets";
import type { CredentialStorePort } from "@/shared/storage/credential-store";
import { mockRouterState } from "@/test/mocks/adapters/mock-expo-router";
import { server, TEST_API_BASE } from "@/test/msw-server";
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

    it("applies preset-aligned header and tab bar border widths across presets", () => {
      const neoElevation = getThemeElevation("neo-brutalist", "dark");
      const neoBorder = resolveThemeColor("neo-brutalist", "dark", "outline-variant");

      const { observability } = renderWithProviders(<AppLayoutGuard />, {
        user: {
          id: "user-1",
          name: "Ada",
          email: "ada@example.com",
          role: "member",
        },
        initialPreset: "neo-brutalist",
        initialColorScheme: "dark",
      });

      expect(mockRouterState.tabsScreenOptions).toMatchObject({
        headerStyle: {
          backgroundColor: resolveThemeColor("neo-brutalist", "dark", "surface-container-low"),
          borderBottomWidth: neoElevation.borderWidth,
          borderBottomColor: neoBorder,
        },
        tabBarStyle: {
          backgroundColor: resolveThemeColor("neo-brutalist", "dark", "surface-container-low"),
          borderTopWidth: neoElevation.borderWidth,
          borderTopColor: neoBorder,
        },
      });
      observability.assertNoDefects();
    });

    it("renders a >=44pt Sign out button and locks against double-tap while sign-out is in flight", async () => {
      let signOutCalls = 0;
      let releaseSignOut: (() => void) | null = null;
      const signOutGate = new Promise<void>((resolve) => {
        releaseSignOut = resolve;
      });

      server.use(
        http.post(`${TEST_API_BASE}/api/auth/sign-out`, async () => {
          signOutCalls += 1;
          await signOutGate;
          return new HttpResponse(null, { status: 204 });
        }),
      );

      const { getByLabelText, getByText, observability } = renderWithProviders(<AppLayoutGuard />, {
        user: {
          id: "user-1",
          name: "Ada",
          email: "ada@example.com",
          role: "member",
        },
      });

      const signOutButton = getByLabelText("Sign out");
      expect(String(signOutButton.props.className)).toContain("min-h-11");
      expect(String(signOutButton.props.className)).toContain("min-w-11");

      fireEvent.press(signOutButton);
      fireEvent.press(signOutButton);

      await waitFor(() => {
        expect(signOutCalls).toBe(1);
        expect(getByLabelText("Sign out").props.accessibilityState?.disabled).toBe(true);
        expect(getByText("Signing out...")).toBeTruthy();
      });

      await act(async () => {
        releaseSignOut?.();
      });

      await waitFor(() => {
        expect(
          mockRouterState.history.some(
            (entry) => entry.type === "replace" && entry.href === ROUTES.AUTH_LOGIN,
          ),
        ).toBe(true);
      });

      expect(signOutCalls).toBe(1);
      observability.assertNoDefects();
    });

    it("completes local teardown, records 1 defect, and redirects to login when credentialStore.deleteItem throws during sign-out", async () => {
      const unhandled: string[] = [];
      const onUnhandled = (reason: unknown) => {
        unhandled.push(reason instanceof Error ? reason.message : String(reason));
      };
      process.on("unhandledRejection", onUnhandled);

      const failingStore: CredentialStorePort = {
        getItem: async () => "token-user-1",
        setItem: async () => {},
        deleteItem: async () => {
          throw new Error("Keychain locked");
        },
      };

      try {
        const { getByLabelText, observability } = renderWithProviders(<AppLayoutGuard />, {
          user: { id: "user-1", name: "Ada", email: "ada@example.com", role: "member" },
          credentialStore: failingStore,
        });

        fireEvent.press(getByLabelText("Sign out"));

        await waitFor(() => {
          expect(
            mockRouterState.history.some(
              (entry) => entry.type === "replace" && entry.href === ROUTES.AUTH_LOGIN,
            ),
          ).toBe(true);
        });

        expect(unhandled).toEqual([]);
        expect(observability.defects).toHaveLength(1);
        expect(getCachedBearerToken()).toBeNull();
      } finally {
        process.off("unhandledRejection", onUnhandled);
      }
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
