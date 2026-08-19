"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ColaboradorCompleto } from "@/lib/colaboradores-types";
import {
  buildContratosPorMesReport,
  contratosPorMesToCsv,
  labelMesYm,
  type ContratoPorMesFila,
} from "@/lib/contratos-por-mes";
import { downloadCsv } from "@/lib/colaboradores-csv";

type Props = {
  mesInicial: string;
  fuente: "supabase" | "sin_datos";
};

function fmtFechaIngreso(ymd: string): string {
  if (!ymd) return "—";
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(ymd);
  if (!m) return ymd;
  return `${m[3]}/${m[2]}/${m[1]}`;
}

export function ContratosPorMesClient({ mesInicial, fuente }: Props) {
  const [mes, setMes] = useState(mesInicial);
  const [colaboradores, setColaboradores] = useState<ColaboradorCompleto[] | null>(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busqueda, setBusqueda] = useState("");
  const [fuenteLive, setFuenteLive] = useState(fuente);
  const abortRef = useRef<AbortController | null>(null);

  const cargar = useCallback(async (refresh = false) => {
    abortRef.current?.abort();
    const ac = new AbortController();
    abortRef.current = ac;
    setCargando(true);
    setError(null);
    try {
      const q = refresh ? "?refresh=1" : "";
      const r = await fetch(`/api/contratos-por-mes${q}`, {
        cache: "no-store",
        signal: ac.signal,
      });
      const j = (await r.json().catch(() => ({}))) as {
        list?: ColaboradorCompleto[];
        error?: string;
        fuente?: "supabase" | "sin_datos";
      };
      if (!r.ok) throw new Error(j.error ?? `Error ${r.status}`);
      if (ac.signal.aborted) return;
      setColaboradores(j.list ?? []);
      if (j.fuente) setFuenteLive(j.fuente);
    } catch (e) {
      if (e instanceof Error && e.name === "AbortError") return;
      setColaboradores(null);
      setError(e instanceof Error ? e.message : "No se pudieron cargar los expedientes.");
    } finally {
      if (!ac.signal.aborted) setCargando(false);
    }
  }, []);

  useEffect(() => {
    void cargar();
    return () => abortRef.current?.abort();
  }, [cargar]);

  const filas: ContratoPorMesFila[] = useMemo(() => {
    if (!colaboradores) return [];
    return buildContratosPorMesReport(colaboradores, mes);
  }, [colaboradores, mes]);

  const filasFiltradas = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    if (!q) return filas;
    return filas.filter(
      (f) =>
        f.noEmpleado.toLowerCase().includes(q) ||
        f.nombreCompleto.toLowerCase().includes(q) ||
        f.servicio.toLowerCase().includes(q),
    );
  }, [filas, busqueda]);

  const altasMes = useMemo(() => filas.filter((f) => f.altaEnMes).length, [filas]);

  const exportarCsv = () => {
    const csv = contratosPorMesToCsv(filasFiltradas);
    const ym = mes.slice(0, 7);
    downloadCsv(`contratos-por-mes-${ym}.csv`, csv);
  };

  return (
    <div className="mx-auto max-w-6xl space-y-6 px-4 py-8 sm:px-6">
      <header className="space-y-2">
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">Contratos por mes</h1>
        <p className="max-w-2xl text-sm text-slate-600">
          Colaboradores dados de alta en el mes, activos durante el mes o que siguen activos con
          antigüedad en ese periodo. Exporte la lista para gestión de contratos.
        </p>
      </header>

      <div className="flex flex-wrap items-end gap-4 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <div>
          <label htmlFor="mes-contratos" className="mb-1 block text-[11px] font-bold uppercase tracking-wide text-slate-600">
            Mes
          </label>
          <input
            id="mes-contratos"
            type="month"
            value={mes.slice(0, 7)}
            onChange={(e) => setMes(e.target.value)}
            className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-200"
          />
        </div>

        <div className="min-w-[200px] flex-1">
          <label htmlFor="busqueda-contratos" className="mb-1 block text-[11px] font-bold uppercase tracking-wide text-slate-600">
            Buscar
          </label>
          <input
            id="busqueda-contratos"
            type="search"
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            placeholder="N.º, nombre o servicio…"
            className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-200"
          />
        </div>

        <button
          type="button"
          onClick={() => void cargar(true)}
          disabled={cargando}
          className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50 disabled:opacity-50"
        >
          Actualizar
        </button>

        <button
          type="button"
          onClick={exportarCsv}
          disabled={cargando || filasFiltradas.length === 0}
          className="rounded-lg bg-sky-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-sky-700 disabled:opacity-50"
        >
          Exportar CSV
        </button>
      </div>

      <div className="flex flex-wrap gap-3 text-sm text-slate-600">
        <span className="rounded-full bg-slate-100 px-3 py-1">
          <strong className="text-slate-900">{labelMesYm(mes)}</strong>
        </span>
        <span className="rounded-full bg-slate-100 px-3 py-1">
          Total: <strong className="text-slate-900">{filas.length}</strong>
        </span>
        <span className="rounded-full bg-emerald-50 px-3 py-1 text-emerald-900">
          Altas en mes: <strong>{altasMes}</strong>
        </span>
        {busqueda.trim() ? (
          <span className="rounded-full bg-amber-50 px-3 py-1 text-amber-900">
            Mostrando: <strong>{filasFiltradas.length}</strong>
          </span>
        ) : null}
        {fuenteLive === "sin_datos" ? (
          <span className="rounded-full bg-red-50 px-3 py-1 text-red-800">Sin conexión a datos</span>
        ) : null}
      </div>

      {error ? (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{error}</div>
      ) : null}

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-4 py-3 text-left text-[11px] font-bold uppercase tracking-wide text-slate-600">
                  N.º empleado
                </th>
                <th className="px-4 py-3 text-left text-[11px] font-bold uppercase tracking-wide text-slate-600">
                  Nombre completo
                </th>
                <th className="px-4 py-3 text-left text-[11px] font-bold uppercase tracking-wide text-slate-600">
                  Servicio
                </th>
                <th className="px-4 py-3 text-left text-[11px] font-bold uppercase tracking-wide text-slate-600">
                  Fecha ingreso
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {cargando ? (
                <tr>
                  <td colSpan={4} className="px-4 py-12 text-center text-slate-500">
                    Cargando expedientes…
                  </td>
                </tr>
              ) : filasFiltradas.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-4 py-12 text-center text-slate-500">
                    No hay colaboradores para este mes con los criterios indicados.
                  </td>
                </tr>
              ) : (
                filasFiltradas.map((f) => (
                  <tr key={f.noEmpleado} className="hover:bg-slate-50/80">
                    <td className="whitespace-nowrap px-4 py-2.5 font-mono text-slate-900">{f.noEmpleado}</td>
                    <td className="px-4 py-2.5 text-slate-900">
                      {f.nombreCompleto}
                      {f.altaEnMes ? (
                        <span className="ml-2 inline-flex rounded bg-emerald-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-emerald-800">
                          Alta
                        </span>
                      ) : null}
                    </td>
                    <td className="px-4 py-2.5 text-slate-700">{f.servicio || "—"}</td>
                    <td className="whitespace-nowrap px-4 py-2.5 text-slate-700">{fmtFechaIngreso(f.fechaIngreso)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
