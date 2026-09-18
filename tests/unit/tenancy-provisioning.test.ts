import { describe, it, expect, vi } from "vitest";
import { ensureUserDefaultTenant, extractUserProfile } from "@/core/tenancy/provisioning";

describe("Tenant Self-Healing Provisioning (ensureUserDefaultTenant)", () => {
  describe("extractUserProfile", () => {
    it("extracts given_name, family_name, and avatar_url from user_metadata", () => {
      const user = {
        id: "user-111",
        email: "carlos@example.com",
        user_metadata: {
          given_name: "Carlos",
          family_name: "Gomez",
          avatar_url: "https://avatar.com/carlos.jpg",
        },
      };
      const profile = extractUserProfile(user);
      expect(profile.firstName).toBe("Carlos");
      expect(profile.lastName).toBe("Gomez");
      expect(profile.fullName).toBe("Carlos Gomez");
      expect(profile.avatarUrl).toBe("https://avatar.com/carlos.jpg");
      expect(profile.email).toBe("carlos@example.com");
    });

    it("falls back to email prefix and placeholder when metadata is missing", () => {
      const user = {
        id: "user-222",
        email: "ana.martinez@corp.com",
      };
      const profile = extractUserProfile(user);
      expect(profile.firstName).toBe("ana.martinez");
      expect(profile.fullName).toBe("ana.martinez");
      expect(profile.avatarUrl).toBeNull();
      expect(profile.email).toBe("ana.martinez@corp.com");
    });

    it("handles raw_user_meta_data from Supabase triggers", () => {
      const user = {
        id: "user-333",
        email: "dev@example.com",
        raw_user_meta_data: {
          given_name: "David",
          family_name: "Developer",
        },
      };
      const profile = extractUserProfile(user);
      expect(profile.firstName).toBe("David");
      expect(profile.fullName).toBe("David Developer");
    });
  });

  describe("Idempotency: existing memberships", () => {
    it("returns default membership tenant ID without creating new records", async () => {
      const mockSelect = vi.fn().mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([
            { tenantId: "tenant-other", isDefault: false },
            { tenantId: "tenant-default-123", isDefault: true },
          ]),
        }),
      });

      const mockDb = {
        select: mockSelect,
        transaction: vi.fn(),
      };

      const tenantId = await ensureUserDefaultTenant(
        { id: "user-has-memberships", email: "user@example.com" },
        mockDb as any
      );

      expect(tenantId).toBe("tenant-default-123");
      expect(mockDb.transaction).not.toHaveBeenCalled();
    });

    it("returns first membership tenant ID if no default membership is flagged", async () => {
      const mockSelect = vi.fn().mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([
            { tenantId: "tenant-first-999", isDefault: false },
          ]),
        }),
      });

      const mockDb = {
        select: mockSelect,
        transaction: vi.fn(),
      };

      const tenantId = await ensureUserDefaultTenant(
        { id: "user-single-membership", email: "user@example.com" },
        mockDb as any
      );

      expect(tenantId).toBe("tenant-first-999");
      expect(mockDb.transaction).not.toHaveBeenCalled();
    });
  });

  describe("Self-healing provisioning: 0 existing memberships", () => {
    it("atomically upserts user, creates default tenant, and inserts OWNER membership", async () => {
      const user = {
        id: "12345678-abcd-ef00-1122-334455667788",
        email: "roberto@example.com",
        user_metadata: {
          given_name: "Roberto",
          family_name: "Perez",
          avatar_url: "https://avatar.com/roberto.png",
        },
      };

      const capturedUserValues: any[] = [];
      const capturedTenantValues: any[] = [];
      const capturedMembershipValues: any[] = [];

      const mockTx = {
        select: vi.fn().mockReturnValue({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue([]), // No collision on slug
            }),
          }),
        }),
        insert: vi.fn((table: any) => {
          return {
            values: (val: any) => {
              if (val.email && val.fullName) {
                capturedUserValues.push(val);
                return {
                  onConflictDoUpdate: vi.fn().mockResolvedValue({}),
                };
              } else if (val.name && val.slug) {
                capturedTenantValues.push(val);
                return {
                  returning: vi.fn().mockResolvedValue([{ id: "new-tenant-uuid-1" }]),
                };
              } else if (val.tenantId && val.role) {
                capturedMembershipValues.push(val);
                return Promise.resolve();
              }
              return Promise.resolve();
            },
          };
        }),
      };

      // Outer select returns []
      const mockDb = {
        select: vi.fn().mockReturnValue({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockResolvedValue([]),
          }),
        }),
        transaction: vi.fn(async (cb: any) => {
          return await cb(mockTx);
        }),
      };

      const tenantId = await ensureUserDefaultTenant(user, mockDb as any);

      expect(tenantId).toBe("new-tenant-uuid-1");
      expect(mockDb.transaction).toHaveBeenCalled();

      // Verify User upsert
      expect(capturedUserValues).toHaveLength(1);
      expect(capturedUserValues[0]).toMatchObject({
        id: user.id,
        email: "roberto@example.com",
        fullName: "Roberto Perez",
        avatarUrl: "https://avatar.com/roberto.png",
      });

      // Verify Tenant creation
      expect(capturedTenantValues).toHaveLength(1);
      expect(capturedTenantValues[0]).toMatchObject({
        name: "Espacio Personal de Roberto",
        slug: "workspace-12345678",
        isActive: true,
      });

      // Verify Membership creation
      expect(capturedMembershipValues).toHaveLength(1);
      expect(capturedMembershipValues[0]).toMatchObject({
        userId: user.id,
        tenantId: "new-tenant-uuid-1",
        role: "OWNER",
        isDefault: true,
      });
    });

    it("handles slug collision by generating alternate slug", async () => {
      const user = {
        id: "aabbccdd-1122-3344-5566-77889900aabb",
        email: "collistion@example.com",
      };

      const capturedTenantValues: any[] = [];

      const mockTx = {
        select: vi.fn().mockReturnValue({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              // First check in transaction finds no memberships
              limit: vi.fn().mockResolvedValue([{ id: "existing-tenant" }]), // Collision found
            }),
          }),
        }),
        insert: vi.fn((table: any) => ({
          values: (val: any) => {
            if (val.slug) {
              capturedTenantValues.push(val);
              return {
                returning: vi.fn().mockResolvedValue([{ id: "new-tenant-uuid-2" }]),
              };
            }
            if (val.email) {
              return {
                onConflictDoUpdate: vi.fn().mockResolvedValue({}),
              };
            }
            return Promise.resolve();
          },
        })),
      };

      const mockDb = {
        select: vi.fn().mockReturnValue({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockResolvedValue([]),
          }),
        }),
        transaction: vi.fn(async (cb: any) => cb(mockTx)),
      };

      const tenantId = await ensureUserDefaultTenant(user, mockDb as any);

      expect(tenantId).toBe("new-tenant-uuid-2");
      expect(capturedTenantValues).toHaveLength(1);
      // Alternate slug uses stripped hyphens and longer slice
      expect(capturedTenantValues[0].slug).toBe("workspace-aabbccdd1122");
    });

    it("throws error if tenant insert fails to return an id", async () => {
      const user = {
        id: "err-user-1",
        email: "err@example.com",
      };

      const mockTx = {
        select: vi.fn().mockReturnValue({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue([]),
            }),
          }),
        }),
        insert: vi.fn(() => ({
          values: (val: any) => {
            if (val.slug) {
              return {
                returning: vi.fn().mockResolvedValue([]), // Empty return
              };
            }
            if (val.email) {
              return {
                onConflictDoUpdate: vi.fn().mockResolvedValue({}),
              };
            }
            return Promise.resolve();
          },
        })),
      };

      const mockDb = {
        select: vi.fn().mockReturnValue({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockResolvedValue([]),
          }),
        }),
        transaction: vi.fn(async (cb: any) => cb(mockTx)),
      };

      await expect(ensureUserDefaultTenant(user, mockDb as any)).rejects.toThrow(
        "Failed to provision default personal tenant"
      );
    });

    it("truncates long OAuth names and slugs to 255 characters defensiverly", async () => {
      const veryLongName = "A".repeat(300);
      const user = {
        id: "long-name-user-1234567890",
        email: "long@example.com",
        user_metadata: {
          given_name: veryLongName,
          full_name: veryLongName,
        },
      };

      const capturedTenantValues: any[] = [];
      const capturedUserValues: any[] = [];

      const mockTx = {
        select: vi.fn().mockReturnValue({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue([]),
            }),
          }),
        }),
        insert: vi.fn(() => ({
          values: (val: any) => {
            if (val.slug) {
              capturedTenantValues.push(val);
              return {
                returning: vi.fn().mockResolvedValue([{ id: "truncated-tenant-id" }]),
              };
            }
            if (val.email) {
              capturedUserValues.push(val);
              return {
                onConflictDoUpdate: vi.fn().mockResolvedValue({}),
              };
            }
            return Promise.resolve();
          },
        })),
      };

      const mockDb = {
        select: vi.fn().mockReturnValue({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockResolvedValue([]),
          }),
        }),
        transaction: vi.fn(async (cb: any) => cb(mockTx)),
      };

      const tenantId = await ensureUserDefaultTenant(user, mockDb as any);
      expect(tenantId).toBe("truncated-tenant-id");
      expect(capturedTenantValues[0].name.length).toBeLessThanOrEqual(255);
      expect(capturedTenantValues[0].slug.length).toBeLessThanOrEqual(255);
      expect(capturedUserValues[0].fullName.length).toBeLessThanOrEqual(255);
    });
  });
});
