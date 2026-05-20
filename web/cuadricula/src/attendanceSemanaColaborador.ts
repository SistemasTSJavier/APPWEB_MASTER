import type { ColaboradorCompleto } from "@/lib/colaboradores-types";
import type { CatalogoServicioItem } from "@/lib/servicios-catalogo-client";
import type { AttendanceWeekPrefetch } from "./attendanceStorage";
import {
  loadAttendanceGridForPlantaWithMeta,
  normalizeStoredRows,
} from "./attendanceStorage";
import type { RemoteAttendanceFetchMeta } from "./attendanceRemote";
import { injectCatalogVacantes, mergeAttendanceRowsWithStoredAndVacantes } from "./attendanceVacantes";
import { listVacantesPorPlanta } from "./vacantesStorage";
import { sortGridRowsByServicioYPosicion } from "./attendanceGridSort";
import {
  colaboradorToGridRow,
  colaboradoresActivosPorPlanta,
  mapaColaboradoresActivosPorPlanta,
  mapaColaboradoresParaAsistenciaPorPlanta,
  gridRowServiceNo,
  plantaToStorageKey,
} from "./cuadriculaColaboradoresBridge";
import { empNoClaveGridRow } from "@/lib/attendance-emp-no";
import { appendFilasGuardadasFueraDeBase } from "./attendancePlantaMerge";
import type { GridRow } from "./mockData";
import { withComputedTotals } from "./attendanceTotals";

function aplicarTotalesPorFila(rows: GridRow[], base: GridRow[]): GridRow[] {
  const baseByKey = new Map(base.map((b) => [empNoClaveGridRow(b), b]));
  return rows.map((r) => {
    const k = empNoClaveGridRow(r);
    const br = k ? baseByKey.get(k) : undefined;
    const merged: GridRow = {
      ...r,
      rowServiceNo: br?.rowServiceNo ?? r.rowServiceNo,
      servicioLinea: br?.servicioLinea ?? r.servicioLinea,
      plantaLinea: br?.plantaLinea ?? r.plantaLinea,
    };
    return withComputedTotals(merged, gridRowServiceNo(merged));
  });
}

function maxSavedAtIso(a: string | null, b: string | undefined): string | null {
  if (!b?.trim()) return a;
  if (!a) return b;
  return b > a ? b : a;
}

async function mergePlantaWeekBlock(
  activos: ColaboradorCompleto[],
  plantaNombre: string,
  catalogo: CatalogoServicioItem[],
  weekStartIso: string,
  prefetchedWeek: AttendanceWeekPrefetch | null,
  todosColaboradores: ColaboradorCompleto[] = activos,
): Promise<{ rows: GridRow[]; savedAt: string | null }> {
  const scopeId = plantaToStorageKey(plantaNombre);
  if (!scopeId || activos.length === 0) {
    return { rows: [], savedAt: null };
  }

  const base = activos.map((c) => colaboradorToGridRow(c, catalogo, plantaNombre));
  const { grid: stored } = await loadAttendanceGridForPlantaWithMeta(
    weekStartIso,
    scopeId,
    activos.map((c) => c.noEmpleado),
    prefetchedWeek,
  );

  let merged = base;
  const normStored = stored?.rows?.length ? normalizeStoredRows(stored.rows) : [];
  if (normStored.length) {
    merged = mergeAttendanceRowsWithStoredAndVacantes(base, normStored);
    merged = appendFilasGuardadasFueraDeBase(
      merged,
      normStored,
      todosColaboradores,
      plantaNombre,
      catalogo,
    );
  } else {
    merged = mergeAttendanceRowsWithStoredAndVacantes(base, []);
  }

  merged = injectCatalogVacantes(merged, listVacantesPorPlanta(plantaNombre));

  return {
    rows: aplicarTotalesPorFila(merged, base),
    savedAt: stored?.savedAt ?? null,
  };
}

async function mergePlantaWeekBlockForCsvImport(
  colaboradoresPlanta: ColaboradorCompleto[],
  todosColaboradores: ColaboradorCompleto[],
  plantaNombre: string,
  catalogo: CatalogoServicioItem[],
  weekStartIso: string,
  prefetchedWeek: AttendanceWeekPrefetch | null,
): Promise<{ rows: GridRow[]; savedAt: string | null }> {
  const scopeId = plantaToStorageKey(plantaNombre);
  if (!scopeId || colaboradoresPlanta.length === 0) {
    return { rows: [], savedAt: null };
  }

  const base = colaboradoresPlanta.map((c) => colaboradorToGridRow(c, catalogo, plantaNombre));
  const empKeys = colaboradoresPlanta.map((c) => c.noEmpleado);
  const { grid: stored } = await loadAttendanceGridForPlantaWithMeta(
    weekStartIso,
    scopeId,
    empKeys,
    prefetchedWeek,
  );

  let merged = base;
  const normStored = stored?.rows?.length ? normalizeStoredRows(stored.rows) : [];
  if (normStored.length) {
    merged = mergeAttendanceRowsWithStoredAndVacantes(base, normStored);
    merged = appendFilasGuardadasFueraDeBase(
      merged,
      normStored,
      todosColaboradores,
      plantaNombre,
      catalogo,
    );
  } else {
    merged = mergeAttendanceRowsWithStoredAndVacantes(base, []);
  }

  merged = injectCatalogVacantes(merged, listVacantesPorPlanta(plantaNombre));

  return {
    rows: aplicarTotalesPorFila(merged, base),
    savedAt: stored?.savedAt ?? null,
  };
}

/**
 * Fila de asistencia de un colaborador en una semana (lunes = weekIso), fusionando localStorage y servidor.
 */
export async function mergeRowForEmployeeInWeek(
  colaboradores: ColaboradorCompleto[],
  plantaNombre: string,
  catalogo: CatalogoServicioItem[],
  weekStartIso: string,
  employeeKey: string,
): Promise<GridRow | null> {
  const grid = await mergeGridRowsForPlantaWeek(
    colaboradores,
    plantaNombre,
    catalogo,
    weekStartIso,
  );
  const key = employeeKey.trim();
  const r = grid.find((x) => String(x.employeeNo ?? x.id ?? "").trim() === key);
  return r ?? null;
}

/** Cuadrícula completa de la planta para un lunes (fusiona guardados). */
export async function mergeGridRowsForPlantaWeek(
  colaboradores: ColaboradorCompleto[],
  plantaNombre: string,
  catalogo: CatalogoServicioItem[],
  weekStartIso: string,
  prefetchedWeek?: AttendanceWeekPrefetch | null,
): Promise<GridRow[]> {
  const mapa = mapaColaboradoresActivosPorPlanta(colaboradores);
  const activos = mapa.get(plantaNombre.trim().toUpperCase()) ?? [];
  const { rows } = await mergePlantaWeekBlock(
    activos,
    plantaNombre,
    catalogo,
    weekStartIso,
    prefetchedWeek ?? null,
    colaboradores,
  );
  return rows;
}

/**
 * Cuadrícula para importar CSV: incluye activos y bajas de la planta (historial por N.º de empleado).
 */
export async function mergeGridRowsForPlantaWeekForCsvImport(
  colaboradores: ColaboradorCompleto[],
  plantaNombre: string,
  catalogo: CatalogoServicioItem[],
  weekStartIso: string,
  prefetchedWeek?: AttendanceWeekPrefetch | null,
): Promise<GridRow[]> {
  const mapa = mapaColaboradoresParaAsistenciaPorPlanta(colaboradores);
  const enPlanta = mapa.get(plantaNombre.trim().toUpperCase()) ?? [];
  enPlanta.sort((a, b) => a.noEmpleado.localeCompare(b.noEmpleado, "es", { numeric: true }));
  const { rows } = await mergePlantaWeekBlockForCsvImport(
    enPlanta,
    colaboradores,
    plantaNombre,
    catalogo,
    weekStartIso,
    prefetchedWeek ?? null,
  );
  return rows;
}

export type TodasPlantasWeekResult = {
  rows: GridRow[];
  remote: RemoteAttendanceFetchMeta;
  lastSavedAt: string | null;
};

/**
 * Todas las plantas en una tabla: **una** petición al servidor y fusión en paralelo por planta.
 */
export async function mergeGridRowsTodasPlantasWeek(
  colaboradores: ColaboradorCompleto[],
  catalogo: CatalogoServicioItem[],
  weekStartIso: string,
): Promise<TodasPlantasWeekResult> {
  const mapa = mapaColaboradoresActivosPorPlanta(colaboradores);
  const plantas = [...mapa.keys()].sort((a, b) => a.localeCompare(b, "es", { numeric: true }));

  if (plantas.length === 0) {
    return { rows: [], remote: { status: "empty" }, lastSavedAt: null };
  }

  const { fetchAttendanceWeekRemote } = await import("./attendanceRemote");
  const prefetch = await fetchAttendanceWeekRemote(weekStartIso);

  const blocks = await Promise.all(
    plantas.map((planta) => {
      const activos = mapa.get(planta) ?? [];
      return mergePlantaWeekBlock(
        activos,
        planta,
        catalogo,
        weekStartIso,
        prefetch,
        colaboradores,
      );
    }),
  );

  let lastSavedAt: string | null = null;
  const allRows: GridRow[] = [];
  for (const block of blocks) {
    if (block.rows.length > 0) allRows.push(...block.rows);
    lastSavedAt = maxSavedAtIso(lastSavedAt, block.savedAt ?? undefined);
  }

  return {
    rows: sortGridRowsByServicioYPosicion(allRows),
    remote: prefetch.meta,
    lastSavedAt,
  };
}

/** Reparte filas por planta para guardar (incluye vacantes de cada planta). */
export function splitGridRowsByPlanta(rows: GridRow[]): Map<string, GridRow[]> {
  const map = new Map<string, GridRow[]>();
  for (const r of rows) {
    const p = (r.plantaLinea ?? "").trim().toUpperCase();
    if (!p) continue;
    const list = map.get(p) ?? [];
    list.push(r);
    map.set(p, list);
  }
  return map;
}

/** @deprecated Use mergeGridRowsForPlantaWeek */
export function mergeGridRowsForServiceWeek(
  colaboradores: ColaboradorCompleto[],
  _nombreServicioCatalogo: string,
  scopeId: string,
  weekStartIso: string,
  _serviceNoParaTotales: string,
): Promise<GridRow[]> {
  const planta = scopeId.startsWith("planta:") ? scopeId.slice(7) : "";
  if (!planta) return Promise.resolve([]);
  return mergeGridRowsForPlantaWeek(colaboradores, planta, [], weekStartIso);
}
