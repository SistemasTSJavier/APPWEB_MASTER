import { NextResponse } from "next/server";
import { requireAdminUsuariosApi } from "@/lib/admin-usuarios-auth";
import { actualizarAdminUsuario, eliminarAdminUsuario } from "@/lib/admin-usuarios";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

export async function PATCH(req: Request, ctx: Ctx) {
  const gate = await requireAdminUsuariosApi();
  if ("error" in gate) return gate.error;

  const { id } = await ctx.params;
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido." }, { status: 400 });
  }

  const b = (body ?? {}) as Record<string, unknown>;
  try {
    const row = await actualizarAdminUsuario(id, {
      nombre: b.nombre !== undefined ? String(b.nombre) : undefined,
      departamento: b.departamento !== undefined ? String(b.departamento) : undefined,
      appRole:
        b.appRole !== undefined || b.app_role !== undefined
          ? String(b.appRole ?? b.app_role)
          : undefined,
      password: b.password !== undefined ? String(b.password) : undefined,
      modulos: b.modulos !== undefined || b.modulos_habilitados !== undefined
        ? (b.modulos ?? b.modulos_habilitados)
        : undefined,
      capacidades:
        b.capacidades !== undefined || b.modulos_capacidades !== undefined
          ? (b.capacidades ?? b.modulos_capacidades)
          : undefined,
    });
    return NextResponse.json({ ok: true, row });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "No se pudo actualizar." },
      { status: 400 },
    );
  }
}

export async function DELETE(_req: Request, ctx: Ctx) {
  const gate = await requireAdminUsuariosApi();
  if ("error" in gate) return gate.error;

  const { id } = await ctx.params;
  try {
    await eliminarAdminUsuario(id, gate.auth.user.id);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "No se pudo eliminar." },
      { status: 400 },
    );
  }
}
