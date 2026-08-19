import { NextResponse } from "next/server";
import { getAuthedApiUser, isAuthedApiUser } from "@/lib/auth-api";
import { userMayAccessContratosPorMes } from "@/lib/app-role";
import { listColaboradoresContratosPorMesServer } from "@/lib/contratos-por-mes-server";

export const dynamic = "force-dynamic";

/** Expedientes para filtrar contratos por mes en cliente. */
export async function GET(req: Request) {
  const auth = await getAuthedApiUser();
  if (!isAuthedApiUser(auth)) return auth;
  const meta = (auth.user.user_metadata ?? null) as Record<string, unknown> | null;
  if (!userMayAccessContratosPorMes(auth.role, meta)) {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }

  const force = new URL(req.url).searchParams.get("refresh") === "1";
  const { list, fuente } = await listColaboradoresContratosPorMesServer({ forceRefresh: force });
  return NextResponse.json({ list, fuente, total: list.length });
}
