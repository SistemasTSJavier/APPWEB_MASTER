import { createSupabaseServerClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

async function signOutAndRedirect(request: Request) {
  const login = new URL("/login", request.url);
  try {
    const supabase = await createSupabaseServerClient();
    await supabase.auth.signOut();
  } catch {
    /* Sin Supabase o sesión ya inválida: redirigir igual a login */
  }
  return NextResponse.redirect(login, { status: 303 });
}

export async function POST(request: Request) {
  return signOutAndRedirect(request);
}

export async function GET(request: Request) {
  return signOutAndRedirect(request);
}
