import { NextResponse } from "next/server";
import { cancelarRegistroMoper } from "@/lib/moper-registros-server";
import { parseRegistroId, requireMoperApiRead } from "@/lib/moper-api-helper";
import { moperWorkflowPuedeCancelar } from "@/lib/moper-workflow-role";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

export async function PATCH(_req: Request, { params }: Params) {
  const ctx = await requireMoperApiRead();
  if (ctx instanceof NextResponse) return ctx;
  if (!moperWorkflowPuedeCancelar(ctx.email, ctx.role)) {
    return NextResponse.json({ error: "No autorizado para cancelar registros" }, { status: 403 });
  }
  const { id: idRaw } = await params;
  const id = parseRegistroId(idRaw);
  if (!id) return NextResponse.json({ error: "ID invalido" }, { status: 400 });
  try {
    await cancelarRegistroMoper(ctx.admin, id);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Error al cancelar" },
      { status: 500 },
    );
  }
}
