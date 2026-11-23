import { waitFor } from "@testing-library/react-native";
import { HttpResponse, http } from "msw";
import { Text, View } from "react-native";
import { describe, expect, it } from "vitest";
import { customFetch } from "@/shared/api/fetch";
import { AUTH_QUERY_KEYS } from "@/shared/api/query-keys";
import {
  getAuthSessionQueryOptions,
  registerAuthSessionQueryOptions,
  type SessionData,
} from "@/shared/lib/auth-session-bridge";
import { Can, useCan } from "@/shared/ui/can";
import { buildTestSessionPayload } from "@/test/mocks/handlers/auth";
import { honoErrorResponse, server, TEST_API_BASE } from "@/test/msw-server";
import { renderWithProviders } from "@/test/render";

function UseCanProbe({
  action,
  resource,
}: {
  action: string;
  resource?: { id?: string; userId?: string; type?: string };
}) {
  const allowed = useCan({ action, resource });
  return <Text testID="can-probe">{allowed ? "allowed" : "denied"}</Text>;
}

describe("<Can /> and useCan()", () => {
  it("fails closed and renders fallback when unauthenticated", () => {
    const { queryByText, getByText } = renderWithProviders(
      <Can action="task:create" fallback={<Text>Sign in required</Text>}>
        <Text>Create Task</Text>
      </Can>,
      { user: null },
    );

    expect(queryByText("Create Task")).toBeNull();
    expect(getByText("Sign in required")).toBeTruthy();
  });

  it("renders children for member on own task and hides for foreign task", () => {
    const { getByText, queryByText } = renderWithProviders(
      <>
        <Can action="task:delete" resource={{ id: "task-1", userId: "u-1", type: "task" }}>
          <Text>Delete Own Task</Text>
        </Can>
        <Can
          action="task:delete"
          resource={{ id: "task-2", userId: "u-2", type: "task" }}
          fallback={<Text>Cannot delete foreign task</Text>}
        >
          <Text>Delete Foreign Task</Text>
        </Can>
      </>,
      { user: { id: "u-1", name: "Member", email: "m@example.com", role: "member" } },
    );

    expect(getByText("Delete Own Task")).toBeTruthy();
    expect(queryByText("Delete Foreign Task")).toBeNull();
    expect(getByText("Cannot delete foreign task")).toBeTruthy();
  });

  it("allows admin to delete foreign tasks", () => {
    const adminRender = renderWithProviders(
      <UseCanProbe
        action="task:delete"
        resource={{ id: "task-99", userId: "u-other", type: "task" }}
      />,
      { user: { id: "u-admin", name: "Admin", email: "a@example.com", role: "admin" } },
    );
    expect(adminRender.getByTestId("can-probe").props.children).toBe("allowed");
  });

  it("restricts viewer to read-only via useCan", () => {
    const viewerRender = renderWithProviders(<UseCanProbe action="task:create" />, {
      user: { id: "u-viewer", name: "Viewer", email: "v@example.com", role: "viewer" },
    });
    expect(viewerRender.getByTestId("can-probe").props.children).toBe("denied");
  });

  it("supports role guard prop directly", () => {
    const { queryByText, getByText } = renderWithProviders(
      <Can role="admin" fallback={<Text>Members only</Text>}>
        <Text>Admin Panel</Text>
      </Can>,
      { user: { id: "u-1", name: "Member", email: "m@example.com", role: "member" } },
    );

    expect(queryByText("Admin Panel")).toBeNull();
    expect(getByText("Members only")).toBeTruthy();
  });

  it("keeps the shared QueryClient registered for 401 session wipes after <Can /> unmounts", async () => {
    const { queryClient, rerender, composition } = renderWithProviders(
      <Can action="task:create">
        <Text>Create Task</Text>
      </Can>,
      { user: { id: "u-1", name: "Member", email: "m@example.com", role: "member" } },
    );

    try {
      // Unmount <Can /> while keeping the app composition alive
      rerender(<View />);

      server.use(
        http.get(`${TEST_API_BASE}/api/v1/tasks`, () =>
          honoErrorResponse(401, "UNAUTHORIZED", "Token expired"),
        ),
      );

      await expect(customFetch("/api/v1/tasks")).rejects.toThrow("Token expired");

      expect(queryClient.getQueryData(AUTH_QUERY_KEYS.session())).toBeNull();
    } finally {
      await composition.dispose();
    }
  });

  it("fetches /api/auth/get-session when mounted before session cache is populated", async () => {
    const previousOptions = getAuthSessionQueryOptions();
    let getSessionCalls = 0;

    registerAuthSessionQueryOptions({
      queryKey: AUTH_QUERY_KEYS.session(),
      staleTime: 5 * 60_000,
      queryFn: () => customFetch<SessionData | null>("/api/auth/get-session"),
    });

    server.use(
      http.get(`${TEST_API_BASE}/api/auth/get-session`, () => {
        getSessionCalls += 1;
        return HttpResponse.json(
          buildTestSessionPayload({
            id: "u-live",
            name: "Live Member",
            email: "live@example.com",
            role: "member",
          }),
        );
      }),
    );

    const { getByText, composition } = renderWithProviders(
      <Can action="task:create" fallback={<Text>Locked</Text>}>
        <Text>Unlocked Create Task</Text>
      </Can>,
    );

    try {
      await waitFor(() => {
        expect(getByText("Unlocked Create Task")).toBeTruthy();
      });
      expect(getSessionCalls).toBeGreaterThanOrEqual(1);
    } finally {
      registerAuthSessionQueryOptions(previousOptions);
      await composition.dispose();
    }
  });
});
