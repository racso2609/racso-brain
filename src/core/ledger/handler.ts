import { NextResponse, type NextRequest } from "next/server";
import { getLedgerTransactions } from "@/core/ledger/queries";
import { createClient } from "@/lib/supabase/server";
import { cookies } from "next/headers";
import { ACTIVE_TENANT_COOKIE, resolveActiveTenantId } from "@/core/tenancy/context";
import { hasPermission } from "@/core/rbac/permissions";
import { db } from "@/db";
import { tenantMemberships } from "@/db/schema";
import { eq } from "drizzle-orm";
import { CursorPaginationParamsSchema } from "@/lib/pagination/cursor";

export interface LedgerRouteDependencies {
  getAuthUser?: () => Promise<{ id: string; email?: string } | null>;
  getCookieTenantId?: () => Promise<string | undefined>;
  getUserMemberships?: (
    userId: string
  ) => Promise<Array<{ tenantId: string; role: string; isDefault?: boolean }>>;
  fetchTransactions?: (tenantId: string, params: unknown) => Promise<unknown>;
}

export async function handleGetLedger(
  request: Request | NextRequest,
  deps?: LedgerRouteDependencies
) {
  try {
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
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const cookieTenantId = deps?.getCookieTenantId
      ? await deps.getCookieTenantId()
      : (await cookies()).get(ACTIVE_TENANT_COOKIE)?.value;

    const memberships = deps?.getUserMemberships
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
      return NextResponse.json(
        { error: "No perteneces a ninguna organización o empresa" },
        { status: 403 }
      );
    }

    if (cookieTenantId) {
      const isMember = memberships.some((m) => m.tenantId === cookieTenantId);
      if (!isMember) {
        return NextResponse.json(
          { error: "Acceso no autorizado al tenant solicitado" },
          { status: 403 }
        );
      }
    }

    const activeTenantId = resolveActiveTenantId(cookieTenantId, memberships);
    if (!activeTenantId) {
      return NextResponse.json(
        { error: "No se encontró un tenant activo para el usuario" },
        { status: 403 }
      );
    }

    const activeMembership = memberships.find((m) => m.tenantId === activeTenantId);
    if (!activeMembership || !hasPermission(activeMembership.role, "ledger:read")) {
      return NextResponse.json(
        { error: "No tienes permisos para consultar el libro financiero" },
        { status: 403 }
      );
    }

    const searchParams = new URL(request.url).searchParams;
    const parsedParams = CursorPaginationParamsSchema.parse({
      limit: searchParams.get("limit") || 10,
      cursor: searchParams.get("cursor") || undefined,
    });

    const result = deps?.fetchTransactions
      ? await deps.fetchTransactions(activeTenantId, parsedParams)
      : await getLedgerTransactions(activeTenantId, parsedParams);

    return NextResponse.json(result);
  } catch (error: unknown) {
    console.error("API /api/ledger error:", error);
    return NextResponse.json(
      { error: "Error al procesar la solicitud del ledger" },
      { status: 500 }
    );
  }
}
