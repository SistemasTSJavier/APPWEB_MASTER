import { cache } from "react";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { parseAppRole, type AppRole } from "@/lib/app-role";
import type { User } from "@supabase/supabase-js";

export type AuthedUser = { user: User; role: AppRole };

async function getAuthedUserWithRoleUncached(): Promise<AuthedUser | null> {
  try {
    const supabase = await createSupabaseServerClient();
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser();
    if (error || !user) return null;
    const role = parseAppRole(user.user_metadata?.app_role ?? user.app_metadata?.app_role);
    if (!role) return null;
    return { user, role };
  } catch {
    return null;
  }
}

/** Una sola lectura de sesión por request de RSC (layout + page comparten resultado). */
export const getAuthedUserWithRole = cache(getAuthedUserWithRoleUncached);
