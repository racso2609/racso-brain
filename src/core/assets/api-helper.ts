import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { cookies } from "next/headers";
import { ACTIVE_TENANT_COOKIE, resolveActiveTenantId } from "@/core/tenancy/context";
import { hasPermission, type PermissionCode } from "@/core/rbac/permissions";
import { db } from "@/db";
import { tenantMemberships } from "@/db/schema";
import { eq } from "drizzle-orm";
import { ensureUserDefaultTenant, type ProvisionableUser } from "@/core/tenancy/provisioning";

export interface AssetRouteAuthDeps {
  getAuthUser?: () => Promise<{ id: string; email?: string } | null>;
  getCookieTenantId?: () => Promise<string | undefined>;
  getUserMemberships?: (
    userId: string
  ) => Promise<Array<{ tenantId: string; role: string; isDefault?: boolean }>>;
  ensureUserTenant?: (user: ProvisionableUser) => Promise<string | null>;
}

export type AuthTenantResult =
  | {
      user: { id: string; email?: string };
      tenantId: string;
      role: string;
      errorResponse?: never;
    }
  | {
      user?: never;
      tenantId?: never;
      role?: never;
      errorResponse: NextResponse;
    };

export async function resolveAuthAndTenant(
  permission: PermissionCode,
  deps?: AssetRouteAuthDeps
): Promise<AuthTenantResult> {
  const user = deps?.getAuthUser
    ? await deps.getAuthUser()
    : await (async () => {
        const supabase = await createClient();
        const {
          data: { user },
        } = await supabase.auth.getUser();
        return user ? { id: user.id, email: user.email } : null;
      })();

  if (!user) {
    return {
      errorResponse: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    };
  }

  const cookieTenantId = deps?.getCookieTenantId
    ? await deps.getCookieTenantId()
    : (await cookies()).get(ACTIVE_TENANT_COOKIE)?.value;

  let memberships = deps?.getUserMemberships
    ? await deps.getUserMemberships(user.id)
    : await db
        .select({
          tenantId: tenantMemberships.tenantId,
          role: tenantMemberships.role,
          isDefault: tenantMemberships.isDefault,
        })
        .from(tenantMemberships)
        .where(eq(tenantMemberships.userId, user.id));

  if (!memberships || memberships.length === 0) {
    let provisionedTenantId: string | null = null;
    try {
      provisionedTenantId = deps?.ensureUserTenant
        ? await deps.ensureUserTenant(user)
        : await ensureUserDefaultTenant(user);
    } catch (provisioningError) {
      console.error("Self-healing provisioning error in asset route:", provisioningError);
      provisionedTenantId = null;
    }

    if (provisionedTenantId) {
      memberships = [
        {
          tenantId: provisionedTenantId,
          role: "OWNER",
          isDefault: true,
        },
      ];
    } else {
      return {
        errorResponse: NextResponse.json(
          { error: "No perteneces a ninguna organización o empresa" },
          { status: 403 }
        ),
      };
    }
  }

  if (cookieTenantId) {
    const isMember = memberships.some((m) => m.tenantId === cookieTenantId);
    if (!isMember) {
      return {
        errorResponse: NextResponse.json(
          { error: "Acceso no autorizado al tenant solicitado" },
          { status: 403 }
        ),
      };
    }
  }

  const activeTenantId = resolveActiveTenantId(cookieTenantId, memberships);
  if (!activeTenantId) {
    return {
      errorResponse: NextResponse.json(
        { error: "No se encontró un tenant activo para el usuario" },
        { status: 403 }
      ),
    };
  }

  const activeMembership = memberships.find((m) => m.tenantId === activeTenantId);
  if (!activeMembership || !hasPermission(activeMembership.role, permission)) {
    return {
      errorResponse: NextResponse.json(
        { error: "No tienes permisos suficientes para realizar esta acción" },
        { status: 403 }
      ),
    };
  }

  return {
    user,
    tenantId: activeTenantId,
    role: activeMembership.role,
  };
}
