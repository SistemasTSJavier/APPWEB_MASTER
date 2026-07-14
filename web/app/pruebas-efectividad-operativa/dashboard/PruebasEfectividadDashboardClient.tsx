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
  peoCategoria,
  promedioPeo,
  type PeoCategoriaId,
  type PeoDashboardPayload,
} from "@/lib/pruebas-efectividad-operativa";

function puntos(n: number | null): string {
  if (n == null) return "—";
  return new Intl.NumberFormat("es-MX", { maximumFractionDigits: 1 }).format(n);
}

function fechaMx(raw: string): string {
  if (!raw) return "—";
  const d = new Date(`${raw}T12:00:00`);
  return Number.isNaN(d.getTime()) ? raw : d.toLocaleDateString("es-MX");
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
}: {
  appRole: AppRole;
  email: string;
  initialNo?: string;
  initialServicio?: string;
}) {
  const [data, setData] = useState<PeoDashboardPayload | null>(null);
  const [servicio, setServicio] = useState(initialServicio?.trim() ?? "");
  const [planta, setPlanta] = useState("");
  const [noEmpleado, setNoEmpleado] = useState(initialNo?.trim().toUpperCase() ?? "");
  const [categoria, setCategoria] = useState<PeoCategoriaId | "">("");
  const [desde, setDesde] = useState("");
  const [hasta, setHasta] = useState("");
  const [busy, setBusy] = useState(true);
  const [exportando, setExportando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const dashboardRef = useRef<HTMLDivElement>(null);

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
      if (desde && e.evaluadaEn < desde) return false;
      if (hasta && e.evaluadaEn > hasta) return false;
      return true;
    });
  }, [data, noEmpleado, nosAlcance, categoria, desde, hasta]);

  const promedioGeneral = promedioPeo(evaluacionesFiltradas.map((e) => e.total));
  const ultima = [...evaluacionesFiltradas].sort((a, b) =>
    `${b.evaluadaEn}${b.createdAt}`.localeCompare(`${a.evaluadaEn}${a.createdAt}`),
  )[0] ?? null;
  const evaluados = new Set(evaluacionesFiltradas.map((e) => e.noEmpleado)).size;
  const cobertura = colaboradoresAlcance.length > 0
    ? Math.round((evaluados / colaboradoresAlcance.length) * 1000) / 10
    : 0;

  const porCategoria = useMemo(
    () =>
      PEO_CATEGORIAS.map((c) => {
        const rows = evaluacionesFiltradas.filter((e) => e.categoria === c.id);
        return { ...c, promedio: promedioPeo(rows.map((e) => e.total)), intentos: rows.length };
      }),
    [evaluacionesFiltradas],
  );

  const criterios = useMemo(() => {
    const rows: Array<{
      key: string;
      categoria: string;
      etiqueta: string;
      maximo: number;
      promedio: number;
      porcentaje: number;
    }> = [];
    for (const cat of PEO_CATEGORIAS) {
      if (categoria && cat.id !== categoria) continue;
      const evals = evaluacionesFiltradas.filter((e) => e.categoria === cat.id);
      for (const criterio of cat.criterios) {
        const valores = evals
          .map((e) => e.puntajes.find((p) => p.id === criterio.id)?.obtenido)
          .filter((v): v is number => typeof v === "number");
        const promedio = promedioPeo(valores);
        if (promedio == null) continue;
        rows.push({
          key: `${cat.id}-${criterio.id}`,
          categoria: cat.nombre,
          etiqueta: criterio.etiqueta,
          maximo: criterio.maximo,
          promedio,
          porcentaje: Math.round((promedio / criterio.maximo) * 1000) / 10,
        });
      }
    }
    return rows;
  }, [evaluacionesFiltradas, categoria]);

  const tendencia = useMemo(
    () =>
      [...evaluacionesFiltradas]
        .sort((a, b) => `${a.evaluadaEn}${a.createdAt}`.localeCompare(`${b.evaluadaEn}${b.createdAt}`))
        .slice(-12),
    [evaluacionesFiltradas],
  );

  const ranking = useMemo(() => {
    const byNo = new Map<string, number[]>();
    for (const e of evaluacionesFiltradas) {
      const arr = byNo.get(e.noEmpleado) ?? [];
      arr.push(e.total);
      byNo.set(e.noEmpleado, arr);
    }
    return [...byNo.entries()]
      .map(([no, valores]) => {
        const c = data?.colaboradores.find((x) => x.noEmpleado === no);
        return { no, nombre: c?.nombre ?? no, promedio: promedioPeo(valores) ?? 0 };
      })
      .sort((a, b) => b.promedio - a.promedio)
      .slice(0, 10);
  }, [evaluacionesFiltradas, data]);

  async function capturar() {
    if (!dashboardRef.current) throw new Error("Dashboard no disponible.");
    return capturarDashboardComoCanvas(dashboardRef.current, {
      scale: Math.min(2, Math.max(1.5, window.devicePixelRatio || 1.5)),
    });
  }

  async function exportarPng() {
    setExportando(true);
    try {
      const canvas = await capturar();
      const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/png"));
      if (!blob) throw new Error("No se generó la imagen.");
      descargarBlob(blob, `efectividad_operativa_${noEmpleado || servicio || "general"}.png`);
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
      const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
      const pageW = pdf.internal.pageSize.getWidth();
      const pageH = pdf.internal.pageSize.getHeight();
      const margin = 8;
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
      pdf.save(`efectividad_operativa_${noEmpleado || servicio || "general"}.pdf`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo exportar PDF.");
    } finally {
      setExportando(false);
    }
  }

  return (
    <AppModuleShell role={appRole} email={email} currentPath="/pruebas-efectividad-operativa">
      <div className="min-w-0 space-y-4">
        <header className="rounded-2xl bg-gradient-to-r from-slate-950 via-indigo-950 to-violet-900 p-5 text-white shadow-lg sm:p-7">
          <p className="text-xs font-bold uppercase tracking-[0.22em] text-violet-200">Vista para cliente</p>
          <h1 className="mt-2 text-2xl font-black uppercase sm:text-4xl">Dashboard de Efectividad Operativa</h1>
          <p className="mt-2 text-sm text-slate-200">Resultados históricos, tendencias y oportunidades de mejora por servicio.</p>
          <div className="mt-4 flex flex-wrap gap-2 print:hidden">
            {appRole !== "cliente_enfoque" ? (
              <Link href="/pruebas-efectividad-operativa" className="btn-secondary uppercase">Nueva evaluación</Link>
            ) : null}
            <button type="button" className="btn-secondary uppercase" onClick={() => void cargar()} disabled={busy}>
              Actualizar
            </button>
            <button type="button" className="btn-secondary uppercase" onClick={() => void exportarPdf()} disabled={exportando || busy}>
              PDF
            </button>
            <button type="button" className="btn-secondary uppercase" onClick={() => void exportarPng()} disabled={exportando || busy}>
              PNG
            </button>
          </div>
        </header>

        {error ? <div className="rounded-xl border border-red-200 bg-red-50 p-3 font-bold text-red-900">{error}</div> : null}

        <section className="card grid gap-3 print:hidden md:grid-cols-2 xl:grid-cols-5">
          <CatFiltroServicio
            value={servicio}
            onChange={(v) => {
              setServicio(v);
              setPlanta("");
              setNoEmpleado("");
            }}
            personal={data?.colaboradores ?? []}
          />
          <CatFiltroPlanta
            servicioFiltro={servicio}
            value={planta}
            onChange={(v) => {
              setPlanta(v);
              setNoEmpleado("");
            }}
            personal={data?.colaboradores ?? []}
          />
          <CatEmpleadoBuscador
            label="Colaborador"
            value={noEmpleado}
            onChange={setNoEmpleado}
            opciones={colaboradoresAlcance}
            listId="peo-dashboard-empleados"
            disabled={busy}
          />
          <label className="space-y-1">
            <span className="form-label">Categoría</span>
            <select className="form-control uppercase" value={categoria} onChange={(e) => setCategoria(e.target.value as PeoCategoriaId | "")}>
              <option value="">Todas</option>
              {PEO_CATEGORIAS.map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}
            </select>
          </label>
          <div className="grid grid-cols-2 gap-2">
            <label className="space-y-1"><span className="form-label">Desde</span><input type="date" className="form-control" value={desde} onChange={(e) => setDesde(e.target.value)} /></label>
            <label className="space-y-1"><span className="form-label">Hasta</span><input type="date" className="form-control" value={hasta} onChange={(e) => setHasta(e.target.value)} /></label>
          </div>
        </section>

        <div ref={dashboardRef} data-cat-dashboard className="space-y-4 rounded-2xl bg-slate-100 p-2 sm:p-4">
          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
              {colaborador ? (
                <CatOficialFoto
                  noEmpleado={colaborador.noEmpleado}
                  nombre={colaborador.nombre}
                  fotoUrl={colaborador.fotoUrl}
                  puedeSubir={false}
                  presentacion
                />
              ) : null}
              <div className="min-w-0 flex-1">
                <p className="text-xs font-black uppercase tracking-[0.18em] text-violet-700">
                  {colaborador ? "Perfil del colaborador" : "Resumen del alcance"}
                </p>
                <h2 className="mt-1 text-2xl font-black uppercase text-slate-950">
                  {colaborador?.nombre ?? (servicio || "Todos los servicios")}
                </h2>
                {colaborador ? (
                  <div className="mt-3 grid gap-2 text-sm uppercase sm:grid-cols-2 lg:grid-cols-4">
                    <p><span className="block text-[10px] font-bold text-slate-500">N.º empleado</span>{colaborador.noEmpleado}</p>
                    <p><span className="block text-[10px] font-bold text-slate-500">Servicio / planta</span>{colaborador.servicio}{colaborador.planta ? ` · ${colaborador.planta}` : ""}</p>
                    <p><span className="block text-[10px] font-bold text-slate-500">Puesto</span>{colaborador.puesto || "—"}</p>
                    <p><span className="block text-[10px] font-bold text-slate-500">Antigüedad</span>{colaborador.tiempoEnEmpresa}</p>
                    <p><span className="block text-[10px] font-bold text-slate-500">Edad</span>{colaborador.edad ? `${colaborador.edad} años` : "—"}</p>
                    <p><span className="block text-[10px] font-bold text-slate-500">Escolaridad</span>{colaborador.escolaridad || "—"}</p>
                  </div>
                ) : (
                  <p className="mt-2 text-sm text-slate-600">{colaboradoresAlcance.length} colaborador(es) activos en el alcance seleccionado.</p>
                )}
              </div>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {[
              { label: "Promedio general", value: `${puntos(promedioGeneral)} / 100` },
              { label: "Última evaluación", value: ultima ? `${puntos(ultima.total)} · ${fechaMx(ultima.evaluadaEn)}` : "Sin datos" },
              { label: "Pruebas registradas", value: String(evaluacionesFiltradas.length) },
              { label: "Cobertura del alcance", value: `${cobertura}% (${evaluados}/${colaboradoresAlcance.length})` },
            ].map((kpi) => (
              <div key={kpi.label} className="rounded-2xl bg-slate-950 p-4 text-white shadow">
                <p className="text-[10px] font-bold uppercase tracking-wider text-violet-200">{kpi.label}</p>
                <p className="mt-2 text-xl font-black">{kpi.value}</p>
              </div>
            ))}
          </div>

          <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <h3 className="text-base font-black uppercase text-slate-900">Resultado por categoría</h3>
            <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
              {porCategoria.map((c) => (
                <div key={c.id} className="rounded-xl border border-slate-200 p-3">
                  <p className="min-h-10 text-xs font-black uppercase text-slate-800">{c.nombre}</p>
                  <p className="mt-2 text-2xl font-black text-violet-950">{puntos(c.promedio)}<span className="text-sm text-slate-500"> / 100</span></p>
                  <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-200">
                    <div className={`h-full ${colorPuntaje(c.promedio ?? 0)}`} style={{ width: `${c.promedio ?? 0}%` }} />
                  </div>
                  <p className="mt-2 text-[10px] font-bold uppercase text-slate-500">{c.intentos} intento(s)</p>
                </div>
              ))}
            </div>
          </section>

          <div className="grid gap-4 xl:grid-cols-[minmax(0,2fr)_minmax(260px,1fr)]">
            <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <h3 className="text-base font-black uppercase text-slate-900">Desglose por criterio</h3>
              <div className="mt-3 space-y-3">
                {criterios.map((c) => (
                  <div key={c.key}>
                    <div className="flex items-end justify-between gap-3 text-xs">
                      <div><p className="font-bold text-slate-900">{c.etiqueta}</p><p className="text-[10px] uppercase text-slate-500">{c.categoria}</p></div>
                      <strong className="whitespace-nowrap">{puntos(c.promedio)} / {c.maximo} · {c.porcentaje}%</strong>
                    </div>
                    <div className="mt-1 h-2 overflow-hidden rounded-full bg-slate-200">
                      <div className={`h-full ${colorPuntaje(c.porcentaje)}`} style={{ width: `${Math.min(100, c.porcentaje)}%` }} />
                    </div>
                  </div>
                ))}
                {criterios.length === 0 ? <p className="text-sm text-slate-500">Sin criterios en el alcance seleccionado.</p> : null}
              </div>
            </section>

            <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <h3 className="text-base font-black uppercase text-slate-900">Ranking del servicio</h3>
              <ol className="mt-3 space-y-2">
                {ranking.map((r, i) => (
                  <li key={r.no} className="flex items-center gap-2 rounded-lg bg-slate-50 p-2 text-xs">
                    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-violet-900 font-black text-white">{i + 1}</span>
                    <span className="min-w-0 flex-1 truncate font-bold uppercase">{r.nombre}</span>
                    <strong>{puntos(r.promedio)}</strong>
                  </li>
                ))}
                {ranking.length === 0 ? <li className="text-sm text-slate-500">Sin resultados.</li> : null}
              </ol>
            </section>
          </div>

          <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <h3 className="text-base font-black uppercase text-slate-900">Evolución histórica (últimas 12 pruebas)</h3>
            <div className="mt-4 flex h-48 items-end gap-2 overflow-x-auto border-b border-slate-300 px-2">
              {tendencia.map((e) => (
                <div key={e.id} className="flex min-w-14 flex-1 flex-col items-center justify-end" title={`${peoCategoria(e.categoria)?.nombre}: ${e.total}`}>
                  <span className="mb-1 text-[10px] font-black">{puntos(e.total)}</span>
                  <div className={`w-full max-w-12 rounded-t ${colorPuntaje(e.total)}`} style={{ height: `${Math.max(3, e.total)}%` }} />
                  <span className="my-1 whitespace-nowrap text-[9px] text-slate-500">{fechaMx(e.evaluadaEn)}</span>
                </div>
              ))}
              {tendencia.length === 0 ? <p className="m-auto text-sm text-slate-500">Sin historial para graficar.</p> : null}
            </div>
          </section>

          <p className="text-right text-[10px] uppercase text-slate-500">
            Generado: {data ? new Date(data.generadoEn).toLocaleString("es-MX") : "—"}
          </p>
        </div>
      </div>
    </AppModuleShell>
  );
}
