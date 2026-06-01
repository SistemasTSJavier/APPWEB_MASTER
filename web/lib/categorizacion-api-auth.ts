import { NextResponse } from "next/server";
import { getAuthedApiUser, isAuthedApiUser } from "@/lib/auth-api";
import { roleMayAccessCategorizacion } from "@/lib/app-role";

export async function requireCategorizacionApi() {
  const auth = await getAuthedApiUser();
  if (!isAuthedApiUser(auth)) return { error: auth };
  if (!roleMayAccessCategorizacion(auth.role, auth.user.email)) {
    return { error: NextResponse.json({ error: "No autorizado para categorización" }, { status: 403 }) };
  }
  return { auth };
}
