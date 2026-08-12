"use client";

import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import type { AppRole } from "@/lib/app-role";
import type { MusicaCancion } from "@/lib/musica-playlist";
import { youtubeThumbUrl, youtubeVideoIdFrom, ymdMexicoCity } from "@/lib/musica-playlist";
import { SGC_DEPARTAMENTOS } from "@/lib/sgc-calidad";

type DepOpt = { id: string; label: string };
type Preview = {
  youtubeVideoId: string;
  youtubeUrl: string;
  titulo: string;
  artista: string;
  thumb: string;
};

const inputCls =
  "w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 shadow-sm outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-200";
const labelCls = "block text-[11px] font-bold uppercase tracking-wide text-slate-600";

export function MusicaPageClient({
  appRole,
  email,
  isAdmin,
}: {
  appRole: AppRole;
  email: string;
  isAdmin: boolean;
}) {
  const [departamentos, setDepartamentos] = useState<DepOpt[]>(
    SGC_DEPARTAMENTOS.map((d) => ({ id: d.id, label: d.label })),
  );
  const [url, setUrl] = useState("");
  const [preview, setPreview] = useState<Preview | null>(null);
  const [previewBusy, setPreviewBusy] = useState(false);
  const [nombre, setNombre] = useState("");
  const [departamento, setDepartamento] = useState("");
  const [mensaje, setMensaje] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [rows, setRows] = useState<MusicaCancion[]>([]);
  const [tab, setTab] = useState<"enviar" | "admin">("enviar");
  const [filtroAdmin, setFiltroAdmin] = useState<"pendiente" | "aprobada" | "especial" | "todas">(
    "pendiente",
  );
  const [filtroFecha, setFiltroFecha] = useState("");

  const [fechaById, setFechaById] = useState<Record<string, string>>({});
  const [inicioById, setInicioById] = useState<Record<string, string>>({});
  const [finById, setFinById] = useState<Record<string, string>>({});

  const load = useCallback(async () => {
    const r = await fetch(`/api/musica/canciones`, { cache: "no-store" });
    const j = (await r.json()) as { rows?: MusicaCancion[]; error?: string };
    if (!r.ok) throw new Error(j.error ?? `Error ${r.status}`);
    setRows(Array.isArray(j.rows) ? j.rows : []);
  }, []);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const r = await fetch("/api/catalogos/departamentos", { cache: "no-store" });
        const j = (await r.json().catch(() => ({}))) as { departamentos?: DepOpt[] };
        if (!cancelled && r.ok && j.departamentos?.length) setDepartamentos(j.departamentos);
      } catch {
        /* builtins */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    void load().catch((e) => setErr(e instanceof Error ? e.message : "Error al cargar"));
  }, [load]);

  useEffect(() => {
    const id = youtubeVideoIdFrom(url);
    if (!id) {
      setPreview(null);
      return;
    }
    const t = window.setTimeout(() => {
      void (async () => {
        setPreviewBusy(true);
        try {
          const r = await fetch(`/api/musica/preview?url=${encodeURIComponent(url.trim())}`, {
            cache: "no-store",
          });
          const j = (await r.json()) as Preview & { error?: string };
          if (!r.ok) {
            setPreview(null);
            return;
          }
          setPreview(j);
        } catch {
          setPreview(null);
        } finally {
          setPreviewBusy(false);
        }
      })();
    }, 400);
    return () => window.clearTimeout(t);
  }, [url]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setErr(null);
    setMsg(null);
    setBusy(true);
    try {
      const r = await fetch("/api/musica/canciones", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          youtubeUrl: url.trim(),
          titulo: preview?.titulo ?? "",
          artista: preview?.artista ?? "",
          departamento,
          solicitadoPor: nombre.trim(),
          mensaje: mensaje.trim(),
        }),
      });
      const j = (await r.json()) as { error?: string };
      if (!r.ok) throw new Error(j.error ?? `Error ${r.status}`);
      setMsg("Canción enviada. El administrador la programará (día y horario).");
      setUrl("");
      setPreview(null);
      setMensaje("");
      await load();
    } catch (ex) {
      setErr(ex instanceof Error ? ex.message : "No se pudo enviar.");
    } finally {
      setBusy(false);
    }
  }

  async function patchCancion(id: string, body: Record<string, unknown>) {
    setErr(null);
    setMsg(null);
    const r = await fetch(`/api/musica/canciones/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const j = (await r.json()) as { error?: string };
    if (!r.ok) throw new Error(j.error ?? `Error ${r.status}`);
    await load();
  }

  const misOAdmin = useMemo(() => {
    let list = rows;
    if (isAdmin) {
      if (filtroAdmin === "pendiente") list = list.filter((r) => r.estado === "pendiente");
      else if (filtroAdmin === "aprobada") list = list.filter((r) => r.estado === "aprobada");
      else if (filtroAdmin === "especial") list = list.filter((r) => r.peticionEspecial);
      if (filtroFecha) list = list.filter((r) => r.fechaProgramada === filtroFecha);
    }
    return list;
  }, [filtroAdmin, filtroFecha, isAdmin, rows]);

  void appRole;
  void email;

  return (
    <div className="min-w-0 space-y-5">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Módulo</p>
        <h1 className="page-title uppercase">Playlist</h1>
        <p className="page-lead text-sm">
          Pega el <strong>URL de YouTube</strong>. El administrador programa <strong>día + hora inicio/fin</strong>{" "}
          o usa <strong>Añadir ahora</strong> como petición especial.
        </p>
      </div>

      {isAdmin ? (
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            className={`rounded-md px-3 py-1.5 text-xs font-bold uppercase ${
              tab === "enviar" ? "bg-slate-900 text-white" : "border border-slate-300 bg-white text-slate-700"
            }`}
            onClick={() => setTab("enviar")}
          >
            Agregar canción
          </button>
          <button
            type="button"
            className={`rounded-md px-3 py-1.5 text-xs font-bold uppercase ${
              tab === "admin" ? "bg-slate-900 text-white" : "border border-slate-300 bg-white text-slate-700"
            }`}
            onClick={() => setTab("admin")}
          >
            Programar
          </button>
        </div>
      ) : null}

      {err ? (
        <p role="alert" className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-950">
          {err}
        </p>
      ) : null}
      {msg ? (
        <p role="status" className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-900">
          {msg}
        </p>
      ) : null}

      {tab === "enviar" || !isAdmin ? (
        <section className="card space-y-4">
          <h2 className="text-sm font-bold uppercase text-slate-900">Agregar con URL de YouTube</h2>
          <form className="space-y-4" onSubmit={onSubmit}>
            <label className="block space-y-1.5">
              <span className={labelCls}>URL de YouTube</span>
              <input
                className={`${inputCls} font-mono text-[13px]`}
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://www.youtube.com/watch?v=… o https://youtu.be/…"
                autoComplete="off"
                required
              />
            </label>

            {(preview || previewBusy) && (
              <div className="flex gap-3 rounded-xl border border-slate-200 bg-slate-50 p-3">
                {preview ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={preview.thumb}
                    alt=""
                    className="h-20 w-32 shrink-0 rounded-md object-cover bg-slate-200"
                  />
                ) : (
                  <div className="h-20 w-32 shrink-0 animate-pulse rounded-md bg-slate-200" />
                )}
                <div className="min-w-0">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Vista previa</p>
                  <p className="mt-0.5 truncate font-semibold text-slate-900">
                    {previewBusy && !preview ? "Cargando…" : preview?.titulo || "Sin título"}
                  </p>
                  <p className="truncate text-xs text-slate-600">{preview?.artista || "—"}</p>
                </div>
              </div>
            )}

            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block space-y-1.5">
                <span className={labelCls}>Tu nombre</span>
                <input
                  className={inputCls}
                  value={nombre}
                  onChange={(e) => setNombre(e.target.value)}
                  required
                  minLength={2}
                  placeholder="Nombre completo"
                />
              </label>
              <label className="block space-y-1.5">
                <span className={labelCls}>Departamento</span>
                <select
                  className={`${inputCls} uppercase`}
                  value={departamento}
                  onChange={(e) => setDepartamento(e.target.value)}
                  required
                >
                  <option value="">Selecciona…</option>
                  {departamentos.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.label}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <label className="block space-y-1.5">
              <span className={labelCls}>Mensaje (opcional)</span>
              <input
                className={inputCls}
                value={mensaje}
                onChange={(e) => setMensaje(e.target.value)}
                placeholder="Ej. Dedicada al equipo"
                maxLength={200}
              />
            </label>

            <button type="submit" className="btn-primary uppercase" disabled={busy || !preview}>
              {busy ? "Enviando…" : "Agregar canción"}
            </button>
          </form>
        </section>
      ) : null}

      {isAdmin && tab === "admin" ? (
        <section className="card space-y-4">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <h2 className="text-sm font-bold uppercase text-slate-900">Programar playlist</h2>
            <div className="flex flex-wrap gap-2">
              <label className="space-y-0.5">
                <span className="block text-[10px] font-bold uppercase text-slate-500">Estado</span>
                <select
                  className="rounded-md border border-slate-300 bg-white px-2 py-1.5 text-xs font-bold uppercase"
                  value={filtroAdmin}
                  onChange={(e) => setFiltroAdmin(e.target.value as typeof filtroAdmin)}
                >
                  <option value="pendiente">Pendientes</option>
                  <option value="aprobada">Aprobadas</option>
                  <option value="especial">Petición especial</option>
                  <option value="todas">Todas</option>
                </select>
              </label>
              <label className="space-y-0.5">
                <span className="block text-[10px] font-bold uppercase text-slate-500">Fecha programada</span>
                <div className="flex gap-1">
                  <input
                    type="date"
                    className="rounded-md border border-slate-300 px-2 py-1.5 text-xs"
                    value={filtroFecha}
                    onChange={(e) => setFiltroFecha(e.target.value)}
                  />
                  <button
                    type="button"
                    className="rounded-md border border-slate-300 px-2 py-1 text-[10px] font-bold uppercase"
                    onClick={() => setFiltroFecha(ymdMexicoCity())}
                  >
                    Hoy
                  </button>
                  {filtroFecha ? (
                    <button
                      type="button"
                      className="rounded-md border border-slate-300 px-2 py-1 text-[10px] font-bold uppercase"
                      onClick={() => setFiltroFecha("")}
                    >
                      Limpiar
                    </button>
                  ) : null}
                </div>
              </label>
            </div>
          </div>
          <p className="text-[11px] text-slate-600">
            Define <strong>fecha</strong>, <strong>hora inicio</strong> y <strong>hora fin</strong> (zona México).
            El FAB solo aparece dentro de ese horario.{" "}
            <strong>Añadir ahora</strong> la pone ya en la lista de hoy como petición especial.
          </p>
          <ul className="divide-y divide-slate-100">
            {misOAdmin.length === 0 ? (
              <li className="py-6 text-center text-sm text-slate-500">Sin canciones en este filtro.</li>
            ) : (
              misOAdmin.map((c) => {
                const fecha = fechaById[c.id] ?? c.fechaProgramada ?? "";
                const inicio = inicioById[c.id] ?? c.horaInicio ?? "09:00";
                const fin = finById[c.id] ?? c.horaFin ?? "18:00";
                return (
                  <li key={c.id} className="flex flex-col gap-3 py-3 sm:flex-row sm:items-start">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={youtubeThumbUrl(c.youtubeVideoId)}
                      alt=""
                      className="h-16 w-28 shrink-0 rounded object-cover bg-slate-200"
                    />
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold text-slate-900">
                        {c.peticionEspecial ? (
                          <span className="mr-1 rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-bold uppercase text-amber-900">
                            Especial
                          </span>
                        ) : null}
                        {c.titulo}
                      </p>
                      <p className="text-xs text-slate-600">
                        {c.departamento} · {c.solicitadoPor}
                        {c.mensaje ? ` · “${c.mensaje}”` : ""}
                      </p>
                      <p className="mt-0.5 text-[10px] font-bold uppercase text-slate-500">
                        {c.estado}
                        {c.fechaProgramada
                          ? ` · ${c.fechaProgramada} ${c.horaInicio}–${c.horaFin}`
                          : ""}
                      </p>
                      <div className="mt-2 flex flex-wrap items-end gap-2">
                        <label className="space-y-0.5">
                          <span className="block text-[10px] font-bold uppercase text-slate-500">Día</span>
                          <input
                            type="date"
                            className="rounded border border-slate-300 px-2 py-1 text-sm"
                            value={fecha}
                            onChange={(e) =>
                              setFechaById((prev) => ({ ...prev, [c.id]: e.target.value }))
                            }
                          />
                        </label>
                        <label className="space-y-0.5">
                          <span className="block text-[10px] font-bold uppercase text-slate-500">Inicio</span>
                          <input
                            type="time"
                            className="rounded border border-slate-300 px-2 py-1 text-sm"
                            value={inicio}
                            onChange={(e) =>
                              setInicioById((prev) => ({ ...prev, [c.id]: e.target.value }))
                            }
                          />
                        </label>
                        <label className="space-y-0.5">
                          <span className="block text-[10px] font-bold uppercase text-slate-500">Fin</span>
                          <input
                            type="time"
                            className="rounded border border-slate-300 px-2 py-1 text-sm"
                            value={fin}
                            onChange={(e) =>
                              setFinById((prev) => ({ ...prev, [c.id]: e.target.value }))
                            }
                          />
                        </label>
                        <button
                          type="button"
                          className="btn-primary text-xs uppercase"
                          onClick={() => {
                            void patchCancion(c.id, {
                              estado: "aprobada",
                              fechaProgramada: fecha,
                              horaInicio: inicio,
                              horaFin: fin,
                              peticionEspecial: false,
                            }).then(
                              () => setMsg("Canción programada."),
                              (ex) => setErr(ex instanceof Error ? ex.message : "Error"),
                            );
                          }}
                        >
                          Programar
                        </button>
                        <button
                          type="button"
                          className="rounded-md bg-amber-600 px-3 py-2 text-xs font-bold uppercase text-white hover:bg-amber-700"
                          onClick={() => {
                            void patchCancion(c.id, { anadirAhora: true }).then(
                              () => setMsg("Añadida ahora como petición especial."),
                              (ex) => setErr(ex instanceof Error ? ex.message : "Error"),
                            );
                          }}
                        >
                          Añadir ahora
                        </button>
                        {c.estado !== "rechazada" ? (
                          <button
                            type="button"
                            className="btn-secondary text-xs uppercase"
                            onClick={() => {
                              void patchCancion(c.id, { estado: "rechazada" }).then(
                                () => setMsg("Canción rechazada."),
                                (ex) => setErr(ex instanceof Error ? ex.message : "Error"),
                              );
                            }}
                          >
                            Rechazar
                          </button>
                        ) : null}
                        <a
                          href={c.youtubeUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs font-bold uppercase text-sky-800 underline"
                        >
                          Ver en YouTube
                        </a>
                      </div>
                    </div>
                  </li>
                );
              })
            )}
          </ul>
        </section>
      ) : null}

      {tab === "enviar" || !isAdmin ? (
        <section className="card space-y-3">
          <h2 className="text-sm font-bold uppercase text-slate-900">
            {isAdmin ? "Últimas propuestas" : "Mis envíos"}
          </h2>
          <ul className="divide-y divide-slate-100">
            {(isAdmin ? rows.slice(0, 15) : rows).length === 0 ? (
              <li className="py-4 text-sm text-slate-500">Aún no hay canciones.</li>
            ) : (
              (isAdmin ? rows.slice(0, 15) : rows).map((c) => (
                <li key={c.id} className="flex gap-3 py-2.5">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={youtubeThumbUrl(c.youtubeVideoId)}
                    alt=""
                    className="h-12 w-20 shrink-0 rounded object-cover bg-slate-200"
                  />
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-slate-900">{c.titulo}</p>
                    <p className="text-[11px] text-slate-500">
                      {c.estado.toUpperCase()}
                      {c.peticionEspecial ? " · ESPECIAL" : ""}
                      {c.fechaProgramada
                        ? ` · ${c.fechaProgramada} ${c.horaInicio}–${c.horaFin}`
                        : ""}{" "}
                      · {c.departamento}
                    </p>
                  </div>
                </li>
              ))
            )}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
