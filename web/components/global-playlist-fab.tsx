"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import type { PlaylistAlertaActiva } from "@/lib/musica-playlist-poc";

declare global {
  interface Window {
    YT?: {
      Player: new (
        el: HTMLElement | string,
        opts: {
          videoId: string;
          width?: string | number;
          height?: string | number;
          playerVars?: Record<string, number | string>;
          events?: {
            onReady?: (e: { target: YtPlayer }) => void;
            onStateChange?: (e: { data: number; target: YtPlayer }) => void;
          };
        },
      ) => YtPlayer;
      PlayerState: { ENDED: number; PLAYING: number; PAUSED: number };
    };
    onYouTubeIframeAPIReady?: () => void;
  }
}

type YtPlayer = {
  destroy: () => void;
  loadVideoById: (id: string) => void;
  playVideo: () => void;
  pauseVideo: () => void;
  getPlayerState: () => number;
};

type PanelMode = "closed" | "expanded" | "minimized";

const MODE_KEY = "ts_playlist_fab_mode";

function loadYtApi(): Promise<void> {
  if (typeof window === "undefined") return Promise.resolve();
  if (window.YT?.Player) return Promise.resolve();
  return new Promise((resolve) => {
    const prev = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => {
      prev?.();
      resolve();
    };
    if (!document.querySelector('script[src="https://www.youtube.com/iframe_api"]')) {
      const s = document.createElement("script");
      s.src = "https://www.youtube.com/iframe_api";
      s.async = true;
      document.body.appendChild(s);
    }
    const t = window.setInterval(() => {
      if (window.YT?.Player) {
        window.clearInterval(t);
        resolve();
      }
    }, 200);
  });
}

function readMode(): PanelMode {
  try {
    const v = localStorage.getItem(MODE_KEY);
    if (v === "expanded" || v === "minimized" || v === "closed") return v;
  } catch {
    /* ignore */
  }
  return "closed";
}

/**
 * Playlist flotante: panel completo, o minimizado (video oculto, audio sigue).
 */
export function GlobalPlaylistFab() {
  const reactId = useId().replace(/:/g, "");
  const playerHostId = `yt-playlist-host-${reactId}`;
  const playerRef = useRef<YtPlayer | null>(null);
  const indexRef = useRef(0);

  const [alert, setAlert] = useState<PlaylistAlertaActiva | null>(null);
  const [ready, setReady] = useState(false);
  const [mode, setMode] = useState<PanelMode>("closed");
  const [trackIndex, setTrackIndex] = useState(0);
  const [playerReady, setPlayerReady] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [bootstrapped, setBootstrapped] = useState(false);

  const sessionActive = mode === "expanded" || mode === "minimized";

  useEffect(() => {
    let cancelled = false;

    async function fetchAlert() {
      try {
        const r = await fetch("/api/musica/alerta-activa", { cache: "no-store" });
        const j = (await r.json()) as { alert?: PlaylistAlertaActiva | null };
        if (cancelled) return;
        const next = j.alert ?? null;
        setAlert(next);
        if (!next) {
          setMode("closed");
        } else if (!bootstrapped) {
          setMode(readMode());
          setBootstrapped(true);
        }
      } catch {
        if (!cancelled) setAlert(null);
      } finally {
        if (!cancelled) setReady(true);
      }
    }

    void fetchAlert();
    const t = window.setInterval(() => void fetchAlert(), 60_000);
    return () => {
      cancelled = true;
      window.clearInterval(t);
    };
  }, [bootstrapped]);

  const persistMode = useCallback((value: PanelMode) => {
    setMode(value);
    try {
      localStorage.setItem(MODE_KEY, value);
    } catch {
      /* ignore */
    }
  }, []);

  const playAt = useCallback(
    (idx: number) => {
      if (!alert?.tracks.length) return;
      const next = ((idx % alert.tracks.length) + alert.tracks.length) % alert.tracks.length;
      indexRef.current = next;
      setTrackIndex(next);
      const id = alert.tracks[next]!.youtubeVideoId;
      if (playerRef.current) {
        playerRef.current.loadVideoById(id);
        playerRef.current.playVideo();
        setPlaying(true);
      }
    },
    [alert],
  );

  useEffect(() => {
    if (!sessionActive || !alert?.tracks.length) return;

    let cancelled = false;
    (async () => {
      await loadYtApi();
      if (cancelled || !window.YT?.Player) return;
      if (playerRef.current) return;

      const host = document.getElementById(playerHostId);
      if (!host) return;

      const startId = alert.tracks[indexRef.current]?.youtubeVideoId ?? alert.tracks[0]!.youtubeVideoId;
      playerRef.current = new window.YT.Player(host, {
        videoId: startId,
        width: "100%",
        height: "100%",
        playerVars: {
          autoplay: 0,
          rel: 0,
          modestbranding: 1,
          playsinline: 1,
        },
        events: {
          onReady: () => {
            if (!cancelled) setPlayerReady(true);
          },
          onStateChange: (e) => {
            const st = window.YT?.PlayerState;
            if (!st) return;
            if (e.data === st.PLAYING) setPlaying(true);
            if (e.data === st.PAUSED) setPlaying(false);
            if (e.data === st.ENDED) {
              setPlaying(false);
              const n = indexRef.current + 1;
              if (alert.tracks[n]) playAt(n);
            }
          },
        },
      });
    })();

    return () => {
      cancelled = true;
    };
  }, [sessionActive, alert, playerHostId, playAt]);

  useEffect(() => {
    if (mode !== "closed") return;
    setPlayerReady(false);
    setPlaying(false);
    if (playerRef.current) {
      try {
        playerRef.current.destroy();
      } catch {
        /* ignore */
      }
      playerRef.current = null;
    }
  }, [mode]);

  if (!ready || !alert) return null;

  const current = alert.tracks[trackIndex] ?? alert.tracks[0]!;

  const togglePlay = () => {
    if (!playerRef.current || !playerReady) return;
    try {
      const st = playerRef.current.getPlayerState();
      const playingState = window.YT?.PlayerState?.PLAYING;
      if (playingState != null && st === playingState) {
        playerRef.current.pauseVideo();
        setPlaying(false);
      } else {
        playerRef.current.playVideo();
        setPlaying(true);
      }
    } catch {
      /* ignore */
    }
  };

  return (
    <div className="print:hidden pointer-events-none fixed bottom-4 right-4 z-[80] flex flex-col items-end gap-2 sm:bottom-6 sm:right-6">
      {sessionActive ? (
        <div
          className={
            mode === "expanded"
              ? "pointer-events-auto flex w-[min(100vw-2rem,22rem)] flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl shadow-slate-900/25"
              : "pointer-events-auto w-[min(100vw-2rem,20rem)]"
          }
        >
          {mode === "expanded" ? (
            <div className="flex items-start justify-between gap-2 bg-slate-950 px-3 py-2.5 text-white">
              <div className="min-w-0">
                <p className="truncate text-[10px] font-bold uppercase tracking-[0.14em] text-sky-300">
                  {alert.departamento}
                </p>
                <p className="truncate text-sm font-bold">{alert.titulo}</p>
                <p className="truncate text-[11px] text-slate-300">{alert.mensaje}</p>
              </div>
              <div className="flex shrink-0 gap-1">
                <button
                  type="button"
                  onClick={() => persistMode("minimized")}
                  className="rounded-md px-2 py-1 text-xs font-bold text-slate-200 hover:bg-white/10"
                  aria-label="Minimizar video (sigue el audio)"
                  title="Minimizar (sigue sonando)"
                >
                  —
                </button>
                <button
                  type="button"
                  onClick={() => persistMode("closed")}
                  className="rounded-md px-2 py-1 text-xs font-bold text-slate-200 hover:bg-white/10"
                  aria-label="Cerrar playlist"
                  title="Cerrar y detener"
                >
                  ✕
                </button>
              </div>
            </div>
          ) : null}

          {/* Mismo nodo siempre: oculto fuera de pantalla al minimizar (YouTube sigue sonando). */}
          <div
            className={
              mode === "minimized"
                ? "pointer-events-none fixed left-[-9999px] top-0 h-[180px] w-[320px] opacity-0"
                : "aspect-video w-full bg-black"
            }
            aria-hidden={mode === "minimized"}
          >
            <div id={playerHostId} className="h-full w-full" />
          </div>

          {mode === "expanded" ? (
            <>
              <div className="border-b border-slate-100 px-3 py-2">
                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Ahora</p>
                <p className="truncate text-sm font-semibold text-slate-900">{current.titulo}</p>
                {current.artista ? (
                  <p className="truncate text-xs text-slate-500">{current.artista}</p>
                ) : null}
                <div className="mt-2 flex flex-wrap gap-2">
                  <button
                    type="button"
                    disabled={!playerReady}
                    onClick={togglePlay}
                    className="rounded-md border border-slate-200 px-2 py-1 text-[11px] font-bold uppercase text-slate-700 hover:bg-slate-50 disabled:opacity-40"
                  >
                    {playing ? "Pausar" : "Play"}
                  </button>
                  <button
                    type="button"
                    disabled={!playerReady}
                    onClick={() => playAt(trackIndex - 1)}
                    className="rounded-md border border-slate-200 px-2 py-1 text-[11px] font-bold uppercase text-slate-700 hover:bg-slate-50 disabled:opacity-40"
                  >
                    Anterior
                  </button>
                  <button
                    type="button"
                    disabled={!playerReady}
                    onClick={() => playAt(trackIndex + 1)}
                    className="rounded-md border border-slate-200 px-2 py-1 text-[11px] font-bold uppercase text-slate-700 hover:bg-slate-50 disabled:opacity-40"
                  >
                    Siguiente
                  </button>
                  <button
                    type="button"
                    onClick={() => persistMode("minimized")}
                    className="rounded-md bg-slate-900 px-2 py-1 text-[11px] font-bold uppercase text-white hover:bg-slate-800"
                  >
                    Minimizar video
                  </button>
                </div>
              </div>

              <ul className="max-h-40 overflow-y-auto py-1">
                {alert.tracks.map((t, i) => {
                  const active = i === trackIndex;
                  return (
                    <li key={t.id}>
                      <button
                        type="button"
                        onClick={() => playAt(i)}
                        className={`flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-slate-50 ${
                          active ? "bg-sky-50 text-sky-950" : "text-slate-800"
                        }`}
                      >
                        <span
                          className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[10px] font-bold ${
                            active ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-600"
                          }`}
                        >
                          {i + 1}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate font-semibold">{t.titulo}</span>
                          {t.artista ? (
                            <span className="block truncate text-[11px] text-slate-500">{t.artista}</span>
                          ) : null}
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>

              <p className="border-t border-slate-100 px-3 py-1.5 text-[10px] text-slate-400">
                Usa <strong>Minimizar video</strong> o — para seguir escuchando sin ver el video
              </p>
            </>
          ) : (
            <div className="flex items-center gap-2 rounded-2xl border border-slate-200 bg-slate-950 px-3 py-2.5 text-white shadow-2xl shadow-slate-900/40">
              <button
                type="button"
                disabled={!playerReady}
                onClick={togglePlay}
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white text-sm font-bold text-slate-900 hover:bg-slate-100 disabled:opacity-40"
                aria-label={playing ? "Pausar" : "Reproducir"}
              >
                {playing ? "❚❚" : "▶"}
              </button>
              <button
                type="button"
                onClick={() => persistMode("expanded")}
                className="min-w-0 flex-1 text-left"
              >
                <p className="truncate text-[10px] font-bold uppercase tracking-wider text-sky-300">
                  Sonando · video oculto
                </p>
                <p className="truncate text-sm font-semibold">{current.titulo}</p>
              </button>
              <button
                type="button"
                onClick={() => persistMode("expanded")}
                className="shrink-0 rounded-md px-2 py-1 text-[10px] font-bold uppercase text-sky-200 hover:bg-white/10"
              >
                Video
              </button>
              <button
                type="button"
                onClick={() => persistMode("closed")}
                className="shrink-0 rounded-md px-2 py-1 text-xs font-bold text-slate-300 hover:bg-white/10"
                aria-label="Detener y cerrar"
              >
                ✕
              </button>
            </div>
          )}
        </div>
      ) : null}

      <div className="pointer-events-auto flex flex-col items-center gap-1.5">
        <button
          type="button"
          onClick={() => {
            if (mode === "closed") persistMode("expanded");
            else if (mode === "expanded") persistMode("minimized");
            else persistMode("expanded");
          }}
          aria-expanded={mode !== "closed"}
          aria-label={
            mode === "closed"
              ? "Abrir playlist"
              : mode === "expanded"
                ? "Minimizar video"
                : "Mostrar video"
          }
          className="flex h-14 w-14 items-center justify-center rounded-full border-[3px] border-white bg-slate-950 text-white shadow-xl shadow-slate-900/40 transition hover:scale-105 hover:bg-slate-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-500"
        >
          <span className="text-lg" aria-hidden>
            ♫
          </span>
        </button>
        <span className="rounded-md bg-white px-2 py-0.5 text-[11px] font-bold uppercase tracking-wide text-slate-900 shadow-md ring-1 ring-slate-200">
          {mode === "minimized" ? "Audio" : "Playlist"}
        </span>
      </div>
    </div>
  );
}
