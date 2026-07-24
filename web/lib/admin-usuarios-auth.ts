import { NextResponse } from "next/server";
import { getAuthedApiUser, isAuthedApiUser } from "@/lib/auth-api";
import { roleMayAccessAdminUsuarios, type AppRole } from "@/lib/app-role";

export type AdminUsuariosApiAuth = {
  user: { id: string; email?: string | null };
  role: AppRole;
};

export async function requireAdminUsuariosApi(): Promise<
  { auth: AdminUsuariosApiAuth } | { error: NextResponse }
> {
  const auth = await getAuthedApiUser();
  if (!isAuthedApiUser(auth)) return { error: auth };
  if (!roleMayAccessAdminUsuarios(auth.role)) {
    return { error: NextResponse.json({ error: "Solo administrador." }, { status: 403 }) };
  }
  return {
    auth: {
      user: { id: auth.user.id, email: auth.user.email },
      role: auth.role,
    },
  };
}
