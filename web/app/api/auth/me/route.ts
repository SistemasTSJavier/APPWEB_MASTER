import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { APP_ROLE_LABEL, parseAppRole } from "@/lib/app-role";

export const dynamic = "force-dynamic";

/** Sesión actual y rol (para la UI). Sin sesión devuelve user: null. */
export async function GET() {
  try {
    const supabase = await createSupabaseServerClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ user: null, role: null, roleLabel: null, sinRol: false });
    }
    const role = parseAppRole(user.user_metadata?.app_role ?? user.app_metadata?.app_role);
    return NextResponse.json({
      user: { id: user.id, email: user.email },
      role,
      roleLabel: role ? APP_ROLE_LABEL[role] : null,
      sinRol: !role,
    });
  } catch {
    return NextResponse.json({ user: null, role: null, roleLabel: null, sinRol: false });
  }
}
