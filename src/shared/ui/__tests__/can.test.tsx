import { Text } from "react-native";
import { describe, expect, it } from "vitest";
import { Can, useCan } from "@/shared/ui/can";
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
});
