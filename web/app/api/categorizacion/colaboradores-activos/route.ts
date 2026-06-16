import { NextResponse } from "next/server";
import { requireCategorizacionApi } from "@/lib/categorizacion-api-auth";
import { listColaboradoresActivosParaCategorizacion } from "@/lib/categorizacion-server";
import { isSupabaseServerConfigured, supabaseServerEnvMissing } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

/** GET: colaboradores activos desde expedientes (sección Colaboradores). ?q= para filtrar. */
export async function GET(req: Request) {
  const gate = await requireCategorizacionApi();
  if ("error" in gate) return gate.error;
  if (!isSupabaseServerConfigured()) {
    return NextResponse.json({ error: "Supabase no configurado", missingEnv: supabaseServerEnvMissing() }, { status: 503 });
  }
  const url = new URL(req.url);
  const q = url.searchParams.get("q") ?? undefined;
  try {
    const rows = await listColaboradoresActivosParaCategorizacion(q);
    return NextResponse.json({ ok: true, rows, total: rows.length });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Error" }, { status: 500 });
  }
}
