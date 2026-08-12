/** Tipos y helpers de playlist / canciones YouTube. */

export const MUSICA_ESTADOS = ["pendiente", "aprobada", "rechazada"] as const;
export type MusicaEstado = (typeof MUSICA_ESTADOS)[number];

export type MusicaCancion = {
  id: string;
  youtubeUrl: string;
  youtubeVideoId: string;
  titulo: string;
  artista: string;
  departamento: string;
  solicitadoPor: string;
  mensaje: string;
  userEmail: string | null;
  estado: MusicaEstado;
  fechaProgramada: string | null;
  /** HH:MM (24h) — inicio ventana MX */
  horaInicio: string;
  /** HH:MM (24h) — fin ventana MX */
  horaFin: string;
  /** Añadida ya a la lista del día (petición especial). */
  peticionEspecial: boolean;
  createdAt: string;
  updatedAt: string;
};

export type MusicaCancionCreate = {
  youtubeUrl: string;
  titulo?: string;
  artista?: string;
  departamento: string;
  solicitadoPor: string;
  mensaje?: string;
};

export type MusicaCancionPatch = {
  estado?: MusicaEstado;
  fechaProgramada?: string | null;
  horaInicio?: string;
  horaFin?: string;
  peticionEspecial?: boolean;
  /** Si true: aprueba hoy y deja en lista activa de inmediato. */
  anadirAhora?: boolean;
  titulo?: string;
  artista?: string;
};

export function esMusicaEstado(v: string): v is MusicaEstado {
  return (MUSICA_ESTADOS as readonly string[]).includes(v);
}

/** Normaliza a HH:MM (24h). */
export function normalizarHoraHm(raw: string | null | undefined, fallback = "00:00"): string {
  const t = String(raw ?? "").trim();
  const m = /^(\d{1,2}):(\d{2})(?::\d{2})?/.exec(t);
  if (!m) return fallback;
  const hh = Math.min(23, Math.max(0, Number(m[1])));
  const mm = Math.min(59, Math.max(0, Number(m[2])));
  return `${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}`;
}

/** Minutos desde medianoche para comparar ventanas. */
export function minutosDesdeMedianoche(hm: string): number {
  const n = normalizarHoraHm(hm);
  const [h, m] = n.split(":").map(Number);
  return (h ?? 0) * 60 + (m ?? 0);
}

export function horaAhoraMexicoCity(ref: Date = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "America/Mexico_City",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(ref);
  const hh = parts.find((p) => p.type === "hour")?.value ?? "00";
  const mm = parts.find((p) => p.type === "minute")?.value ?? "00";
  return `${hh.padStart(2, "0")}:${mm.padStart(2, "0")}`;
}

/** ¿La hora actual MX está dentro de [inicio, fin]? (inclusive). Soporta cruce de medianoche. */
export function horaEnVentana(ahoraHm: string, inicioHm: string, finHm: string): boolean {
  const ahora = minutosDesdeMedianoche(ahoraHm);
  const ini = minutosDesdeMedianoche(inicioHm);
  const fin = minutosDesdeMedianoche(finHm);
  if (ini <= fin) return ahora >= ini && ahora <= fin;
  // Ej. 22:00 → 02:00
  return ahora >= ini || ahora <= fin;
}

/** Extrae el ID de video de YouTube desde ID o URL. */
export function youtubeVideoIdFrom(raw: string): string | null {
  const t = String(raw ?? "").trim();
  if (!t) return null;
  if (/^[\w-]{11}$/.test(t)) return t;
  try {
    const u = new URL(t.startsWith("http") ? t : `https://${t}`);
    if (u.hostname.includes("youtu.be")) {
      const id = u.pathname.split("/").filter(Boolean)[0] ?? "";
      return /^[\w-]{11}$/.test(id) ? id : null;
    }
    if (u.hostname.includes("youtube.com")) {
      const v = u.searchParams.get("v");
      if (v && /^[\w-]{11}$/.test(v)) return v;
      const parts = u.pathname.split("/").filter(Boolean);
      const emb =
        parts[0] === "embed" || parts[0] === "shorts" || parts[0] === "live" ? parts[1] : null;
      if (emb && /^[\w-]{11}$/.test(emb)) return emb;
    }
  } catch {
    /* ignore */
  }
  return null;
}

export function youtubeWatchUrl(videoId: string): string {
  return `https://www.youtube.com/watch?v=${videoId}`;
}

export function youtubeThumbUrl(videoId: string): string {
  return `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`;
}

export function ymdMexicoCity(ref: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Mexico_City",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(ref);
}

export function validarMusicaCreate(body: unknown):
  | { ok: true; data: MusicaCancionCreate & { youtubeVideoId: string; youtubeUrl: string } }
  | { ok: false; error: string } {
  if (!body || typeof body !== "object") return { ok: false, error: "Datos inválidos." };
  const o = body as Record<string, unknown>;
  const youtubeUrl = String(o.youtubeUrl ?? o.url ?? "").trim();
  const youtubeVideoId = youtubeVideoIdFrom(youtubeUrl);
  if (!youtubeVideoId) {
    return { ok: false, error: "Pega un URL válido de YouTube (watch, youtu.be o shorts)." };
  }
  const solicitadoPor = String(o.solicitadoPor ?? o.nombre ?? "").trim();
  if (solicitadoPor.length < 2) {
    return { ok: false, error: "Indica tu nombre." };
  }
  const departamento = String(o.departamento ?? "").trim();
  if (!departamento) {
    return { ok: false, error: "Selecciona el departamento." };
  }
  return {
    ok: true,
    data: {
      youtubeUrl: youtubeWatchUrl(youtubeVideoId),
      youtubeVideoId,
      titulo: String(o.titulo ?? "").trim(),
      artista: String(o.artista ?? "").trim(),
      departamento,
      solicitadoPor,
      mensaje: String(o.mensaje ?? "").trim(),
    },
  };
}

type DbRow = {
  id: string;
  youtube_url: string;
  youtube_video_id: string;
  titulo: string;
  artista: string;
  departamento: string;
  solicitado_por: string;
  mensaje: string;
  user_email: string | null;
  estado: string;
  fecha_programada: string | null;
  hora_inicio?: string | null;
  hora_fin?: string | null;
  peticion_especial?: boolean | null;
  created_at: string;
  updated_at: string;
};

export function mapMusicaRow(r: DbRow): MusicaCancion {
  return {
    id: r.id,
    youtubeUrl: r.youtube_url,
    youtubeVideoId: r.youtube_video_id,
    titulo: r.titulo || "Sin título",
    artista: r.artista || "",
    departamento: r.departamento,
    solicitadoPor: r.solicitado_por,
    mensaje: r.mensaje || "",
    userEmail: r.user_email,
    estado: esMusicaEstado(r.estado) ? r.estado : "pendiente",
    fechaProgramada: r.fecha_programada,
    horaInicio: normalizarHoraHm(r.hora_inicio, "00:00"),
    horaFin: normalizarHoraHm(r.hora_fin, "23:59"),
    peticionEspecial: Boolean(r.peticion_especial),
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}
