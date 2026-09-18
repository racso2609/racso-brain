import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { ACTIVE_TENANT_COOKIE } from "@/core/tenancy/context";
import { ensureUserDefaultTenant, type ProvisionableUser } from "@/core/tenancy/provisioning";

export async function findUserDefaultTenant(
  userOrId: string | ProvisionableUser
): Promise<string | null> {
  try {
    const user = typeof userOrId === "string" ? { id: userOrId } : userOrId;
    return await ensureUserDefaultTenant(user);
  } catch (error) {
    console.error("Error finding or provisioning default tenant for user:", error);
    return null;
  }
}

export async function handleAuthCallback(
  request: Request,
  supabaseClient?: ReturnType<typeof createClient> extends Promise<infer T> ? T : never,
  getTenantFn: (user: ProvisionableUser) => Promise<string | null> = findUserDefaultTenant
) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get("code");
  const next = requestUrl.searchParams.get("next") ?? "/";
  const error = requestUrl.searchParams.get("error");
  const errorDescription = requestUrl.searchParams.get("error_description");

  if (error) {
    const redirectUrl = new URL("/login", requestUrl.origin);
    redirectUrl.searchParams.set(errorDescription ? "error_description" : "error", errorDescription || error);
    if (errorDescription && error) {
      redirectUrl.searchParams.set("error", error);
    }
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
    let defaultTenantId: string | null = null;
    try {
      defaultTenantId = await getTenantFn(data.session.user);
    } catch (err) {
      console.error("Error ensuring default tenant in auth callback:", err);
    }

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
