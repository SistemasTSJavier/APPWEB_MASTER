import { NextResponse } from "next/server";
import { getAuthedApiUser, isAuthedApiUser } from "@/lib/auth-api";
import { roleMayAccessGerenteLegalContratos } from "@/lib/app-role";

export async function requireGerenteLegalApi() {
  const auth = await getAuthedApiUser();
  if (!isAuthedApiUser(auth)) return { error: auth } as const;
  if (!roleMayAccessGerenteLegalContratos(auth.role)) {
    return {
      error: NextResponse.json({ error: "No autorizado para Gerente Legal" }, { status: 403 }),
    } as const;
  }
  return { auth } as const;
}
