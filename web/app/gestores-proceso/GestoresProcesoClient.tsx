"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ConsejoCapturaGestor,
  EmptyDetalleGestor,
  GestorDetallePanel,
  GestorRankingCard,
  GestoresHero,
  GuiaRapidaGestores,
  PeriodoResumenBar,
  SkeletonGestores,
  StatCardGestor,
} from "@/components/gestores-proceso/gestores-proceso-ui";
import {
  mondayOfWeekLocal,
  type GestorProcesoBucket,
  type GestorProcesoPeriodo,
  type GestoresProcesoReport,
} from "@/lib/gestores-proceso";

type Props = {
  initialReport: GestoresProcesoReport | null;
  initialPeriodo: GestorProcesoPeriodo;
  initialFecha: string;
  fuente: "supabase" | "sin_datos";
};

function ymdLocal(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function mesFromYmd(ymd: string): string {
  return ymd.slice(0, 7);
}

function labelSemanaDesdeLunes(lunesYmd: string): string {
  const [y, m, d] = lunesYmd.split("-").map(Number);
  const lun = new Date(y, m - 1, d);
  const dom = new Date(lun);
  dom.setDate(dom.getDate() + 6);
  const fmt = new Intl.DateTimeFormat("es-MX", { day: "numeric", month: "short" });
  return `Semana ${fmt.format(lun)} – ${fmt.format(dom)} ${dom.getFullYear()}`;
}

export function GestoresProcesoClient({
  initialReport,
  initialPeriodo,
  initialFecha,
  fuente,
}: Props) {
  const [periodo, setPeriodo] = useState<GestorProcesoPeriodo>(initialPeriodo);
  const [fechaMes, setFechaMes] = useState(mesFromYmd(initialFecha));
  const [fechaSemana, setFechaSemana] = useState(initialFecha);
  const [report, setReport] = useState<GestoresProcesoReport | null>(initialReport);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [gestorKey, setGestorKey] = useState<string | null>(null);
  const [busqueda, setBusqueda] = useState("");
  const [guiaAbierta, setGuiaAbierta] = useState(true);

  const fechaConsulta = periodo === "mes" ? `${fechaMes}-01` : fechaSemana;

  const recargar = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const q = new URLSearchParams({ periodo, fecha: fechaConsulta });
      const r = await fetch(`/api/gestores-proceso?${q}`, { cache: "no-store" });
      const j = (await r.json().catch(() => ({}))) as {
        report?: GestoresProcesoReport;
        error?: string;
      };
      if (!r.ok) throw new Error(j.error ?? `Error ${r.status}`);
      setReport(j.report ?? null);
      setGestorKey(null);
    } catch (e) {
      setReport(null);
      setError(e instanceof Error ? e.message : "No se pudo cargar el reporte.");
    } finally {
      setLoading(false);
    }
  }, [periodo, fechaConsulta]);

  const skipInitialFetch = useRef(true);

  useEffect(() => {
    if (skipInitialFetch.current) {
      skipInitialFetch.current = false;
      if (periodo === initialPeriodo && fechaConsulta === initialFecha) return;
    }
    void recargar();
  }, [recargar, periodo, fechaConsulta, initialPeriodo, initialFecha]);

  const maxTotal = useMemo(
    () => Math.max(1, ...(report?.gestores.map((g) => g.total) ?? [1])),
    [report],
  );

  const gestoresFiltrados = useMemo(() => {
    const list = report?.gestores ?? [];
    const n = busqueda.trim().toUpperCase();
    if (!n) return list;
    return list.filter(
      (g) =>
        g.gestorLabel.includes(n) ||
        g.gestorTextoEjemplo.toUpperCase().includes(n) ||
        g.gestorColaborador?.noEmpleado.toUpperCase().includes(n) ||
        g.gestorColaborador?.nombreCompleto.toUpperCase().includes(n),
    );
  }, [report, busqueda]);

  const seleccionado: GestorProcesoBucket | null = useMemo(() => {
    if (!gestorKey || !report) return null;
    return report.gestores.find((g) => g.gestorKey === gestorKey) ?? null;
  }, [gestorKey, report]);

  useEffect(() => {
    if (!report || gestoresFiltrados.length === 0) return;
    if (gestorKey && gestoresFiltrados.some((g) => g.gestorKey === gestorKey)) return;
    setGestorKey(gestoresFiltrados[0]!.gestorKey);
  }, [report, gestoresFiltrados, gestorKey]);

  const sinDatosPeriodo = report && report.totalEnPeriodo === 0;

  return (
    <div className="min-w-0 space-y-5">
      <GestoresHero />

      <GuiaRapidaGestores open={guiaAbierta} onToggle={() => setGuiaAbierta((v) => !v)} />

      {fuente === "sin_datos" ? (
        <p
          className="rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-950"
          role="alert"
        >
          No hay datos de colaboradores en el servidor. Configure Supabase (service role) como en la
          sección Colaboradores.
        </p>
      ) : null}

      <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
        <h2 className="text-xs font-extrabold uppercase tracking-wide text-slate-800">
          Filtros del reporte
        </h2>
        <p className="mt-1 text-xs text-slate-600">
          Los números se calculan con la <strong>fecha de ingreso</strong> de cada colaborador, no con la
          fecha en que se capturó el alta.
        </p>

        <div
          className="mt-4 inline-flex rounded-lg border border-slate-200 bg-slate-100 p-1"
          role="tablist"
          aria-label="Tipo de periodo"
        >
          <button
            type="button"
            role="tab"
            aria-selected={periodo === "mes"}
            className={`rounded-md px-4 py-2 text-xs font-bold uppercase tracking-wide transition ${
              periodo === "mes"
                ? "bg-white text-indigo-700 shadow-sm ring-1 ring-slate-200"
                : "text-slate-600 hover:text-slate-900"
            }`}
            onClick={() => setPeriodo("mes")}
          >
            Por mes
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={periodo === "semana"}
            className={`rounded-md px-4 py-2 text-xs font-bold uppercase tracking-wide transition ${
              periodo === "semana"
                ? "bg-white text-indigo-700 shadow-sm ring-1 ring-slate-200"
                : "text-slate-600 hover:text-slate-900"
            }`}
            onClick={() => setPeriodo("semana")}
          >
            Por semana
          </button>
        </div>

        <div className="mt-4 flex flex-wrap items-end gap-4">
          {periodo === "mes" ? (
            <label className="block min-w-[200px] flex-1">
              <span className="text-xs font-bold uppercase tracking-wide text-slate-600">
                Mes de ingreso
              </span>
              <input
                type="month"
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm font-medium focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-200"
                value={fechaMes}
                onChange={(e) => setFechaMes(e.target.value)}
              />
              <span className="mt-1 block text-[10px] text-slate-500">
                Incluye del día 1 al último día del mes
              </span>
            </label>
          ) : (
            <label className="block min-w-[200px] flex-1">
              <span className="text-xs font-bold uppercase tracking-wide text-slate-600">
                Semana (elija cualquier día)
              </span>
              <input
                type="date"
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm font-medium focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-200"
                value={fechaSemana}
                onChange={(e) => {
                  const v = e.target.value;
                  if (v) setFechaSemana(ymdLocal(mondayOfWeekLocal(new Date(v + "T12:00:00"))));
                }}
              />
              <span className="mt-1 block text-[10px] font-medium text-slate-600">
                {labelSemanaDesdeLunes(fechaSemana)} · lunes a domingo
              </span>
            </label>
          )}
        </div>

        <ConsejoCapturaGestor />

        {report ? (
          <PeriodoResumenBar
            periodoLabel={report.periodoLabel}
            totalEnPeriodo={report.totalEnPeriodo}
            gestoresCount={report.gestores.length}
            sinGestorEnPeriodo={report.sinGestorEnPeriodo}
            loading={loading}
          />
        ) : null}

        {error ? (
          <p className="mt-3 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-bold text-rose-800" role="alert">
            {error}
          </p>
        ) : null}
      </section>

      {report ? (
        <>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <StatCardGestor
              label="Ingresos en el periodo"
              value={String(report.totalEnPeriodo)}
              hint="Colaboradores con fecha de ingreso dentro del rango"
              accent="indigo"
            />
            <StatCardGestor
              label="Gestores distintos"
              value={String(report.gestores.length)}
              hint="Valores únicos del campo «Gestor del proceso»"
              accent="indigo"
            />
            <StatCardGestor
              label="Gestores (histórico)"
              value={String(report.gestoresDistintosHistorico)}
              hint="Todos los expedientes, sin filtrar por fecha"
              accent="slate"
            />
            <StatCardGestor
              label="Sin gestor (histórico)"
              value={String(report.colaboradoresSinGestorHistorico)}
              hint="Colaboradores sin valor en el campo"
              accent={report.colaboradoresSinGestorHistorico > 0 ? "rose" : "slate"}
            />
          </div>

          {sinDatosPeriodo ? (
            <p className="rounded-xl border border-dashed border-slate-300 bg-white px-6 py-10 text-center text-sm text-slate-600">
              No hubo ingresos en <strong>{report.periodoLabel}</strong>. Pruebe otro mes o semana.
            </p>
          ) : (
            <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)] lg:items-start">
              <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <h2 className="text-xs font-extrabold uppercase tracking-wide text-slate-800">
                      Ranking de gestores
                    </h2>
                    <p className="mt-0.5 text-[10px] text-slate-500">Ordenado de mayor a menor cantidad</p>
                  </div>
                  <label className="sr-only" htmlFor="buscar-gestor">
                    Buscar gestor
                  </label>
                  <input
                    id="buscar-gestor"
                    type="search"
                    placeholder="Nombre, N.º o texto del gestor…"
                    value={busqueda}
                    onChange={(e) => setBusqueda(e.target.value)}
                    className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm focus:border-indigo-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-200 sm:max-w-xs"
                  />
                </div>

                <div className="mt-4 space-y-2">
                  {loading && gestoresFiltrados.length === 0 ? <SkeletonGestores /> : null}
                  {!loading && gestoresFiltrados.length === 0 ? (
                    <p className="rounded-lg border border-dashed border-slate-200 py-8 text-center text-sm text-slate-500">
                      {busqueda.trim()
                        ? "Ningún gestor coincide con la búsqueda."
                        : "No hay gestores en este periodo."}
                    </p>
                  ) : (
                    gestoresFiltrados.map((g, idx) => (
                      <GestorRankingCard
                        key={g.gestorKey}
                        gestor={g}
                        rank={idx + 1}
                        maxTotal={maxTotal}
                        totalPeriodo={report.totalEnPeriodo}
                        active={gestorKey === g.gestorKey}
                        onSelect={() => setGestorKey(g.gestorKey)}
                      />
                    ))
                  )}
                </div>
              </section>

              <div className="lg:sticky lg:top-4 lg:max-h-[calc(100vh-6rem)] lg:overflow-hidden">
                {seleccionado ? (
                  <GestorDetallePanel
                    gestor={seleccionado}
                    onCerrar={() => setGestorKey(null)}
                  />
                ) : (
                  <EmptyDetalleGestor />
                )}
              </div>
            </div>
          )}
        </>
      ) : loading ? (
        <div className="rounded-xl border border-slate-200 bg-white p-6">
          <SkeletonGestores />
        </div>
      ) : null}
    </div>
  );
}
