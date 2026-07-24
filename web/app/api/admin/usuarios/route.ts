import { NextResponse } from "next/server";
import { requireAdminUsuariosApi } from "@/lib/admin-usuarios-auth";
import { crearAdminUsuario, listarAdminUsuarios } from "@/lib/admin-usuarios";

export const dynamic = "force-dynamic";

export async function GET() {
  const gate = await requireAdminUsuariosApi();
  if ("error" in gate) return gate.error;

  try {
    const rows = await listarAdminUsuarios();
    return NextResponse.json({ rows });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "No se pudo listar usuarios." },
      { status: 500 },
    );
  }
}

export async function POST(req: Request) {
  const gate = await requireAdminUsuariosApi();
  if ("error" in gate) return gate.error;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido." }, { status: 400 });
  }

  const b = (body ?? {}) as Record<string, unknown>;
  try {
    const row = await crearAdminUsuario({
      email: String(b.email ?? ""),
      password: String(b.password ?? ""),
      nombre: String(b.nombre ?? ""),
      departamento: String(b.departamento ?? ""),
      appRole: String(b.appRole ?? b.app_role ?? ""),
      modulos: b.modulos ?? b.modulos_habilitados,
      capacidades: b.capacidades ?? b.modulos_capacidades,
    });
    return NextResponse.json({ ok: true, row });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "No se pudo crear el usuario." },
      { status: 400 },
    );
  }
}
