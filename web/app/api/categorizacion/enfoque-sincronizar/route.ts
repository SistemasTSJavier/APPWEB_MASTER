import { NextResponse } from "next/server";
import { requireCategorizacionApi } from "@/lib/categorizacion-api-auth";
import { syncCatPersonalActivosPorServicio } from "@/lib/categorizacion-enfoque-acceso";
import { puedeGestionarCategorizacionCompleta } from "@/lib/categorizacion-enfoque-auth";
import { isSupabaseServerConfigured } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

/** POST: sincroniza cat_personal con colaboradores activos del servicio (Enfoque). */
export async function POST(req: Request) {
  const gate = await requireCategorizacionApi();
  if ("error" in gate) return gate.error;
  if (!puedeGestionarCategorizacionCompleta(gate.auth.role, gate.auth.user.email)) {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }
  if (!isSupabaseServerConfigured()) {
    return NextResponse.json({ error: "Supabase no configurado" }, { status: 503 });
  }
  let body: { servicio?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }
  try {
    const result = await syncCatPersonalActivosPorServicio(String(body.servicio ?? ""));
    return NextResponse.json({ ok: true, ...result });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Error" }, { status: 500 });
  }
}
