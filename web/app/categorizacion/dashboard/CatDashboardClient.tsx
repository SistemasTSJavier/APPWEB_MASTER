"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AppModuleShell } from "@/components/app-module-shell";
import { CatEmpleadoBuscador, CatFiltroPlanta, conteoActivosPorServicio, filtrarPorServicio, serviciosCoincidenCat } from "@/components/categorizacion/CatEmpleadoBuscador";
import { CatDashboardView } from "@/components/categorizacion/CatDashboardView";
import { CategorizacionHero } from "@/components/categorizacion/categorizacion-ui";
import type { CatDashboardEmpleado, CatDashboardPayload } from "@/lib/categorizacion-dashboard-types";
import type { AppRole } from "@/lib/app-role";
import { roleEsClienteEnfoque, roleMayWriteExpedienteColaborador } from "@/lib/app-role";
import { CatOficialFoto } from "@/components/categorizacion/CatOficialFoto";
import { CatLogoServicioFiltro } from "@/components/categorizacion/CatDashboardBanner";
import {
  claveLogoServicioDashboard,
  logoServicioDesdeMapa,
} from "@/lib/cat-dashboard-logo-servicio";
import { capturarDashboardComoCanvas } from "@/lib/dashboard-export-capture";

const LOOP_MS = 20_000;
const PDF_MARGIN_MM = 10;
const PDF_HEADER_MM = 8;
const PDF_JPEG_QUALITY = 0.92;
const DASHBOARD_CACHE_KEY = "cat-dashboard-payload-v6";
const DASHBOARD_CACHE_MS = 5 * 60_000;

type DashboardCache = CatDashboardPayload & { cachedAt: number };

function leerDashboardCache(): CatDashboardPayload | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(DASHBOARD_CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as DashboardCache;
    if (!parsed?.empleados?.length || Date.now() - parsed.cachedAt > DASHBOARD_CACHE_MS) return null;
    const { cachedAt: _c, ...payload } = parsed;
    return {
      ...payload,
      empleados: (payload.empleados ?? []).map((e) => ({ ...e, fotoUrl: e.fotoUrl ?? null })),
      logosServicio: payload.logosServicio ?? {},
    };
  } catch {
    return null;
  }
}

function guardarDashboardCache(payload: CatDashboardPayload) {
  if (typeof window === "undefined") return;
  try {
    const toStore: DashboardCache = { ...payload, cachedAt: Date.now() };
    sessionStorage.setItem(DASHBOARD_CACHE_KEY, JSON.stringify(toStore));
  } catch {
    /* quota / privado */
  }
}

function esperarPintado(): Promise<void> {
  return new Promise((resolve) => {
    requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
  });
}

async function capturarElementoDashboard(el: HTMLElement) {
  await esperarPintado();

  const host = el.closest("[data-export-capture-host]") as HTMLElement | null;
  const hostPrev = host
    ? {
        left: host.style.left,
        top: host.style.top,
        visibility: host.style.visibility,
        zIndex: host.style.zIndex,
        opacity: host.style.opacity,
        pointerEvents: host.style.pointerEvents,
      }
    : null;
  if (host) {
    host.style.left = "0";
    host.style.top = "0";
    host.style.visibility = "visible";
    host.style.opacity = "1";
    host.style.zIndex = "9998";
    host.style.pointerEvents = "none";
  }

  const scale = Math.min(2, Math.max(1.5, window.devicePixelRatio || 1.5));

  try {
    return await capturarDashboardComoCanvas(el, { scale });
  } finally {
    if (host && hostPrev) {
      host.style.left = hostPrev.left;
      host.style.top = hostPrev.top;
      host.style.visibility = hostPrev.visibility;
      host.style.zIndex = hostPrev.zIndex;
      host.style.opacity = hostPrev.opacity;
      host.style.pointerEvents = hostPrev.pointerEvents;
    }
  }
}

function fechaArchivoMx(d = new Date()): string {
  return d.toLocaleDateString("es-MX").replace(/\//g, "-");
}

function documentoEnFullscreen(): boolean {
  return Boolean(document.fullscreenElement);
}

async function solicitarFullscreenVentana(): Promise<boolean> {
  try {
    const el = document.documentElement;
    if (!documentoEnFullscreen()) {
      await el.requestFullscreen();
    }
    return documentoEnFullscreen();
  } catch {
    return false;
  }
}

async function salirFullscreenVentana(): Promise<void> {
  try {
    if (documentoEnFullscreen()) {
      await document.exitFullscreen();
    }
  } catch {
    /* ignorar */
  }
}

export function CatDashboardClient({
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
  const [data, setData] = useState<CatDashboardPayload | null>(null);
  const [busy, setBusy] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [servicio, setServicio] = useState(initialServicio?.trim() || "");
  const [planta, setPlanta] = useState("");
  const [noSel, setNoSel] = useState(initialNo?.trim().toUpperCase() || "");
  const [mostrar, setMostrar] = useState(Boolean(initialNo?.trim()));
  const [pantallaCompleta, setPantallaCompleta] = useState(Boolean(initialNo?.trim()));
  const [modoLoop, setModoLoop] = useState(false);
  const [loopIndex, setLoopIndex] = useState(0);
  const [segundosRestantes, setSegundosRestantes] = useState(LOOP_MS / 1000);
  const [exportando, setExportando] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [fechaFinAcceso, setFechaFinAcceso] = useState("");
  const dashRef = useRef<HTMLDivElement>(null);
  const dashExportRef = useRef<HTMLDivElement>(null);
  const esClienteConsulta = roleEsClienteEnfoque(appRole);
  const puedeSubirFoto = roleMayWriteExpedienteColaborador(appRole) && !esClienteConsulta;
  const puedeSubirLogo = !esClienteConsulta;

  function normalizarEmpleadosDashboard(rows: CatDashboardEmpleado[]): CatDashboardEmpleado[] {
    return rows.map((e) => ({ ...e, fotoUrl: e.fotoUrl ?? null }));
  }

  function actualizarLogoServicio(servicioNombre: string, url: string | null) {
    const key = claveLogoServicioDashboard(servicioNombre);
    setData((prev) => {
      if (!prev) return prev;
      const logosServicio = { ...prev.logosServicio };
      if (url) logosServicio[key] = url;
      else delete logosServicio[key];
      const next: CatDashboardPayload = { ...prev, logosServicio };
      guardarDashboardCache(next);
      return next;
    });
  }

  function actualizarFotoEmpleado(no: string, url: string) {
    const key = no.trim().toUpperCase();
    setData((prev) => {
      if (!prev) return prev;
      const next: CatDashboardPayload = {
        ...prev,
        empleados: prev.empleados.map((e) =>
          e.noEmpleado.trim().toUpperCase() === key ? { ...e, fotoUrl: url } : e,
        ),
      };
      guardarDashboardCache(next);
      return next;
    });
  }

  function normalizarPayloadDashboard(j: Record<string, unknown>): CatDashboardPayload {
    return {
      empleados: normalizarEmpleadosDashboard((j.empleados as CatDashboardEmpleado[]) ?? []),
      servicios: (j.servicios as string[]) ?? [],
      generadoEn: String(j.generadoEn ?? new Date().toISOString()),
      logosServicio: (j.logosServicio as Record<string, string>) ?? {},
    };
  }

  const load = useCallback(async (opts?: { background?: boolean }) => {
    const background = Boolean(opts?.background);
    if (!background) setBusy(true);
    else setRefreshing(true);
    setErr(null);
    try {
      const r = await fetch("/api/categorizacion/dashboard", { cache: "no-store" });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error);
      const payload = normalizarPayloadDashboard(j as Record<string, unknown>);
      setData(payload);
      guardarDashboardCache(payload);
    } catch (e) {
      setErr(e instanceof Error ? e.message.toUpperCase() : "ERROR AL CARGAR.");
    } finally {
      setBusy(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    const cached = leerDashboardCache();
    if (cached) {
      setData(cached);
      setBusy(false);
      void load({ background: true });
      return;
    }
    void load();
  }, [load]);

  useEffect(() => {
    if (!esClienteConsulta) return;
    void (async () => {
      try {
        const r = await fetch("/api/categorizacion/enfoque-accesos/contexto", { cache: "no-store" });
        const j = await r.json();
        if (r.ok && j.servicio) {
          setServicio(String(j.servicio));
          setFechaFinAcceso(String(j.fechaFin ?? ""));
        }
      } catch {
        /* contexto validado en API del dashboard */
      }
    })();
  }, [esClienteConsulta]);

  useEffect(() => {
    if (!esClienteConsulta || servicio || !data?.servicios?.length) return;
    setServicio(data.servicios[0] ?? "");
  }, [esClienteConsulta, servicio, data]);

  const empleadosServicio = useMemo(() => {
    if (!data) return [];
    if (!servicio) return data.empleados;
    return filtrarPorServicio(data.empleados, servicio, planta);
  }, [data, servicio, planta]);

  /** Cliente: al cargar el servicio, mostrar el dashboard real del primer colaborador. */
  useEffect(() => {
    if (!esClienteConsulta || !servicio || empleadosServicio.length === 0) return;
    if (noSel.trim()) return;
    const primero = empleadosServicio[0];
    if (!primero) return;
    setNoSel(primero.noEmpleado.trim().toUpperCase());
    setMostrar(true);
  }, [esClienteConsulta, servicio, empleadosServicio, noSel]);

  const conteosServicio = useMemo(
    () => (data ? conteoActivosPorServicio(data.empleados) : []),
    [data],
  );

  const opciones = useMemo(
    () => empleadosServicio.map((e) => ({ noEmpleado: e.noEmpleado, nombre: e.nombre })),
    [empleadosServicio],
  );

  const empleadoManual = useMemo(() => {
    if (!noSel || !data) return null;
    return data.empleados.find((e) => e.noEmpleado.trim().toUpperCase() === noSel.trim().toUpperCase()) ?? null;
  }, [data, noSel]);

  const logoServicioFiltro = useMemo(
    () => (servicio ? logoServicioDesdeMapa(data?.logosServicio, servicio) : null),
    [data?.logosServicio, servicio],
  );

  const empleadoEnPantalla = useMemo(() => {
    if (noSel) return empleadoManual;
    if (modoLoop && empleadosServicio.length > 0) {
      const i = loopIndex % empleadosServicio.length;
      return empleadosServicio[i] ?? null;
    }
    return null;
  }, [noSel, empleadoManual, modoLoop, loopIndex, empleadosServicio]);

  useEffect(() => {
    const key = noSel.trim().toUpperCase();
    if (
      key &&
      empleadosServicio.length > 0 &&
      empleadosServicio.every((e) => e.noEmpleado.trim().toUpperCase() !== key)
    ) {
      setNoSel("");
      if (!esClienteConsulta) setMostrar(false);
    }
  }, [empleadosServicio, noSel, esClienteConsulta]);

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

  const indicePresentacion = useMemo(() => {
    if (empleadosServicio.length === 0) return 0;
    if (noSel.trim()) {
      const i = empleadosServicio.findIndex(
        (e) => e.noEmpleado.trim().toUpperCase() === noSel.trim().toUpperCase(),
      );
      if (i >= 0) return i;
    }
    return loopIndex % empleadosServicio.length;
  }, [empleadosServicio, noSel, loopIndex]);

  const posicionPresentacion = empleadosServicio.length > 0 ? indicePresentacion + 1 : 0;

  function pausarLoop() {
    if (empleadosServicio.length > 0) {
      const i = indicePresentacion % empleadosServicio.length;
      const emp = empleadosServicio[i];
      if (emp) {
        setLoopIndex(i);
        setNoSel(emp.noEmpleado.trim().toUpperCase());
      }
    }
    setModoLoop(false);
    setSegundosRestantes(LOOP_MS / 1000);
  }

  function reanudarLoop() {
    if (empleadosServicio.length === 0) return;
    setNoSel("");
    setModoLoop(true);
    setSegundosRestantes(LOOP_MS / 1000);
  }

  function seleccionarEnPresentacion(no: string) {
    const key = no.trim().toUpperCase();
    const idx = empleadosServicio.findIndex((e) => e.noEmpleado.trim().toUpperCase() === key);
    if (idx < 0) return;
    setModoLoop(false);
    setSegundosRestantes(LOOP_MS / 1000);
    setLoopIndex(idx);
    setNoSel(key);
  }

  function moverPresentacion(delta: -1 | 1) {
    if (empleadosServicio.length <= 1) return;
    const len = empleadosServicio.length;
    const next = (indicePresentacion + delta + len) % len;
    const emp = empleadosServicio[next];
    if (!emp) return;
    setModoLoop(false);
    setSegundosRestantes(LOOP_MS / 1000);
    setLoopIndex(next);
    setNoSel(emp.noEmpleado.trim().toUpperCase());
  }

  function seleccionarColaborador(no: string) {
    const key = no.trim().toUpperCase();
    setNoSel(key);
    setModoLoop(false);
    setLoopIndex(0);
    setPantallaCompleta(false);
    setMostrar(Boolean(key));
  }

  const cerrarPresentacion = useCallback(() => {
    void salirFullscreenVentana();
    setPantallaCompleta(false);
    setModoLoop(false);
    setSegundosRestantes(LOOP_MS / 1000);
    // Al salir de pantalla completa se mantiene la vista inline del colaborador.
    setMostrar(true);
  }, []);

  const abrirPresentacion = useCallback(async () => {
    setMostrar(true);
    setPantallaCompleta(true);
    await solicitarFullscreenVentana();
  }, []);

  async function mostrarDashboard() {
    if (noSel.trim()) {
      detenerLoop();
      await abrirPresentacion();
      return;
    }
    if (servicio && empleadosServicio.length > 0) {
      setLoopIndex(0);
      setModoLoop(true);
      setSegundosRestantes(LOOP_MS / 1000);
      await abrirPresentacion();
      return;
    }
    setErr("SELECCIONA UN SERVICIO CON COLABORADORES O UN COLABORADOR.");
  }

  useEffect(() => {
    if (!pantallaCompleta) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onFullscreenChange = () => {
      if (!documentoEnFullscreen()) {
        setPantallaCompleta(false);
        setModoLoop(false);
        setSegundosRestantes(LOOP_MS / 1000);
        setMostrar(true);
      }
    };
    window.addEventListener("fullscreenchange", onFullscreenChange);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("fullscreenchange", onFullscreenChange);
    };
  }, [pantallaCompleta]);

  const puedeMostrar = Boolean(noSel.trim() || (servicio && empleadosServicio.length > 0));

  const empleadoExport = empleadoEnPantalla ?? empleadoManual;
  const puedeExportarDashboard = Boolean(
    empleadoExport && (pantallaCompleta || (noSel.trim() && empleadoManual)) && !modoLoop,
  );

  function elementoDashboardCaptura(): HTMLElement | null {
    if (pantallaCompleta && dashRef.current) return dashRef.current;
    if (dashExportRef.current) return dashExportRef.current;
    return dashRef.current;
  }

  async function exportarPdf() {
    const el = elementoDashboardCaptura();
    if (!el || !empleadoExport) {
      setErr("ABRA LA PRESENTACIÓN O SELECCIONE UN COLABORADOR PARA EXPORTAR.");
      return;
    }
    setExportando(true);
    setErr(null);
    try {
      const canvas = await capturarElementoDashboard(el);
      const { jsPDF } = await import("jspdf");
      const img = canvas.toDataURL("image/jpeg", PDF_JPEG_QUALITY);
      const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
      const no = empleadoExport.noEmpleado;
      const nombre = empleadoExport.nombre;
      const servicioLabel = empleadoExport.servicio?.trim() || servicio || "—";
      const exportado = new Date().toLocaleString("es-MX", { dateStyle: "medium", timeStyle: "short" });

      pdf.setProperties({
        title: `Dashboard categorización — ${no}`,
        subject: nombre,
        author: "Tactical Support",
      });

      const pageW = pdf.internal.pageSize.getWidth();
      const pageH = pdf.internal.pageSize.getHeight();
      const contentW = pageW - PDF_MARGIN_MM * 2;
      const imgH = (canvas.height * contentW) / canvas.width;
      const usableH = pageH - PDF_MARGIN_MM * 2 - PDF_HEADER_MM;
      let yOffset = 0;
      let page = 0;

      while (yOffset < imgH) {
        if (page > 0) pdf.addPage();
        pdf.setFontSize(8);
        pdf.setTextColor(80);
        pdf.text(`Dashboard categorización — ${no} — ${nombre}`, PDF_MARGIN_MM, PDF_MARGIN_MM + 3);
        pdf.text(servicioLabel.toUpperCase(), PDF_MARGIN_MM, PDF_MARGIN_MM + 6);
        pdf.text(exportado, pageW - PDF_MARGIN_MM, PDF_MARGIN_MM + 3, { align: "right" });
        pdf.addImage(img, "JPEG", PDF_MARGIN_MM, PDF_MARGIN_MM + PDF_HEADER_MM - yOffset, contentW, imgH);
        yOffset += usableH;
        page += 1;
      }

      pdf.save(`dashboard-cat-${no}-${fechaArchivoMx()}.pdf`);
    } catch (e) {
      setErr(e instanceof Error ? e.message.toUpperCase() : "NO SE PUDO EXPORTAR PDF.");
    } finally {
      setExportando(false);
    }
  }

  async function exportarPng() {
    const el = elementoDashboardCaptura();
    if (!el || !empleadoExport) {
      setErr("ABRA LA PRESENTACIÓN O SELECCIONE UN COLABORADOR PARA EXPORTAR.");
      return;
    }
    setExportando(true);
    setErr(null);
    try {
      const canvas = await capturarElementoDashboard(el);
      const a = document.createElement("a");
      a.href = canvas.toDataURL("image/png");
      a.download = `dashboard-cat-${empleadoExport.noEmpleado}-${fechaArchivoMx()}.png`;
      a.click();
    } catch (e) {
      setErr(e instanceof Error ? e.message.toUpperCase() : "NO SE PUDO EXPORTAR IMAGEN.");
    } finally {
      setExportando(false);
    }
  }

  const loopPos = posicionPresentacion;

  return (
    <AppModuleShell
      role={appRole}
      email={email}
      currentPath="/categorizacion"
      modulosHabilitados={modulosHabilitados}
    >
      <div className="min-w-0 space-y-4">
        <CategorizacionHero
          title={esClienteConsulta ? "Categorización — consulta por servicio" : "Dashboard de categorización"}
          description={
            esClienteConsulta
              ? "Dashboard por colaborador: datos personales, gráfica por módulo, ranking del servicio, nivel y paquete. Use pantalla completa para presentación o recorrido automático."
              : "Por colaborador o en loop por servicio (20 s cada uno). Datos personales, gráfica, nivel y paquete."
          }
          backHref={esClienteConsulta ? undefined : "/categorizacion"}
          backLabel={esClienteConsulta ? undefined : "Categorización"}
        />

        {esClienteConsulta && servicio ? (
          <div className="rounded-lg border border-sky-200 bg-sky-50 px-3 py-2 text-xs text-sky-950">
            <strong>Servicio asignado:</strong> <span className="uppercase">{servicio}</span>
            {fechaFinAcceso ? (
              <span className="ml-2 text-slate-600">· Acceso vigente hasta {fechaFinAcceso}</span>
            ) : null}
            <span className="ml-2 text-slate-600">
              · {empleadosServicio.length} colaborador(es) activo(s)
            </span>
          </div>
        ) : null}

        <section className={`card ${esClienteConsulta ? "space-y-3 p-3 sm:p-4" : "space-y-4"}`}>
          <h2 className="text-sm font-bold uppercase text-slate-900">Filtros</h2>
          {conteosServicio.length > 0 ? (
            <div className="flex flex-wrap gap-1.5">
              {conteosServicio.map(({ servicio: s, count }) => (
                <span
                  key={s}
                  className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-[10px] font-semibold uppercase ${
                    servicio && serviciosCoincidenCat(servicio, s)
                      ? "border-violet-300 bg-violet-100 text-violet-950"
                      : "border-slate-200 bg-slate-50 text-slate-700"
                  }`}
                >
                  <span className="max-w-[12rem] truncate">{s}</span>
                  <span className="font-mono font-bold tabular-nums">{count}</span>
                </span>
              ))}
              <span className="self-center text-[10px] font-semibold text-slate-500">
                {data?.empleados.length ?? 0} activos total
              </span>
            </div>
          ) : null}
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <div className="space-y-3">
            <label className="space-y-1 block">
              <span className="form-label">Servicio</span>
              {esClienteConsulta ? (
                <p className="form-control uppercase bg-slate-50 font-semibold text-slate-800">{servicio || "—"}</p>
              ) : (
              <select
                className="form-control uppercase"
                value={servicio}
                onChange={(e) => {
                  setServicio(e.target.value);
                  setPlanta("");
                  setNoSel("");
                  setMostrar(false);
                  detenerLoop();
                }}
              >
                <option value="">Todos los servicios ({data?.empleados.length ?? 0})</option>
                {(data?.servicios ?? []).map((s) => (
                  <option key={s} value={s}>
                    {s} ({conteosServicio.find((c) => serviciosCoincidenCat(c.servicio, s))?.count ?? 0})
                  </option>
                ))}
              </select>
              )}
              <p className="text-[11px] text-slate-500">
                {empleadosServicio.length} colaborador(es) activo(s) en el filtro
              </p>
            </label>
            {!esClienteConsulta ? (
              <CatFiltroPlanta
                servicioFiltro={servicio}
                value={planta}
                onChange={(v) => {
                  setPlanta(v);
                  setNoSel("");
                  setMostrar(false);
                  detenerLoop();
                }}
                personal={data?.empleados ?? []}
              />
            ) : null}
            </div>
            <CatEmpleadoBuscador
              label={esClienteConsulta ? "Colaborador" : "Colaborador (opcional en loop)"}
              hint={
                esClienteConsulta
                  ? "Seleccione un colaborador para ver su dashboard completo."
                  : "Vacío + servicio = recorrido automático cada 20 s."
              }
              value={noSel}
              onChange={seleccionarColaborador}
              opciones={opciones}
              listId="cat-dashboard-empleado"
              disabled={busy || opciones.length === 0}
            />
          </div>

          {servicio && puedeSubirLogo ? (
            <CatLogoServicioFiltro
              servicio={servicio}
              logoUrl={logoServicioFiltro}
              onActualizado={(url) => actualizarLogoServicio(servicio, url)}
            />
          ) : null}

          {empleadoManual && puedeSubirFoto ? (
            <div className="flex flex-wrap items-start justify-between gap-4 rounded-lg border border-violet-200 bg-violet-50/60 px-4 py-3">
              <div className="min-w-[12rem] flex-1 text-xs text-slate-700">
                <p className="font-bold uppercase text-violet-950">Foto del colaborador</p>
                <p className="mt-1 leading-relaxed">
                  Suba la fotografía oficial una por una. Se guarda en el expediente y aparece en la presentación del
                  dashboard y en la ficha técnica.
                </p>
              </div>
              <CatOficialFoto
                noEmpleado={empleadoManual.noEmpleado}
                nombre={empleadoManual.nombre}
                fotoUrl={empleadoManual.fotoUrl}
                puedeSubir
                onActualizada={(url) => actualizarFotoEmpleado(empleadoManual.noEmpleado, url)}
              />
            </div>
          ) : null}

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              className="btn-primary uppercase"
              disabled={!puedeMostrar || busy}
              onClick={() => void mostrarDashboard()}
            >
              {esClienteConsulta
                ? noSel.trim()
                  ? "Mostrar general (pantalla completa)"
                  : "Mostrar general — loop por servicio (20 s)"
                : noSel.trim()
                  ? "Presentar (pantalla completa)"
                  : "Presentar loop (pantalla completa)"}
            </button>
            {modoLoop ? (
              <button type="button" className="btn-secondary uppercase" onClick={detenerLoop}>
                Detener loop
              </button>
            ) : null}
            {!esClienteConsulta ? (
              <>
                <button
                  type="button"
                  className="btn-secondary uppercase"
                  disabled={!puedeExportarDashboard || exportando}
                  onClick={() => void exportarPdf()}
                >
                  {exportando ? "Exportando…" : "Exportar PDF"}
                </button>
                <button
                  type="button"
                  className="btn-secondary uppercase"
                  disabled={!puedeExportarDashboard || exportando}
                  onClick={() => void exportarPng()}
                >
                  Exportar imagen
                </button>
              </>
            ) : null}
            <button type="button" className="text-xs font-bold uppercase text-violet-800" onClick={() => void load()}>
              {refreshing ? "Actualizando…" : "Actualizar datos"}
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
        {busy && !data ? <p className="text-sm text-slate-500">Cargando colaboradores y promedios…</p> : null}
        {refreshing && data ? (
          <p className="text-xs font-medium text-slate-500">Actualizando datos en segundo plano…</p>
        ) : null}

        {!busy && !esClienteConsulta && servicio && empleadosServicio.length > 0 && !noSel && !modoLoop ? (
          <section className="card overflow-x-auto">
            <h2 className="mb-3 text-sm font-bold uppercase">Vista por servicio — {servicio}</h2>
            <p className="mb-3 text-xs text-slate-600">
              Pulsa <strong>Presentar loop por servicio</strong> para rotar el dashboard cada 20 segundos, o elige un
              colaborador para ver el dashboard completo.
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
                        Ver dashboard
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        ) : null}

        {mostrar && !pantallaCompleta && empleadoEnPantalla && data ? (
          <section className="min-w-0">
            <CatDashboardView
              key={`inline-${empleadoEnPantalla.noEmpleado}`}
              ref={dashRef}
              empleado={empleadoEnPantalla}
              generadoEn={data.generadoEn}
              rankingServicio={empleadosServicio}
              onSeleccionarColaborador={seleccionarColaborador}
              puedeSubirFoto={puedeSubirFoto}
              onFotoActualizada={actualizarFotoEmpleado}
              logoServicioUrl={logoServicioDesdeMapa(data.logosServicio, empleadoEnPantalla.servicio)}
              puedeSubirLogo={puedeSubirLogo}
              onLogoServicioActualizado={(url) => actualizarLogoServicio(empleadoEnPantalla.servicio, url)}
            />
          </section>
        ) : null}

        {mostrar && noSel && !empleadoEnPantalla && !busy ? (
          <p className="text-sm font-medium text-amber-800">Colaborador no encontrado en categorización (regístralo en Personal).</p>
        ) : null}

        {!mostrar && !busy && !esClienteConsulta ? (
          <p className="rounded-xl border border-dashed border-slate-300 bg-white px-6 py-10 text-center text-sm text-slate-600">
            Elige un <strong>servicio</strong> para loop automático (20 s) o un <strong>colaborador</strong> para vista fija.
          </p>
        ) : null}

        {!mostrar && !busy && esClienteConsulta && servicio && empleadosServicio.length === 0 ? (
          <p className="rounded-xl border border-dashed border-amber-200 bg-amber-50 px-6 py-10 text-center text-sm text-amber-900">
            No hay colaboradores activos en el servicio <strong className="uppercase">{servicio}</strong>.
          </p>
        ) : null}

        {!esClienteConsulta ? (
          <p className="text-center text-xs text-slate-500">
            <Link href="/categorizacion" className="font-bold text-violet-800 underline">
              Volver a módulos
            </Link>
          </p>
        ) : null}
      </div>

      {pantallaCompleta && mostrar && empleadoEnPantalla && data ? (
        <div className="fixed inset-0 z-[9999] flex h-[100dvh] w-[100dvw] flex-col overflow-hidden bg-white">
          <div className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-b border-slate-200 bg-slate-50 px-3 py-1.5 sm:px-4">
            <p className="text-[10px] font-bold uppercase tracking-wide text-slate-600 sm:text-xs">
              Presentación · Categorización
            </p>
            <div className="flex max-w-full flex-wrap items-center justify-end gap-1.5 sm:gap-2">
              {empleadosServicio.length > 1 ? (
                <span className="rounded-md border border-slate-200 bg-white px-2.5 py-1 text-[10px] font-semibold text-slate-700 sm:text-xs">
                  {modoLoop ? (
                    <>
                      Loop · {servicio} · {posicionPresentacion}/{empleadosServicio.length} · {segundosRestantes}s
                    </>
                  ) : (
                    <>
                      Manual · {servicio} · {posicionPresentacion}/{empleadosServicio.length}
                    </>
                  )}
                </span>
              ) : null}
              {empleadosServicio.length > 1 ? (
                <>
                  <button
                    type="button"
                    className="rounded-md border border-slate-300 bg-white px-2.5 py-1 text-[10px] font-bold uppercase text-slate-800 sm:text-xs"
                    onClick={() => moverPresentacion(-1)}
                    aria-label="Colaborador anterior"
                  >
                    ← Anterior
                  </button>
                  <button
                    type="button"
                    className="rounded-md border border-slate-300 bg-white px-2.5 py-1 text-[10px] font-bold uppercase text-slate-800 sm:text-xs"
                    onClick={() => moverPresentacion(1)}
                    aria-label="Colaborador siguiente"
                  >
                    Siguiente →
                  </button>
                </>
              ) : null}
              {modoLoop ? (
                <button
                  type="button"
                  className="rounded-md border border-violet-300 bg-violet-50 px-2.5 py-1 text-[10px] font-bold uppercase text-violet-950 sm:text-xs"
                  onClick={pausarLoop}
                >
                  Pausar loop
                </button>
              ) : empleadosServicio.length > 1 ? (
                <button
                  type="button"
                  className="rounded-md border border-violet-300 bg-violet-50 px-2.5 py-1 text-[10px] font-bold uppercase text-violet-950 sm:text-xs"
                  onClick={reanudarLoop}
                >
                  Reanudar loop
                </button>
              ) : null}
              {!esClienteConsulta ? (
                <>
                  <button
                    type="button"
                    className="rounded-md border border-slate-300 bg-white px-2.5 py-1 text-[10px] font-bold uppercase text-slate-800 disabled:opacity-50 sm:text-xs"
                    disabled={!puedeExportarDashboard || exportando}
                    onClick={() => void exportarPdf()}
                  >
                    {exportando ? "Exportando…" : "Exportar PDF"}
                  </button>
                  <button
                    type="button"
                    className="rounded-md border border-slate-300 bg-white px-2.5 py-1 text-[10px] font-bold uppercase text-slate-800 disabled:opacity-50 sm:text-xs"
                    disabled={!puedeExportarDashboard || exportando}
                    onClick={() => void exportarPng()}
                  >
                    Exportar imagen
                  </button>
                </>
              ) : null}
              <button
                type="button"
                className="rounded-md bg-slate-900 px-2.5 py-1 text-[10px] font-bold uppercase text-white sm:text-xs"
                onClick={cerrarPresentacion}
              >
                Salir
              </button>
            </div>
          </div>

          <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
            <CatDashboardView
              key={`present-${empleadoEnPantalla.noEmpleado}-${indicePresentacion}`}
              ref={dashRef}
              empleado={empleadoEnPantalla}
              generadoEn={data.generadoEn}
              presentacion
              rankingServicio={empleadosServicio}
              onSeleccionarColaborador={seleccionarEnPresentacion}
              puedeSubirFoto={puedeSubirFoto}
              onFotoActualizada={actualizarFotoEmpleado}
              logoServicioUrl={logoServicioDesdeMapa(data.logosServicio, empleadoEnPantalla.servicio)}
              puedeSubirLogo={puedeSubirLogo}
              onLogoServicioActualizado={(url) => actualizarLogoServicio(empleadoEnPantalla.servicio, url)}
            />
          </div>
        </div>
      ) : null}

      {!esClienteConsulta && !pantallaCompleta && empleadoManual && data && noSel.trim() ? (
        <div
          data-export-capture-host
          className="pointer-events-none fixed left-[-12000px] top-0 h-[920px] w-[1400px] opacity-0"
          aria-hidden
        >
          <div className="h-full w-full bg-white">
            <CatDashboardView
              ref={dashExportRef}
              empleado={empleadoManual}
              generadoEn={data.generadoEn}
              presentacion
              rankingServicio={empleadosServicio.length > 1 ? empleadosServicio : undefined}
              logoServicioUrl={logoServicioDesdeMapa(data.logosServicio, empleadoManual.servicio)}
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
