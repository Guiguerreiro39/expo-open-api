import { describe, expect, it } from "vitest";
import {
  canAccessResource,
  ForbiddenError,
  hasPermission,
  hasRole,
  isAdmin,
  normalizeRole,
  requirePermission,
} from "@/shared/lib/rbac";

describe("rbac matrix", () => {
  const adminUser = { id: "u-admin", role: "admin" };
  const memberUser = { id: "u-member", role: "member" };
  const aliasUser = { id: "u-alias", role: "user" };
  const viewerUser = { id: "u-viewer", role: "viewer" };

  it("normalizes roles with user -> member alias and unknown -> viewer fail-safe", () => {
    expect(normalizeRole("admin")).toBe("admin");
    expect(normalizeRole(" ADMIN ")).toBe("admin");
    expect(normalizeRole("member")).toBe("member");
    expect(normalizeRole("user")).toBe("member");
    expect(normalizeRole("viewer")).toBe("viewer");
    expect(normalizeRole("super-unknown")).toBe("viewer");
    expect(normalizeRole(null)).toBe("viewer");
    expect(normalizeRole(undefined)).toBe("viewer");
  });

  it("checks role helpers accurately", () => {
    expect(isAdmin(adminUser)).toBe(true);
    expect(isAdmin("admin")).toBe(true);
    expect(isAdmin(memberUser)).toBe(false);
    expect(isAdmin(null)).toBe(false);

    expect(hasRole(aliasUser, "member")).toBe(true);
    expect(hasRole(viewerUser, "viewer")).toBe(true);
    expect(hasRole(null, "viewer")).toBe(false);
  });

  it("fails closed when unauthenticated or when resource is unknown", () => {
    expect(hasPermission({ user: null, role: null, action: "task:read" })).toBe(false);
    expect(hasPermission({ action: "task:read" })).toBe(false);
    expect(hasPermission({ user: memberUser, resource: "billing", action: "read" })).toBe(false);
    expect(hasPermission({ user: viewerUser, resource: "billing", action: "read" })).toBe(false);
  });

  it("denies scope: 'all' mutations for non-admins even when resource.type is set and fails closed when user.id is omitted", () => {
    expect(
      hasPermission({
        role: "member",
        action: "task:delete",
        resource: { type: "task", scope: "all" },
      }),
    ).toBe(false);
    expect(
      hasPermission({
        role: "member",
        action: "task:update",
        resource: { type: "task", scope: "all" },
      }),
    ).toBe(false);
    expect(
      hasPermission({
        role: "member",
        action: "task:delete",
        resource: { id: "t1", userId: "other" },
      }),
    ).toBe(false);
    expect(
      hasPermission({
        user: { role: "member" },
        action: "task:delete",
        resource: { id: "t1", userId: "other" },
      }),
    ).toBe(false);
  });

  it("grants admin full access across resources and cross-owner actions", () => {
    expect(hasPermission({ user: adminUser, action: "task:delete:any" })).toBe(true);
    expect(hasPermission({ user: adminUser, action: "file:delete:any" })).toBe(true);
    expect(hasPermission({ user: adminUser, resource: "user", action: "ban" })).toBe(true);
    expect(
      canAccessResource(adminUser, { id: "task-1", userId: memberUser.id }, "task", "delete"),
    ).toBe(true);
  });

  it("allows member and user alias to manage own tasks and files but blocks foreign resources", () => {
    for (const user of [memberUser, aliasUser]) {
      expect(hasPermission({ user, action: "task:create" })).toBe(true);
      expect(hasPermission({ user, action: "file:create" })).toBe(true);
      expect(hasPermission({ user, action: "task:delete:any" })).toBe(false);
      expect(hasPermission({ user, action: "file:delete:any" })).toBe(false);
      expect(hasPermission({ user, resource: "user", action: "ban" })).toBe(false);

      expect(canAccessResource(user, { id: "task-own", userId: user.id }, "task", "update")).toBe(
        true,
      );
      expect(canAccessResource(user, { id: "file-own", ownerId: user.id }, "file", "delete")).toBe(
        true,
      );
      expect(
        canAccessResource(user, { id: "task-other", userId: "u-other" }, "task", "delete"),
      ).toBe(false);
      expect(canAccessResource(user, { id: "file-other", userId: "u-other" }, "file", "read")).toBe(
        false,
      );
    }
  });

  it("restricts viewer role to read-only permissions", () => {
    expect(hasPermission({ user: viewerUser, action: "task:read" })).toBe(true);
    expect(hasPermission({ user: viewerUser, action: "file:read" })).toBe(true);
    expect(hasPermission({ user: viewerUser, resource: "user", action: "get" })).toBe(true);
    expect(hasPermission({ user: viewerUser, resource: "session", action: "list" })).toBe(true);

    expect(hasPermission({ user: viewerUser, action: "task:create" })).toBe(false);
    expect(hasPermission({ user: viewerUser, action: "task:update" })).toBe(false);
    expect(hasPermission({ user: viewerUser, action: "task:delete" })).toBe(false);
    expect(hasPermission({ user: viewerUser, action: "file:create" })).toBe(false);
    expect(hasPermission({ user: viewerUser, action: "file:delete" })).toBe(false);
  });

  it("throws ForbiddenError (403) from requirePermission when access is denied", () => {
    expect(() =>
      requirePermission(memberUser, { resource: "task", action: "create" }),
    ).not.toThrow();

    try {
      requirePermission(viewerUser, { resource: "task", action: "delete" });
      expect.unreachable("Expected requirePermission to throw ForbiddenError");
    } catch (error) {
      expect(error).toBeInstanceOf(ForbiddenError);
      expect((error as ForbiddenError).status).toBe(403);
      expect((error as ForbiddenError)._tag).toBe("ForbiddenError");
    }
  });
});
