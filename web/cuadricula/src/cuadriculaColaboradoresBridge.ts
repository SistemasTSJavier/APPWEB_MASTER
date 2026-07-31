import { canonicalEmpNoAttendance } from "@/lib/attendance-emp-no";
import type { ColaboradorCompleto } from "@/lib/colaboradores-types";
import {
  nombreServicioCatalogoColaborador,
  noServicioColaborador,
  plantaColaborador,
  plantaExpedienteColaborador,
  posicionLaboralColaborador,
  reconcileRowServiceNo,
} from "@/lib/colaboradores-catalogo-display";

export { plantaExpedienteColaborador } from "@/lib/colaboradores-catalogo-display";
import {
  colaboradorActivoPorEstatusYNumero,
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
    .filter((c) => colaboradorActivoParaCapturaAsistencia(c) && coincideColaboradorServicioCatalogo(c, catalogNombre))
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

/**
 * Quién entra a la cuadrícula de asistencia: solo N.º de empleado + estatus
 * (ACTIVO; excluye INACTIVO y BAJA). La asistencia se empareja por N.º.
 */
export function colaboradorActivoParaCapturaAsistencia(c: ColaboradorCompleto): boolean {
  return colaboradorActivoPorEstatusYNumero(c);
}

/** Lista precalculada de activos para cuadrícula (evita mezclar bajas/inactivos). */
export function filtrarColaboradoresActivosCaptura(lista: ColaboradorCompleto[]): ColaboradorCompleto[] {
  return lista.filter(colaboradorActivoParaCapturaAsistencia);
}

/** Planta usada cuando el activo aún no tiene planta en expediente ni catálogo. */
export const PLANTA_CAPTURA_SIN_ASIGNAR = "SIN PLANTA";

/**
 * Planta única del colaborador (misma resolución que pantalla Colaboradores:
 * expediente primero, catálogo si falta). Un empleado → una sola planta.
 * Si no hay planta, usa SIN PLANTA para que el activo igual entre a captura.
 */
export function plantaCapturaColaborador(
  c: ColaboradorCompleto,
  catalogo: CatalogoServicioItem[] = [],
): string {
  return (
    normTxt(plantaColaborador(c, catalogo) || plantaExpedienteColaborador(c)) ||
    PLANTA_CAPTURA_SIN_ASIGNAR
  );
}

/** Activos con la misma planta en expediente. */
export function colaboradoresActivosPorPlanta(lista: ColaboradorCompleto[], planta: string): ColaboradorCompleto[] {
  const p = normTxt(planta);
  if (!p) return [];
  return lista.filter(
    (c) => colaboradorActivoParaCapturaAsistencia(c) && normTxt(plantaExpedienteColaborador(c)) === p,
  );
}

/**
 * Lista estable para captura semanal: activos de la planta, orden por N.º.
 * Misma base en todas las semanas; identidad siempre desde Colaboradores.
 */
export function colaboradoresActivosParaCapturaPlanta(
  lista: ColaboradorCompleto[],
  planta: string,
  catalogo: CatalogoServicioItem[] = [],
): ColaboradorCompleto[] {
  const p = normTxt(planta);
  if (!p) return [];
  return lista
    .filter(
      (c) =>
        colaboradorActivoParaCapturaAsistencia(c) && plantaCapturaColaborador(c, catalogo) === p,
    )
    .sort((a, b) => a.noEmpleado.localeCompare(b.noEmpleado, "es", { numeric: true }));
}

/** Nombre de planta normalizado, igual que las claves de los desplegables de captura. */
export function normPlantaCapturaNombre(p: string): string {
  return normTxt(p);
}

/**
 * Agrupa SOLO activos por planta en una pasada (mismas claves que
 * `listarPlantasCapturaAsistencia`). Equivale a llamar
 * `colaboradoresActivosParaCapturaPlanta` por cada planta, sin recorrer la
 * lista completa una vez por planta.
 * Activos sin planta van a {@link PLANTA_CAPTURA_SIN_ASIGNAR}.
 */
export function agruparActivosPorPlantaCaptura(
  lista: ColaboradorCompleto[],
  catalogo: CatalogoServicioItem[] = [],
): Map<string, ColaboradorCompleto[]> {
  const map = new Map<string, ColaboradorCompleto[]>();
  for (const c of lista) {
    if (!colaboradorActivoParaCapturaAsistencia(c)) continue;
    const p = plantaCapturaColaborador(c, catalogo);
    const arr = map.get(p);
    if (arr) arr.push(c);
    else map.set(p, [c]);
  }
  for (const arr of map.values()) {
    arr.sort((a, b) => a.noEmpleado.localeCompare(b.noEmpleado, "es", { numeric: true }));
  }
  return map;
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

/** Sin planta capturada en expediente (pendiente de asignar). */
export function colaboradorSinPlantaEnExpediente(c: ColaboradorCompleto): boolean {
  return !normTxt(plantaExpedienteColaborador(c));
}

/**
 * Para importar/guardar asistencia en la planta en pantalla:
 * coincide planta en expediente O aún no tiene planta (servicio/planta pendientes).
 */
export function colaboradorPertenecePlantaAsistencia(
  c: ColaboradorCompleto,
  planta: string,
): boolean {
  const p = normTxt(planta);
  if (!p) return true;
  const exp = normTxt(plantaExpedienteColaborador(c));
  if (!exp) return true;
  return exp === p;
}

/** Activos y bajas visibles al importar CSV en una planta (incluye quienes aún no tienen planta en expediente). */
export function colaboradoresParaAsistenciaCsvImport(
  lista: ColaboradorCompleto[],
  planta: string,
): ColaboradorCompleto[] {
  const p = normTxt(planta);
  return lista
    .filter((c) => colaboradorPertenecePlantaAsistencia(c, p))
    .sort((a, b) => a.noEmpleado.localeCompare(b.noEmpleado, "es", { numeric: true }));
}

/** Servicios distintos (línea vigente) entre colaboradores activos, para filtro en vista global. */
export function listarServiciosLineaActivos(lista: ColaboradorCompleto[]): string[] {
  const set = new Set<string>();
  for (const c of lista) {
    if (!colaboradorActivoParaCapturaAsistencia(c)) continue;
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
    if (!colaboradorActivoParaCapturaAsistencia(c)) continue;
    const p = normTxt(plantaExpedienteColaborador(c)) || PLANTA_CAPTURA_SIN_ASIGNAR;
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
    if (!colaboradorActivoParaCapturaAsistencia(c)) continue;
    const p = normTxt(plantaExpedienteColaborador(c));
    if (p) set.add(p);
  }
  return [...set].sort((a, b) => a.localeCompare(b, "es"));
}

/** Plantas para captura semanal (expediente + catálogo de servicios). */
export function listarPlantasCapturaAsistencia(
  lista: ColaboradorCompleto[],
  catalogo: CatalogoServicioItem[] = [],
): string[] {
  const set = new Set<string>();
  for (const c of lista) {
    if (!colaboradorActivoParaCapturaAsistencia(c)) continue;
    set.add(plantaCapturaColaborador(c, catalogo));
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

/** Mapa N.º → colaborador activo (captura asistencia / importación CSV). */
export function mapaColaboradoresActivosCapturaPorEmpNo(
  lista: ColaboradorCompleto[],
): Map<string, ColaboradorCompleto> {
  const map = new Map<string, ColaboradorCompleto>();
  for (const c of lista) {
    if (!colaboradorActivoParaCapturaAsistencia(c)) continue;
    for (const raw of [c.noEmpleado, String(c.form?.noEmpleado1 ?? "")]) {
      const k = canonicalEmpNoAttendance(raw);
      if (k && !map.has(k)) map.set(k, c);
    }
  }
  return map;
}

/** Busca colaborador por N.º canónico (expediente o form.noEmpleado1). */
export function buscarColaboradorPorClaveAsistencia(
  lista: ColaboradorCompleto[],
  employeeKey: string,
): ColaboradorCompleto | undefined {
  const key = canonicalEmpNoAttendance(employeeKey);
  if (!key) return undefined;
  for (const c of lista) {
    if (canonicalEmpNoAttendance(c.noEmpleado) === key) return c;
    if (canonicalEmpNoAttendance(String(c.form?.noEmpleado1 ?? "")) === key) return c;
  }
  return undefined;
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

/**
 * Fila de cuadrícula desde expediente Colaboradores + catálogo Servicios
 * (misma lógica que la pantalla Colaboradores: N.º servicio, posición, planta).
 */
export function colaboradorToGridRow(
  c: ColaboradorCompleto,
  catalogo: CatalogoServicioItem[] = [],
  plantaContexto?: string,
): GridRow {
  const plantaCtx = plantaContexto?.trim() || undefined;
  const catalogoOpts = plantaCtx ? { plantaContexto: plantaCtx } : undefined;
  const n = fechaIngresoNormalizadaColaborador(c);
  const hireRaw = n
    ? formatoDesdeYyyyMmDd(n)
    : String(c.fechaIngreso ?? c.form?.fechaIngreso ?? "").trim();
  const noEmp = canonicalEmpNoAttendance(String(c.noEmpleado || c.form?.noEmpleado1 || ""));

  const servicioLinea = nombreServicioCatalogoColaborador(c, catalogo, catalogoOpts);
  const position = posicionLaboralColaborador(c, catalogo);
  const plantaLinea = normTxt(
    plantaCtx || plantaColaborador(c, catalogo) || plantaExpedienteColaborador(c),
  );

  const rowServiceNo = reconcileRowServiceNo(
    {
      rowServiceNo: noServicioColaborador(c, catalogo, catalogoOpts),
      servicioLinea,
    },
    c,
    catalogo,
    plantaCtx ?? plantaLinea,
  );

  return {
    id: noEmp || c.noEmpleado,
    position: normTxt(position),
    role: normTxt(String(c.form?.puesto ?? c.puesto ?? c.moperActual?.puesto ?? "")),
    hireDate: hireRaw.trim().toUpperCase(),
    employeeNo: noEmp || c.noEmpleado,
    name: normTxt(String(c.form?.nombreCompleto ?? c.nombreCompleto ?? "")),
    rowServiceNo: rowServiceNo || undefined,
    servicioLinea: servicioLinea || undefined,
    plantaLinea: plantaLinea || undefined,
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
  return filtrarColaboradoresActivosCaptura(lista).sort((a, b) =>
    a.noEmpleado.localeCompare(b.noEmpleado, "es", { numeric: true }),
  );
}

/** Todos los colaboradores con N° de empleado (activos y bajas) para Consulta asistencia. */
export function colaboradoresParaConsultaAsistencia(lista: ColaboradorCompleto[]): ColaboradorCompleto[] {
  return lista
    .filter((c) => c.noEmpleado.trim())
    .sort((a, b) => a.noEmpleado.localeCompare(b.noEmpleado, "es", { numeric: true }));
}

export function estatusExpedienteColaborador(c: ColaboradorCompleto): "ACTIVO" | "BAJA" {
  return colaboradorActivoPorEstatusYNumero(c) ? "ACTIVO" : "BAJA";
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
