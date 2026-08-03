import { NextResponse } from "next/server";
import { requireCategorizacionApi } from "@/lib/categorizacion-api-auth";
import { buildResumenCategorizacion, periodMonthEvaluacion } from "@/lib/categorizacion-server";
import { CAT_NIVEL_REGLAS, CAT_PAQUETE_REGLAS } from "@/lib/categorizacion-calificaciones";
import { isSupabaseServerConfigured, supabaseServerEnvMissing } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const gate = await requireCategorizacionApi();
  if ("error" in gate) return gate.error;
  if (!isSupabaseServerConfigured()) {
    return NextResponse.json({ error: "Supabase no configurado", missingEnv: supabaseServerEnvMissing() }, { status: 503 });
  }
  try {
    const url = new URL(req.url);
    const periodMonth = periodMonthEvaluacion(
      url.searchParams.get("mes") ?? url.searchParams.get("period_month"),
    );
    const rows = await buildResumenCategorizacion(null, { periodMonth });
    return NextResponse.json({
      ok: true,
      rows,
      periodMonth,
      reglasNivel: CAT_NIVEL_REGLAS,
      reglasPaquete: CAT_PAQUETE_REGLAS,
      nota: "Promedio general del mes elegido = promedio de RH, Capacitación, Operaciones y Enfoque al cliente (escala 1–5).",
    });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Error" }, { status: 500 });
  }
}
