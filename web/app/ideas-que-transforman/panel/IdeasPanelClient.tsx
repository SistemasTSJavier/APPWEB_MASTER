"use client";

import { useCallback, useEffect, useState } from "react";
import {
  etiquetaDepartamentoIdea,
  fechaIdeaMx,
  type IdeaEstado,
  type IdeaQueTransforma,
} from "@/lib/ideas-que-transforman";
import { IDEAS_PUBLIC_PATH } from "@/lib/ideas-que-transforman-public-paths";

type Tab = IdeaEstado;

export function IdeasPanelClient() {
  const [tab, setTab] = useState<Tab>("pendiente");
  const [rows, setRows] = useState<IdeaQueTransforma[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [detalle, setDetalle] = useState<IdeaQueTransforma | null>(null);
  const [aceptando, setAceptando] = useState(false);

  const cargar = useCallback(async (estado: Tab) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/ideas-que-transforman?estado=${encodeURIComponent(estado)}`);
      const j = (await res.json().catch(() => ({}))) as { rows?: IdeaQueTransforma[]; error?: string };
      if (!res.ok) {
        setError(j.error ?? "No se pudo cargar el listado.");
        setRows([]);
        return;
      }
      setRows(j.rows ?? []);
    } catch {
      setError("Error de red al cargar ideas.");
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void cargar(tab);
    }, 0);
    return () => window.clearTimeout(timer);
  }, [tab, cargar]);

  async function aceptarIdea(id: string) {
    setAceptando(true);
    setError(null);
    try {
      const res = await fetch(`/api/ideas-que-transforman/${encodeURIComponent(id)}`, { method: "PATCH" });
      const j = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        setError(j.error ?? "No se pudo aceptar la idea.");
        return;
      }
      setDetalle(null);
      await cargar("pendiente");
    } catch {
      setError("Error de red al aceptar.");
    } finally {
      setAceptando(false);
    }
  }

  return (
    <div className="min-w-0 space-y-5">
      <header className="overflow-hidden rounded-xl border border-slate-200 bg-gradient-to-br from-slate-950 via-slate-900 to-blue-950 px-5 py-6 text-white shadow-sm sm:px-6">
        <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-sky-300/90">Mejora continua</p>
        <h1 className="mt-1 text-xl font-bold uppercase tracking-wide sm:text-2xl">Ideas que transforman</h1>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-slate-300">
          Revise propuestas del equipo, consulte el detalle y acepte las que pasen a implementación.
        </p>
        <p className="mt-3 text-[11px] text-slate-400">
          Enlace público (QR):{" "}
          <a href={IDEAS_PUBLIC_PATH} className="font-semibold text-sky-300 underline-offset-2 hover:underline">
            {IDEAS_PUBLIC_PATH}
          </a>
        </p>
      </header>

      <div className="flex flex-wrap gap-2">
        {(
          [
            { id: "pendiente" as const, label: "Pendientes" },
            { id: "aceptado" as const, label: "Aceptados" },
          ] as const
        ).map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => {
              setDetalle(null);
              setTab(t.id);
            }}
            className={`rounded-lg px-4 py-2 text-xs font-bold uppercase tracking-wide transition ${
              tab === t.id
                ? "bg-slate-900 text-white shadow-sm"
                : "border border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {error && (
        <p className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800">{error}</p>
      )}

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="hidden gap-2 border-b border-slate-200 bg-slate-50 px-5 py-3 text-[10px] font-bold uppercase tracking-wide text-slate-500 sm:grid sm:grid-cols-[1.1fr_1.2fr_1.2fr_auto]">
          <span>Fecha de creación</span>
          <span>Nombre</span>
          <span>Departamento</span>
          <span className="text-right">Acción</span>
        </div>

        {loading ? (
          <p className="px-5 py-8 text-sm text-slate-500">Cargando…</p>
        ) : rows.length === 0 ? (
          <p className="px-5 py-8 text-sm text-slate-500">
            {tab === "pendiente" ? "No hay propuestas pendientes." : "Aún no hay ideas aceptadas."}
          </p>
        ) : (
          <ul className="divide-y divide-slate-100">
            {rows.map((r) => (
              <li
                key={r.id}
                className="flex flex-col gap-3 px-4 py-3.5 text-sm sm:grid sm:grid-cols-[1.1fr_1.2fr_1.2fr_auto] sm:items-center sm:gap-2 sm:px-5"
              >
                <div className="sm:contents">
                  <p className="text-[10px] font-bold uppercase text-slate-400 sm:hidden">Fecha</p>
                  <span className="text-slate-700">{fechaIdeaMx(r.createdAt)}</span>
                </div>
                <div className="sm:contents">
                  <p className="text-[10px] font-bold uppercase text-slate-400 sm:hidden">Nombre</p>
                  <span className="font-semibold text-slate-900">{r.nombre}</span>
                </div>
                <div className="sm:contents">
                  <p className="text-[10px] font-bold uppercase text-slate-400 sm:hidden">Departamento</p>
                  <span className="text-slate-700">{etiquetaDepartamentoIdea(r.departamentoAutor)}</span>
                </div>
                <div className="sm:text-right">
                  <button
                    type="button"
                    onClick={() => setDetalle(r)}
                    className="w-full rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-[11px] font-bold uppercase tracking-wide text-slate-800 transition hover:bg-slate-50 sm:w-auto"
                  >
                    Ver resumen
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      {detalle && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/50 p-4 sm:items-center"
          role="dialog"
          aria-modal="true"
          aria-labelledby="idea-detalle-titulo"
          onClick={() => setDetalle(null)}
        >
          <div
            className="max-h-[90dvh] w-full max-w-lg overflow-y-auto rounded-2xl border border-slate-200 bg-white shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="border-b border-slate-200 bg-gradient-to-r from-slate-950 to-blue-950 px-5 py-4 text-white">
              <p className="text-[10px] font-bold uppercase tracking-wide text-sky-300">Resumen de la propuesta</p>
              <h2 id="idea-detalle-titulo" className="mt-1 text-lg font-bold uppercase">
                {detalle.nombre}
              </h2>
              <p className="mt-1 text-xs text-slate-300">
                {fechaIdeaMx(detalle.createdAt)} · {etiquetaDepartamentoIdea(detalle.departamentoAutor)}
              </p>
            </div>

            <div className="space-y-4 px-5 py-5 text-sm">
              <Campo label="Problema" valor={detalle.problema} />
              <Campo label="Solución" valor={detalle.solucion} />
              <Campo label="Beneficio" valor={detalle.beneficio} />
              <Campo
                label="Departamento afectado"
                valor={etiquetaDepartamentoIdea(detalle.departamentoAfectado)}
              />
              {detalle.estado === "aceptado" && (
                <p className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-900">
                  Aceptada
                  {detalle.aceptadoAt ? ` · ${fechaIdeaMx(detalle.aceptadoAt)}` : ""}
                  {detalle.aceptadoPorEmail ? ` · ${detalle.aceptadoPorEmail}` : ""}
                </p>
              )}
            </div>

            <div className="flex flex-wrap justify-end gap-2 border-t border-slate-200 px-5 py-4">
              <button
                type="button"
                onClick={() => setDetalle(null)}
                className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-xs font-bold uppercase text-slate-800 hover:bg-slate-50"
              >
                Cerrar
              </button>
              {detalle.estado === "pendiente" && (
                <button
                  type="button"
                  disabled={aceptando}
                  onClick={() => void aceptarIdea(detalle.id)}
                  className="rounded-lg bg-emerald-700 px-4 py-2 text-xs font-bold uppercase text-white hover:bg-emerald-600 disabled:opacity-60"
                >
                  {aceptando ? "Aceptando…" : "Mover a aceptado"}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Campo({ label, valor }: { label: string; valor: string }) {
  return (
    <div>
      <p className="text-[10px] font-bold uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-1 whitespace-pre-wrap leading-relaxed text-slate-800">{valor}</p>
    </div>
  );
}
