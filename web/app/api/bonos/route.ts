import { NextResponse } from "next/server";
import { getAuthedUserWithRole } from "@/lib/auth-server";
import { roleMayAccessBonos } from "@/lib/app-role";
import { buildBonosReport, parseBonosMilestone } from "@/lib/bonos-server";
import { createSupabaseServiceRoleClient, isSupabaseServerConfigured, supabaseServerEnvMissing } from "@/lib/supabase/admin";
import { dateToIsoYmd, mondayOfWeek } from "@/lib/semana-lun-dom";

export const dynamic = "force-dynamic";

/** GET: reporte de bonos por asistencia (sin F ni PSGS en el periodo de cada hito; CAP no descalifica). */
export async function GET(req: Request) {
  const auth = await getAuthedUserWithRole();
  if (!auth) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  if (!roleMayAccessBonos(auth.role)) {
    return NextResponse.json({ error: "Sin permiso para Bonos" }, { status: 403 });
  }
  if (!isSupabaseServerConfigured()) {
    return NextResponse.json(
      { error: "Supabase no configurado", missingEnv: supabaseServerEnvMissing() },
      { status: 503 },
    );
  }

  const url = new URL(req.url);
  const servicio = url.searchParams.get("servicio")?.trim() || undefined;
  const bonoDias = parseBonosMilestone(url.searchParams.get("bono"));
  const weekStartIso =
    url.searchParams.get("weekStartIso")?.trim() || dateToIsoYmd(mondayOfWeek(new Date()));

  try {
    const admin = createSupabaseServiceRoleClient();
    if (!admin) {
      return NextResponse.json({ error: "Supabase no configurado" }, { status: 503 });
    }
    const payload = await buildBonosReport(admin, { servicio, bonoDias, weekStartIso });
    return NextResponse.json({ ok: true, ...payload });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Error al generar bonos" },
      { status: 500 },
    );
  }
}
