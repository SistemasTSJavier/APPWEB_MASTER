import { NextResponse } from "next/server";
import { getAuthedApiUser, isAuthedApiUser } from "@/lib/auth-api";
import { roleMayAccessGestoresProceso } from "@/lib/app-role";
import {
  buildGestoresProcesoReport,
  type GestorProcesoPeriodo,
} from "@/lib/gestores-proceso";
import { listColaboradoresGestoresServer } from "@/lib/gestores-proceso-server";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const auth = await getAuthedApiUser();
  if (!isAuthedApiUser(auth)) return auth;
  if (!roleMayAccessGestoresProceso(auth.role)) {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const periodoRaw = String(searchParams.get("periodo") ?? "mes").trim();
  const periodo: GestorProcesoPeriodo = periodoRaw === "semana" ? "semana" : "mes";
  const fecha = String(searchParams.get("fecha") ?? "").trim();
  if (!fecha) {
    return NextResponse.json({ error: "Parametro fecha requerido (YYYY-MM-DD)" }, { status: 400 });
  }

  const { list, fuente } = await listColaboradoresGestoresServer();
  const report = buildGestoresProcesoReport(list, periodo, fecha);
  if (!report) {
    return NextResponse.json({ error: "Fecha o periodo invalido" }, { status: 400 });
  }

  return NextResponse.json({ report, fuente });
}
