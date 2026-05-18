import type { ColaboradorCompleto } from "@/lib/colaboradores-types";
import type { CatalogoServicioItem } from "@/lib/servicios-catalogo-client";
import { noServicioColaborador } from "@/lib/colaboradores-catalogo-display";
import {
  loadAttendanceGridForPlanta,
  mergeAttendanceRowsWithStored,
  normalizeStoredRows,
} from "./attendanceStorage";
import { withComputedTotals } from "./attendanceTotals";
import {
  colaboradorToGridRow,
  colaboradoresActivosPorPlanta,
  gridRowServiceNo,
  plantaToStorageKey,
} from "./cuadriculaColaboradoresBridge";
import type { GridRow } from "./mockData";

function aplicarTotalesPorFila(rows: GridRow[], base: GridRow[]): GridRow[] {
  const baseByKey = new Map(base.map((b) => [String(b.employeeNo ?? b.id ?? "").trim(), b]));
  return rows.map((r) => {
    const k = String(r.employeeNo ?? r.id ?? "").trim();
    const br = k ? baseByKey.get(k) : undefined;
    const merged: GridRow = {
      ...r,
      rowServiceNo: br?.rowServiceNo ?? r.rowServiceNo,
      servicioLinea: br?.servicioLinea ?? r.servicioLinea,
    };
    return withComputedTotals(merged, gridRowServiceNo(merged));
  });
}

/**
 * Fila de asistencia de un colaborador en una semana (lunes = weekIso), fusionando localStorage.
 */
export function mergeRowForEmployeeInWeek(
  colaboradores: ColaboradorCompleto[],
  plantaNombre: string,
  catalogo: CatalogoServicioItem[],
  weekStartIso: string,
  employeeKey: string,
): GridRow | null {
  const key = employeeKey.trim();
  if (!key || !plantaNombre.trim()) return null;
  const scopeId = plantaToStorageKey(plantaNombre);
  const activos = colaboradoresActivosPorPlanta(colaboradores, plantaNombre);
  const c = activos.find((x) => x.noEmpleado.trim() === key);
  if (!c) return null;
  const base = activos.map((x) => colaboradorToGridRow(x, catalogo, plantaNombre));
  const stored = loadAttendanceGridForPlanta(
    weekStartIso,
    scopeId,
    activos.map((x) => x.noEmpleado),
  );
  const no = noServicioColaborador(c, catalogo);
  const norm = normalizeStoredRows(stored?.rows ?? [], no);
  const merged = mergeAttendanceRowsWithStored(base, norm);
  const r = merged.find((x) => String(x.employeeNo ?? x.id ?? "").trim() === key);
  return r ? aplicarTotalesPorFila([r], base)[0] ?? null : null;
}

/** Cuadrícula completa de la planta para un lunes (fusiona localStorage). */
export function mergeGridRowsForPlantaWeek(
  colaboradores: ColaboradorCompleto[],
  plantaNombre: string,
  catalogo: CatalogoServicioItem[],
  weekStartIso: string,
): GridRow[] {
  const scopeId = plantaToStorageKey(plantaNombre);
  if (!scopeId) return [];
  const activos = colaboradoresActivosPorPlanta(colaboradores, plantaNombre);
  const base = activos.map((c) => colaboradorToGridRow(c, catalogo, plantaNombre));
  const stored = loadAttendanceGridForPlanta(
    weekStartIso,
    scopeId,
    activos.map((c) => c.noEmpleado),
  );
  let merged = base;
  if (stored) {
    const norm = normalizeStoredRows(stored.rows);
    merged = mergeAttendanceRowsWithStored(base, norm);
  }
  return aplicarTotalesPorFila(merged, base);
}

/** @deprecated Use mergeGridRowsForPlantaWeek */
export function mergeGridRowsForServiceWeek(
  colaboradores: ColaboradorCompleto[],
  _nombreServicioCatalogo: string,
  scopeId: string,
  weekStartIso: string,
  _serviceNoParaTotales: string,
): GridRow[] {
  const planta = scopeId.startsWith("planta:") ? scopeId.slice(7) : "";
  if (!planta) return [];
  return mergeGridRowsForPlantaWeek(colaboradores, planta, [], weekStartIso);
}
