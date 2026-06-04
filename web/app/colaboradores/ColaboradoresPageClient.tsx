"use client";

import { Fragment, useEffect, useMemo, useState } from "react";
import { listColaboradoresCompletos, type ColaboradorCompleto } from "@/lib/colaboradores-store";
import { EditorExpedienteCompleto } from "@/app/colaboradores/EditorExpedienteCompleto";
import { type CatalogoServicioItem, fetchServiciosCatalogo } from "@/lib/servicios-catalogo-client";
import type { MoperHistorialEntrada } from "@/lib/moper-historial-types";
import { colaboradoresToCsv, downloadCsv } from "@/lib/colaboradores-csv";
import { listMoperHistorialPorEmpleado } from "@/lib/moper-historial";
import { ALTAS_ETIQUETA_PARTE_IMPORT } from "@/lib/altas-import-partes";
import { groupFormByAltasPartes, type FormParteGrupo } from "@/lib/altas-expediente-partes";
import {
  colaboradorEstaActivoEnOperacion,
  fechaIngresoNormalizadaColaborador,
} from "@/lib/colaboradores-baja";
import {
  claveServicioAgrupada,
  servicioAgrupadoUsaZona,
  servicioLineaColaborador,
  zonaVarianteServicio,
  ZONA_FILTRO_SIN_SUFIJO,
} from "@/lib/servicio-agrupacion";
import type { AppRole } from "@/lib/app-role";
import {
  esRolLegalSoloLectura,
  roleMayEditColaboradores,
  roleMayEditColaboradoresVacantes,
  roleMayExportColaboradoresCsv,
} from "@/lib/app-role";
import { normalizarFechaParaInputDate } from "@/lib/fecha-input-normalize";
import { textoEdadDesdeExpediente } from "@/lib/edad-desde-nacimiento";
import { formatoDesdeYyyyMmDd, formatoFechaDiaMesAnio } from "@/lib/fecha-formato-display";
import {
  noServicioColaborador,
  plantaColaborador,
  posicionLaboralColaborador,
} from "@/lib/colaboradores-catalogo-display";

function fechaEnRangoIngreso(fechaNormColaborador: string, desde: string, hasta: string): boolean {
  const desdeN = desde.trim() ? normalizarFechaParaInputDate(desde.trim()) || desde.trim() : "";
  const hastaN = hasta.trim() ? normalizarFechaParaInputDate(hasta.trim()) || hasta.trim() : "";
  if (!fechaNormColaborador) return !desdeN && !hastaN;
  if (desdeN && fechaNormColaborador < desdeN) return false;
  if (hastaN && fechaNormColaborador > hastaN) return false;
  return true;
}

function ingresoMostrarEnTabla(c: ColaboradorCompleto): string {
  const n = fechaIngresoNormalizadaColaborador(c);
  if (n) {
    const dmy = formatoDesdeYyyyMmDd(n);
    if (dmy) return dmy;
  }
  const fallback = String(c.fechaIngreso ?? c.form?.fechaIngreso ?? "").trim();
  if (!fallback) return "—";
  return formatoFechaDiaMesAnio(fallback, { conHora: false });
}

function textoBusquedaCoincide(c: ColaboradorCompleto, q: string): boolean {
  if (!q.trim()) return true;
  const n = q.trim().toLowerCase();
  const campos = [
    c.noEmpleado,
    c.nombreCompleto,
    c.servicioAsignado,
    c.ultimoServicio,
    servicioLineaColaborador(c),
    c.nss,
    c.posicion,
    c.puesto,
    c.fechaIngreso,
    ...Object.values(c.form),
    ...c.familiares.flatMap((f) => [f.nombreFamiliar, f.parentesco, f.fechaNacimiento]),
  ];
  return campos.some((t) => String(t).toLowerCase().includes(n));
}

export function ColaboradoresPageClient({ appRole }: { appRole: AppRole }) {
  const puedeEditar = roleMayEditColaboradores(appRole);
  const puedeEditarVacantes = roleMayEditColaboradoresVacantes(appRole);
  const puedeExportarCsv = roleMayExportColaboradoresCsv(appRole);
  const mostrarCheckboxCsv = puedeEditar || puedeExportarCsv;
  const soloLectura = appRole === "mejora_continua" || esRolLegalSoloLectura(appRole);
  const colSpan = mostrarCheckboxCsv ? 8 : 7;

  const [rows, setRows] = useState<ColaboradorCompleto[]>([]);
  const [listaError, setListaError] = useState<string | null>(null);
  const [busqueda, setBusqueda] = useState("");
  const [servicio, setServicio] = useState("");
  const [zona, setZona] = useState("");
  const [fechaDesde, setFechaDesde] = useState("");
  const [fechaHasta, setFechaHasta] = useState("");
  const [filtroActivo, setFiltroActivo] = useState<"todos" | "activos" | "inactivos">("todos");
  const [expandido, setExpandido] = useState<string | null>(null);
  const [editandoNo, setEditandoNo] = useState<string | null>(null);
  const [seleccion, setSeleccion] = useState<Set<string>>(new Set());
  const [catalogoServicios, setCatalogoServicios] = useState<CatalogoServicioItem[]>([]);

  const [columnaCsvBusy, setColumnaCsvBusy] = useState(false);
  const [columnaCsvMsg, setColumnaCsvMsg] = useState<string | null>(null);
  const [masivoCsvBusy, setMasivoCsvBusy] = useState(false);
  const [masivoCsvMsg, setMasivoCsvMsg] = useState<string | null>(null);
  const [masivoCsvMergeExisting, setMasivoCsvMergeExisting] = useState(false);
  const [masivoCsvPreserveMoper, setMasivoCsvPreserveMoper] = useState(true);
  const [masivoCsvDetalle, setMasivoCsvDetalle] = useState<{
    imported: number;
    filasCsvValidas: number;
    skippedEmpty: number;
    lotes: number;
    duplicateNosMerged: number;
    resolvedByNombre: number;
    errores: Array<{ row: number; message: string }>;
    avisos: Array<{ row: number; message: string }>;
  } | null>(null);
  const [columnaCsvDetalle, setColumnaCsvDetalle] = useState<{
    dataFieldKey: string;
    dataHeaderLabel: string;
    actualizados: number;
    ignoradosNoExiste: number;
    omitidosSinExpediente: string[];
    filasVaciasOsinDato: number;
    errores: Array<{ row: number; message: string }>;
  } | null>(null);

  useEffect(() => {
    let cancel = false;
    (async () => {
      setListaError(null);
      try {
        const list = await listColaboradoresCompletos();
        if (!cancel) setRows(list);
      } catch (e) {
        if (!cancel) setRows([]);
        if (!cancel) setListaError(e instanceof Error ? e.message : "ERROR AL CARGAR COLABORADORES.");
      }
    })();
    return () => {
      cancel = true;
    };
  }, []);

  useEffect(() => {
    if (!puedeEditar) {
      setCatalogoServicios([]);
      return;
    }
    let cancel = false;
    (async () => {
      try {
        const list = await fetchServiciosCatalogo();
        if (!cancel) setCatalogoServicios(list);
      } catch {
        if (!cancel) setCatalogoServicios([]);
      }
    })();
    return () => {
      cancel = true;
    };
  }, [puedeEditar]);

  async function recargarColaboradores() {
    try {
      const list = await listColaboradoresCompletos({ forceRefresh: true });
      setRows(list);
      setListaError(null);
    } catch (e) {
      setListaError(e instanceof Error ? e.message : "ERROR AL CARGAR COLABORADORES.");
    }
  }

  async function importarCsvUnaColumnaDesdeArchivo(file: File | null) {
    if (!file) return;
    setColumnaCsvBusy(true);
    setColumnaCsvMsg(null);
    setColumnaCsvDetalle(null);
    try {
      const text = await file.text();
      const r = await fetch("/api/colaboradores/import-columna-csv", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ csvText: text }),
      });
      const rawBody = await r.text();
      const contentType = r.headers.get("content-type") ?? "";
      if (contentType.includes("text/html")) {
        throw new Error(
          "LA RUTA API NO RESPONDE (404 HTML). USA /colaboradores Y REINICIA npm run dev EN LA CARPETA web.",
        );
      }
      let j: {
        error?: string;
        ok?: boolean;
        dataFieldKey?: string;
        dataHeaderLabel?: string;
        actualizados?: number;
        ignoradosNoExiste?: number;
        omitidosSinExpediente?: string[];
        filasVaciasOsinDato?: number;
        errores?: Array<{ row: number; message: string }>;
      } = {};
      try {
        j = JSON.parse(rawBody || "{}") as typeof j;
      } catch {
        j = {};
      }
      if (!r.ok) {
        throw new Error(j.error ?? `Error ${r.status}`);
      }
      setColumnaCsvDetalle({
        dataFieldKey: String(j.dataFieldKey ?? ""),
        dataHeaderLabel: String(j.dataHeaderLabel ?? ""),
        actualizados: Number(j.actualizados ?? 0),
        ignoradosNoExiste: Number(j.ignoradosNoExiste ?? 0),
        omitidosSinExpediente: Array.isArray(j.omitidosSinExpediente)
          ? j.omitidosSinExpediente.map((n) => String(n).trim()).filter(Boolean)
          : [],
        filasVaciasOsinDato: Number(j.filasVaciasOsinDato ?? 0),
        errores: Array.isArray(j.errores) ? j.errores : [],
      });
      setColumnaCsvMsg("IMPORTACION TERMINADA.");
      await recargarColaboradores();
    } catch (e) {
      setColumnaCsvMsg(e instanceof Error ? e.message.toUpperCase() : "ERROR AL IMPORTAR CSV.");
    } finally {
      setColumnaCsvBusy(false);
    }
  }

  async function importarCsvMasivoDesdeArchivo(file: File | null) {
    if (!file) return;
    setMasivoCsvBusy(true);
    setMasivoCsvMsg(null);
    setMasivoCsvDetalle(null);
    try {
      const text = await file.text();
      const r = await fetch("/api/colaboradores/import-csv-masivo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          csvText: text,
          preserveMoper: masivoCsvPreserveMoper,
          mergeExisting: masivoCsvMergeExisting,
        }),
      });
      const rawBody = await r.text();
      const contentType = r.headers.get("content-type") ?? "";
      if (contentType.includes("text/html")) {
        throw new Error(
          "LA RUTA API NO RESPONDE (404 HTML). ABRE EL MODULO EN /colaboradores (NO /api/colaboradores). REINICIA npm run dev DENTRO DE LA CARPETA web.",
        );
      }
      let j: {
        error?: string;
        ok?: boolean;
        imported?: number;
        filasCsvValidas?: number;
        skippedEmpty?: number;
        lotes?: number;
        duplicateNosMerged?: number;
        resolvedByNombre?: number;
        avisos?: Array<{ row: number; message: string }>;
        errors?: Array<{ row: number; message: string }>;
      } = {};
      try {
        j = JSON.parse(rawBody || "{}") as typeof j;
      } catch {
        j = {};
      }
      if (!r.ok) {
        throw new Error(j.error ?? `Error ${r.status}`);
      }
      setMasivoCsvDetalle({
        imported: Number(j.imported ?? 0),
        filasCsvValidas: Number(j.filasCsvValidas ?? 0),
        skippedEmpty: Number(j.skippedEmpty ?? 0),
        lotes: Number(j.lotes ?? 0),
        duplicateNosMerged: Number(j.duplicateNosMerged ?? 0),
        resolvedByNombre: Number(j.resolvedByNombre ?? 0),
        errores: Array.isArray(j.errors) ? j.errors : [],
        avisos: Array.isArray(j.avisos) ? j.avisos : [],
      });
      setMasivoCsvMsg("IMPORTACION MASIVA TERMINADA.");
      await recargarColaboradores();
    } catch (e) {
      setMasivoCsvMsg(e instanceof Error ? e.message.toUpperCase() : "ERROR AL IMPORTAR CSV MASIVO.");
    } finally {
      setMasivoCsvBusy(false);
    }
  }

  function abrirExpediente(no: string) {
    setEditandoNo(null);
    setExpandido((prev) => (prev === no ? null : no));
  }

  function abrirEditor(no: string) {
    setExpandido(null);
    setEditandoNo((prev) => (prev === no ? null : no));
  }

  const serviciosUnicos = useMemo(() => {
    const s = new Set<string>();
    for (const r of rows) {
      const clave = claveServicioAgrupada(servicioLineaColaborador(r));
      if (clave) s.add(clave);
    }
    return [...s].sort((a, b) => a.localeCompare(b, "es"));
  }, [rows]);

  const zonasDisponibles = useMemo(() => {
    if (!servicioAgrupadoUsaZona(servicio)) return { labels: [] as string[], haySinSufijo: false };
    const set = new Set<string>();
    let haySinSufijo = false;
    for (const r of rows) {
      if (claveServicioAgrupada(servicioLineaColaborador(r)) !== servicio) continue;
      const z = zonaVarianteServicio(servicioLineaColaborador(r));
      if (!z) haySinSufijo = true;
      else set.add(z.toUpperCase());
    }
    return {
      labels: [...set].sort((a, b) => a.localeCompare(b, "es")),
      haySinSufijo,
    };
  }, [rows, servicio]);

  const filtrados = useMemo(() => {
    return rows.filter((c) => {
      const activo = colaboradorEstaActivoEnOperacion(c);
      if (filtroActivo === "activos" && !activo) return false;
      if (filtroActivo === "inactivos" && activo) return false;
      if (!fechaEnRangoIngreso(fechaIngresoNormalizadaColaborador(c), fechaDesde, fechaHasta)) return false;
      if (servicio && claveServicioAgrupada(servicioLineaColaborador(c)) !== servicio) return false;
      if (servicioAgrupadoUsaZona(servicio) && zona) {
        const zCol = zonaVarianteServicio(servicioLineaColaborador(c)).toUpperCase();
        if (zona === ZONA_FILTRO_SIN_SUFIJO) {
          if (zCol !== "") return false;
        } else if (zCol !== zona) return false;
      }
      if (!textoBusquedaCoincide(c, busqueda)) return false;
      return true;
    });
  }, [rows, busqueda, servicio, zona, fechaDesde, fechaHasta, filtroActivo]);

  function toggleSel(no: string) {
    setSeleccion((prev) => {
      const next = new Set(prev);
      if (next.has(no)) next.delete(no);
      else next.add(no);
      return next;
    });
  }

  function seleccionarTodosFiltrados() {
    setSeleccion(new Set(filtrados.map((r) => r.noEmpleado)));
  }

  function limpiarSeleccion() {
    setSeleccion(new Set());
  }

  function exportarCsv() {
    const usarSeleccion = seleccion.size > 0;
    const datos = usarSeleccion ? filtrados.filter((r) => seleccion.has(r.noEmpleado)) : filtrados;
    if (datos.length === 0) return;
    const csv = colaboradoresToCsv(datos);
    const suf = new Date().toISOString().slice(0, 10);
    downloadCsv(`colaboradores_tactical_${suf}.csv`, csv);
  }

  return (
    <div className="w-full">
        <div className="mb-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Modulo</p>
            <h1 className="text-3xl font-bold uppercase tracking-tight text-slate-900">COLABORADORES</h1>
            <p className="mt-1 text-sm font-medium leading-relaxed text-slate-800 sm:text-base">
              {soloLectura ? (
                esRolLegalSoloLectura(appRole) ? (
                  <>
                    Modo <strong>solo consulta</strong> (área legal). Expediente en lectura; sin datos de nómina. Usa <strong>Expediente</strong> para ver el
                    detalle. El <strong>historial MOPER</strong> global y por colaborador está en el modulo <strong>MOPER</strong> (solo lectura).
                  </>
                ) : (
                  <>
                    Modo <strong>solo consulta</strong> (sin datos de nómina en expediente). Usa filtros, <strong>marcar seleccion</strong> y{" "}
                    <strong>Exportar CSV</strong> con los expedientes filtrados o seleccionados.
                  </>
                )
              ) : puedeEditar ? (
                <>
                  Columna <strong>SERVICIO</strong> muestra la linea vigente (MOPER / ultimo movimiento si aplica). Busqueda, filtros y CSV conservan
                  tambien datos de alta. <strong>Editar</strong> abre el expediente y el catálogo de <strong>vacantes de Cuadrícula</strong> para corregir
                  servicio, planta y posición.
                </>
              ) : appRole === "gerente_rh" ? (
                <>
                  Modo <strong>solo consulta</strong> de expedientes aqui. Para registrar o editar movimientos de servicio y puesto usa el modulo{" "}
                  <strong>MOPER</strong>.
                </>
              ) : appRole === "editor_cuadricula" ? (
                <>
                  Modo <strong>solo consulta</strong> de expedientes. La captura de asistencia está en el modulo <strong>Cuadrícula</strong>. El historial MOPER
                  se consulta en <strong>MOPER</strong> (solo lectura).
                </>
              ) : (
                <>
                  Modo <strong>solo consulta</strong> (nominas). Usa <strong>Expediente</strong> para ver el detalle. Los movimientos MOPER los consultas en el
                  modulo <strong>MOPER</strong> (solo lectura).
                </>
              )}
            </p>
          </div>
        </div>

        {listaError ? (
          <div className="card mb-4 border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold uppercase text-red-900">
            {listaError}
          </div>
        ) : null}

        {puedeEditar ? (
          <section className="card mb-4 space-y-3 border border-sky-200 bg-sky-50/50">
            <h2 className="text-sm font-bold uppercase text-slate-900">Importar una columna (CSV)</h2>
            <p className="text-xs font-medium leading-relaxed text-slate-700">
              Archivo con <strong>dos columnas</strong>: primero el <strong>N° de empleado</strong> (cabeceras como NO_EMPLEADO, NO DE EMPLEADO, CLAVE) y
              <strong> una sola columna de dato</strong> (ej. ESTADO CIVIL, CURP, TELEFONO, SERVICIO, PLANTA, NO_SERVICIO). Se detecta el campo por el nombre de la cabecera. Solo se
              actualizan expedientes que <strong>ya existen</strong>; si el N° no esta en el sistema, la fila se <strong>ignora</strong>. Celdas vacias en
              la columna de dato no cambian el valor guardado. Si la columna es <strong>SERVICIO</strong> (o equivalente reconocido), se alinea tambien la
              linea vigente del listado (<code className="rounded bg-white/80 px-1">moperActual</code> y campos de servicio en expediente), igual que al guardar desde el editor.
            </p>
            <div className="flex flex-wrap items-center gap-3">
              <input
                type="file"
                accept=".csv,text/csv"
                disabled={columnaCsvBusy}
                className="max-w-full text-sm font-medium text-slate-800 file:mr-2 file:rounded-md file:border file:border-slate-300 file:bg-white file:px-3 file:py-1.5 file:text-xs file:font-bold file:uppercase"
                onChange={(e) => {
                  const f = e.target.files?.[0] ?? null;
                  e.target.value = "";
                  void importarCsvUnaColumnaDesdeArchivo(f);
                }}
              />
              {columnaCsvBusy ? <span className="text-xs font-bold uppercase text-slate-600">Procesando…</span> : null}
            </div>
            {columnaCsvMsg ? (
              <p
                className={`text-xs font-bold uppercase ${
                  columnaCsvMsg.includes("ERROR") || columnaCsvMsg.includes("NO ") ? "text-red-800" : "text-emerald-900"
                }`}
              >
                {columnaCsvMsg}
              </p>
            ) : null}
            {columnaCsvDetalle ? (
              <div className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-800">
                <p className="font-bold uppercase">
                  Campo detectado: {columnaCsvDetalle.dataFieldKey}{" "}
                  <span className="font-semibold normal-case text-slate-600">({columnaCsvDetalle.dataHeaderLabel})</span>
                </p>
                <ul className="mt-2 list-inside list-disc space-y-0.5 font-semibold uppercase">
                  <li>Expedientes actualizados: {columnaCsvDetalle.actualizados}</li>
                  <li>Filas ignoradas (N° sin expediente en sistema): {columnaCsvDetalle.ignoradosNoExiste}</li>
                  <li>Filas sin dato o vacias: {columnaCsvDetalle.filasVaciasOsinDato}</li>
                </ul>
                {columnaCsvDetalle.omitidosSinExpediente.length > 0 ? (
                  <div className="mt-2 border-t border-slate-100 pt-2">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="font-bold uppercase text-amber-900">
                        N° omitidos ({columnaCsvDetalle.omitidosSinExpediente.length})
                      </p>
                      <button
                        type="button"
                        className="rounded border border-amber-600 bg-amber-50 px-2 py-0.5 text-[10px] font-bold uppercase text-amber-950 hover:bg-amber-100"
                        onClick={() =>
                          downloadCsv(
                            "omitidos_sin_expediente.csv",
                            `\uFEFFno_de_empleado\n${columnaCsvDetalle.omitidosSinExpediente.join("\n")}\n`,
                          )
                        }
                      >
                        Descargar CSV
                      </button>
                    </div>
                    <pre className="mt-1 max-h-32 overflow-y-auto whitespace-pre-wrap font-mono text-[11px] font-medium normal-case text-amber-950">
                      {columnaCsvDetalle.omitidosSinExpediente.slice(0, 80).join("\n")}
                      {columnaCsvDetalle.omitidosSinExpediente.length > 80
                        ? `\n… (+${columnaCsvDetalle.omitidosSinExpediente.length - 80} más)`
                        : ""}
                    </pre>
                  </div>
                ) : null}
                {columnaCsvDetalle.errores.length > 0 ? (
                  <div className="mt-2 border-t border-slate-100 pt-2">
                    <p className="font-bold uppercase text-amber-900">Advertencias por fila</p>
                    <ul className="mt-1 max-h-32 overflow-y-auto font-mono text-[11px] font-medium normal-case text-amber-950">
                      {columnaCsvDetalle.errores.map((err) => (
                        <li key={`${err.row}-${err.message}`}>
                          Fila {err.row}: {err.message}
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}
              </div>
            ) : null}
          </section>
        ) : null}

        {puedeEditar ? (
          <section className="card mb-4 space-y-3 border border-emerald-200 bg-emerald-50/40">
            <h2 className="text-sm font-bold uppercase text-slate-900">Importar expedientes completos (CSV masivo)</h2>
            <p className="text-xs font-medium leading-relaxed text-slate-700">
              Un solo archivo con las <strong>5 partes del expediente</strong> (mismas columnas que Altas / plantilla{" "}
              <a className="font-bold text-emerald-900 underline" href="/plantillas/empleado_completo.csv" download>
                empleado_completo.csv
              </a>
              ). Hasta <strong>2.000 filas</strong> por archivo. La identificación prioriza{" "}
              <strong>nombre completo</strong> (o nombres + apellidos) sobre el N° de empleado; si falta N°, se busca coincidencia en BD, luego CURP/IMSS/RFC o N° auto.
              Para cargas historicas deja desmarcado <strong>Mezclar con expediente existente</strong> (sobrescribe campos vacios del CSV).
            </p>
            <div className="flex flex-wrap gap-4 text-xs font-semibold uppercase text-slate-800">
              <label className="flex cursor-pointer items-center gap-2">
                <input
                  type="checkbox"
                  checked={masivoCsvPreserveMoper}
                  disabled={masivoCsvBusy}
                  onChange={(e) => setMasivoCsvPreserveMoper(e.target.checked)}
                />
                Conservar linea MOPER vigente si el CSV no trae ULTIMO_SERVICIO
              </label>
              <label className="flex cursor-pointer items-center gap-2">
                <input
                  type="checkbox"
                  checked={masivoCsvMergeExisting}
                  disabled={masivoCsvBusy}
                  onChange={(e) => setMasivoCsvMergeExisting(e.target.checked)}
                />
                Mezclar con expediente existente (reimportacion parcial)
              </label>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <input
                type="file"
                accept=".csv,text/csv"
                disabled={masivoCsvBusy}
                className="max-w-full text-sm font-medium text-slate-800 file:mr-2 file:rounded-md file:border file:border-slate-300 file:bg-white file:px-3 file:py-1.5 file:text-xs file:font-bold file:uppercase"
                onChange={(e) => {
                  const f = e.target.files?.[0] ?? null;
                  e.target.value = "";
                  void importarCsvMasivoDesdeArchivo(f);
                }}
              />
              {masivoCsvBusy ? <span className="text-xs font-bold uppercase text-slate-600">Procesando en servidor…</span> : null}
            </div>
            {masivoCsvMsg ? (
              <p
                className={`text-xs font-bold uppercase ${
                  masivoCsvMsg.includes("ERROR") || masivoCsvMsg.includes("NO ") ? "text-red-800" : "text-emerald-900"
                }`}
              >
                {masivoCsvMsg}
              </p>
            ) : null}
            {masivoCsvDetalle ? (
              <div className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-800">
                <ul className="list-inside list-disc space-y-0.5 font-semibold uppercase">
                  <li>Expedientes guardados (N° unicos): {masivoCsvDetalle.imported}</li>
                  {masivoCsvDetalle.resolvedByNombre > 0 ? (
                    <li>Filas identificadas por nombre (N° reutilizado o corregido): {masivoCsvDetalle.resolvedByNombre}</li>
                  ) : null}
                  {masivoCsvDetalle.filasCsvValidas > masivoCsvDetalle.imported ? (
                    <li className="text-amber-900">
                      Filas validas en CSV: {masivoCsvDetalle.filasCsvValidas} (diferencia por N° repetidos u omitidos)
                    </li>
                  ) : null}
                  <li>Filas vacias omitidas: {masivoCsvDetalle.skippedEmpty}</li>
                  {masivoCsvDetalle.duplicateNosMerged > 0 ? (
                    <li className="text-amber-900">
                      Filas con N° de empleado repetido en el archivo (se guardó la última):{" "}
                      {masivoCsvDetalle.duplicateNosMerged}
                    </li>
                  ) : null}
                  <li>Lotes guardados en servidor: {masivoCsvDetalle.lotes}</li>
                </ul>
                {masivoCsvDetalle.avisos.length > 0 ? (
                  <div className="mt-2 border-t border-slate-100 pt-2">
                    <p className="font-bold uppercase text-sky-900">Avisos (fila importada)</p>
                    <ul className="mt-1 max-h-32 overflow-y-auto font-mono text-[11px] font-medium normal-case text-sky-950">
                      {masivoCsvDetalle.avisos.slice(0, 40).map((a) => (
                        <li key={`${a.row}-${a.message}`}>{a.message}</li>
                      ))}
                      {masivoCsvDetalle.avisos.length > 40 ? (
                        <li className="font-sans font-bold uppercase">… y {masivoCsvDetalle.avisos.length - 40} mas</li>
                      ) : null}
                    </ul>
                  </div>
                ) : null}
                {masivoCsvDetalle.errores.length > 0 ? (
                  <div className="mt-2 border-t border-slate-100 pt-2">
                    <p className="font-bold uppercase text-amber-900">Filas con error (no importadas)</p>
                    <ul className="mt-1 max-h-40 overflow-y-auto font-mono text-[11px] font-medium normal-case text-amber-950">
                      {masivoCsvDetalle.errores.slice(0, 80).map((err) => (
                        <li key={`${err.row}-${err.message}`}>
                          Fila {err.row}: {err.message}
                        </li>
                      ))}
                      {masivoCsvDetalle.errores.length > 80 ? (
                        <li className="font-sans font-bold uppercase">… y {masivoCsvDetalle.errores.length - 80} mas</li>
                      ) : null}
                    </ul>
                  </div>
                ) : null}
              </div>
            ) : null}
          </section>
        ) : null}

        <div className="card mb-4 space-y-4">
          <h2 className="text-sm font-bold uppercase text-slate-800">Filtros</h2>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-7">
            <label className="space-y-1 md:col-span-2 xl:col-span-1">
              <span className="form-label uppercase">Busqueda general</span>
              <input
                className="form-control uppercase"
                value={busqueda}
                onChange={(e) => setBusqueda(e.target.value)}
                placeholder="NUMERO, NOMBRE, NSS, TEXTO EN EXPEDIENTE..."
              />
            </label>
            <label className="space-y-1">
              <span className="form-label uppercase">Servicio asignado</span>
              <select
                className="form-control uppercase"
                value={servicio}
                onChange={(e) => {
                  setServicio(e.target.value);
                  setZona("");
                }}
              >
                <option value="">TODOS</option>
                {serviciosUnicos.map((sv) => (
                  <option key={sv} value={sv}>
                    {sv.toUpperCase()}
                  </option>
                ))}
              </select>
            </label>
            <label className="space-y-1">
              <span className="form-label uppercase">Zona (CAT / U-ERRE)</span>
              <select
                className="form-control uppercase"
                value={zona}
                onChange={(e) => setZona(e.target.value)}
                disabled={!servicioAgrupadoUsaZona(servicio)}
              >
                <option value="">TODAS</option>
                {zonasDisponibles.haySinSufijo ? (
                  <option value={ZONA_FILTRO_SIN_SUFIJO}>SIN ZONA (SOLO &quot;CAT&quot; O &quot;U-ERRE&quot;)</option>
                ) : null}
                {zonasDisponibles.labels.map((z) => (
                  <option key={z} value={z}>
                    {z}
                  </option>
                ))}
              </select>
            </label>
            <label className="space-y-1">
              <span className="form-label uppercase">Ingreso desde</span>
              <input className="form-control uppercase" type="date" value={fechaDesde} onChange={(e) => setFechaDesde(e.target.value)} />
              <span className="block text-[10px] font-medium uppercase leading-tight text-slate-400">
                Snapshot o fecha en expediente (Parte 1). Formatos DD/MM/AAAA reconocidos.
              </span>
            </label>
            <label className="space-y-1">
              <span className="form-label uppercase">Ingreso hasta</span>
              <input className="form-control uppercase" type="date" value={fechaHasta} onChange={(e) => setFechaHasta(e.target.value)} />
            </label>
            <label className="space-y-1">
              <span className="form-label uppercase">ESTATUS</span>
              <select
                className="form-control uppercase"
                value={filtroActivo}
                onChange={(e) => setFiltroActivo(e.target.value as "todos" | "activos" | "inactivos")}
              >
                <option value="todos">TODOS</option>
                <option value="activos">SOLO ACTIVOS (SIN BAJA VIGENTE)</option>
                <option value="inactivos">SOLO INACTIVOS (BAJA O INACTIVO)</option>
              </select>
            </label>
          </div>
          {mostrarCheckboxCsv ? (
            <div className="flex flex-wrap items-center gap-2 border-t border-slate-200 pt-4">
              <button type="button" className="btn-primary uppercase" onClick={exportarCsv} disabled={filtrados.length === 0}>
                Exportar CSV (Excel)
              </button>
              <span className="text-xs text-slate-500">
                {seleccion.size > 0
                  ? `EXPORTA ${seleccion.size} SELECCIONADO(S) DENTRO DEL FILTRO.`
                  : "SIN CASILLAS MARCA EXPORTA TODOS LOS RESULTADOS DEL FILTRO."}
              </span>
              <button type="button" className="btn-secondary uppercase text-xs" onClick={seleccionarTodosFiltrados}>
                Marcar todos (filtrados)
              </button>
              <button type="button" className="btn-secondary uppercase text-xs" onClick={limpiarSeleccion}>
                Quitar seleccion
              </button>
              <span className="ml-auto text-sm font-semibold text-slate-700">
                {filtrados.length} / {rows.length} COLABORADOR(ES)
              </span>
            </div>
          ) : (
            <div className="flex flex-wrap items-center gap-2 border-t border-slate-200 pt-4">
              <span className="ml-auto text-sm font-semibold text-slate-700">
                {filtrados.length} / {rows.length} COLABORADOR(ES)
              </span>
            </div>
          )}
        </div>

        <div className="table-wrap">
          <table className="w-max min-w-full border-collapse text-left text-sm sm:text-[15px]">
            <colgroup>
              {mostrarCheckboxCsv ? <col className="w-10" /> : null}
              <col className="w-[5.5rem]" />
              <col className="w-[6.75rem]" />
              <col className="min-w-[12rem] w-[26%]" />
              <col className="min-w-[9rem] w-[18%]" />
              <col className="w-[7rem]" />
              <col className="w-[6.5rem]" />
              <col className="w-[8.5rem]" />
            </colgroup>
            <thead className="table-head">
              <tr>
                {mostrarCheckboxCsv ? <th className="w-10 px-2 py-2.5"></th> : null}
                <th className="whitespace-nowrap px-3 py-2.5 sm:px-4">NO. EMPLEADO</th>
                <th className="whitespace-nowrap px-3 py-2.5 sm:px-4">FECHA INGRESO</th>
                <th className="px-3 py-2.5 sm:px-4">NOMBRE</th>
                <th className="whitespace-nowrap px-3 py-2.5 sm:px-4">SERVICIO</th>
                <th className="whitespace-nowrap px-3 py-2.5 sm:px-4">PUESTO</th>
                <th className="whitespace-nowrap px-3 py-2.5 sm:px-4">ESTADO</th>
                <th className="sticky right-0 z-10 whitespace-nowrap bg-slate-100 px-3 py-2.5 text-right shadow-[-8px_0_12px_-8px_rgba(15,23,42,0.12)] sm:px-4">
                  ACCIONES
                </th>
              </tr>
            </thead>
            <tbody>
              {filtrados.map((c) => (
                <Fragment key={c.noEmpleado}>
                  <tr className="group table-row-hover">
                    {mostrarCheckboxCsv ? (
                      <td className="table-cell px-2">
                        <input
                          type="checkbox"
                          className="h-4 w-4 rounded border-slate-300"
                          checked={seleccion.has(c.noEmpleado)}
                          onChange={() => toggleSel(c.noEmpleado)}
                          aria-label={`Seleccionar ${c.noEmpleado}`}
                        />
                      </td>
                    ) : null}
                    <td className="table-cell whitespace-nowrap font-mono font-medium">{c.noEmpleado}</td>
                    <td className="table-cell whitespace-nowrap tabular-nums">{ingresoMostrarEnTabla(c)}</td>
                    <td
                      className="table-cell min-w-[12rem] max-w-[24rem] font-medium leading-snug text-slate-900"
                      title={c.nombreCompleto || undefined}
                    >
                      <span className="line-clamp-2 break-words">{c.nombreCompleto || "—"}</span>
                    </td>
                    <td className="table-cell whitespace-nowrap text-slate-700" title={servicioLineaColaborador(c) || undefined}>
                      {servicioLineaColaborador(c) || "—"}
                    </td>
                    <td className="table-cell whitespace-nowrap" title={c.moperActual?.puesto || c.puesto || undefined}>
                      {c.moperActual?.puesto?.trim() || c.puesto?.trim() || "—"}
                    </td>
                    <td className="table-cell align-middle whitespace-nowrap">
                      {!colaboradorEstaActivoEnOperacion(c) ? (
                        <span
                          className="inline-block rounded-md bg-slate-200 px-2.5 py-1 text-xs font-bold uppercase tracking-wide text-slate-800 ring-1 ring-slate-300/80"
                          title={
                            formatoFechaDiaMesAnio(String(c.form.fechaBaja ?? "").trim(), { conHora: false })
                              ? `Baja: ${formatoFechaDiaMesAnio(String(c.form.fechaBaja ?? "").trim(), { conHora: false })}`
                              : undefined
                          }
                        >
                          Inactivo
                        </span>
                      ) : (
                        <span className="inline-block rounded-md bg-emerald-100 px-2.5 py-1 text-xs font-bold uppercase tracking-wide text-emerald-900 ring-1 ring-emerald-200/80">
                          Activo
                        </span>
                      )}
                    </td>
                    <td className="table-cell sticky right-0 z-10 bg-white text-right shadow-[-8px_0_12px_-8px_rgba(15,23,42,0.08)] group-hover:bg-slate-50/95">
                      <div className="flex flex-col items-end gap-1 whitespace-nowrap sm:flex-row sm:justify-end sm:gap-2">
                        <button
                          type="button"
                          className="link-action text-sm uppercase"
                          onClick={() => abrirExpediente(c.noEmpleado)}
                        >
                          {expandido === c.noEmpleado ? "Ocultar" : "Expediente"}
                        </button>
                        {puedeEditar ? (
                          <button
                            type="button"
                            className="link-action text-sm font-bold uppercase text-blue-900"
                            onClick={() => abrirEditor(c.noEmpleado)}
                          >
                            {editandoNo === c.noEmpleado ? "Cerrar edicion" : "Editar"}
                          </button>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                  {puedeEditar && editandoNo === c.noEmpleado ? (
                    <tr className="bg-blue-50/80">
                      <td colSpan={colSpan} className="border-t border-blue-200 px-4 py-4">
                        <EditorExpedienteCompleto
                          key={c.noEmpleado}
                          colaborador={c}
                          catalogoServicios={catalogoServicios}
                          editarVacantesCuadricula={puedeEditarVacantes}
                          onCancel={() => setEditandoNo(null)}
                          onGuardado={async (guardado) => {
                            setRows((prev) =>
                              prev.map((r) => (r.noEmpleado === guardado.noEmpleado ? guardado : r)),
                            );
                            setEditandoNo(null);
                            await recargarColaboradores();
                          }}
                        />
                      </td>
                    </tr>
                  ) : expandido === c.noEmpleado ? (
                    <tr className="bg-slate-50">
                      <td colSpan={colSpan} className="border-t border-slate-200 px-4 py-4">
                        <DetalleExpediente c={c} ocultarNomina={soloLectura} catalogoServicios={catalogoServicios} />
                      </td>
                    </tr>
                  ) : null}
                </Fragment>
              ))}
            </tbody>
          </table>
          {filtrados.length === 0 ? (
            <p className="p-8 text-center text-sm text-slate-600">
              {rows.length === 0
                ? "NO HAY COLABORADORES GUARDADOS. REGISTRALOS EN ALTAS Y FINALIZA LA CAPTURA."
                : "NINGUN REGISTRO COINCIDE CON LOS FILTROS."}
            </p>
          ) : null}
        </div>
    </div>
  );
}

function DetalleExpediente({
  c,
  ocultarNomina,
  catalogoServicios = [],
}: {
  c: ColaboradorCompleto;
  ocultarNomina?: boolean;
  catalogoServicios?: CatalogoServicioItem[];
}) {
  const partesAltas = useMemo(() => (ocultarNomina ? ([1, 2, 3] as const) : ([1, 2, 3, 4] as const)), [ocultarNomina]);
  const gruposPartes = useMemo(() => groupFormByAltasPartes(c.form), [c.form]);
  const porParte = useMemo(() => {
    const m = new Map<number, FormParteGrupo>();
    for (const g of gruposPartes) {
      if (g.parte >= 1) m.set(g.parte, g);
    }
    return m;
  }, [gruposPartes]);
  const otrosCampos = useMemo(() => gruposPartes.find((g) => g.parte === 0), [gruposPartes]);
  const [historialMoper, setHistorialMoper] = useState<MoperHistorialEntrada[]>([]);
  const [histCargando, setHistCargando] = useState(true);
  const [histError, setHistError] = useState<string | null>(null);

  useEffect(() => {
    let cancel = false;
    (async () => {
      setHistCargando(true);
      setHistError(null);
      try {
        const h = await listMoperHistorialPorEmpleado(c.noEmpleado);
        if (!cancel) {
          setHistorialMoper(h);
          setHistCargando(false);
        }
      } catch (e) {
        if (!cancel) {
          setHistorialMoper([]);
          setHistError(e instanceof Error ? e.message : "ERROR AL CARGAR HISTORIAL.");
          setHistCargando(false);
        }
      }
    })();
    return () => {
      cancel = true;
    };
  }, [c.noEmpleado]);

  return (
    <div className="flex flex-col gap-6 text-sm sm:text-base">
      <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <h3 className="mb-3 text-xs font-bold uppercase tracking-wide text-slate-500 sm:text-sm">Resumen guardado</h3>
        <ul className="grid gap-3 text-slate-800 sm:grid-cols-2 lg:grid-cols-3">
          <li className="min-w-0 break-words">
            <strong className="text-slate-600">SERVICIO (VIGENTE):</strong> {servicioLineaColaborador(c) || "—"}
          </li>
          <li className="min-w-0 break-words">
            <strong className="text-slate-600">N.º SERVICIO:</strong> {noServicioColaborador(c, catalogoServicios) || "—"}
          </li>
          <li className="min-w-0 break-words">
            <strong className="text-slate-600">POSICIÓN (PUESTO EN PLANTA):</strong>{" "}
            {posicionLaboralColaborador(c, catalogoServicios) || "—"}
          </li>
          <li className="min-w-0 break-words">
            <strong className="text-slate-600">PLANTA:</strong> {plantaColaborador(c, catalogoServicios) || "—"}
          </li>
          <li className="min-w-0 break-words">
            <strong className="text-slate-600">PUESTO (VIGENTE):</strong> {c.moperActual?.puesto || c.puesto || "—"}
          </li>
          <li className="min-w-0 break-words">
            <strong className="text-slate-600">NSS (IMSS):</strong>{" "}
            {String(c.form?.imss ?? c.nss ?? "").trim() || "—"}
          </li>
          <li className="min-w-0 break-words">
            <strong className="text-slate-600">ULTIMO SERVICIO (MOPER):</strong> {c.ultimoServicio || "—"}
          </li>
          <li className="min-w-0 break-words">
            <strong className="text-slate-600">REGISTRADO EN:</strong>{" "}
            {c.registeredAt ? formatoFechaDiaMesAnio(c.registeredAt) : "—"}
          </li>
        </ul>
      </section>

      <div className="space-y-5">
        <h3 className="text-xs font-bold uppercase tracking-[0.12em] text-slate-500 sm:text-sm">Expediente ALTAS (por parte)</h3>
        {ocultarNomina ? (
          <p className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs leading-relaxed text-slate-600 sm:text-sm">
            La sección de nómina / datos bancarios no se muestra en tu perfil.
          </p>
        ) : null}
        {partesAltas.map((num) => (
          <ExpedienteBloqueParte
            key={`parte-${num}`}
            titulo={ALTAS_ETIQUETA_PARTE_IMPORT[num] ?? `PARTE ${num}`}
            grupo={porParte.get(num)}
            form={c.form ?? {}}
          />
        ))}

        <section className="rounded-xl border border-slate-200 bg-slate-50/80 p-4">
          <h4 className="mb-2 border-b border-slate-200 pb-2 text-sm font-bold uppercase text-slate-800">
            {ALTAS_ETIQUETA_PARTE_IMPORT[5]}
          </h4>
          {c.familiares.length === 0 ? (
            <p className="text-slate-500">SIN REGISTROS DE FAMILIARES.</p>
          ) : (
            <ul className="list-disc space-y-2 pl-5 text-sm leading-relaxed text-slate-800 sm:text-base">
              {c.familiares.map((f, i) => (
                <li key={i} className="break-words">
                  {f.nombreFamiliar.toUpperCase()} — {f.parentesco.toUpperCase()} — NAC.:{" "}
                  {formatoFechaDiaMesAnio(String(f.fechaNacimiento ?? "").trim(), { conHora: false })} — BEN.: {f.beneficiarioBancario}
                </li>
              ))}
            </ul>
          )}
        </section>

        <ExpedienteBloqueParte titulo={ALTAS_ETIQUETA_PARTE_IMPORT[6] ?? "MOPER"} grupo={porParte.get(6)} form={c.form ?? {}} />

        {otrosCampos ? (
          <ExpedienteBloqueParte titulo={otrosCampos.titulo} grupo={otrosCampos} form={c.form ?? {}} />
        ) : null}
      </div>

      <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <h3 className="mb-2 text-xs font-bold uppercase tracking-wide text-slate-500 sm:text-sm">Historial MOPER</h3>
        <p className="mb-2 text-xs leading-relaxed text-slate-500 sm:text-sm">
          Movimientos registrados desde el modulo MOPER (mas recientes arriba).
          {histCargando ? " CARGANDO…" : ` ${historialMoper.length} MOVIMIENTO(S).`}
        </p>
        {histError ? (
          <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-3 text-xs font-semibold uppercase text-amber-950">
            {histError}
          </p>
        ) : histCargando ? (
          <p className="text-slate-500">CARGANDO HISTORIAL…</p>
        ) : historialMoper.length === 0 ? (
          <p className="rounded-lg border border-slate-200 bg-white px-3 py-3 text-slate-600">
            SIN MOVIMIENTOS MOPER PARA ESTE COLABORADOR.
          </p>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
            <table className="min-w-[900px] w-full text-left text-[13px] sm:text-sm">
              <thead className="border-b border-slate-200 bg-slate-100 text-[11px] font-bold uppercase tracking-wide text-slate-600 sm:text-xs">
                <tr>
                  <th className="whitespace-nowrap px-3 py-2">Fecha</th>
                  <th className="whitespace-nowrap px-3 py-2">Serv. inicial</th>
                  <th className="whitespace-nowrap px-3 py-2">Serv. final</th>
                  <th className="whitespace-nowrap px-3 py-2">Puesto inicial</th>
                  <th className="whitespace-nowrap px-3 py-2">Puesto final</th>
                  <th className="min-w-[120px] px-3 py-2">Motivo</th>
                  <th className="min-w-[140px] px-3 py-2">Especificacion</th>
                </tr>
              </thead>
              <tbody>
                {historialMoper.map((mov, idx) => (
                  <HistorialMoperFila key={`${mov.registradoEn}-${idx}`} mov={mov} />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}

function ExpedienteBloqueParte({
  titulo,
  grupo,
  form = {},
}: {
  titulo: string;
  grupo?: FormParteGrupo;
  form?: Record<string, string>;
}) {
  const hay = grupo && grupo.entries.length > 0;
  const fechaNacimientoExp =
    String(form.fechaNacimiento ?? "").trim() ||
    String(grupo?.entries.find((e) => e.key === "fechaNacimiento")?.value ?? "").trim();

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <h4 className="mb-3 border-b border-slate-100 pb-2 text-sm font-bold uppercase text-slate-800 sm:text-base">{titulo}</h4>
      {!hay || !grupo ? (
        <p className="text-xs italic leading-relaxed text-slate-500 sm:text-sm">SIN DATOS CAPTURADOS EN ESTA PARTE.</p>
      ) : (
        <div className="grid max-h-[min(28rem,50vh)] grid-cols-1 gap-x-6 gap-y-3 overflow-auto sm:grid-cols-2 lg:grid-cols-3">
          {grupo.entries.map(({ key, label, value }) => {
            const mostrar =
              key === "edad"
                ? textoEdadDesdeExpediente(fechaNacimientoExp, String(value))
                : String(value);
            const etiqueta = key === "edad" ? `${label} (AL DÍA DE HOY)` : label;
            return (
              <div key={key} className="min-w-0">
                <p className="text-xs font-semibold uppercase leading-snug text-slate-500 sm:text-sm">{etiqueta}</p>
                <p className="mt-0.5 break-words font-mono text-sm uppercase leading-snug text-slate-900 sm:text-base">
                  {mostrar.trim() ? mostrar.toUpperCase() : "—"}
                </p>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}

function HistorialMoperFila({ mov }: { mov: MoperHistorialEntrada }) {
  const celda =
    "border-b border-slate-100 px-2 py-2.5 align-top text-[13px] uppercase leading-snug text-slate-800 sm:px-3 sm:text-sm";
  return (
    <tr className="hover:bg-slate-50">
      <td className={`${celda} whitespace-nowrap font-mono text-xs text-slate-600 sm:text-[13px]`}>
        {formatoFechaDiaMesAnio(mov.registradoEn)}
      </td>
      <td className={celda}>{mov.servicioInicial.trim() || "—"}</td>
      <td className={celda}>{mov.servicioFinal.trim() || "—"}</td>
      <td className={celda}>{mov.puestoInicial.trim() || "—"}</td>
      <td className={celda}>{mov.puestoFinal.trim() || "—"}</td>
      <td className={`${celda} max-w-[min(100vw,18rem)] break-words sm:max-w-[14rem]`}>{mov.motivo.trim() || "—"}</td>
      <td className={`${celda} max-w-[min(100vw,18rem)] break-words sm:max-w-[14rem]`}>{mov.especificacion.trim() || "—"}</td>
    </tr>
  );
}
