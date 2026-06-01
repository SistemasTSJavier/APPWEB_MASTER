"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AppModuleShell } from "@/components/app-module-shell";
import { CatEmpleadoBuscador } from "@/components/categorizacion/CatEmpleadoBuscador";
import { CatDashboardView } from "@/components/categorizacion/CatDashboardView";
import { CategorizacionHero } from "@/components/categorizacion/categorizacion-ui";
import type { CatDashboardEmpleado, CatDashboardPayload } from "@/lib/categorizacion-dashboard-types";
import type { AppRole } from "@/lib/app-role";

const LOOP_MS = 20_000;

export function CatDashboardClient({
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
  const [data, setData] = useState<CatDashboardPayload | null>(null);
  const [busy, setBusy] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [servicio, setServicio] = useState(initialServicio?.trim() || "");
  const [noSel, setNoSel] = useState(initialNo?.trim().toUpperCase() || "");
  const [mostrar, setMostrar] = useState(Boolean(initialNo?.trim()));
  const [pantallaCompleta, setPantallaCompleta] = useState(Boolean(initialNo?.trim()));
  const [modoLoop, setModoLoop] = useState(false);
  const [loopIndex, setLoopIndex] = useState(0);
  const [segundosRestantes, setSegundosRestantes] = useState(LOOP_MS / 1000);
  const [exportando, setExportando] = useState(false);
  const dashRef = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    setBusy(true);
    setErr(null);
    try {
      const r = await fetch("/api/categorizacion/dashboard", { cache: "no-store" });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error);
      setData({ empleados: j.empleados, servicios: j.servicios, generadoEn: j.generadoEn });
    } catch (e) {
      setErr(e instanceof Error ? e.message.toUpperCase() : "ERROR AL CARGAR.");
    } finally {
      setBusy(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const empleadosServicio = useMemo(() => {
    if (!data) return [];
    if (!servicio) return data.empleados;
    return data.empleados.filter((e) => e.servicio === servicio);
  }, [data, servicio]);

  const opciones = useMemo(
    () => empleadosServicio.map((e) => ({ noEmpleado: e.noEmpleado, nombre: e.nombre })),
    [empleadosServicio],
  );

  const empleadoManual = useMemo(() => {
    if (!noSel || !data) return null;
    return data.empleados.find((e) => e.noEmpleado.trim().toUpperCase() === noSel.trim().toUpperCase()) ?? null;
  }, [data, noSel]);

  const empleadoEnPantalla = useMemo(() => {
    if (noSel) return empleadoManual;
    if (modoLoop && empleadosServicio.length > 0) {
      const i = loopIndex % empleadosServicio.length;
      return empleadosServicio[i] ?? null;
    }
    return null;
  }, [noSel, empleadoManual, modoLoop, loopIndex, empleadosServicio]);

  useEffect(() => {
    if (noSel && empleadosServicio.length > 0 && empleadosServicio.every((e) => e.noEmpleado !== noSel)) {
      setNoSel("");
    }
  }, [empleadosServicio, noSel]);

  useEffect(() => {
    if (!modoLoop || noSel || empleadosServicio.length === 0) return;

    setSegundosRestantes(LOOP_MS / 1000);
    const tick = setInterval(() => {
      setSegundosRestantes((s) => {
        if (s <= 1) {
          setLoopIndex((i) => (i + 1) % empleadosServicio.length);
          return LOOP_MS / 1000;
        }
        return s - 1;
      });
    }, 1000);

    return () => clearInterval(tick);
  }, [modoLoop, noSel, empleadosServicio.length, loopIndex]);

  function detenerLoop() {
    setModoLoop(false);
    setLoopIndex(0);
  }

  function seleccionarColaborador(no: string) {
    setNoSel(no.trim().toUpperCase());
    setModoLoop(false);
    setLoopIndex(0);
    if (no.trim()) {
      setMostrar(true);
      setPantallaCompleta(true);
    }
  }

  function cerrarPresentacion() {
    setPantallaCompleta(false);
    setMostrar(false);
    detenerLoop();
  }

  function mostrarDashboard() {
    if (noSel.trim()) {
      detenerLoop();
      setMostrar(true);
      setPantallaCompleta(true);
      return;
    }
    if (servicio && empleadosServicio.length > 0) {
      setLoopIndex(0);
      setModoLoop(true);
      setMostrar(true);
      setPantallaCompleta(true);
      setSegundosRestantes(LOOP_MS / 1000);
      return;
    }
    setErr("SELECCIONA UN SERVICIO CON COLABORADORES O UN COLABORADOR.");
  }

  useEffect(() => {
    if (!pantallaCompleta) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") cerrarPresentacion();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [pantallaCompleta]);

  const puedeMostrar = Boolean(noSel.trim() || (servicio && empleadosServicio.length > 0));

  async function exportarPdf() {
    if (!dashRef.current || !empleadoEnPantalla) return;
    setExportando(true);
    try {
      const html2canvas = (await import("html2canvas")).default;
      const { jsPDF } = await import("jspdf");
      const canvas = await html2canvas(dashRef.current, {
        scale: 2,
        useCORS: true,
        backgroundColor: "#ffffff",
      });
      const img = canvas.toDataURL("image/png");
      const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
      const w = pdf.internal.pageSize.getWidth();
      const h = (canvas.height * w) / canvas.width;
      const pageH = pdf.internal.pageSize.getHeight();
      let slice = 0;
      let remaining = h;
      while (remaining > 0) {
        if (slice > 0) pdf.addPage();
        pdf.addImage(img, "PNG", 0, -slice, w, h);
        slice += pageH;
        remaining -= pageH;
      }
      pdf.save(`dashboard-cat-${empleadoEnPantalla.noEmpleado}.pdf`);
    } catch {
      setErr("NO SE PUDO EXPORTAR PDF.");
    } finally {
      setExportando(false);
    }
  }

  async function exportarPng() {
    if (!dashRef.current || !empleadoEnPantalla) return;
    setExportando(true);
    try {
      const html2canvas = (await import("html2canvas")).default;
      const canvas = await html2canvas(dashRef.current, { scale: 2, useCORS: true, backgroundColor: "#ffffff" });
      const a = document.createElement("a");
      a.href = canvas.toDataURL("image/png");
      a.download = `dashboard-cat-${empleadoEnPantalla.noEmpleado}.png`;
      a.click();
    } catch {
      setErr("NO SE PUDO EXPORTAR IMAGEN.");
    } finally {
      setExportando(false);
    }
  }

  const loopPos =
    modoLoop && empleadosServicio.length > 0 ? (loopIndex % empleadosServicio.length) + 1 : 0;

  return (
    <AppModuleShell role={appRole} email={email} currentPath="/categorizacion">
      <div className="min-w-0 space-y-5">
        <CategorizacionHero
          title="Dashboard de categorización"
          description="Por colaborador o en loop por servicio (20 s cada uno). Datos personales, gráfica, nivel y paquete."
          backHref="/categorizacion"
          backLabel="Categorización"
        />

        <section className="card space-y-4">
          <h2 className="text-sm font-bold uppercase text-slate-900">Filtros</h2>
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <label className="space-y-1">
              <span className="form-label">Servicio</span>
              <select
                className="form-control uppercase"
                value={servicio}
                onChange={(e) => {
                  setServicio(e.target.value);
                  setNoSel("");
                  setMostrar(false);
                  detenerLoop();
                }}
              >
                <option value="">Todos los servicios</option>
                {(data?.servicios ?? []).map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
              <p className="text-[11px] text-slate-500">{empleadosServicio.length} colaborador(es) en el filtro</p>
            </label>
            <CatEmpleadoBuscador
              label="Colaborador (opcional en loop)"
              hint="Vacío + servicio = recorrido automático cada 20 s."
              value={noSel}
              onChange={seleccionarColaborador}
              opciones={opciones}
              listId="cat-dashboard-empleado"
              disabled={busy || opciones.length === 0}
            />
          </div>

          <div className="flex flex-wrap gap-2">
            <button type="button" className="btn-primary uppercase" disabled={!puedeMostrar || busy} onClick={mostrarDashboard}>
              {noSel.trim() ? "Presentar (pantalla completa)" : "Presentar loop (pantalla completa)"}
            </button>
            {modoLoop ? (
              <button type="button" className="btn-secondary uppercase" onClick={detenerLoop}>
                Detener loop
              </button>
            ) : null}
            <button
              type="button"
              className="btn-secondary uppercase"
              disabled={!mostrar || !empleadoEnPantalla || exportando || modoLoop}
              onClick={() => void exportarPdf()}
            >
              Exportar PDF
            </button>
            <button
              type="button"
              className="btn-secondary uppercase"
              disabled={!mostrar || !empleadoEnPantalla || exportando || modoLoop}
              onClick={() => void exportarPng()}
            >
              Exportar imagen
            </button>
            <button type="button" className="text-xs font-bold uppercase text-violet-800" onClick={() => void load()}>
              Actualizar datos
            </button>
          </div>

          {modoLoop && mostrar && empleadosServicio.length > 0 ? (
            <div className="rounded-lg border border-violet-200 bg-violet-50 px-4 py-3 text-sm font-medium text-violet-950">
              <strong>Modo loop</strong> — {servicio}: colaborador {loopPos} de {empleadosServicio.length}
              {empleadoEnPantalla ? ` · ${empleadoEnPantalla.nombre}` : ""}. Siguiente en{" "}
              <strong>{segundosRestantes}s</strong>.
            </div>
          ) : null}
        </section>

        {err ? <p className="text-sm font-bold uppercase text-red-800">{err}</p> : null}
        {busy ? <p className="text-sm text-slate-500">Cargando datos…</p> : null}

        {!busy && servicio && empleadosServicio.length > 0 && !noSel && !modoLoop ? (
          <section className="card overflow-x-auto">
            <h2 className="mb-3 text-sm font-bold uppercase">Vista por servicio — {servicio}</h2>
            <p className="mb-3 text-xs text-slate-600">
              Pulsa <strong>Mostrar loop por servicio</strong> para rotar el dashboard cada 20 segundos.
            </p>
            <table className="w-full min-w-[640px] text-xs">
              <thead>
                <tr className="border-b text-[10px] font-bold uppercase text-slate-600">
                  <th className="p-2">N°</th>
                  <th className="p-2">Nombre</th>
                  <th className="p-2">Cap.</th>
                  <th className="p-2">Op.</th>
                  <th className="p-2">Enf.</th>
                  <th className="p-2">General</th>
                  <th className="p-2">Nivel</th>
                  <th className="p-2" />
                </tr>
              </thead>
              <tbody>
                {empleadosServicio.map((e) => (
                  <tr key={e.noEmpleado} className="border-b hover:bg-slate-50">
                    <td className="p-2 font-mono">{e.noEmpleado}</td>
                    <td className="p-2">{e.nombre}</td>
                    <td className="p-2 text-center">{fmt(e.promedioCapacitacion)}</td>
                    <td className="p-2 text-center">{fmt(e.promedioOperaciones)}</td>
                    <td className="p-2 text-center">{fmt(e.promedioEnfoque)}</td>
                    <td className="p-2 text-center font-bold">{fmt(e.promedioGeneral)}</td>
                    <td className="p-2 text-[10px] font-bold uppercase">{e.nivelId ?? "—"}</td>
                    <td className="p-2">
                      <button
                        type="button"
                        className="font-bold uppercase text-violet-800"
                        onClick={() => seleccionarColaborador(e.noEmpleado)}
                      >
                        Ver fijo
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        ) : null}

        {mostrar && noSel && !empleadoEnPantalla && !busy ? (
          <p className="text-sm font-medium text-amber-800">Colaborador no encontrado en categorización (regístralo en Personal).</p>
        ) : null}

        {!mostrar && !busy ? (
          <p className="rounded-xl border border-dashed border-slate-300 bg-white px-6 py-10 text-center text-sm text-slate-600">
            Elige un <strong>servicio</strong> para loop automático (20 s) o un <strong>colaborador</strong> para vista fija.
          </p>
        ) : null}

        <p className="text-center text-xs text-slate-500">
          <Link href="/categorizacion" className="font-bold text-violet-800 underline">
            Volver a módulos
          </Link>
        </p>
      </div>

      {pantallaCompleta && mostrar && empleadoEnPantalla && data ? (
        <div className="fixed inset-0 z-[250] flex flex-col bg-slate-900/40 backdrop-blur-sm">
          <div className="flex shrink-0 items-center justify-between gap-3 border-b border-slate-700 bg-slate-900 px-4 py-3 text-white sm:px-6">
            <div className="min-w-0 text-sm font-medium">
              {modoLoop ? (
                <span>
                  <strong className="uppercase">Loop</strong> · {servicio} · {loopPos}/{empleadosServicio.length}
                  {empleadoEnPantalla ? ` · ${empleadoEnPantalla.nombre}` : ""} · siguiente{" "}
                  <strong>{segundosRestantes}s</strong>
                </span>
              ) : (
                <span>
                  <strong className="uppercase">Presentación</strong> · {empleadoEnPantalla.nombre} (N°{" "}
                  {empleadoEnPantalla.noEmpleado})
                </span>
              )}
            </div>
            <div className="flex shrink-0 flex-wrap gap-2">
              {modoLoop ? (
                <button type="button" className="rounded-lg bg-slate-700 px-3 py-1.5 text-xs font-bold uppercase" onClick={detenerLoop}>
                  Pausar loop
                </button>
              ) : null}
              <button
                type="button"
                className="rounded-lg bg-white px-3 py-1.5 text-xs font-bold uppercase text-slate-900"
                onClick={cerrarPresentacion}
              >
                Salir (Esc)
              </button>
            </div>
          </div>

          <div className="flex min-h-0 flex-1 items-center justify-center overflow-auto p-3 sm:p-6 md:p-8">
            <CatDashboardView
              key={modoLoop ? `loop-${empleadoEnPantalla.noEmpleado}-${loopIndex}` : empleadoEnPantalla.noEmpleado}
              ref={dashRef}
              empleado={empleadoEnPantalla}
              generadoEn={data.generadoEn}
              presentacion
            />
          </div>
        </div>
      ) : null}
    </AppModuleShell>
  );
}

function fmt(n: number | null): string {
  return n != null ? n.toFixed(2) : "—";
}
