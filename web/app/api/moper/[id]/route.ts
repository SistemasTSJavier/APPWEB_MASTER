import { NextResponse } from "next/server";
import { actualizarRegistroMoper, obtenerRegistroPorId } from "@/lib/moper-registros-server";
import type { MoperRegistroCreateBody } from "@/lib/moper-registros-types";
import { parseRegistroId, requireMoperApiRead, requireMoperApiWrite } from "@/lib/moper-api-helper";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: Request, { params }: Params) {
  const ctx = await requireMoperApiRead();
  if (ctx instanceof NextResponse) return ctx;
  const { id: idRaw } = await params;
  const id = parseRegistroId(idRaw);
  if (!id) return NextResponse.json({ error: "ID invalido" }, { status: 400 });
  try {
    const registro = await obtenerRegistroPorId(ctx.admin, id);
    if (!registro) return NextResponse.json({ error: "Registro no encontrado" }, { status: 404 });
    return NextResponse.json(registro);
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Error al cargar registro" },
      { status: 500 },
    );
  }
}

export async function PATCH(req: Request, { params }: Params) {
  const ctx = await requireMoperApiWrite();
  if (ctx instanceof NextResponse) return ctx;
  const { id: idRaw } = await params;
  const id = parseRegistroId(idRaw);
  if (!id) return NextResponse.json({ error: "ID invalido" }, { status: 400 });
  let body: MoperRegistroCreateBody;
  try {
    body = (await req.json()) as MoperRegistroCreateBody;
  } catch {
    return NextResponse.json({ error: "JSON invalido" }, { status: 400 });
  }
  try {
    const registro = await actualizarRegistroMoper(ctx.admin, id, body);
    return NextResponse.json(registro);
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Error al actualizar" },
      { status: 400 },
    );
  }
}
