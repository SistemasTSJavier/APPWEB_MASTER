import { NextResponse } from "next/server";
import { getAuthedApiUser, isAuthedApiUser } from "@/lib/auth-api";
import {
  crearCatalogoItem,
  desactivarCatalogoItem,
  listarCatalogo,
  listarDepartamentosOpciones,
  type CatalogoTipo,
} from "@/lib/app-catalogos";
import { roleMayAccessAdminUsuarios } from "@/lib/app-role";

export const dynamic = "force-dynamic";

/** GET ?tipo=departamento|rol — lista catálogo (admin). Sin tipo: ambos + departamentos merged. */
export async function GET(req: Request) {
  const auth = await getAuthedApiUser();
  if (!isAuthedApiUser(auth)) return auth;
  if (!roleMayAccessAdminUsuarios(auth.role)) {
    return NextResponse.json({ error: "Solo administrador" }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const tipoRaw = String(searchParams.get("tipo") ?? "").trim();
  const tipo = tipoRaw === "departamento" || tipoRaw === "rol" ? (tipoRaw as CatalogoTipo) : null;

  try {
    if (tipo) {
      const items = await listarCatalogo(tipo, false);
      return NextResponse.json({ items });
    }
    const [departamentos, roles, departamentosOpciones] = await Promise.all([
      listarCatalogo("departamento", false),
      listarCatalogo("rol", false),
      listarDepartamentosOpciones(),
    ]);
    return NextResponse.json({ departamentos, roles, departamentosOpciones });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Error al listar catálogo" },
      { status: 500 },
    );
  }
}

/** POST { tipo, label, id?, baseRole? } */
export async function POST(req: Request) {
  const auth = await getAuthedApiUser();
  if (!isAuthedApiUser(auth)) return auth;
  if (!roleMayAccessAdminUsuarios(auth.role)) {
    return NextResponse.json({ error: "Solo administrador" }, { status: 403 });
  }

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }

  const tipoRaw = String(body.tipo ?? "").trim();
  if (tipoRaw !== "departamento" && tipoRaw !== "rol") {
    return NextResponse.json({ error: "tipo debe ser departamento o rol" }, { status: 400 });
  }

  try {
    const item = await crearCatalogoItem({
      tipo: tipoRaw,
      label: String(body.label ?? ""),
      id: body.id != null ? String(body.id) : undefined,
      baseRole: body.baseRole != null ? String(body.baseRole) : undefined,
    });
    return NextResponse.json({ item }, { status: 201 });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "No se pudo crear" },
      { status: 400 },
    );
  }
}

/** DELETE ?id= */
export async function DELETE(req: Request) {
  const auth = await getAuthedApiUser();
  if (!isAuthedApiUser(auth)) return auth;
  if (!roleMayAccessAdminUsuarios(auth.role)) {
    return NextResponse.json({ error: "Solo administrador" }, { status: 403 });
  }

  const id = String(new URL(req.url).searchParams.get("id") ?? "").trim();
  if (!id) return NextResponse.json({ error: "id requerido" }, { status: 400 });

  try {
    await desactivarCatalogoItem(id);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "No se pudo desactivar" },
      { status: 400 },
    );
  }
}
