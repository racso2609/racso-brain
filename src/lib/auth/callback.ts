import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { db } from "@/db";
import { tenantMemberships } from "@/db/schema";
import { eq } from "drizzle-orm";
import { ACTIVE_TENANT_COOKIE } from "@/core/tenancy/context";

export async function findUserDefaultTenant(userId: string): Promise<string | null> {
  try {
    const memberships = await db
      .select({
        tenantId: tenantMemberships.tenantId,
        isDefault: tenantMemberships.isDefault,
      })
      .from(tenantMemberships)
      .where(eq(tenantMemberships.userId, userId));

    const defaultMembership = memberships.find((m) => m.isDefault);
    return defaultMembership?.tenantId ?? memberships[0]?.tenantId ?? null;
  } catch (error) {
    console.error("Error finding default tenant for user:", error);
    return null;
  }
}

export async function handleAuthCallback(
  request: Request,
  supabaseClient?: ReturnType<typeof createClient> extends Promise<infer T> ? T : never,
  getTenantFn: (userId: string) => Promise<string | null> = findUserDefaultTenant
) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get("code");
  const next = requestUrl.searchParams.get("next") ?? "/";
  const error = requestUrl.searchParams.get("error");
  const errorDescription = requestUrl.searchParams.get("error_description");

  if (error) {
    const redirectUrl = new URL("/login", requestUrl.origin);
    redirectUrl.searchParams.set("error", errorDescription || error);
    return NextResponse.redirect(redirectUrl, { status: 303 });
  }

  if (!code) {
    const redirectUrl = new URL("/login", requestUrl.origin);
    redirectUrl.searchParams.set("error", "missing_code");
    return NextResponse.redirect(redirectUrl, { status: 303 });
  }

  const supabase = supabaseClient ?? (await createClient());
  const { data, error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);

  if (exchangeError || !data.session) {
    const redirectUrl = new URL("/login", requestUrl.origin);
    redirectUrl.searchParams.set(
      "error",
      exchangeError?.message || "auth_exchange_failed"
    );
    return NextResponse.redirect(redirectUrl, { status: 303 });
  }

  const redirectUrl = new URL(next.startsWith("/") ? next : `/${next}`, requestUrl.origin);
  const response = NextResponse.redirect(redirectUrl, { status: 303 });

  if (data.session.user) {
    const defaultTenantId = await getTenantFn(data.session.user.id);
    if (defaultTenantId) {
      response.cookies.set(ACTIVE_TENANT_COOKIE, defaultTenantId, {
        path: "/",
        sameSite: "lax",
        httpOnly: false,
        secure: process.env.NODE_ENV === "production",
        maxAge: 60 * 60 * 24 * 30,
      });
    }
  }

  return response;
}
