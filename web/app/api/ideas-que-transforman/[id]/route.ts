import { NextResponse } from "next/server";
import { getAuthedApiUser, isAuthedApiUser } from "@/lib/auth-api";
import { roleMayAccessIdeasQueTransforman } from "@/lib/app-role";
import { aceptarIdea } from "@/lib/ideas-que-transforman-server";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

/** Marcar idea como aceptada. */
export async function PATCH(_req: Request, ctx: Ctx) {
  const auth = await getAuthedApiUser();
  if (!isAuthedApiUser(auth)) return auth;
  if (!roleMayAccessIdeasQueTransforman(auth.role)) {
    return NextResponse.json({ error: "No autorizado." }, { status: 403 });
  }

  const { id } = await ctx.params;
  const result = await aceptarIdea(id, auth.user.email ?? "");
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status ?? 500 });
  }

  return NextResponse.json({ ok: true, row: result.row });
}
