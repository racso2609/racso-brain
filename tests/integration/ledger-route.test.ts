import { describe, it, expect, vi } from "vitest";
import { handleGetLedger } from "@/core/ledger/handler";

describe("Ledger Route Multi-Tenant & RBAC Protection (/api/ledger)", () => {
  it("returns 401 Unauthorized when user is not authenticated", async () => {
    const request = new Request("http://localhost:3000/api/ledger");

    const response = await handleGetLedger(request, {
      getAuthUser: async () => null,
      getCookieTenantId: async () => undefined,
      getUserMemberships: async () => [],
      fetchTransactions: vi.fn(),
    });

    expect(response.status).toBe(401);
    const data = await response.json();
    expect(data.error).toBe("Unauthorized");
  });

  it("returns 403 Forbidden when user belongs to no tenants", async () => {
    const request = new Request("http://localhost:3000/api/ledger");

    const response = await handleGetLedger(request, {
      getAuthUser: async () => ({ id: "user-no-tenants" }),
      getCookieTenantId: async () => undefined,
      getUserMemberships: async () => [],
      fetchTransactions: vi.fn(),
    });

    expect(response.status).toBe(403);
    const data = await response.json();
    expect(data.error).toContain("No perteneces");
  });

  it("returns 403 Forbidden when user attempts access with a foreign tenant cookie", async () => {
    const request = new Request("http://localhost:3000/api/ledger");

    const response = await handleGetLedger(request, {
      getAuthUser: async () => ({ id: "user-1" }),
      getCookieTenantId: async () => "foreign-tenant-evil-corp",
      getUserMemberships: async () => [
        { tenantId: "valid-tenant-legit", role: "ADMIN", isDefault: true },
      ],
      fetchTransactions: vi.fn(),
    });

    expect(response.status).toBe(403);
    const data = await response.json();
    expect(data.error).toBe("Acceso no autorizado al tenant solicitado");
  });

  it("returns 403 Forbidden when user role lacks ledger:read permission (e.g. MAINTENANCE_OPERATOR)", async () => {
    const request = new Request("http://localhost:3000/api/ledger");

    const response = await handleGetLedger(request, {
      getAuthUser: async () => ({ id: "operator-user" }),
      getCookieTenantId: async () => "tenant-alpha",
      getUserMemberships: async () => [
        { tenantId: "tenant-alpha", role: "MAINTENANCE_OPERATOR", isDefault: true },
      ],
      fetchTransactions: vi.fn(),
    });

    expect(response.status).toBe(403);
    const data = await response.json();
    expect(data.error).toBe("No tienes permisos para consultar el libro financiero");
  });

  it("returns 200 OK and ledger data when user has ledger:read permission (ADMIN)", async () => {
    const mockData = {
      items: [
        {
          id: "tx-1",
          tenantId: "tenant-alpha",
          amount: "150.00",
          currency: "USD",
          txType: "EXPENSE",
          status: "COMMITTED",
        },
      ],
      nextCursor: null,
      hasMore: false,
    };

    const mockFetch = vi.fn().mockResolvedValue(mockData);

    const request = new Request("http://localhost:3000/api/ledger?limit=10");

    const response = await handleGetLedger(request, {
      getAuthUser: async () => ({ id: "admin-user" }),
      getCookieTenantId: async () => "tenant-alpha",
      getUserMemberships: async () => [
        { tenantId: "tenant-alpha", role: "ADMIN", isDefault: true },
      ],
      fetchTransactions: mockFetch,
    });

    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data).toEqual(mockData);
    expect(mockFetch).toHaveBeenCalledWith("tenant-alpha", expect.objectContaining({ limit: 10 }));
  });

  it("sanitizes unexpected internal errors and returns 500 with generic error message", async () => {
    const request = new Request("http://localhost:3000/api/ledger");

    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    const response = await handleGetLedger(request, {
      getAuthUser: async () => {
        throw new Error("DB Connection exploded: sensitive postgres credentials leaked");
      },
    });

    expect(response.status).toBe(500);
    const data = await response.json();
    expect(data.error).toBe("Error al procesar la solicitud del ledger");
    expect(consoleSpy).toHaveBeenCalled();

    consoleSpy.mockRestore();
  });
});
