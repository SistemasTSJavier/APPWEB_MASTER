import { NextResponse } from "next/server";
import { getAuthedApiUser, isAuthedApiUser } from "@/lib/auth-api";
import { departamentoExiste } from "@/lib/app-catalogos";
import { roleMayAccessMusica, roleMayAdminMusica } from "@/lib/app-role";
import { esMusicaEstado, validarMusicaCreate } from "@/lib/musica-playlist";
import { insertarCancion, listarCanciones } from "@/lib/musica-playlist-server";

export const dynamic = "force-dynamic";

/** Cualquier usuario logueado: agregar canción con URL de YouTube. */
export async function POST(req: Request) {
  const auth = await getAuthedApiUser();
  if (!isAuthedApiUser(auth)) return auth;
  if (!roleMayAccessMusica(auth.role)) {
    return NextResponse.json({ error: "No autorizado." }, { status: 403 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido." }, { status: 400 });
  }

  const validado = validarMusicaCreate(body);
  if (!validado.ok) {
    return NextResponse.json({ error: validado.error }, { status: 400 });
  }

  if (!(await departamentoExiste(validado.data.departamento))) {
    return NextResponse.json({ error: "Departamento no válido." }, { status: 400 });
  }

  const result = await insertarCancion(validado.data, auth.user.email ?? null);
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 500 });
  }

  return NextResponse.json({ ok: true, row: result.row });
}

/** Listar: admin ve todas; resto solo las propias por email. */
export async function GET(req: Request) {
  const auth = await getAuthedApiUser();
  if (!isAuthedApiUser(auth)) return auth;
  if (!roleMayAccessMusica(auth.role)) {
    return NextResponse.json({ error: "No autorizado." }, { status: 403 });
  }

  const url = new URL(req.url);
  const estadoRaw = url.searchParams.get("estado")?.trim() ?? "";
  const estado = esMusicaEstado(estadoRaw) ? estadoRaw : undefined;
  const fecha = url.searchParams.get("fecha")?.trim() || undefined;

  const result = await listarCanciones({ estado, fecha });
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 500 });
  }

  if (roleMayAdminMusica(auth.role)) {
    return NextResponse.json({ rows: result.rows, admin: true });
  }

  const email = (auth.user.email ?? "").trim().toLowerCase();
  const rows = result.rows.filter((r) => (r.userEmail ?? "").toLowerCase() === email);
  return NextResponse.json({ rows, admin: false });
}
