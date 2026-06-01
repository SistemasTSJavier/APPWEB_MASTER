import { NextResponse } from "next/server";
import { requireCategorizacionApi } from "@/lib/categorizacion-api-auth";
import { buildResumenCategorizacion } from "@/lib/categorizacion-server";
import { CAT_NIVEL_REGLAS, CAT_PAQUETE_REGLAS } from "@/lib/categorizacion-calificaciones";
import { isSupabaseServerConfigured, supabaseServerEnvMissing } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

export async function GET() {
  const gate = await requireCategorizacionApi();
  if ("error" in gate) return gate.error;
  if (!isSupabaseServerConfigured()) {
    return NextResponse.json({ error: "Supabase no configurado", missingEnv: supabaseServerEnvMissing() }, { status: 503 });
  }
  try {
    const rows = await buildResumenCategorizacion();
    return NextResponse.json({
      ok: true,
      rows,
      reglasNivel: CAT_NIVEL_REGLAS,
      reglasPaquete: CAT_PAQUETE_REGLAS,
      nota: "Promedio general = promedio de RH, Capacitación, Operaciones y Enfoque al cliente (escala 1–5).",
    });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Error" }, { status: 500 });
  }
}
