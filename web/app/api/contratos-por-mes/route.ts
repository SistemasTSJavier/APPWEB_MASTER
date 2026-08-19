import { NextResponse } from "next/server";
import { getAuthedApiUser, isAuthedApiUser } from "@/lib/auth-api";
import { userMayAccessContratosPorMes } from "@/lib/app-role";
import type { ContratosPorMesPeriodo } from "@/lib/contratos-por-mes";
import { buildContratosPorMesReportServer } from "@/lib/contratos-por-mes-server";

export const dynamic = "force-dynamic";

/** Colaboradores con al menos 1 día laborado en cuadrícula para el mes o año indicado. */
export async function GET(req: Request) {
  const auth = await getAuthedApiUser();
  if (!isAuthedApiUser(auth)) return auth;
  const meta = (auth.user.user_metadata ?? null) as Record<string, unknown> | null;
  if (!userMayAccessContratosPorMes(auth.role, meta)) {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }

  const url = new URL(req.url);
  const periodoRaw = url.searchParams.get("periodo")?.trim();
  const periodo: ContratosPorMesPeriodo = periodoRaw === "anio" ? "anio" : "mes";
  const mesYm = url.searchParams.get("mes")?.trim() || undefined;
  const anioRaw = url.searchParams.get("anio")?.trim();
  const anio = anioRaw ? Number(anioRaw) : undefined;
  const servicio = url.searchParams.get("servicio")?.trim() || "";
  const force = url.searchParams.get("refresh") === "1";

  const report = await buildContratosPorMesReportServer({
    periodo,
    mesYm,
    anio,
    servicio,
    forceRefresh: force,
  });

  return NextResponse.json({
    ...report,
    total: report.rows.length,
  });
}
