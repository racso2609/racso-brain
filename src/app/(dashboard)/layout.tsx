import React from "react";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { db } from "@/db";
import { tenantMemberships, tenants } from "@/db/schema";
import { eq } from "drizzle-orm";
import { cookies } from "next/headers";
import {
  ACTIVE_TENANT_COOKIE,
  resolveActiveTenantId,
} from "@/core/tenancy/context";
import { TenantSwitcher } from "@/components/shared/tenant-switcher";
import Link from "next/link";
import {
  LayoutDashboard,
  Truck,
  FolderGit2,
  Receipt,
  Settings,
  LogOut,
} from "lucide-react";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  // Fetch user tenant memberships
  const memberships = await db
    .select({
      membershipId: tenantMemberships.id,
      tenantId: tenantMemberships.tenantId,
      role: tenantMemberships.role,
      isDefault: tenantMemberships.isDefault,
      tenantName: tenants.name,
      tenantSlug: tenants.slug,
    })
    .from(tenantMemberships)
    .innerJoin(tenants, eq(tenantMemberships.tenantId, tenants.id))
    .where(eq(tenantMemberships.userId, user.id));

  const cookieStore = await cookies();
  const cookieTenantId = cookieStore.get(ACTIVE_TENANT_COOKIE)?.value;

  const activeTenantId =
    resolveActiveTenantId(cookieTenantId, memberships) ??
    memberships[0]?.tenantId ??
    "";

  const tenantOptions = memberships.map((m) => ({
    id: m.tenantId,
    name: m.tenantName,
    role: m.role,
  }));

  return (
    <div className="min-h-screen flex flex-col md:flex-row bg-background">
      {/* Sidebar */}
      <aside className="w-full md:w-64 border-r border-border bg-card/50 flex flex-col justify-between p-4">
        <div className="space-y-6">
          <div className="flex items-center gap-2.5 px-2">
            <div className="h-8 w-8 rounded-lg bg-primary flex items-center justify-center text-primary-foreground font-bold text-sm">
              RB
            </div>
            <span className="font-bold tracking-tight text-foreground text-lg">
              racso-brain
            </span>
          </div>

          <div className="px-1">
            <TenantSwitcher
              activeTenantId={activeTenantId}
              tenants={tenantOptions}
            />
          </div>

          <nav className="space-y-1">
            <Link
              href="/"
              className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium bg-primary/10 text-primary transition-colors"
            >
              <LayoutDashboard className="w-4 h-4" />
              General
            </Link>
            <Link
              href="/assets"
              className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium text-muted-foreground hover:bg-muted/50 hover:text-foreground transition-colors"
            >
              <Truck className="w-4 h-4" />
              Activos
            </Link>
            <Link
              href="/projects"
              className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium text-muted-foreground hover:bg-muted/50 hover:text-foreground transition-colors"
            >
              <FolderGit2 className="w-4 h-4" />
              Proyectos
            </Link>
            <Link
              href="/finances"
              className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium text-muted-foreground hover:bg-muted/50 hover:text-foreground transition-colors"
            >
              <Receipt className="w-4 h-4" />
              Finanzas & Ledger
            </Link>
            <Link
              href="/settings"
              className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium text-muted-foreground hover:bg-muted/50 hover:text-foreground transition-colors"
            >
              <Settings className="w-4 h-4" />
              Configuración
            </Link>
          </nav>
        </div>

        {/* User profile footer */}
        <div className="pt-4 border-t border-border flex items-center justify-between px-2">
          <div className="truncate">
            <p className="text-xs font-medium text-foreground truncate">
              {user.email}
            </p>
            <p className="text-[10px] text-muted-foreground truncate">
              {user.user_metadata?.full_name || "Usuario Conectado"}
            </p>
          </div>
          <form action="/auth/signout" method="post">
            <button
              type="submit"
              title="Cerrar sesión"
              className="p-1.5 rounded-md hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </form>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col overflow-y-auto">
        {children}
      </main>
    </div>
  );
}
