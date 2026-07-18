import { NextResponse } from "next/server";
import { getAuthedApiUser, isAuthedApiUser } from "@/lib/auth-api";
import { roleMayAccessIdeasQueTransforman } from "@/lib/app-role";
import { esIdeaEstado, validarIdeaCreate } from "@/lib/ideas-que-transforman";
import { insertarIdea, listarIdeas } from "@/lib/ideas-que-transforman-server";

export const dynamic = "force-dynamic";

/** Público: registrar una idea desde el formulario QR. */
export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido." }, { status: 400 });
  }

  const validado = validarIdeaCreate(body);
  if (!validado.ok) {
    return NextResponse.json({ error: validado.error }, { status: 400 });
  }

  const result = await insertarIdea(validado.data);
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 500 });
  }

  return NextResponse.json({ ok: true, id: result.row.id });
}

/** Panel: listar ideas (pendientes o aceptadas). */
export async function GET(req: Request) {
  const auth = await getAuthedApiUser();
  if (!isAuthedApiUser(auth)) return auth;
  if (!roleMayAccessIdeasQueTransforman(auth.role)) {
    return NextResponse.json({ error: "No autorizado." }, { status: 403 });
  }

  const url = new URL(req.url);
  const estadoRaw = url.searchParams.get("estado")?.trim() ?? "";
  const estado = esIdeaEstado(estadoRaw) ? estadoRaw : undefined;

  const result = await listarIdeas(estado);
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 500 });
  }

  return NextResponse.json({ rows: result.rows });
}
