import { NextResponse } from "next/server";
import { notificarContabilidadMoperPorId } from "@/lib/moper-registros-server";
import { parseRegistroId, requireMoperApiRead } from "@/lib/moper-api-helper";
import { roleMayReenviarEmailContabilidadMoper } from "@/lib/app-role";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

export async function POST(req: Request, { params }: Params) {
  const { id: idRaw } = await params;
  const id = parseRegistroId(idRaw);
  if (!id) return NextResponse.json({ error: "ID invalido" }, { status: 400 });

  const ctx = await requireMoperApiRead();
  if (ctx instanceof NextResponse) return ctx;
  if (!roleMayReenviarEmailContabilidadMoper(ctx.role)) {
    return NextResponse.json({ error: "No autorizado para reenviar notificación" }, { status: 403 });
  }

  let body: { pendiente?: boolean } = {};
  try {
    const text = await req.text();
    if (text.trim()) body = JSON.parse(text) as { pendiente?: boolean };
  } catch {
    return NextResponse.json({ error: "JSON invalido" }, { status: 400 });
  }

  try {
    const resultado = await notificarContabilidadMoperPorId(ctx.admin, id, {
      forzar: true,
      pendienteRecepcion: Boolean(body.pendiente),
    });
    if (!resultado.ok) {
      return NextResponse.json(
        { error: resultado.error ?? "No se pudo enviar el correo", modo: resultado.modo },
        { status: 502 },
      );
    }
    return NextResponse.json(resultado);
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Error al notificar contabilidad" },
      { status: 400 },
    );
  }
}
