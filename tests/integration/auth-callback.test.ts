import { describe, it, expect, vi } from "vitest";
import { handleAuthCallback } from "@/lib/auth/callback";

describe("Supabase SSR Auth Callback Route Handler (TC-FE-02, TC-FE-03, TC-BE-08)", () => {
  it("exchanges code for session and redirects to next destination with active tenant cookie", async () => {
    const mockExchangeCode = vi.fn().mockResolvedValue({
      data: {
        session: { user: { id: "user-123", email: "user@example.com" } },
      },
      error: null,
    });

    const mockSupabase = {
      auth: {
        exchangeCodeForSession: mockExchangeCode,
      },
    };

    const mockFindUserDefaultTenant = vi.fn().mockResolvedValue("tenant-personal-456");

    const request = new Request(
      "http://localhost:3000/auth/callback?code=valid-pkce-code&next=/dashboard"
    );

    const response = await handleAuthCallback(
      request,
      mockSupabase as any,
      mockFindUserDefaultTenant
    );

    expect(mockExchangeCode).toHaveBeenCalledWith("valid-pkce-code");
    expect(mockFindUserDefaultTenant).toHaveBeenCalledWith(
      expect.objectContaining({ id: "user-123", email: "user@example.com" })
    );
    expect(response.status).toBe(303); // Redirect
    expect(response.headers.get("Location")).toBe("http://localhost:3000/dashboard");
    expect(response.headers.get("Set-Cookie")).toContain("active_tenant_id=tenant-personal-456");
  });

  it("provisions new tenant on first login and sets active_tenant_id cookie", async () => {
    const mockExchangeCode = vi.fn().mockResolvedValue({
      data: {
        session: {
          user: {
            id: "user-new-999",
            email: "newuser@example.com",
            user_metadata: { given_name: "Nuevo", family_name: "Usuario" },
          },
        },
      },
      error: null,
    });

    const mockSupabase = {
      auth: { exchangeCodeForSession: mockExchangeCode },
    };

    const mockProvisionTenant = vi.fn().mockResolvedValue("tenant-new-auto-provisioned");

    const request = new Request(
      "http://localhost:3000/auth/callback?code=first-time-pkce&next=/projects"
    );

    const response = await handleAuthCallback(
      request,
      mockSupabase as any,
      mockProvisionTenant
    );

    expect(mockProvisionTenant).toHaveBeenCalledWith(
      expect.objectContaining({
        id: "user-new-999",
        email: "newuser@example.com",
        user_metadata: { given_name: "Nuevo", family_name: "Usuario" },
      })
    );
    expect(response.status).toBe(303);
    expect(response.headers.get("Location")).toBe("http://localhost:3000/projects");
    expect(response.headers.get("Set-Cookie")).toContain("active_tenant_id=tenant-new-auto-provisioned");
  });

  it("redirects to /login with error query if code exchange fails", async () => {
    const mockExchangeCode = vi.fn().mockResolvedValue({
      data: { session: null },
      error: new Error("Invalid OAuth code"),
    });

    const mockSupabase = {
      auth: {
        exchangeCodeForSession: mockExchangeCode,
      },
    };

    const request = new Request(
      "http://localhost:3000/auth/callback?code=bad-code"
    );

    const response = await handleAuthCallback(
      request,
      mockSupabase as any,
      vi.fn()
    );

    expect(response.status).toBe(303);
    expect(response.headers.get("Location")).toContain("/login?error=");
  });

  it("redirects to /login if code parameter is missing", async () => {
    const request = new Request("http://localhost:3000/auth/callback");

    const response = await handleAuthCallback(request, {} as any, vi.fn());
    expect(response.status).toBe(303);
    expect(response.headers.get("Location")).toContain("/login?error=missing_code");
  });
});
