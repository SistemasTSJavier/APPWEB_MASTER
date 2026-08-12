/**
 * PoC: playlist flotante por departamento con videos de YouTube.
 * Sin BD aún: editar tracks aquí. Fase 2 → cada departamento sube/gestiona en Supabase.
 */

export type PlaylistTrack = {
  id: string;
  titulo: string;
  artista?: string;
  /** ID del video (ej. dQw4w9WgXcQ) o URL watch/youtu.be/embed. */
  youtube: string;
};

export type PlaylistAlertaItem = {
  id: string;
  departamento: string;
  titulo: string;
  mensaje: string;
  tracks: PlaylistTrack[];
  /** Si false, no entra al sorteo del día. */
  activo: boolean;
};

export const PLAYLIST_ALERTAS_POC: PlaylistAlertaItem[] = [
  {
    id: "rh-1",
    departamento: "Recursos Humanos",
    titulo: "Playlist RH",
    mensaje: "Selección del día — Recursos Humanos",
    activo: true,
    tracks: [
      {
        id: "rh-t1",
        titulo: "Lofi beats",
        artista: "Radio",
        youtube: "jfKfPfyJRdk",
      },
      {
        id: "rh-t2",
        titulo: "Chill hop",
        artista: "Radio",
        youtube: "5qap5aO4i9A",
      },
      {
        id: "rh-t3",
        titulo: "Focus mix",
        artista: "Radio",
        youtube: "DWcJFNfaw9c",
      },
    ],
  },
  {
    id: "ops-1",
    departamento: "Operaciones",
    titulo: "Playlist Operaciones",
    mensaje: "Selección del día — Operaciones",
    activo: true,
    tracks: [
      {
        id: "ops-t1",
        titulo: "Synthwave drive",
        artista: "Radio",
        youtube: "4xDzrJKXOOY",
      },
      {
        id: "ops-t2",
        titulo: "Chill hop",
        artista: "Radio",
        youtube: "5qap5aO4i9A",
      },
    ],
  },
  {
    id: "sistemas-1",
    departamento: "Sistemas",
    titulo: "Playlist Sistemas",
    mensaje: "Música de enfoque — Sistemas",
    activo: true,
    tracks: [
      {
        id: "sis-t1",
        titulo: "Coding lofi",
        artista: "Radio",
        youtube: "jfKfPfyJRdk",
      },
      {
        id: "sis-t2",
        titulo: "Deep focus",
        artista: "Radio",
        youtube: "DWcJFNfaw9c",
      },
    ],
  },
];

export type PlaylistAlertaActiva = PlaylistAlertaItem & {
  fechaReferencia: string;
  tracks: Array<PlaylistTrack & { youtubeVideoId: string }>;
};

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
      const emb = parts[0] === "embed" || parts[0] === "shorts" || parts[0] === "live" ? parts[1] : null;
      if (emb && /^[\w-]{11}$/.test(emb)) return emb;
    }
  } catch {
    /* ignore */
  }
  return null;
}

export function ymdMexicoCity(ref: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Mexico_City",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(ref);
}

function hashDia(ymd: string): number {
  let h = 0;
  for (let i = 0; i < ymd.length; i++) h = (h * 31 + ymd.charCodeAt(i)) >>> 0;
  return h;
}

export function elegirPlaylistDelDia(
  items: PlaylistAlertaItem[] = PLAYLIST_ALERTAS_POC,
  ref: Date = new Date(),
): PlaylistAlertaActiva | null {
  const activos = items.filter(
    (x) => x.activo && x.tracks.some((t) => youtubeVideoIdFrom(t.youtube)),
  );
  if (activos.length === 0) return null;
  const ymd = ymdMexicoCity(ref);
  const pick = activos[hashDia(ymd) % activos.length]!;
  const tracks = pick.tracks
    .map((t) => {
      const youtubeVideoId = youtubeVideoIdFrom(t.youtube);
      if (!youtubeVideoId) return null;
      return { ...t, youtubeVideoId };
    })
    .filter((t): t is PlaylistTrack & { youtubeVideoId: string } => Boolean(t));
  if (tracks.length === 0) return null;
  return { ...pick, tracks, fechaReferencia: ymd };
}
