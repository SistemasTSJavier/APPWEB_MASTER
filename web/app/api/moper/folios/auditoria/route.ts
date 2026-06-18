import { NextResponse } from "next/server";
import {
  asignarFoliosPendientesMoper,
  auditarFoliosMoper,
} from "@/lib/moper-registros-server";
import { requireMoperApiRead } from "@/lib/moper-api-helper";
import { moperWorkflowPuedeAjustarFolio } from "@/lib/moper-workflow-role";

export const dynamic = "force-dynamic";

/** GET: lista folios actuales y MOPER sin folio. */
export async function GET() {
  const ctx = await requireMoperApiRead();
  if (ctx instanceof NextResponse) return ctx;
  if (!moperWorkflowPuedeAjustarFolio(ctx.role)) {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }
  try {
    const auditoria = await auditarFoliosMoper(ctx.admin);
    return NextResponse.json({ ok: true, auditoria });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Error" }, { status: 500 });
  }
}

/** POST: asigna folios a registros que quedaron sin numero. */
export async function POST(req: Request) {
  const ctx = await requireMoperApiRead();
  if (ctx instanceof NextResponse) return ctx;
  if (!moperWorkflowPuedeAjustarFolio(ctx.role)) {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }
  let body: { desdeNum?: number } = {};
  try {
    body = (await req.json()) as { desdeNum?: number };
  } catch {
    /* opcional */
  }
  try {
    const result = await asignarFoliosPendientesMoper(
      ctx.admin,
      body.desdeNum != null ? Number(body.desdeNum) : undefined,
    );
    return NextResponse.json({ ok: true, ...result });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Error" }, { status: 500 });
  }
}
