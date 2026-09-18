export const ACTIVE_TENANT_COOKIE = "active_tenant_id";

export interface MembershipReference {
  tenantId: string;
  isDefault?: boolean;
  role?: string;
}

/**
 * Resolves the active tenant ID with strict anti-cross-tenant protection (TC-BE-03).
 * If the cookie value points to a tenant where the user is NOT a member,
 * it is discarded and the user's default (or first) tenant is returned.
 */
export function resolveActiveTenantId(
  cookieTenantId: string | undefined,
  memberships: MembershipReference[]
): string | null {
  if (!memberships || memberships.length === 0) {
    return null;
  }

  // 1. If cookie is present, check if user is an actual member
  if (cookieTenantId) {
    const isMember = memberships.some((m) => m.tenantId === cookieTenantId);
    if (isMember) {
      return cookieTenantId;
    }
  }

  // 2. Fallback to default membership
  const defaultMembership = memberships.find((m) => m.isDefault);
  if (defaultMembership) {
    return defaultMembership.tenantId;
  }

  // 3. Fallback to first membership
  return memberships[0]?.tenantId ?? null;
}

/**
 * Reads the active tenant ID cookie from a Next.js cookie store
 */
export function getActiveTenantFromCookieStore(cookieStore: {
  get: (name: string) => { value: string } | undefined;
}): string | undefined {
  return cookieStore.get(ACTIVE_TENANT_COOKIE)?.value;
}

/**
 * Sets the active tenant cookie with security flags
 */
export function setActiveTenantInCookieStore(
  cookieStore: {
    set: (name: string, value: string, options: Record<string, unknown>) => void;
  },
  tenantId: string
): void {
  cookieStore.set(ACTIVE_TENANT_COOKIE, tenantId, {
    path: "/",
    sameSite: "lax",
    httpOnly: false, // Accessible by client components for instant sync if needed
    secure: process.env.NODE_ENV === "production",
    maxAge: 60 * 60 * 24 * 30, // 30 days
  });
}
