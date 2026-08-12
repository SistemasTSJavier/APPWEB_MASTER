import { NextResponse } from "next/server";
import { getAuthedApiUser, isAuthedApiUser } from "@/lib/auth-api";
import { roleMayAdminMusica } from "@/lib/app-role";
import {
  esMusicaEstado,
  normalizarHoraHm,
  type MusicaCancionPatch,
} from "@/lib/musica-playlist";
import { actualizarCancion } from "@/lib/musica-playlist-server";

export const dynamic = "force-dynamic";

/** Admin: aprobar / rechazar / programar día+horario / añadir ahora (petición especial). */
export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const auth = await getAuthedApiUser();
  if (!isAuthedApiUser(auth)) return auth;
  if (!roleMayAdminMusica(auth.role)) {
    return NextResponse.json({ error: "Solo administrador puede programar la playlist." }, { status: 403 });
  }

  const { id } = await ctx.params;
  if (!id?.trim()) {
    return NextResponse.json({ error: "ID requerido." }, { status: 400 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido." }, { status: 400 });
  }

  const o = (body && typeof body === "object" ? body : {}) as Record<string, unknown>;
  const patch: MusicaCancionPatch = {};

  if (o.anadirAhora === true) {
    patch.anadirAhora = true;
  } else {
    if (typeof o.estado === "string" && esMusicaEstado(o.estado)) patch.estado = o.estado;
    if ("fechaProgramada" in o) {
      const f = o.fechaProgramada == null || o.fechaProgramada === "" ? null : String(o.fechaProgramada).trim();
      if (f && !/^\d{4}-\d{2}-\d{2}$/.test(f)) {
        return NextResponse.json({ error: "Fecha inválida (YYYY-MM-DD)." }, { status: 400 });
      }
      patch.fechaProgramada = f;
    }
    if (typeof o.horaInicio === "string") patch.horaInicio = normalizarHoraHm(o.horaInicio, "00:00");
    if (typeof o.horaFin === "string") patch.horaFin = normalizarHoraHm(o.horaFin, "23:59");
    if (typeof o.peticionEspecial === "boolean") patch.peticionEspecial = o.peticionEspecial;
  }

  if (typeof o.titulo === "string") patch.titulo = o.titulo;
  if (typeof o.artista === "string") patch.artista = o.artista;

  if (patch.estado === "aprobada" && !patch.anadirAhora && !patch.fechaProgramada) {
    return NextResponse.json(
      { error: "Para aprobar indica la fecha, o usa «Añadir ahora»." },
      { status: 400 },
    );
  }

  if (patch.horaInicio && patch.horaFin && patch.horaInicio === patch.horaFin) {
    return NextResponse.json(
      { error: "La hora de inicio y fin no pueden ser iguales." },
      { status: 400 },
    );
  }

  const result = await actualizarCancion(id.trim(), patch);
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 500 });
  }

  return NextResponse.json({ ok: true, row: result.row });
}
