import { describe, it, expect } from "vitest";
import { resolveActiveTenantId } from "@/core/tenancy/context";

describe("Tenancy Context Resolution (TC-BE-03)", () => {
  const userMemberships = [
    { tenantId: "tenant-personal-111", isDefault: true, role: "OWNER" },
    { tenantId: "tenant-company-222", isDefault: false, role: "ADMIN" },
  ];

  it("returns the tenant ID from cookie if user is a member of that tenant", () => {
    const activeTenant = resolveActiveTenantId(
      "tenant-company-222",
      userMemberships
    );
    expect(activeTenant).toBe("tenant-company-222");
  });

  it("TC-BE-03: ignores tampered cookie and falls back to default tenant if user is NOT a member", () => {
    const tamperedCookieTenant = "foreign-tenant-999-evil";
    const activeTenant = resolveActiveTenantId(
      tamperedCookieTenant,
      userMemberships
    );

    // Must fallback to the user's default tenant, never leaking foreign tenant
    expect(activeTenant).toBe("tenant-personal-111");
  });

  it("falls back to default tenant if cookie is missing or empty", () => {
    expect(resolveActiveTenantId(undefined, userMemberships)).toBe("tenant-personal-111");
    expect(resolveActiveTenantId("", userMemberships)).toBe("tenant-personal-111");
  });

  it("falls back to first available membership if no membership is flagged as default", () => {
    const noDefaultMemberships = [
      { tenantId: "tenant-first-333", isDefault: false, role: "MEMBER" },
      { tenantId: "tenant-second-444", isDefault: false, role: "MEMBER" },
    ];
    expect(resolveActiveTenantId(undefined, noDefaultMemberships)).toBe("tenant-first-333");
  });

  it("returns null if user has no memberships", () => {
    expect(resolveActiveTenantId("any-cookie", [])).toBeNull();
  });
});
