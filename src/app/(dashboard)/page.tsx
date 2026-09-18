import React from "react";
import { createClient } from "@/lib/supabase/server";
import { cookies } from "next/headers";
import { ACTIVE_TENANT_COOKIE } from "@/core/tenancy/context";
import { db } from "@/db";
import { tenantMemberships } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { DashboardLedgerView } from "@/components/shared/dashboard-ledger-view";
import { DollarSign, Clock, ArrowUpRight } from "lucide-react";

export default async function DashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const cookieStore = await cookies();
  const activeTenantId = cookieStore.get(ACTIVE_TENANT_COOKIE)?.value;

  let userRole: string | undefined = undefined;

  if (user && activeTenantId) {
    const [membership] = await db
      .select({ role: tenantMemberships.role })
      .from(tenantMemberships)
      .where(
        and(
          eq(tenantMemberships.userId, user.id),
          eq(tenantMemberships.tenantId, activeTenantId)
        )
      );
    userRole = membership?.role;
  }

  return (
    <div className="p-6 md:p-8 space-y-8">
      {/* Top Banner */}
      <div className="space-y-1">
        <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-foreground">
          Panel de Control
        </h1>
        <p className="text-sm text-muted-foreground">
          Visión panorámica de flujos de caja, compromisos pendientes y operaciones activas.
        </p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <div className="p-5 rounded-xl border border-border bg-card shadow-sm space-y-2">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-xs font-medium uppercase tracking-wider">Flujo de Caja del Mes</span>
            <DollarSign className="w-4 h-4 text-emerald-500" />
          </div>
          <div className="text-2xl font-bold text-foreground">$0.00 USD</div>
          <div className="text-xs text-muted-foreground">Devengado neto del período</div>
        </div>

        <div className="p-5 rounded-xl border border-border bg-card shadow-sm space-y-2">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-xs font-medium uppercase tracking-wider">Cuentas por Pagar</span>
            <Clock className="w-4 h-4 text-amber-500" />
          </div>
          <div className="text-2xl font-bold text-foreground">$0.00 USD</div>
          <div className="text-xs text-muted-foreground">Pendientes de liquidación</div>
        </div>

        <div className="p-5 rounded-xl border border-border bg-card shadow-sm space-y-2">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-xs font-medium uppercase tracking-wider">Cuentas por Cobrar</span>
            <ArrowUpRight className="w-4 h-4 text-primary" />
          </div>
          <div className="text-2xl font-bold text-foreground">$0.00 USD</div>
          <div className="text-xs text-muted-foreground">Hitos de proyectos emitidos</div>
        </div>
      </div>

      {/* Financial Ledger Section */}
      <div className="pt-2">
        <DashboardLedgerView userRole={userRole} />
      </div>
    </div>
  );
}
