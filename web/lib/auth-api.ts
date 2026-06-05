import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { resolveAppRoleFromUser, type AppRole } from "@/lib/app-role";
import type { User } from "@supabase/supabase-js";

export type AuthedApiUser = { user: User; role: AppRole };

export async function getAuthedApiUser(): Promise<AuthedApiUser | NextResponse> {
  try {
    const supabase = await createSupabaseServerClient();
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser();
    if (error || !user) {
      return NextResponse.json({ error: "Sesion invalida o expirada. Inicia sesion de nuevo." }, { status: 401 });
    }
    const role = resolveAppRoleFromUser(user);
    if (!role) {
      return NextResponse.json(
        {
          error:
            'Tu usuario no tiene rol (app_role). Un administrador debe asignarlo en Supabase: Authentication → Users → User Metadata, p. ej. {"app_role":"rh"} o {"app_role":"relaciones_laborales"}.',
        },
        { status: 403 },
      );
    }
    return { user, role };
  } catch {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }
}

export function isAuthedApiUser(r: AuthedApiUser | NextResponse): r is AuthedApiUser {
  return !(r instanceof NextResponse);
}
