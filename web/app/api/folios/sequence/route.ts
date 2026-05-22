import { NextResponse } from "next/server";
import { ajustarFolioSecuencia } from "@/lib/moper-registros-server";
import { requireMoperApiRead } from "@/lib/moper-api-helper";
import { moperWorkflowPuedeAjustarFolio } from "@/lib/moper-workflow-role";

export const dynamic = "force-dynamic";

export async function PATCH(req: Request) {
  const ctx = await requireMoperApiRead();
  if (ctx instanceof NextResponse) return ctx;
  if (!moperWorkflowPuedeAjustarFolio(ctx.role)) {
    return NextResponse.json({ error: "No autorizado para ajustar folio" }, { status: 403 });
  }
  let body: { delta?: number };
  try {
    body = (await req.json()) as { delta?: number };
  } catch {
    return NextResponse.json({ error: "JSON invalido" }, { status: 400 });
  }
  const delta = Number(body.delta);
  if (!Number.isFinite(delta)) {
    return NextResponse.json({ error: "delta numerico requerido" }, { status: 400 });
  }
  try {
    const folio = await ajustarFolioSecuencia(ctx.admin, delta);
    return NextResponse.json({ folio });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Error al ajustar folio" },
      { status: 500 },
    );
  }
}
