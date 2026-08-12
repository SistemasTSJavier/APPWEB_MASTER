import {
  createSupabaseServiceRoleClient,
  hintSupabaseClientError,
  isSupabaseServerConfigured,
} from "@/lib/supabase/admin";
import {
  horaAhoraMexicoCity,
  horaEnVentana,
  mapMusicaRow,
  normalizarHoraHm,
  type MusicaCancion,
  type MusicaCancionCreate,
  type MusicaCancionPatch,
  type MusicaEstado,
  youtubeWatchUrl,
  ymdMexicoCity,
} from "@/lib/musica-playlist";
import { elegirPlaylistDelDia, type PlaylistAlertaActiva } from "@/lib/musica-playlist-poc";

function admin() {
  if (!isSupabaseServerConfigured()) return null;
  return createSupabaseServiceRoleClient();
}

export async function fetchYoutubeOEmbed(url: string): Promise<{ titulo: string; autor: string } | null> {
  try {
    const endpoint = `https://www.youtube.com/oembed?url=${encodeURIComponent(url)}&format=json`;
    const r = await fetch(endpoint, { next: { revalidate: 3600 } });
    if (!r.ok) return null;
    const j = (await r.json()) as { title?: string; author_name?: string };
    return {
      titulo: String(j.title ?? "").trim(),
      autor: String(j.author_name ?? "").trim(),
    };
  } catch {
    return null;
  }
}

export async function insertarCancion(
  data: MusicaCancionCreate & { youtubeVideoId: string; youtubeUrl: string },
  userEmail: string | null,
): Promise<{ ok: true; row: MusicaCancion } | { ok: false; error: string }> {
  const sb = admin();
  if (!sb) return { ok: false, error: "Supabase no configurado." };

  let titulo = data.titulo?.trim() || "";
  let artista = data.artista?.trim() || "";
  if (!titulo) {
    const meta = await fetchYoutubeOEmbed(data.youtubeUrl);
    if (meta) {
      titulo = meta.titulo || titulo;
      if (!artista) artista = meta.autor;
    }
  }

  const { data: row, error } = await sb
    .from("musica_canciones")
    .insert({
      youtube_url: data.youtubeUrl || youtubeWatchUrl(data.youtubeVideoId),
      youtube_video_id: data.youtubeVideoId,
      titulo: titulo || "Canción de YouTube",
      artista,
      departamento: data.departamento,
      solicitado_por: data.solicitadoPor,
      mensaje: data.mensaje ?? "",
      user_email: userEmail,
      estado: "pendiente",
      peticion_especial: false,
    })
    .select("*")
    .single();

  if (error) return { ok: false, error: hintSupabaseClientError(error.message) };
  return { ok: true, row: mapMusicaRow(row) };
}

export async function listarCanciones(opts?: {
  estado?: MusicaEstado;
  fecha?: string;
}): Promise<{ ok: true; rows: MusicaCancion[] } | { ok: false; error: string }> {
  const sb = admin();
  if (!sb) return { ok: false, error: "Supabase no configurado." };

  let q = sb.from("musica_canciones").select("*").order("created_at", { ascending: false }).limit(300);
  if (opts?.estado) q = q.eq("estado", opts.estado);
  if (opts?.fecha) q = q.eq("fecha_programada", opts.fecha);

  const { data, error } = await q;
  if (error) return { ok: false, error: hintSupabaseClientError(error.message) };
  return { ok: true, rows: (data ?? []).map(mapMusicaRow) };
}

export async function actualizarCancion(
  id: string,
  patch: MusicaCancionPatch,
): Promise<{ ok: true; row: MusicaCancion } | { ok: false; error: string }> {
  const sb = admin();
  if (!sb) return { ok: false, error: "Supabase no configurado." };

  const upd: Record<string, unknown> = { updated_at: new Date().toISOString() };

  if (patch.anadirAhora) {
    const hoy = ymdMexicoCity();
    const ahora = horaAhoraMexicoCity();
    upd.estado = "aprobada";
    upd.fecha_programada = hoy;
    upd.hora_inicio = ahora;
    upd.hora_fin = "23:59";
    upd.peticion_especial = true;
  } else {
    if (patch.estado != null) upd.estado = patch.estado;
    if (patch.fechaProgramada !== undefined) upd.fecha_programada = patch.fechaProgramada;
    if (patch.horaInicio != null) upd.hora_inicio = normalizarHoraHm(patch.horaInicio, "00:00");
    if (patch.horaFin != null) upd.hora_fin = normalizarHoraHm(patch.horaFin, "23:59");
    if (patch.peticionEspecial != null) upd.peticion_especial = patch.peticionEspecial;
  }

  if (patch.titulo != null) upd.titulo = patch.titulo.trim();
  if (patch.artista != null) upd.artista = patch.artista.trim();

  const { data, error } = await sb.from("musica_canciones").update(upd).eq("id", id).select("*").single();
  if (error) return { ok: false, error: hintSupabaseClientError(error.message) };
  return { ok: true, row: mapMusicaRow(data) };
}

/**
 * Playlist visible ahora: aprobadas con fecha = hoy MX y hora actual dentro de [hora_inicio, hora_fin].
 * Peticiones especiales primero; luego por orden de creación.
 */
export async function playlistActivaDelDia(): Promise<PlaylistAlertaActiva | null> {
  const ymd = ymdMexicoCity();
  const ahoraHm = horaAhoraMexicoCity();
  const sb = admin();
  if (sb) {
    const { data, error } = await sb
      .from("musica_canciones")
      .select("*")
      .eq("estado", "aprobada")
      .eq("fecha_programada", ymd)
      .order("peticion_especial", { ascending: false })
      .order("created_at", { ascending: true });

    if (!error && data && data.length > 0) {
      const rows = data
        .map(mapMusicaRow)
        .filter((r) => horaEnVentana(ahoraHm, r.horaInicio, r.horaFin));

      if (rows.length > 0) {
        const especiales = rows.filter((r) => r.peticionEspecial).length;
        const depto =
          [...new Set(rows.map((r) => r.departamento).filter(Boolean))].slice(0, 3).join(" · ") ||
          "Playlist del día";
        return {
          id: `db-${ymd}-${ahoraHm}`,
          departamento: depto,
          titulo: especiales > 0 ? "Playlist + petición especial" : "Playlist del día",
          mensaje: `${rows.length} canción(es) · ${ahoraHm} MX`,
          activo: true,
          fechaReferencia: ymd,
          tracks: rows.map((r) => ({
            id: r.id,
            titulo: r.peticionEspecial ? `★ ${r.titulo}` : r.titulo,
            artista: r.artista || r.solicitadoPor,
            youtube: r.youtubeVideoId,
            youtubeVideoId: r.youtubeVideoId,
          })),
        };
      }

      // Hay canciones hoy pero fuera de horario → no mostrar FAB (ni fallback PoC).
      return null;
    }
  }

  // Fallback PoC solo si no hay nada programado en BD para hoy.
  return elegirPlaylistDelDia();
}
