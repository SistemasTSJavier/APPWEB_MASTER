"use client";

import { useCallback, useEffect, useState } from "react";
import {
  BUZON_APROBACIONES,
  BUZON_APROBACION_LABEL,
  BUZON_ESTADOS,
  BUZON_ESTATUS_LABEL,
  etiquetaDepartamentoBuzon,
  fechaBuzonMx,
  type BuzonAprobacion,
  type BuzonEstatus,
  type BuzonRegistro,
} from "@/lib/buzon";
import { BUZON_PUBLIC_PATH } from "@/lib/buzon-public-paths";

type Filtro = "todos" | BuzonAprobacion | `estatus:${BuzonEstatus}`;

export function BuzonPanelClient() {
  const [filtro, setFiltro] = useState<Filtro>("pendiente");
  const [rows, setRows] = useState<BuzonRegistro[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [puedeEditar, setPuedeEditar] = useState(false);
  const [detalle, setDetalle] = useState<BuzonRegistro | null>(null);
  const [nuevoEstatus, setNuevoEstatus] = useState<BuzonEstatus>("recibido");
  const [nota, setNota] = useState("");
  const [guardando, setGuardando] = useState(false);

  const cargar = useCallback(async (f: Filtro) => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (f === "pendiente" || f === "aprobado" || f === "no_aprobado") {
        params.set("aprobacion", f);
      } else if (f.startsWith("estatus:")) {
        params.set("aprobacion", "aprobado");
        params.set("estatus", f.slice("estatus:".length));
      }
      const qs = params.toString() ? `?${params}` : "";
      const res = await fetch(`/api/buzon${qs}`);
      const j = (await res.json().catch(() => ({}))) as {
        rows?: BuzonRegistro[];
        error?: string;
        puedeEditar?: boolean;
      };
      if (!res.ok) {
        setError(j.error ?? "No se pudo cargar el listado.");
        setRows([]);
        return;
      }
      setRows(j.rows ?? []);
      setPuedeEditar(Boolean(j.puedeEditar));
    } catch {
      setError("Error de red al cargar registros.");
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void cargar(filtro);
    }, 0);
    return () => window.clearTimeout(timer);
  }, [filtro, cargar]);

  function abrirDetalle(r: BuzonRegistro) {
    setDetalle(r);
    setNuevoEstatus(r.estatus ?? "recibido");
    setNota("");
    setError(null);
  }

  async function decidirAprobacion(aprobacion: "aprobado" | "no_aprobado") {
    if (!detalle || !puedeEditar) return;
    setGuardando(true);
    setError(null);
    try {
      const res = await fetch(`/api/buzon/${encodeURIComponent(detalle.id)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ accion: "aprobacion", aprobacion, nota }),
      });
      const j = (await res.json().catch(() => ({}))) as {
        error?: string;
        row?: BuzonRegistro;
      };
      if (!res.ok) {
        setError(j.error ?? "No se pudo guardar la aprobación.");
        return;
      }
      if (j.row) setDetalle(j.row);
      setNota("");
      await cargar(filtro);
    } catch {
      setError("Error de red al actualizar.");
    } finally {
      setGuardando(false);
    }
  }

  async function guardarEstatus() {
    if (!detalle || !puedeEditar) return;
    setGuardando(true);
    setError(null);
    try {
      const res = await fetch(`/api/buzon/${encodeURIComponent(detalle.id)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ accion: "estatus", estatus: nuevoEstatus, nota }),
      });
      const j = (await res.json().catch(() => ({}))) as {
        error?: string;
        row?: BuzonRegistro;
      };
      if (!res.ok) {
        setError(j.error ?? "No se pudo actualizar el estatus.");
        return;
      }
      if (j.row) setDetalle(j.row);
      setNota("");
      await cargar(filtro);
    } catch {
      setError("Error de red al actualizar.");
    } finally {
      setGuardando(false);
    }
  }

  const filtros: { id: Filtro; label: string }[] = [
    { id: "todos", label: "Todos" },
    ...BUZON_APROBACIONES.map((id) => ({ id: id as Filtro, label: BUZON_APROBACION_LABEL[id] })),
    ...BUZON_ESTADOS.map((id) => ({
      id: `estatus:${id}` as Filtro,
      label: `Estatus: ${BUZON_ESTATUS_LABEL[id]}`,
    })),
  ];

  return (
    <div className="min-w-0 space-y-5">
      <header className="overflow-hidden rounded-xl border border-slate-200 bg-gradient-to-br from-slate-950 via-slate-900 to-indigo-950 px-5 py-6 text-white shadow-sm sm:px-6">
        <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-sky-300/90">
          Atención interna
        </p>
        <h1 className="mt-1 text-xl font-bold uppercase tracking-wide sm:text-2xl">Buzón</h1>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-slate-300">
          Primero apruebe o rechace el registro. Solo los aprobados tienen estatus de seguimiento.
        </p>
        <p className="mt-3 text-[11px] text-slate-400">
          Enlace público:{" "}
          <a
            href={BUZON_PUBLIC_PATH}
            className="font-semibold text-sky-300 underline-offset-2 hover:underline"
          >
            {BUZON_PUBLIC_PATH}
          </a>
          {!puedeEditar ? (
            <span className="ml-2 rounded bg-white/10 px-2 py-0.5 text-[10px] uppercase">
              Solo lectura
            </span>
          ) : null}
        </p>
      </header>

      <div className="flex flex-wrap gap-2">
        {filtros.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => {
              setDetalle(null);
              setFiltro(t.id);
            }}
            className={`rounded-lg px-3 py-2 text-[11px] font-bold uppercase tracking-wide transition ${
              filtro === t.id
                ? "bg-slate-900 text-white shadow-sm"
                : "border border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {error && !detalle ? (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">
          {error}
        </p>
      ) : null}

      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
        <table className="min-w-full text-left text-sm">
          <thead className="bg-slate-50 text-[10px] font-bold uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-3 py-3">Código</th>
              <th className="px-3 py-3">Colaborador</th>
              <th className="px-3 py-3">Departamento</th>
              <th className="px-3 py-3">Aprobación</th>
              <th className="px-3 py-3">Estatus</th>
              <th className="px-3 py-3">Fecha</th>
              <th className="px-3 py-3" />
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={7} className="px-3 py-8 text-center text-slate-500">
                  Cargando…
                </td>
              </tr>
            ) : rows.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-3 py-8 text-center text-slate-500">
                  Sin registros en este filtro.
                </td>
              </tr>
            ) : (
              rows.map((r) => (
                <tr key={r.id} className="border-t border-slate-100 hover:bg-slate-50/80">
                  <td className="px-3 py-3 font-mono text-xs font-semibold">{r.codigoSeguimiento}</td>
                  <td className="px-3 py-3">{r.nombreColaborador}</td>
                  <td className="px-3 py-3">{etiquetaDepartamentoBuzon(String(r.departamento))}</td>
                  <td className="px-3 py-3">
                    <span
                      className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-bold ${
                        r.aprobacion === "aprobado"
                          ? "bg-emerald-50 text-emerald-900"
                          : r.aprobacion === "no_aprobado"
                            ? "bg-red-50 text-red-800"
                            : "bg-amber-50 text-amber-900"
                      }`}
                    >
                      {BUZON_APROBACION_LABEL[r.aprobacion]}
                    </span>
                  </td>
                  <td className="px-3 py-3">
                    {r.aprobacion === "aprobado" && r.estatus ? (
                      <span className="inline-flex rounded-full bg-sky-50 px-2 py-0.5 text-[11px] font-bold text-sky-900">
                        {BUZON_ESTATUS_LABEL[r.estatus]}
                      </span>
                    ) : (
                      <span className="text-xs text-slate-400">—</span>
                    )}
                  </td>
                  <td className="px-3 py-3 text-xs text-slate-600">{fechaBuzonMx(r.createdAt)}</td>
                  <td className="px-3 py-3 text-right">
                    <button
                      type="button"
                      className="text-xs font-bold uppercase text-sky-700 underline-offset-2 hover:underline"
                      onClick={() => abrirDetalle(r)}
                    >
                      Ver
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {detalle ? (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-4 sm:items-center"
          role="dialog"
          aria-modal="true"
        >
          <div className="max-h-[90dvh] w-full max-w-lg overflow-y-auto rounded-2xl bg-white p-5 shadow-xl sm:p-6">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-wide text-slate-500">
                  Detalle
                </p>
                <h2 className="font-mono text-lg font-bold text-slate-900">
                  {detalle.codigoSeguimiento}
                </h2>
              </div>
              <button
                type="button"
                className="rounded-lg px-2 py-1 text-sm font-semibold text-slate-500 hover:bg-slate-100"
                onClick={() => setDetalle(null)}
              >
                Cerrar
              </button>
            </div>

            <dl className="mt-4 space-y-2 text-sm">
              <div>
                <dt className="text-[10px] font-bold uppercase text-slate-500">Colaborador</dt>
                <dd>{detalle.nombreColaborador}</dd>
              </div>
              <div>
                <dt className="text-[10px] font-bold uppercase text-slate-500">Departamento</dt>
                <dd>{etiquetaDepartamentoBuzon(String(detalle.departamento))}</dd>
              </div>
              <div>
                <dt className="text-[10px] font-bold uppercase text-slate-500">
                  Queja / requerimiento
                </dt>
                <dd className="whitespace-pre-wrap">{detalle.quejaRequerimiento}</dd>
              </div>
              <div>
                <dt className="text-[10px] font-bold uppercase text-slate-500">Aprobación</dt>
                <dd className="font-semibold">{BUZON_APROBACION_LABEL[detalle.aprobacion]}</dd>
              </div>
              {detalle.aprobacion === "aprobado" ? (
                <div>
                  <dt className="text-[10px] font-bold uppercase text-slate-500">Estatus</dt>
                  <dd className="font-semibold">
                    {detalle.estatus ? BUZON_ESTATUS_LABEL[detalle.estatus] : "—"}
                  </dd>
                </div>
              ) : null}
            </dl>

            {detalle.evidenciaUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={detalle.evidenciaUrl}
                alt="Evidencia"
                className="mt-4 aspect-[4/3] w-full rounded-lg object-cover"
              />
            ) : null}

            {detalle.notas.length > 0 ? (
              <div className="mt-4">
                <p className="text-[10px] font-bold uppercase text-slate-500">Notas</p>
                <ul className="mt-2 max-h-40 space-y-2 overflow-y-auto">
                  {detalle.notas.map((n, i) => (
                    <li
                      key={`${n.at}-${i}`}
                      className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm"
                    >
                      <p className="font-semibold text-slate-800">
                        {n.tipo === "aprobacion" && n.aprobacion
                          ? BUZON_APROBACION_LABEL[n.aprobacion]
                          : n.estatus
                            ? BUZON_ESTATUS_LABEL[n.estatus]
                            : "Nota"}{" "}
                        · {fechaBuzonMx(n.at)}
                        {n.by ? ` · ${n.by}` : ""}
                      </p>
                      <p className="mt-1 whitespace-pre-wrap text-slate-600">{n.nota}</p>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}

            {puedeEditar && detalle.aprobacion === "pendiente" ? (
              <div className="mt-5 space-y-3 border-t border-slate-200 pt-4">
                <p className="text-[10px] font-bold uppercase tracking-wide text-slate-500">
                  Decisión de aprobación
                </p>
                <p className="text-xs text-slate-600">
                  Si no se aprueba, no habrá estatus de seguimiento. Si se aprueba, inicia en
                  «Recibido».
                </p>
                <div>
                  <label className="text-[11px] font-bold uppercase text-slate-600" htmlFor="buzon-nota-apr">
                    Nota (obligatoria)
                  </label>
                  <textarea
                    id="buzon-nota-apr"
                    className="mt-1 min-h-[90px] w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                    value={nota}
                    onChange={(e) => setNota(e.target.value)}
                    placeholder="Motivo de la decisión…"
                    maxLength={2000}
                  />
                </div>
                {error ? (
                  <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">
                    {error}
                  </p>
                ) : null}
                <div className="flex flex-col gap-2 sm:flex-row">
                  <button
                    type="button"
                    disabled={guardando}
                    className="flex-1 rounded-xl bg-emerald-700 px-4 py-3 text-sm font-bold uppercase text-white disabled:opacity-60"
                    onClick={() => void decidirAprobacion("aprobado")}
                  >
                    {guardando ? "Guardando…" : "Aprobado"}
                  </button>
                  <button
                    type="button"
                    disabled={guardando}
                    className="flex-1 rounded-xl bg-red-700 px-4 py-3 text-sm font-bold uppercase text-white disabled:opacity-60"
                    onClick={() => void decidirAprobacion("no_aprobado")}
                  >
                    {guardando ? "Guardando…" : "No aprobado"}
                  </button>
                </div>
              </div>
            ) : null}

            {puedeEditar && detalle.aprobacion === "aprobado" ? (
              <div className="mt-5 space-y-3 border-t border-slate-200 pt-4">
                <p className="text-[10px] font-bold uppercase tracking-wide text-slate-500">
                  Cambiar estatus
                </p>
                <div>
                  <label className="text-[11px] font-bold uppercase text-slate-600" htmlFor="buzon-est">
                    Nuevo estatus
                  </label>
                  <select
                    id="buzon-est"
                    className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                    value={nuevoEstatus}
                    onChange={(e) => setNuevoEstatus(e.target.value as BuzonEstatus)}
                  >
                    {BUZON_ESTADOS.map((s) => (
                      <option key={s} value={s}>
                        {BUZON_ESTATUS_LABEL[s]}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-[11px] font-bold uppercase text-slate-600" htmlFor="buzon-nota">
                    Nota (obligatoria)
                  </label>
                  <textarea
                    id="buzon-nota"
                    className="mt-1 min-h-[90px] w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                    value={nota}
                    onChange={(e) => setNota(e.target.value)}
                    placeholder="Explique el cambio de estatus…"
                    maxLength={2000}
                  />
                </div>
                {error ? (
                  <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">
                    {error}
                  </p>
                ) : null}
                <button
                  type="button"
                  disabled={guardando}
                  className="w-full rounded-xl bg-slate-900 px-4 py-3 text-sm font-bold uppercase text-white disabled:opacity-60"
                  onClick={() => void guardarEstatus()}
                >
                  {guardando ? "Guardando…" : "Guardar estatus y nota"}
                </button>
              </div>
            ) : null}

            {detalle.aprobacion === "no_aprobado" ? (
              <p className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-800">
                Registro no aprobado: no aplica estatus de seguimiento.
              </p>
            ) : null}

            {!puedeEditar ? (
              <p className="mt-4 text-xs text-slate-500">
                Su usuario tiene solo lectura; no puede aprobar ni cambiar estatus.
              </p>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}
