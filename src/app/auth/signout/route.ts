import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { ACTIVE_TENANT_COOKIE } from "@/core/tenancy/context";

export async function POST(request: Request) {
  const supabase = await createClient();
  await supabase.auth.signOut();

  const url = new URL("/login", request.url);
  const response = NextResponse.redirect(url, { status: 303 });
  response.cookies.delete(ACTIVE_TENANT_COOKIE);

  return response;
}
