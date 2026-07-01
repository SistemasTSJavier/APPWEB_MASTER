"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { AppRole } from "@/lib/app-role";
import { BONOS_MILESTONES, type BonosFila, type BonosMilestone } from "@/lib/bonos-types";
import { servicioCoincideFiltroCat } from "@/lib/categorizacion-filtros-servicio";

function fmtFecha(ymd: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(ymd.trim());
  if (!m) return ymd || "—";
  return `${m[3]}/${m[2]}/${m[1]}`;
}

export function BonosPageClient({ appRole: _appRole, email: _email }: { appRole: AppRole; email: string }) {
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

  const load = useCallback(async () => {
    setBusy(true);
    setMsg(null);
    try {
      const params = new URLSearchParams();
      if (filtroServicio) params.set("servicio", filtroServicio);
      if (filtroBono) params.set("bono", filtroBono);
      const qs = params.toString();
      const r = await fetch(`/api/bonos${qs ? `?${qs}` : ""}`, { cache: "no-store" });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error ?? `Error ${r.status}`);
      setFilas(Array.isArray(j.filas) ? j.filas : []);
      setServicios(Array.isArray(j.servicios) ? j.servicios : []);
      setTotalActivos(Number(j.totalActivos ?? 0));
      setTotalConBono(Number(j.totalConBono ?? j.filas?.length ?? 0));
      setGeneradoEn(String(j.generadoEn ?? ""));
      setFechaReferencia(String(j.fechaReferencia ?? ""));
    } catch (e) {
      setMsg(e instanceof Error ? e.message.toUpperCase() : "ERROR AL CARGAR.");
      setFilas([]);
    } finally {
      setBusy(false);
    }
  }, [filtroServicio, filtroBono]);

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
      const cmp = a.fechaCumplimiento.localeCompare(b.fechaCumplimiento);
      if (cmp !== 0) return cmp;
      return a.nombre.localeCompare(b.nombre, "es", { sensitivity: "base" });
    });
  }, [filas, busqueda]);

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
          <h1 className="text-3xl font-bold uppercase tracking-tight text-slate-900">Bonos</h1>
          <p className="mt-1 max-w-3xl text-sm font-medium leading-relaxed text-slate-700">
            Solo colaboradores <strong>activos</strong> y <strong>LOCAL</strong> en servicios operativos. El bono
            depende de la <strong>antigüedad desde el ingreso</strong>: se revisa cuadrícula del{" "}
            <strong>ingreso al día de cumplimiento</strong> (ingreso + 15, 30, 60 o 90 días).{" "}
            <strong>Una sola falta (F)</strong> o <strong>PSGS</strong> en cuadrícula desde el ingreso hasta hoy elimina
            los <strong>4 bonos</strong>. Bono 15: 15–29 días · 30: 30–59 · 60: 60–89 · 90: 90–119 días.
          </p>
          {fechaReferencia ? (
            <p className="mt-2 text-xs font-semibold text-violet-900">
              Fecha de referencia: {fmtFecha(fechaReferencia)}
            </p>
          ) : null}
        </div>

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
              <p className="text-[11px] text-slate-500">
                Ej. ingreso 15/jun: bono 15 el 30/jun si asistencia perfecta ingreso→30/jun.
              </p>
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
            <span>· {totalConBono} con bono cumplido</span>
            <span>· {totalActivos} elegible(s) LOCAL</span>
            {generadoEn ? (
              <span>
                · Actualizado{" "}
                {new Date(generadoEn).toLocaleString("es-MX", { dateStyle: "short", timeStyle: "short" })}
              </span>
            ) : null}
            <button type="button" className="btn-secondary text-xs uppercase" disabled={busy} onClick={() => void load()}>
              {busy ? "Cargando…" : "Actualizar"}
            </button>
          </div>
          {filtroServicio && conteosServicio.length > 0 ? (
            <div className="flex flex-wrap gap-1.5">
              {conteosServicio
                .filter((c) => servicioCoincideFiltroCat(c.servicio, filtroServicio))
                .map(({ servicio, count }) => (
                  <span
                    key={servicio}
                    className="inline-flex items-center gap-1 rounded-full border border-violet-200 bg-violet-50 px-2.5 py-0.5 text-[10px] font-semibold uppercase"
                  >
                    {servicio} <span className="font-mono">{count}</span>
                  </span>
                ))}
            </div>
          ) : null}
        </section>

        {msg ? (
          <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm font-semibold text-red-900">
            {msg}
          </p>
        ) : null}

        <section className="card overflow-x-auto">
          {busy && filas.length === 0 ? (
            <p className="py-8 text-center text-sm text-slate-500">Calculando bonos desde cuadrícula…</p>
          ) : null}
          <table className="w-full min-w-[900px] text-left text-xs">
            <thead className="border-b border-slate-200 bg-slate-50 text-[10px] font-bold uppercase text-slate-600">
              <tr>
                <th className="p-2">N° empleado</th>
                <th className="p-2">F. ingreso</th>
                <th className="p-2">Servicio</th>
                <th className="p-2">Local / foráneo</th>
                <th className="p-2">Periodo evaluado</th>
                <th className="p-2">Bono (días)</th>
                <th className="p-2">Cumplimiento</th>
              </tr>
            </thead>
            <tbody>
              {filtradas.map((f) => (
                <tr key={f.noEmpleado} className="border-b border-slate-100 hover:bg-slate-50">
                  <td className="p-2">
                    <span className="font-mono font-bold">{f.noEmpleado}</span>
                    {f.nombre ? (
                      <span className="mt-0.5 block text-[10px] font-medium normal-case text-slate-600">
                        {f.nombre}
                      </span>
                    ) : null}
                  </td>
                  <td className="p-2">{fmtFecha(f.fechaIngreso)}</td>
                  <td className="p-2 uppercase">{f.servicio || "—"}</td>
                  <td className="p-2 uppercase">{f.localForaneo || "—"}</td>
                  <td className="p-2 whitespace-nowrap text-[11px] text-slate-700">
                    {fmtFecha(f.periodoEvaluadoDesde)} → {fmtFecha(f.periodoEvaluadoHasta)}
                  </td>
                  <td className="p-2 font-mono font-bold">{f.bonoDias}</td>
                  <td className="p-2 font-semibold">{fmtFecha(f.fechaCumplimiento)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {!busy && filtradas.length === 0 ? (
            <p className="py-8 text-center text-sm text-slate-500">
              Sin elegibles con bono cumplido. Requiere antigüedad en el rango del hito, asistencia perfecta desde
              ingreso hasta la fecha de cumplimiento, y cumplimiento ya vencido.
            </p>
          ) : null}
        </section>
      </div>
  );
}
