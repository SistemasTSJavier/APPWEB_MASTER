import type { ColaboradorCompleto } from "@/lib/colaboradores-types";
import {
  nombreServicioCatalogoColaborador,
  noServicioColaborador,
  plantaExpedienteColaborador,
  posicionLaboralColaborador,
} from "@/lib/colaboradores-catalogo-display";

export { plantaExpedienteColaborador } from "@/lib/colaboradores-catalogo-display";
import {
  colaboradorTieneBaja,
  fechaBajaNormalizadaColaborador,
  fechaIngresoNormalizadaColaborador,
} from "@/lib/colaboradores-baja";
import { formatoDesdeYyyyMmDd } from "@/lib/fecha-formato-display";
import type { CatalogoServicioItem } from "@/lib/servicios-catalogo-client";
import { claveServicioAgrupada, servicioLineaColaborador } from "@/lib/servicio-agrupacion";
import type { EmpleadoIncidenciaMock } from "./incidenciasEmployeesMock";
import type { BajasRow } from "./bajasMock";
import { emptyBajasShifts } from "./bajasMock";
import type { GridRow } from "./mockData";
import { emptyShifts, WEEK_COLUMNS, ZERO_TOTALS } from "./mockData";

function normTxt(s: string): string {
  return s.trim().replace(/\s+/g, " ").toUpperCase();
}

/**
 * ¿La línea de servicio vigente del colaborador corresponde al nombre del catálogo?
 */
export function coincideColaboradorServicioCatalogo(
  c: ColaboradorCompleto,
  catalogNombre: string,
): boolean {
  const linea = normTxt(servicioLineaColaborador(c));
  const cat = normTxt(catalogNombre);
  if (!linea || !cat) return false;
  if (linea === cat) return true;
  const kl = claveServicioAgrupada(linea);
  const kc = claveServicioAgrupada(cat);
  if (kl && kc && kl === kc) return true;
  if (linea.includes(cat) || cat.includes(linea)) return true;
  return false;
}

export function colaboradoresActivosPorServicioCatalogo(
  lista: ColaboradorCompleto[],
  catalogNombre: string,
): ColaboradorCompleto[] {
  return lista
    .filter((c) => !colaboradorTieneBaja(c) && coincideColaboradorServicioCatalogo(c, catalogNombre))
    .sort((a, b) => a.noEmpleado.localeCompare(b.noEmpleado, "es", { numeric: true }));
}

/** Clave estable para localStorage de asistencia por planta. */
export function plantaToStorageKey(planta: string): string {
  const n = normTxt(planta);
  return n ? `planta:${n}` : "";
}

export function plantaFromStorageKey(key: string): string {
  const k = key.trim();
  if (!k.startsWith("planta:")) return "";
  return k.slice(7).trim();
}

export function coincideColaboradorPlantaExpediente(c: ColaboradorCompleto, planta: string): boolean {
  const p = normTxt(planta);
  if (!p) return false;
  return normTxt(plantaExpedienteColaborador(c)) === p;
}

/** Activos con la misma planta en expediente. */
export function colaboradoresActivosPorPlanta(lista: ColaboradorCompleto[], planta: string): ColaboradorCompleto[] {
  return lista.filter((c) => !colaboradorTieneBaja(c) && coincideColaboradorPlantaExpediente(c, planta));
}

/** Activos y dados de baja con la misma planta (lista de asistencia con historial). */
export function colaboradoresParaAsistenciaPorPlanta(
  lista: ColaboradorCompleto[],
  planta: string,
): ColaboradorCompleto[] {
  return lista
    .filter((c) => coincideColaboradorPlantaExpediente(c, planta))
    .sort((a, b) => a.noEmpleado.localeCompare(b.noEmpleado, "es", { numeric: true }));
}

/** Plantas en expediente (activos y bajas) para selector de cuadrícula. */
export function listarPlantasParaAsistencia(lista: ColaboradorCompleto[]): string[] {
  const set = new Set<string>();
  for (const c of lista) {
    const p = normTxt(plantaExpedienteColaborador(c));
    if (p) set.add(p);
  }
  return [...set].sort((a, b) => a.localeCompare(b, "es", { numeric: true }));
}

/** Agrupa por planta todos los colaboradores con planta en expediente (incluye bajas). */
export function mapaColaboradoresParaAsistenciaPorPlanta(
  lista: ColaboradorCompleto[],
): Map<string, ColaboradorCompleto[]> {
  const map = new Map<string, ColaboradorCompleto[]>();
  for (const c of lista) {
    const p = normTxt(plantaExpedienteColaborador(c));
    if (!p) continue;
    const bucket = map.get(p);
    if (bucket) bucket.push(c);
    else map.set(p, [c]);
  }
  return map;
}

/** Servicios distintos (línea vigente) entre colaboradores activos, para filtro en vista global. */
export function listarServiciosLineaActivos(lista: ColaboradorCompleto[]): string[] {
  const set = new Set<string>();
  for (const c of lista) {
    if (colaboradorTieneBaja(c)) continue;
    const s = normTxt(servicioLineaColaborador(c));
    if (s) set.add(s);
  }
  return [...set].sort((a, b) => a.localeCompare(b, "es", { numeric: true }));
}

/** Activos agrupados por planta (una pasada; evita filtrar la lista por cada planta). */
export function mapaColaboradoresActivosPorPlanta(
  lista: ColaboradorCompleto[],
): Map<string, ColaboradorCompleto[]> {
  const map = new Map<string, ColaboradorCompleto[]>();
  for (const c of lista) {
    if (colaboradorTieneBaja(c)) continue;
    const p = normTxt(plantaExpedienteColaborador(c));
    if (!p) continue;
    const bucket = map.get(p);
    if (bucket) bucket.push(c);
    else map.set(p, [c]);
  }
  return map;
}

/** Plantas distintas solo de colaboradores activos (campo planta en expediente). */
export function listarPlantasDeColaboradores(lista: ColaboradorCompleto[]): string[] {
  const set = new Set<string>();
  for (const c of lista) {
    if (colaboradorTieneBaja(c)) continue;
    const p = normTxt(plantaExpedienteColaborador(c));
    if (p) set.add(p);
  }
  return [...set].sort((a, b) => a.localeCompare(b, "es"));
}

/** @deprecated Use listarPlantasDeColaboradores */
export function listarPlantasDistintas(lista: ColaboradorCompleto[], _catalogo: CatalogoServicioItem[] = []): string[] {
  return listarPlantasDeColaboradores(lista);
}

export function gridRowServiceNo(row: GridRow): string {
  return (row.rowServiceNo ?? "").trim();
}

export function colaboradoresConBajaPorServicioCatalogo(
  lista: ColaboradorCompleto[],
  catalogNombre: string,
): ColaboradorCompleto[] {
  return lista
    .filter((c) => colaboradorTieneBaja(c) && coincideColaboradorServicioCatalogo(c, catalogNombre))
    .sort((a, b) => a.noEmpleado.localeCompare(b.noEmpleado, "es", { numeric: true }));
}

/** Bajas que coinciden con al menos uno de los nombres de catálogo seleccionados. */
export function colaboradoresConBajaPorServiciosCatalogo(
  lista: ColaboradorCompleto[],
  catalogNombres: string[],
): ColaboradorCompleto[] {
  const nombres = catalogNombres.map((n) => n.trim()).filter(Boolean);
  if (nombres.length === 0) return [];
  return lista
    .filter(
      (c) =>
        colaboradorTieneBaja(c) &&
        nombres.some((nombre) => coincideColaboradorServicioCatalogo(c, nombre)),
    )
    .sort((a, b) => a.noEmpleado.localeCompare(b.noEmpleado, "es", { numeric: true }));
}

export function colaboradorToGridRow(
  c: ColaboradorCompleto,
  catalogo: CatalogoServicioItem[] = [],
  plantaContexto?: string,
): GridRow {
  const n = fechaIngresoNormalizadaColaborador(c);
  const hire =
    n ? formatoDesdeYyyyMmDd(n) : String(c.fechaIngreso ?? c.form?.fechaIngreso ?? "").trim().toUpperCase() || "—";
  const plantaCtx = plantaContexto?.trim() || plantaExpedienteColaborador(c);
  const catalogoOpts = plantaCtx ? { plantaContexto: plantaCtx } : undefined;
  const linea = nombreServicioCatalogoColaborador(c, catalogo, catalogoOpts);
  return {
    id: c.noEmpleado,
    position: (posicionLaboralColaborador(c, catalogo) || "").trim().toUpperCase() || "—",
    role: (c.puesto || "").trim().toUpperCase() || "—",
    hireDate: hire,
    employeeNo: c.noEmpleado,
    name: (c.nombreCompleto || "").trim().toUpperCase() || "—",
    rowServiceNo: noServicioColaborador(c, catalogo, catalogoOpts),
    servicioLinea: linea || "—",
    plantaLinea: normTxt(plantaCtx) || undefined,
    vacant: false,
    shifts: emptyShifts(WEEK_COLUMNS.length),
    totals: { ...ZERO_TOTALS },
  };
}

export function colaboradorToEmpleadoIncidencia(c: ColaboradorCompleto): EmpleadoIncidenciaMock {
  const n = fechaIngresoNormalizadaColaborador(c);
  const fIngreso =
    n ? formatoDesdeYyyyMmDd(n) : String(c.fechaIngreso ?? c.form?.fechaIngreso ?? "").trim().toUpperCase() || "—";
  return {
    id: c.noEmpleado,
    nombres: (c.nombreCompleto || "").trim().toUpperCase() || "—",
    noEmpleado: c.noEmpleado,
    fIngreso,
    servicio: servicioLineaColaborador(c) || "—",
  };
}

export function colaboradorConBajaToBajasRow(
  c: ColaboradorCompleto,
  catalogNombre: string,
  noServicioCatalogo: string,
): BajasRow {
  const n = fechaIngresoNormalizadaColaborador(c);
  const fechaIngreso =
    n ? formatoDesdeYyyyMmDd(n) : String(c.fechaIngreso ?? c.form?.fechaIngreso ?? "").trim().toUpperCase() || "—";
  const fb = fechaBajaNormalizadaColaborador(c);
  const fechaBaja = fb ? formatoDesdeYyyyMmDd(fb) : "—";
  return {
    id: c.noEmpleado,
    servicio: catalogNombre.trim().toUpperCase(),
    noServicio: noServicioCatalogo.trim(),
    planta: plantaExpedienteColaborador(c).trim().toUpperCase() || "—",
    posicion: (posicionLaboralColaborador(c) || "").trim().toUpperCase() || "—",
    puesto: (c.puesto || "").trim().toUpperCase() || "—",
    fechaIngreso,
    noEmpleado: c.noEmpleado,
    nombres: (c.nombreCompleto || "").trim().toUpperCase() || "—",
    fechaBaja,
    shifts: emptyBajasShifts(),
  };
}

export function colaboradoresActivosTodos(lista: ColaboradorCompleto[]): ColaboradorCompleto[] {
  return lista
    .filter((c) => !colaboradorTieneBaja(c))
    .sort((a, b) => a.noEmpleado.localeCompare(b.noEmpleado, "es", { numeric: true }));
}

/** Todos los colaboradores con N° de empleado (activos y bajas) para Consulta asistencia. */
export function colaboradoresParaConsultaAsistencia(lista: ColaboradorCompleto[]): ColaboradorCompleto[] {
  return lista
    .filter((c) => c.noEmpleado.trim())
    .sort((a, b) => a.noEmpleado.localeCompare(b.noEmpleado, "es", { numeric: true }));
}

export function estatusExpedienteColaborador(c: ColaboradorCompleto): "ACTIVO" | "BAJA" {
  return colaboradorTieneBaja(c) ? "BAJA" : "ACTIVO";
}

export function fechaBajaDisplayColaborador(c: ColaboradorCompleto): string {
  const fb = fechaBajaNormalizadaColaborador(c);
  return fb ? formatoDesdeYyyyMmDd(fb) : "—";
}

export function fechaIngresoDisplayColaborador(c: ColaboradorCompleto): string {
  const n = fechaIngresoNormalizadaColaborador(c);
  return n
    ? formatoDesdeYyyyMmDd(n)
    : String(c.fechaIngreso ?? c.form?.fechaIngreso ?? "").trim() || "—";
}
