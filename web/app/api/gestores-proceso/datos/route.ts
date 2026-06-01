import { NextResponse } from "next/server";
import { getAuthedApiUser, isAuthedApiUser } from "@/lib/auth-api";
import { roleMayAccessGestoresProceso } from "@/lib/app-role";
import { listColaboradoresGestoresServer } from "@/lib/gestores-proceso-server";

export const dynamic = "force-dynamic";

/** Expedientes para armar el reporte en cliente (una sola descarga; caché servidor ~3 min). */
export async function GET(req: Request) {
  const auth = await getAuthedApiUser();
  if (!isAuthedApiUser(auth)) return auth;
  if (!roleMayAccessGestoresProceso(auth.role)) {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }

  const force = new URL(req.url).searchParams.get("refresh") === "1";
  const { list, fuente } = await listColaboradoresGestoresServer({ forceRefresh: force });
  return NextResponse.json({ list, fuente, total: list.length });
}
