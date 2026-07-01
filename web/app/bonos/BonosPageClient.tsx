"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { AppRole } from "@/lib/app-role";
import { BONOS_MILESTONES, type BonosFila, type BonosMilestone } from "@/lib/bonos-types";
import { servicioCoincideFiltroCat } from "@/lib/categorizacion-filtros-servicio";
import { formatoDesdeYyyyMmDd } from "@/lib/fecha-formato-display";
import { agruparFilasPorBono } from "@/lib/bonos-agrupar";
import { addDays, mondayOfWeek, semanaDesdeLunes } from "@/lib/semana-lun-dom";
import { BonosEmailDialog } from "./BonosEmailDialog";

function fmtFecha(ymd: string): string {
  return formatoDesdeYyyyMmDd(ymd) || ymd || "—";
}

function filaKey(f: BonosFila): string {
  return `${f.noEmpleado}|${f.fechaCumplimiento}|${f.bonoDias}`;
}

export function BonosPageClient({ appRole: _appRole, email: _email }: { appRole: AppRole; email: string }) {
  const [weekStart, setWeekStart] = useState(() => mondayOfWeek(new Date()));
  const semana = useMemo(() => semanaDesdeLunes(weekStart), [weekStart]);
  const weekStartIso = semana.lunesYmd;

  const [filas, setFilas] = useState<BonosFila[]>([]);
  const [servicios, setServicios] = useState<string[]>([]);
  const [totalActivos, setTotalActivos] = useState(0);
  const [totalConBono, setTotalConBono] = useState(0);
  const [filtroServicio, setFiltroServicio] = useState("");
  const [filtroBono, setFiltroBono] = useState<"" | `${BonosMilestone}`>("");
  const [busqueda, setBusqueda] = useState("");
  const [busy, setBusy] = useState(true);
  const [msg, setMsg] = useState<string | null>(null);
  const [generadoEn, setGeneradoEn] = useState("");
  const [fechaReferencia, setFechaReferencia] = useState("");
  const [seleccion, setSeleccion] = useState<Set<string>>(() => new Set());
  const [emailOpen, setEmailOpen] = useState(false);

  const load = useCallback(async () => {
    setBusy(true);
    setMsg(null);
    try {
      const params = new URLSearchParams();
      params.set("weekStartIso", weekStartIso);
      if (filtroServicio) params.set("servicio", filtroServicio);
      if (filtroBono) params.set("bono", filtroBono);
      const r = await fetch(`/api/bonos?${params.toString()}`, { cache: "no-store" });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error ?? `Error ${r.status}`);
      setFilas(Array.isArray(j.filas) ? j.filas : []);
      setServicios(Array.isArray(j.servicios) ? j.servicios : []);
      setTotalActivos(Number(j.totalActivos ?? 0));
      setTotalConBono(Number(j.totalConBono ?? j.filas?.length ?? 0));
      setGeneradoEn(String(j.generadoEn ?? ""));
      setFechaReferencia(String(j.fechaReferencia ?? ""));
      setSeleccion(new Set());
    } catch (e) {
      setMsg(e instanceof Error ? e.message.toUpperCase() : "ERROR AL CARGAR.");
      setFilas([]);
    } finally {
      setBusy(false);
    }
  }, [filtroServicio, filtroBono, weekStartIso]);

  useEffect(() => {
    void load();
  }, [load]);

  const filtradas = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    const base = q
      ? filas.filter(
          (f) =>
            f.noEmpleado.toLowerCase().includes(q) ||
            f.nombre.toLowerCase().includes(q) ||
            f.servicio.toLowerCase().includes(q),
        )
      : filas;
    return [...base].sort((a, b) => {
      if (a.bonoDias !== b.bonoDias) return a.bonoDias - b.bonoDias;
      const cmp = a.fechaCumplimiento.localeCompare(b.fechaCumplimiento);
      if (cmp !== 0) return cmp;
      return a.nombre.localeCompare(b.nombre, "es", { sensitivity: "base" });
    });
  }, [filas, busqueda]);

  const gruposBonos = useMemo(() => agruparFilasPorBono(filtradas), [filtradas]);

  const filasSeleccionadas = useMemo(
    () => filtradas.filter((f) => seleccion.has(filaKey(f))),
    [filtradas, seleccion],
  );

  const todasVisiblesSeleccionadas =
    filtradas.length > 0 && filtradas.every((f) => seleccion.has(filaKey(f)));

  const toggleFila = (f: BonosFila) => {
    const k = filaKey(f);
    setSeleccion((prev) => {
      const next = new Set(prev);
      if (next.has(k)) next.delete(k);
      else next.add(k);
      return next;
    });
  };

  const toggleTodasVisibles = () => {
    setSeleccion((prev) => {
      const next = new Set(prev);
      if (todasVisiblesSeleccionadas) {
        for (const f of filtradas) next.delete(filaKey(f));
      } else {
        for (const f of filtradas) next.add(filaKey(f));
      }
      return next;
    });
  };

  const conteosServicio = useMemo(() => {
    const map = new Map<string, number>();
    for (const f of filas) {
      const clave = f.servicio.trim();
      if (!clave) continue;
      map.set(clave, (map.get(clave) ?? 0) + 1);
    }
    return [...map.entries()].map(([servicio, count]) => ({ servicio, count }));
  }, [filas]);

  return (
    <div className="min-w-0 space-y-5">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Módulo</p>
        <h1 className="page-title uppercase">Bonos</h1>
        <p className="page-lead text-sm">
          Solo colaboradores <strong>activos</strong> y <strong>LOCAL</strong> en servicios operativos. El bono
          depende de la <strong>antigüedad desde el ingreso</strong>: se revisa cuadrícula del{" "}
          <strong>ingreso al día de cumplimiento</strong> (ingreso + 15, 30, 60 o 90 días).{" "}
          <strong>Una sola falta (F)</strong> o <strong>PSGS</strong> en cuadrícula desde el ingreso hasta hoy elimina
          los <strong>4 bonos</strong>. Bono 15: 15–29 días · 30: 30–59 · 60: 60–89 · 90: 90–119 días.
        </p>
        {fechaReferencia ? (
          <p className="mt-2 text-xs font-semibold text-blue-900">
            Fecha de referencia del cálculo: {fmtFecha(fechaReferencia)}
          </p>
        ) : null}
      </div>

      <section className="callout-accent space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-sm font-bold uppercase text-slate-900">Periodo de evaluación (semana)</h2>
            <p className="mt-1 text-[11px] text-slate-600">
              Se muestran bonos cuya <strong>fecha de cumplimiento</strong> cae en la semana seleccionada (lun–dom),
              igual que en Cuadrícula.
            </p>
          </div>
          <button
            type="button"
            className="btn-secondary text-xs uppercase"
            onClick={() => setWeekStart(mondayOfWeek(new Date()))}
          >
            Semana actual
          </button>
        </div>

        <div className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between">
          <button
            type="button"
            className="btn-secondary shrink-0 text-xs uppercase"
            onClick={() => setWeekStart((d) => addDays(d, -7))}
            title="Semana anterior (lun–dom)"
          >
            ← Semana anterior
          </button>
          <div className="min-w-0 flex-1 text-center">
            <p className="text-[10px] font-bold uppercase tracking-wider text-blue-900">Semana de evaluación</p>
            <p className="mt-1 text-base font-bold text-slate-900">{semana.etiqueta}</p>
          </div>
          <button
            type="button"
            className="btn-secondary shrink-0 text-xs uppercase"
            onClick={() => setWeekStart((d) => addDays(d, 7))}
            title="Semana siguiente (lun–dom)"
          >
            Semana siguiente →
          </button>
        </div>
      </section>

      <section className="card space-y-4">
        <h2 className="text-sm font-bold uppercase text-slate-900">Filtros</h2>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
          <label className="space-y-1">
            <span className="form-label">Servicio</span>
            <select
              className="form-control uppercase"
              value={filtroServicio}
              onChange={(e) => setFiltroServicio(e.target.value)}
            >
              <option value="">Todos los servicios</option>
              {servicios.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </label>
          <label className="space-y-1">
            <span className="form-label">Bono cumplido</span>
            <select
              className="form-control uppercase"
              value={filtroBono}
              onChange={(e) => setFiltroBono(e.target.value as "" | `${BonosMilestone}`)}
            >
              <option value="">Todos los bonos cumplidos</option>
              {BONOS_MILESTONES.map((d) => (
                <option key={d} value={String(d)}>
                  {d} días
                </option>
              ))}
            </select>
          </label>
          <label className="space-y-1 md:col-span-2">
            <span className="form-label">Buscar</span>
            <input
              type="search"
              className="form-control uppercase"
              placeholder="N° DE EMPLEADO O NOMBRE…"
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
            />
          </label>
        </div>
        <div className="flex flex-wrap items-center gap-3 text-[11px] font-semibold text-slate-600">
          <span>
            {filtradas.length} fila(s)
            {filas.length !== filtradas.length ? ` de ${filas.length}` : ""}
          </span>
          <span>· {totalConBono} con cumplimiento en esta semana</span>
          <span>· {totalActivos} elegible(s) LOCAL</span>
          {seleccion.size > 0 ? <span className="text-blue-900">· {seleccion.size} seleccionado(s)</span> : null}
          {generadoEn ? (
            <span>
              · Actualizado{" "}
              {new Date(generadoEn).toLocaleString("es-MX", { dateStyle: "short", timeStyle: "short" })}
            </span>
          ) : null}
          <button type="button" className="btn-secondary text-xs uppercase" disabled={busy} onClick={() => void load()}>
            {busy ? "Cargando…" : "Actualizar"}
          </button>
          <button
            type="button"
            className="btn-secondary text-xs uppercase"
            disabled={filtradas.length === 0}
            onClick={toggleTodasVisibles}
          >
            {todasVisiblesSeleccionadas ? "Quitar selección" : "Seleccionar todos"}
          </button>
          <button
            type="button"
            className="btn-primary text-xs uppercase"
            disabled={filasSeleccionadas.length === 0}
            onClick={() => setEmailOpen(true)}
          >
            Enviar por correo ({filasSeleccionadas.length})
          </button>
        </div>
        {filtroServicio && conteosServicio.length > 0 ? (
          <div className="flex flex-wrap gap-1.5">
            {conteosServicio
              .filter((c) => servicioCoincideFiltroCat(c.servicio, filtroServicio))
              .map(({ servicio, count }) => (
                <span
                  key={servicio}
                  className="badge-muted gap-1 uppercase"
                >
                  {servicio} <span className="font-mono">{count}</span>
                </span>
              ))}
          </div>
        ) : null}
      </section>

      {msg ? (
        <p
          className={`rounded-lg border px-3 py-2 text-sm font-semibold ${
            msg.includes("ENVIADO") || msg.includes("CORREO")
              ? "border-emerald-200 bg-emerald-50 text-emerald-900"
              : "border-red-200 bg-red-50 text-red-900"
          }`}
        >
          {msg}
        </p>
      ) : null}

      <section className="space-y-6">
        {busy && filas.length === 0 ? (
          <div className="card py-8 text-center text-sm text-slate-500">Calculando bonos desde cuadrícula…</div>
        ) : null}

        {gruposBonos.map((grupo) => (
          <div key={grupo.hito} className="table-wrap overflow-hidden p-0">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 bg-slate-900 px-4 py-3 text-white">
              <h3 className="border-l-4 border-blue-500 pl-3 text-sm font-bold uppercase tracking-wide">
                {grupo.titulo}
              </h3>
              <span className="rounded-md bg-white/10 px-3 py-0.5 text-[11px] font-semibold text-sky-200">
                {grupo.filas.length} colaborador{grupo.filas.length === 1 ? "" : "es"}
              </span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[920px] text-left text-xs">
                <thead className="table-head">
                  <tr>
                    <th className="w-10 p-2">
                      <span className="sr-only">Seleccionar</span>
                    </th>
                    <th className="table-cell py-2.5">N° empleado</th>
                    <th className="table-cell py-2.5">F. ingreso</th>
                    <th className="table-cell py-2.5">Servicio</th>
                    <th className="table-cell py-2.5">Local / foráneo</th>
                    <th className="table-cell py-2.5">Periodo evaluado</th>
                    <th className="table-cell py-2.5">Cumplimiento</th>
                  </tr>
                </thead>
                <tbody>
                  {grupo.filas.map((f) => {
                    const k = filaKey(f);
                    const sel = seleccion.has(k);
                    return (
                      <tr
                        key={k}
                        className={`table-row-hover ${sel ? "bg-blue-50" : ""}`}
                      >
                        <td className="table-cell py-2">
                          <input
                            type="checkbox"
                            className="size-4 rounded border-slate-300 accent-blue-900"
                            checked={sel}
                            onChange={() => toggleFila(f)}
                            aria-label={`Seleccionar ${f.nombre || f.noEmpleado}`}
                          />
                        </td>
                        <td className="table-cell py-2.5">
                          <span className="font-mono font-bold text-slate-950">{f.noEmpleado}</span>
                          {f.nombre ? (
                            <span className="mt-0.5 block text-[10px] font-medium normal-case text-slate-600">
                              {f.nombre}
                            </span>
                          ) : null}
                        </td>
                        <td className="table-cell py-2.5">{fmtFecha(f.fechaIngreso)}</td>
                        <td className="table-cell py-2.5 uppercase">{f.servicio || "—"}</td>
                        <td className="table-cell py-2.5 uppercase">{f.localForaneo || "—"}</td>
                        <td className="table-cell whitespace-nowrap py-2.5 text-[11px] text-slate-600">
                          {fmtFecha(f.periodoEvaluadoDesde)} → {fmtFecha(f.periodoEvaluadoHasta)}
                        </td>
                        <td className="table-cell py-2.5 font-semibold text-blue-900">{fmtFecha(f.fechaCumplimiento)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        ))}

        {!busy && filtradas.length === 0 ? (
          <div className="card py-10 text-center text-sm text-slate-500">
            Sin bonos con cumplimiento en <strong>{semana.etiqueta}</strong>. Cambie de semana o revise filtros.
          </div>
        ) : null}
      </section>

      <BonosEmailDialog
        open={emailOpen}
        onClose={() => setEmailOpen(false)}
        filas={filasSeleccionadas}
        semana={semana}
        onEnviado={(texto) => setMsg(texto.toUpperCase())}
      />
    </div>
  );
}
