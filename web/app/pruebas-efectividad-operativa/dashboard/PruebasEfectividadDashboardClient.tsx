"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { AppModuleShell } from "@/components/app-module-shell";
import {
  CatEmpleadoBuscador,
  CatFiltroPlanta,
  CatFiltroServicio,
} from "@/components/categorizacion/CatEmpleadoBuscador";
import { CatOficialFoto } from "@/components/categorizacion/CatOficialFoto";
import { filtrarPorServicioYPlanta } from "@/lib/categorizacion-filtros-servicio";
import { capturarDashboardComoCanvas } from "@/lib/dashboard-export-capture";
import type { AppRole } from "@/lib/app-role";
import {
  PEO_CATEGORIAS,
  PEO_TIPOS,
  etiquetaPeoNivelRiesgo,
  etiquetaPeoResultado,
  etiquetaPeoTipo,
  peoCategoria,
  peoNivelRiesgo,
  peoResultado,
  promedioPeo,
  tituloInformePeo,
  type PeoCategoriaId,
  type PeoDashboardPayload,
  type PeoEvaluacion,
  type PeoTipoId,
} from "@/lib/pruebas-efectividad-operativa";

function puntos(n: number | null): string {
  if (n == null) return "—";
  return new Intl.NumberFormat("es-MX", { maximumFractionDigits: 1 }).format(n);
}

function fechaMx(raw: string): string {
  if (!raw) return "—";
  const d = new Date(`${raw}T12:00:00`);
  return Number.isNaN(d.getTime())
    ? raw
    : d.toLocaleDateString("es-MX", { day: "2-digit", month: "short", year: "numeric" });
}

function colorPuntaje(n: number): string {
  if (n >= 90) return "bg-emerald-600";
  if (n >= 75) return "bg-sky-600";
  if (n >= 60) return "bg-amber-500";
  return "bg-rose-600";
}

function descargarBlob(blob: Blob, nombre: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = nombre;
  a.click();
  URL.revokeObjectURL(url);
}

export function PruebasEfectividadDashboardClient({
  appRole,
  email,
  initialNo,
  initialServicio,
  modulosHabilitados,
}: {
  appRole: AppRole;
  email: string;
  initialNo?: string;
  initialServicio?: string;
  modulosHabilitados?: readonly string[] | null;
}) {
  const [data, setData] = useState<PeoDashboardPayload | null>(null);
  const [servicio, setServicio] = useState(initialServicio?.trim() ?? "");
  const [planta, setPlanta] = useState("");
  const [noEmpleado, setNoEmpleado] = useState(initialNo?.trim().toUpperCase() ?? "");
  const [categoria, setCategoria] = useState<PeoCategoriaId | "">("");
  const [tipo, setTipo] = useState<PeoTipoId | "">("");
  const [desde, setDesde] = useState("");
  const [hasta, setHasta] = useState("");
  const [seleccionId, setSeleccionId] = useState<string | null>(null);
  const [busy, setBusy] = useState(true);
  const [exportando, setExportando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const informeRef = useRef<HTMLDivElement>(null);

  async function cargar() {
    setBusy(true);
    setError(null);
    try {
      const r = await fetch("/api/pruebas-efectividad-operativa/dashboard", { cache: "no-store" });
      const j = (await r.json()) as PeoDashboardPayload & { error?: string };
      if (!r.ok) throw new Error(j.error ?? `Error ${r.status}`);
      setData(j);
      if (!servicio && j.servicios.length === 1) setServicio(j.servicios[0]!);
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo cargar el dashboard.");
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    let cancel = false;
    void (async () => {
      try {
        const r = await fetch("/api/pruebas-efectividad-operativa/dashboard", { cache: "no-store" });
        const j = (await r.json()) as PeoDashboardPayload & { error?: string };
        if (!r.ok) throw new Error(j.error ?? `Error ${r.status}`);
        if (cancel) return;
        setData(j);
      } catch (e) {
        if (!cancel) setError(e instanceof Error ? e.message : "No se pudo cargar el dashboard.");
      } finally {
        if (!cancel) setBusy(false);
      }
    })();
    return () => {
      cancel = true;
    };
  }, []);

  const colaboradoresAlcance = useMemo(
    () => (data ? filtrarPorServicioYPlanta(data.colaboradores, servicio, planta) : []),
    [data, servicio, planta],
  );
  const colaborador = useMemo(
    () => data?.colaboradores.find((c) => c.noEmpleado === noEmpleado) ?? null,
    [data, noEmpleado],
  );
  const nosAlcance = useMemo(
    () => new Set(colaboradoresAlcance.map((c) => c.noEmpleado)),
    [colaboradoresAlcance],
  );

  const evaluacionesFiltradas = useMemo(() => {
    if (!data) return [];
    return data.evaluaciones.filter((e) => {
      if (noEmpleado && e.noEmpleado !== noEmpleado) return false;
      if (!noEmpleado && !nosAlcance.has(e.noEmpleado)) return false;
      if (categoria && e.categoria !== categoria) return false;
      if (tipo && e.tipo !== tipo) return false;
      if (desde && e.evaluadaEn < desde) return false;
      if (hasta && e.evaluadaEn > hasta) return false;
      return true;
    });
  }, [data, noEmpleado, nosAlcance, categoria, tipo, desde, hasta]);

  useEffect(() => {
    if (!seleccionId) return;
    if (!evaluacionesFiltradas.some((e) => e.id === seleccionId)) {
      setSeleccionId(null);
    }
  }, [evaluacionesFiltradas, seleccionId]);

  const promedioGeneral = promedioPeo(evaluacionesFiltradas.map((e) => e.total));
  const evaluados = new Set(evaluacionesFiltradas.map((e) => e.noEmpleado)).size;
  const cobertura =
    colaboradoresAlcance.length > 0
      ? Math.round((evaluados / colaboradoresAlcance.length) * 1000) / 10
      : 0;

  const seleccionada: PeoEvaluacion | null = useMemo(
    () => evaluacionesFiltradas.find((e) => e.id === seleccionId) ?? null,
    [evaluacionesFiltradas, seleccionId],
  );

  const fotoSeleccionada = useMemo(() => {
    if (!seleccionada || !data) return null;
    return data.colaboradores.find((c) => c.noEmpleado === seleccionada.noEmpleado) ?? null;
  }, [seleccionada, data]);

  async function capturar() {
    if (!informeRef.current) throw new Error("Seleccione una evaluación para exportar el informe.");
    return capturarDashboardComoCanvas(informeRef.current, {
      scale: Math.min(2, Math.max(1.5, window.devicePixelRatio || 1.5)),
    });
  }

  async function exportarPng() {
    setExportando(true);
    try {
      const canvas = await capturar();
      const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/png"));
      if (!blob) throw new Error("No se generó la imagen.");
      const slug = seleccionada?.noEmpleado || servicio || "general";
      descargarBlob(blob, `informe_peo_${slug}_${seleccionada?.evaluadaEn ?? "export"}.png`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo exportar PNG.");
    } finally {
      setExportando(false);
    }
  }

  async function exportarPdf() {
    setExportando(true);
    try {
      const canvas = await capturar();
      const { jsPDF } = await import("jspdf");
      const pdf = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
      const pageW = pdf.internal.pageSize.getWidth();
      const pageH = pdf.internal.pageSize.getHeight();
      const margin = 6;
      const contentW = pageW - margin * 2;
      const imageH = (canvas.height * contentW) / canvas.width;
      const dataUrl = canvas.toDataURL("image/jpeg", 0.92);
      let offsetY = 0;
      let page = 0;
      const usableH = pageH - margin * 2;
      while (offsetY < imageH) {
        if (page > 0) pdf.addPage();
        pdf.addImage(dataUrl, "JPEG", margin, margin - offsetY, contentW, imageH, undefined, "FAST");
        offsetY += usableH;
        page++;
      }
      const slug = seleccionada?.noEmpleado || servicio || "general";
      pdf.save(`informe_peo_${slug}_${seleccionada?.evaluadaEn ?? "export"}.pdf`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo exportar PDF.");
    } finally {
      setExportando(false);
    }
  }

  const riesgo = seleccionada ? peoNivelRiesgo(seleccionada.total) : null;
  const resultadoOk = seleccionada ? peoResultado(seleccionada.total) === "aprobada" : false;

  return (
    <AppModuleShell
      role={appRole}
      email={email}
      currentPath="/pruebas-efectividad-operativa"
      modulosHabilitados={modulosHabilitados}
    >
      <div className="min-w-0 space-y-4">
        <header className="rounded-2xl bg-gradient-to-r from-slate-900 via-slate-800 to-sky-900 p-5 text-white shadow-lg sm:p-7">
          <p className="text-xs font-bold uppercase tracking-[0.22em] text-sky-200">Vista para cliente</p>
          <h1 className="mt-2 text-2xl font-black uppercase sm:text-4xl">Dashboard de Efectividad Operativa</h1>
          <p className="mt-2 text-sm text-slate-200">
            Filtre el alcance, elija una evaluación y genere el informe ejecutivo.
          </p>
          <div className="mt-4 flex flex-wrap gap-2 print:hidden">
            {appRole !== "cliente_enfoque" ? (
              <Link href="/pruebas-efectividad-operativa" className="btn-secondary uppercase">
                Nueva evaluación
              </Link>
            ) : null}
            <button type="button" className="btn-secondary uppercase" onClick={() => void cargar()} disabled={busy}>
              Actualizar
            </button>
            <button
              type="button"
              className="btn-secondary uppercase"
              onClick={() => void exportarPdf()}
              disabled={exportando || busy || !seleccionada}
            >
              PDF informe
            </button>
            <button
              type="button"
              className="btn-secondary uppercase"
              onClick={() => void exportarPng()}
              disabled={exportando || busy || !seleccionada}
            >
              PNG informe
            </button>
          </div>
        </header>

        {error ? (
          <div className="rounded-xl border border-red-200 bg-red-50 p-3 font-bold text-red-900">{error}</div>
        ) : null}

        <section className="card grid gap-3 print:hidden md:grid-cols-2 xl:grid-cols-6">
          <CatFiltroServicio
            value={servicio}
            onChange={(v) => {
              setServicio(v);
              setPlanta("");
              setNoEmpleado("");
              setSeleccionId(null);
            }}
            personal={data?.colaboradores ?? []}
          />
          <CatFiltroPlanta
            servicioFiltro={servicio}
            value={planta}
            onChange={(v) => {
              setPlanta(v);
              setNoEmpleado("");
              setSeleccionId(null);
            }}
            personal={data?.colaboradores ?? []}
          />
          <CatEmpleadoBuscador
            label="Colaborador"
            value={noEmpleado}
            onChange={(v) => {
              setNoEmpleado(v);
              setSeleccionId(null);
            }}
            opciones={colaboradoresAlcance}
            listId="peo-dashboard-empleados"
            disabled={busy}
          />
          <label className="space-y-1">
            <span className="form-label">Tipo</span>
            <select
              className="form-control uppercase"
              value={tipo}
              onChange={(e) => {
                setTipo(e.target.value as PeoTipoId | "");
                setSeleccionId(null);
              }}
            >
              <option value="">Todos</option>
              {PEO_TIPOS.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.nombre}
                </option>
              ))}
            </select>
          </label>
          <label className="space-y-1">
            <span className="form-label">Categoría</span>
            <select
              className="form-control uppercase"
              value={categoria}
              onChange={(e) => {
                setCategoria(e.target.value as PeoCategoriaId | "");
                setSeleccionId(null);
              }}
            >
              <option value="">Todas</option>
              {PEO_CATEGORIAS.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nombre}
                </option>
              ))}
            </select>
          </label>
          <div className="grid grid-cols-2 gap-2">
            <label className="space-y-1">
              <span className="form-label">Desde</span>
              <input type="date" className="form-control" value={desde} onChange={(e) => setDesde(e.target.value)} />
            </label>
            <label className="space-y-1">
              <span className="form-label">Hasta</span>
              <input type="date" className="form-control" value={hasta} onChange={(e) => setHasta(e.target.value)} />
            </label>
          </div>
        </section>

        <div className="grid gap-3 sm:grid-cols-3">
          {[
            { label: "Promedio del alcance", value: `${puntos(promedioGeneral)} / 100` },
            { label: "Evaluaciones", value: String(evaluacionesFiltradas.length) },
            {
              label: "Cobertura",
              value: `${cobertura}% (${evaluados}/${colaboradoresAlcance.length})`,
            },
          ].map((kpi) => (
            <div key={kpi.label} className="rounded-2xl bg-slate-900 p-4 text-white shadow">
              <p className="text-[10px] font-bold uppercase tracking-wider text-sky-200">{kpi.label}</p>
              <p className="mt-2 text-xl font-black">{kpi.value}</p>
            </div>
          ))}
        </div>

        <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm print:hidden">
          <h2 className="text-base font-black uppercase text-slate-900">Evaluaciones del alcance</h2>
          <p className="mt-1 text-xs text-slate-500">Seleccione un registro para abrir el informe ejecutivo.</p>
          <div className="mt-3 overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="bg-slate-900 text-[10px] font-black uppercase tracking-wide text-white">
                <tr>
                  <th className="px-3 py-2">Fecha</th>
                  <th className="px-3 py-2">Colaborador</th>
                  <th className="px-3 py-2">Categoría</th>
                  <th className="px-3 py-2">Tipo</th>
                  <th className="px-3 py-2">Total</th>
                  <th className="px-3 py-2">Resultado</th>
                </tr>
              </thead>
              <tbody>
                {evaluacionesFiltradas.map((e) => {
                  const ok = peoResultado(e.total) === "aprobada";
                  const active = e.id === seleccionId;
                  return (
                    <tr
                      key={e.id}
                      className={`cursor-pointer border-t border-slate-100 ${
                        active ? "bg-sky-50" : "hover:bg-slate-50"
                      }`}
                      onClick={() => setSeleccionId(e.id)}
                    >
                      <td className="px-3 py-2 whitespace-nowrap font-semibold">{fechaMx(e.evaluadaEn)}</td>
                      <td className="px-3 py-2">
                        <span className="font-bold uppercase text-slate-900">{e.nombre}</span>
                        <span className="mt-0.5 block text-[10px] text-slate-500">{e.noEmpleado}</span>
                      </td>
                      <td className="px-3 py-2 text-xs uppercase">
                        {peoCategoria(e.categoria)?.nombre ?? e.categoria}
                      </td>
                      <td className="px-3 py-2">
                        <span
                          className={`rounded px-2 py-0.5 text-[10px] font-bold uppercase ${
                            e.tipo === "real" ? "bg-rose-100 text-rose-900" : "bg-sky-100 text-sky-900"
                          }`}
                        >
                          {etiquetaPeoTipo(e.tipo)}
                        </span>
                      </td>
                      <td className="px-3 py-2 font-black">{puntos(e.total)}</td>
                      <td className="px-3 py-2">
                        <span
                          className={`rounded px-2 py-0.5 text-[10px] font-black uppercase text-white ${
                            ok ? "bg-emerald-600" : "bg-rose-600"
                          }`}
                        >
                          {ok ? "Aprobada" : "Fallida"}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {evaluacionesFiltradas.length === 0 ? (
              <p className="py-8 text-center text-sm text-slate-500">Sin evaluaciones en el alcance.</p>
            ) : null}
          </div>
        </section>

        {!seleccionada ? (
          <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-4 py-10 text-center text-sm text-slate-600">
            Seleccione una evaluación de la lista para ver el informe ejecutivo.
          </div>
        ) : (
          <div
            ref={informeRef}
            data-cat-dashboard
            className="overflow-hidden rounded-2xl border border-slate-300 bg-[#eef2f6] shadow-lg"
          >
            {/* Header informe */}
            <div className="flex flex-wrap items-center justify-between gap-3 bg-[#0b3a6e] px-4 py-3 text-white sm:px-6">
              <div className="min-w-0">
                <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-sky-200">
                  Seguridad patrimonial
                </p>
                <h2 className="mt-1 text-lg font-black uppercase leading-tight sm:text-2xl">
                  {tituloInformePeo(seleccionada.tipo)}
                </h2>
              </div>
              <div className="rounded-lg bg-white/10 px-3 py-2 text-right text-sm">
                <p className="text-[10px] font-bold uppercase text-sky-100">Fecha de la prueba</p>
                <p className="font-black">{fechaMx(seleccionada.evaluadaEn)}</p>
              </div>
            </div>

            <div className="grid gap-px border-b border-slate-300 bg-slate-300 sm:grid-cols-3">
              <div className="bg-white px-4 py-3">
                <p className="text-[10px] font-bold uppercase text-slate-500">Lugar auditado</p>
                <p className="mt-1 text-sm font-black uppercase text-slate-900">
                  {seleccionada.planta || seleccionada.servicio || "—"}
                </p>
              </div>
              <div className="bg-white px-4 py-3">
                <p className="text-[10px] font-bold uppercase text-slate-500">Área responsable</p>
                <p className="mt-1 text-sm font-black uppercase text-slate-900">
                  {seleccionada.servicio || "Seguridad patrimonial"}
                </p>
              </div>
              <div className="bg-white px-4 py-3">
                <p className="text-[10px] font-bold uppercase text-slate-500">Auditor / evaluador</p>
                <p className="mt-1 truncate text-sm font-black text-slate-900">
                  {seleccionada.evaluadorEmail || "—"}
                </p>
              </div>
            </div>

            <div className="grid gap-4 p-4 lg:grid-cols-[240px_minmax(0,1.2fr)_minmax(0,1fr)] xl:grid-cols-[260px_minmax(0,1.1fr)_minmax(0,0.95fr)_minmax(220px,0.85fr)]">
              {/* Columna izquierda: tipo + resultado + riesgo */}
              <div className="space-y-4">
                <section className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
                  <h3 className="text-xs font-black uppercase text-[#0b3a6e]">Tipo de prueba realizada</h3>
                  <ul className="mt-3 space-y-2">
                    {PEO_CATEGORIAS.map((c) => {
                      const activa = c.id === seleccionada.categoria;
                      return (
                        <li
                          key={c.id}
                          className={`flex items-start gap-2 rounded-lg px-2 py-1.5 text-xs ${
                            activa ? "bg-sky-50 font-black text-slate-900" : "text-slate-500"
                          }`}
                        >
                          <span
                            className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded border text-[10px] ${
                              activa
                                ? "border-emerald-600 bg-emerald-600 text-white"
                                : "border-slate-300 bg-white"
                            }`}
                          >
                            {activa ? "✓" : ""}
                          </span>
                          <span className="uppercase leading-snug">{c.nombre}</span>
                        </li>
                      );
                    })}
                  </ul>
                </section>

                <section className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
                  <h3 className="text-xs font-black uppercase text-[#0b3a6e]">Resultado de la prueba</h3>
                  <div className="mt-3 flex items-center gap-3">
                    <div
                      className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-full text-2xl font-black text-white ${
                        resultadoOk ? "bg-emerald-600" : "bg-rose-600"
                      }`}
                    >
                      {resultadoOk ? "✓" : "✕"}
                    </div>
                    <div>
                      <p
                        className={`text-sm font-black uppercase leading-snug ${
                          resultadoOk ? "text-emerald-800" : "text-rose-800"
                        }`}
                      >
                        {etiquetaPeoResultado(seleccionada.total)}
                      </p>
                      <p className="mt-1 text-xs font-bold text-slate-600">
                        Puntaje: {puntos(seleccionada.total)} / 100
                      </p>
                    </div>
                  </div>
                </section>

                <section className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
                  <h3 className="text-xs font-black uppercase text-[#0b3a6e]">Indicador de riesgo</h3>
                  <div className="mt-4 px-1">
                    <div className="relative h-2 rounded-full bg-gradient-to-r from-emerald-500 via-amber-400 to-rose-600">
                      <span
                        className="absolute top-1/2 h-4 w-4 -translate-y-1/2 rounded-full border-2 border-white bg-slate-900 shadow"
                        style={{
                          left:
                            riesgo === "bajo" ? "12%" : riesgo === "medio" ? "50%" : "88%",
                        }}
                      />
                    </div>
                    <div className="mt-2 flex justify-between text-[10px] font-black uppercase text-slate-600">
                      <span className="text-emerald-700">Bajo</span>
                      <span className="text-amber-700">Medio</span>
                      <span className="text-rose-700">Alto</span>
                    </div>
                    <p className="mt-3 text-center text-sm font-black uppercase text-slate-900">
                      Nivel asignado: {etiquetaPeoNivelRiesgo(seleccionada.total)}
                    </p>
                  </div>
                </section>
              </div>

              {/* Centro: hallazgos + personal + criterios */}
              <div className="space-y-4">
                <section className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
                  <h3 className="text-xs font-black uppercase text-[#0b3a6e]">
                    Hallazgos — Situación observada
                  </h3>
                  <p className="mt-3 whitespace-pre-wrap text-sm leading-relaxed text-slate-800">
                    {seleccionada.observaciones.trim() || "Sin hallazgos registrados."}
                  </p>
                </section>

                <section className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
                  <h3 className="text-xs font-black uppercase text-[#0b3a6e]">Personal involucrado</h3>
                  <div className="mt-3 flex items-start gap-3">
                    {fotoSeleccionada ? (
                      <CatOficialFoto
                        noEmpleado={fotoSeleccionada.noEmpleado}
                        nombre={fotoSeleccionada.nombre}
                        fotoUrl={fotoSeleccionada.fotoUrl}
                        puedeSubir={false}
                        presentacion
                      />
                    ) : null}
                    <div className="min-w-0 flex-1 overflow-x-auto">
                      <table className="min-w-full text-left text-sm">
                        <thead className="bg-slate-100 text-[10px] font-black uppercase text-slate-600">
                          <tr>
                            <th className="px-2 py-1.5">Nombre</th>
                            <th className="px-2 py-1.5">Puesto</th>
                            <th className="px-2 py-1.5">N.º</th>
                          </tr>
                        </thead>
                        <tbody>
                          <tr className="border-t border-slate-100">
                            <td className="px-2 py-2 font-bold uppercase">{seleccionada.nombre}</td>
                            <td className="px-2 py-2 uppercase">{seleccionada.puesto || "—"}</td>
                            <td className="px-2 py-2 font-semibold">{seleccionada.noEmpleado}</td>
                          </tr>
                        </tbody>
                      </table>
                      {(seleccionada.servicio || seleccionada.planta) && (
                        <p className="mt-2 text-[10px] font-semibold uppercase text-slate-500">
                          {[seleccionada.servicio, seleccionada.planta].filter(Boolean).join(" · ")}
                        </p>
                      )}
                    </div>
                  </div>
                </section>

                <section className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
                  <h3 className="text-xs font-black uppercase text-[#0b3a6e]">Desglose de calificaciones</h3>
                  <div className="mt-3 space-y-2">
                    {seleccionada.puntajes.map((p) => {
                      const pct = p.maximo > 0 ? Math.round((p.obtenido / p.maximo) * 1000) / 10 : 0;
                      return (
                        <div key={p.id}>
                          <div className="flex items-end justify-between gap-2 text-xs">
                            <p className="font-semibold text-slate-800">{p.etiqueta}</p>
                            <strong className="whitespace-nowrap">
                              {puntos(p.obtenido)} / {p.maximo}
                            </strong>
                          </div>
                          <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-slate-200">
                            <div
                              className={`h-full ${colorPuntaje(pct)}`}
                              style={{ width: `${Math.min(100, pct)}%` }}
                            />
                          </div>
                        </div>
                      );
                    })}
                    {seleccionada.puntajes.length === 0 ? (
                      <p className="text-sm text-slate-500">Sin criterios capturados.</p>
                    ) : null}
                  </div>
                </section>
              </div>

              {/* Acciones */}
              <div className="space-y-4">
                <section className="rounded-xl border border-emerald-200 bg-emerald-50/60 p-3 shadow-sm">
                  <h3 className="text-xs font-black uppercase text-emerald-900">Acciones correctivas</h3>
                  <ul className="mt-3 space-y-2">
                    {(seleccionada.accionesCorrectivas ?? []).map((a, i) => (
                      <li key={`ac-${i}`} className="flex gap-2 text-sm text-slate-800">
                        <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-emerald-600 text-[10px] font-black text-white">
                          ✓
                        </span>
                        <span>{a}</span>
                      </li>
                    ))}
                    {(seleccionada.accionesCorrectivas ?? []).length === 0 ? (
                      <li className="text-sm text-slate-500">Sin registro.</li>
                    ) : null}
                  </ul>
                </section>

                <section className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
                  <h3 className="text-xs font-black uppercase text-[#0b3a6e]">Acciones de seguimiento</h3>
                  <div className="mt-3 overflow-x-auto">
                    <table className="min-w-full text-left text-xs">
                      <thead className="bg-slate-100 text-[10px] font-black uppercase text-slate-600">
                        <tr>
                          <th className="px-2 py-1.5">Acción</th>
                          <th className="px-2 py-1.5">Responsable</th>
                          <th className="px-2 py-1.5">Fecha</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(seleccionada.accionesSeguimiento ?? []).map((s, i) => (
                          <tr key={`sg-${i}`} className="border-t border-slate-100">
                            <td className="px-2 py-2 font-semibold text-slate-800">{s.accion}</td>
                            <td className="px-2 py-2 uppercase text-slate-700">{s.responsable || "—"}</td>
                            <td className="px-2 py-2 whitespace-nowrap">{fechaMx(s.fechaCompromiso)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    {(seleccionada.accionesSeguimiento ?? []).length === 0 ? (
                      <p className="py-3 text-sm text-slate-500">Sin registro.</p>
                    ) : null}
                  </div>
                </section>
              </div>

              {/* Evidencias */}
              <div className="space-y-4 xl:block">
                <section className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
                  <h3 className="text-xs font-black uppercase text-[#0b3a6e]">Evidencia</h3>
                  <div className="mt-3 space-y-3">
                    {(seleccionada.evidencias ?? []).map((ev) => (
                      <figure key={ev.id} className="overflow-hidden rounded-lg border border-slate-200">
                        {ev.mime.startsWith("image/") ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={ev.url}
                            alt={ev.nombreArchivo}
                            className="max-h-64 w-full object-contain bg-slate-50"
                          />
                        ) : (
                          <a
                            href={ev.url}
                            target="_blank"
                            rel="noreferrer"
                            className="flex h-28 items-center justify-center bg-slate-100 text-xs font-bold uppercase text-sky-800"
                          >
                            Ver PDF · {ev.nombreArchivo}
                          </a>
                        )}
                        <figcaption className="truncate px-2 py-1 text-[10px] text-slate-500">
                          {ev.nombreArchivo}
                        </figcaption>
                      </figure>
                    ))}
                    {(seleccionada.evidencias ?? []).length === 0 ? (
                      <p className="text-sm text-slate-500">Sin registro.</p>
                    ) : null}
                  </div>
                </section>
              </div>
            </div>

            <p className="border-t border-slate-200 bg-white px-4 py-2 text-right text-[10px] uppercase text-slate-500">
              Generado: {data ? new Date(data.generadoEn).toLocaleString("es-MX") : "—"}
              {colaborador ? ` · Filtro: ${colaborador.nombre}` : ""}
            </p>
          </div>
        )}
      </div>
    </AppModuleShell>
  );
}
