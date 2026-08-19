import { NextResponse } from "next/server";
import { getAuthedApiUser, isAuthedApiUser } from "@/lib/auth-api";
import { userMayAccessContratosPorMes } from "@/lib/app-role";
import { buildContratosPorMesReportServer } from "@/lib/contratos-por-mes-server";

export const dynamic = "force-dynamic";

/** Colaboradores con al menos 1 día laborado en cuadrícula para el mes indicado. */
export async function GET(req: Request) {
  const auth = await getAuthedApiUser();
  if (!isAuthedApiUser(auth)) return auth;
  const meta = (auth.user.user_metadata ?? null) as Record<string, unknown> | null;
  if (!userMayAccessContratosPorMes(auth.role, meta)) {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }

  const url = new URL(req.url);
  const mesYm = url.searchParams.get("mes")?.trim() || undefined;
  const servicio = url.searchParams.get("servicio")?.trim() || "";
  const force = url.searchParams.get("refresh") === "1";

  const report = await buildContratosPorMesReportServer({
    mesYm,
    servicio,
    forceRefresh: force,
  });

  return NextResponse.json({
    ...report,
    total: report.rows.length,
  });
}
