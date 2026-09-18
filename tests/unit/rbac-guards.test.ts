import { describe, it, expect } from "vitest";
import {
  hasPermission,
  SYSTEM_ROLES,
  PERMISSIONS,
  type PermissionCode,
} from "@/core/rbac/permissions";
import {
  requirePermission,
  ForbiddenError,
  UnauthorizedError,
} from "@/core/rbac/guards";

describe("RBAC Permissions and Guards (TC-BE-04, TC-BE-05, TC-BE-06)", () => {
  it("TC-BE-06: correctly resolves system roles and permissions hierarchy", () => {
    // OWNER has all permissions
    expect(hasPermission("OWNER", "ledger:write")).toBe(true);
    expect(hasPermission("OWNER", "ledger:read")).toBe(true);
    expect(hasPermission("OWNER", "tenancy:admin")).toBe(true);
    expect(hasPermission("OWNER", "projects:read_sensitive")).toBe(true);

    // ADMIN has ledger:write, ledger:read, etc.
    expect(hasPermission("ADMIN", "ledger:write")).toBe(true);
    expect(hasPermission("ADMIN", "tenancy:admin")).toBe(false);

    // MAINTENANCE_OPERATOR has assets, but NOT ledger:write or ledger:read
    expect(hasPermission("MAINTENANCE_OPERATOR", "assets:read")).toBe(true);
    expect(hasPermission("MAINTENANCE_OPERATOR", "assets:write")).toBe(true);
    expect(hasPermission("MAINTENANCE_OPERATOR", "ledger:write")).toBe(false);
    expect(hasPermission("MAINTENANCE_OPERATOR", "ledger:read")).toBe(false);

    // FINANCIAL_AUDITOR has ledger:read only
    expect(hasPermission("FINANCIAL_AUDITOR", "ledger:read")).toBe(true);
    expect(hasPermission("FINANCIAL_AUDITOR", "ledger:write")).toBe(false);

    // Unknown role has no permissions
    expect(hasPermission("NON_EXISTENT_ROLE", "ledger:read")).toBe(false);
  });

  it("TC-BE-04: grants authorization when user has required permission (OWNER / ADMIN)", async () => {
    const mockContext = {
      user: { id: "u-1", email: "admin@example.com" },
      membership: { role: "ADMIN", tenantId: "tenant-1" },
    };

    const guardResult = await requirePermission(
      "ledger:write",
      async () => mockContext
    );

    expect(guardResult).toEqual(mockContext);
  });

  it("TC-BE-05: rejects with ForbiddenError (403) when role lacks permission (MAINTENANCE_OPERATOR)", async () => {
    const mockContext = {
      user: { id: "u-2", email: "tech@example.com" },
      membership: { role: "MAINTENANCE_OPERATOR", tenantId: "tenant-1" },
    };

    await expect(
      requirePermission("ledger:write", async () => mockContext)
    ).rejects.toThrow(ForbiddenError);

    try {
      await requirePermission("ledger:write", async () => mockContext);
    } catch (err: any) {
      expect(err.statusCode).toBe(403);
      expect(err.message).toContain("Forbidden");
    }
  });

  it("rejects with UnauthorizedError (401) when user is unauthenticated", async () => {
    await expect(
      requirePermission("ledger:read", async () => {
        throw new UnauthorizedError("Session not found");
      })
    ).rejects.toThrow(UnauthorizedError);
  });
});
