import type { ColaboradorCompleto } from "@/lib/colaboradores-types";
import type { CatalogoServicioItem } from "@/lib/servicios-catalogo-client";
import type { AttendanceWeekPrefetch } from "./attendanceStorage";
import {
  loadAttendanceGridForPlantaWithMeta,
  normalizeStoredRows,
  resolveMergedStoredGridForPlanta,
} from "./attendanceStorage";
import { getAttendanceWeekPrefetch } from "./attendanceWeekPrefetch";
import type { RemoteAttendanceFetchMeta } from "./attendanceRemote";
import { injectCatalogVacantes, mergeAttendanceRowsWithStoredAndVacantes } from "./attendanceVacantes";
import { listVacantesPorPlanta } from "./vacantesStorage";
import {
  agruparActivosPorPlantaCaptura,
  colaboradorToGridRow,
  colaboradoresParaAsistenciaCsvImport,
  gridRowServiceNo,
  normPlantaCapturaNombre,
  plantaToStorageKey,
} from "./cuadriculaColaboradoresBridge";
import { canonicalEmpNoAttendance, empNoClaveGridRow, indexGridRowsByEmpNo } from "@/lib/attendance-emp-no";
import { sortGridRowsByPosicion } from "./attendanceGridSort";
import { elegirValorIdentificacionAsistencia } from "./attendanceGridColumns";
import { appendFilasGuardadasFueraDeBase } from "./attendancePlantaMerge";
import { emptyShifts, WEEK_COLUMNS, ZERO_TOTALS, type GridRow } from "./mockData";
import { withComputedTotals } from "./attendanceTotals";

function aplicarTotalesPorFila(rows: GridRow[], base: GridRow[]): GridRow[] {
  const baseByKey = new Map(base.map((b) => [empNoClaveGridRow(b), b]));
  return rows.map((r) => {
    const k = empNoClaveGridRow(r);
    const br = k ? baseByKey.get(k) : undefined;
    const merged: GridRow = {
      ...r,
      rowServiceNo: elegirValorIdentificacionAsistencia(br?.rowServiceNo, r.rowServiceNo),
      servicioLinea: elegirValorIdentificacionAsistencia(br?.servicioLinea, r.servicioLinea),
      plantaLinea:
        elegirValorIdentificacionAsistencia(br?.plantaLinea, r.plantaLinea) ||
        br?.plantaLinea ||
        r.plantaLinea,
      position: elegirValorIdentificacionAsistencia(br?.position, r.position),
      role: elegirValorIdentificacionAsistencia(br?.role, r.role),
    };
    return withComputedTotals(merged, gridRowServiceNo(merged));
  });
}

function maxSavedAtIso(a: string | null, b: string | undefined): string | null {
  if (!b?.trim()) return a;
  if (!a) return b;
  return b > a ? b : a;
}

/**
 * Captura semanal: identidad siempre desde Colaboradores; solo se fusionan turnos guardados de la semana.
 */
function fusionarCapturaSemanalDesdeExpediente(
  base: GridRow[],
  storedRows: GridRow[],
): GridRow[] {
  const storedByEmp = indexGridRowsByEmpNo(storedRows.filter((r) => !r.vacant));
  const merged = base.map((br) => {
    const k = empNoClaveGridRow(br);
    const s = k ? storedByEmp.get(k) : undefined;
    if (!s?.shifts?.length || s.shifts.length !== br.shifts.length) {
      return br;
    }
    return {
      ...br,
      shifts: s.shifts.map((day) => ({
        D: typeof day?.D === "string" ? day.D : "",
        T: typeof day?.T === "string" ? day.T : "",
        N: typeof day?.N === "string" ? day.N : "",
      })),
    };
  });
  return sortGridRowsByPosicion(merged.map((r) => withComputedTotals(r, gridRowServiceNo(r))));
}

export type MergePlantaWeekOpts = {
  /** Captura semanal: solo activos, sin vacantes ni filas de baja guardadas. */
  soloCapturaActivos?: boolean;
  /** Filas base precalculadas (cache); evita reconstruirlas al cambiar de semana. */
  baseRows?: GridRow[];
};

/**
 * Cache de la parte que NO cambia entre semanas: activos agrupados por planta y
 * sus filas base de cuadrícula. Solo se recalcula cuando cambia la lista de
 * colaboradores o el catálogo (identidad de los arreglos); cambiar de semana
 * solo descarga los turnos guardados y los fusiona sobre esta base.
 */
type CapturaBaseCache = {
  colaboradores: ColaboradorCompleto[];
  catalogo: CatalogoServicioItem[];
  grupos: Map<string, ColaboradorCompleto[]>;
  basePorPlanta: Map<string, GridRow[]>;
};

let capturaBaseCache: CapturaBaseCache | null = null;

function capturaBase(
  colaboradores: ColaboradorCompleto[],
  catalogo: CatalogoServicioItem[],
): CapturaBaseCache {
  if (
    !capturaBaseCache ||
    capturaBaseCache.colaboradores !== colaboradores ||
    capturaBaseCache.catalogo !== catalogo
  ) {
    capturaBaseCache = {
      colaboradores,
      catalogo,
      grupos: agruparActivosPorPlantaCaptura(colaboradores, catalogo),
      basePorPlanta: new Map(),
    };
  }
  return capturaBaseCache;
}

function baseDePlanta(
  cache: CapturaBaseCache,
  planta: string,
): { activos: ColaboradorCompleto[]; base: GridRow[] } {
  const key = normPlantaCapturaNombre(planta);
  const activos = cache.grupos.get(key) ?? [];
  let base = cache.basePorPlanta.get(key);
  if (!base) {
    base = activos.map((c) => colaboradorToGridRow(c, cache.catalogo, key));
    cache.basePorPlanta.set(key, base);
  }
  return { activos, base };
}

async function mergePlantaWeekBlock(
  activos: ColaboradorCompleto[],
  plantaNombre: string,
  catalogo: CatalogoServicioItem[],
  weekStartIso: string,
  prefetchedWeek: AttendanceWeekPrefetch | null,
  todosColaboradores: ColaboradorCompleto[] = activos,
  opts?: MergePlantaWeekOpts,
): Promise<{ rows: GridRow[]; savedAt: string | null }> {
  const soloCaptura = opts?.soloCapturaActivos !== false;
  const scopeId = plantaToStorageKey(plantaNombre);
  if (!scopeId || activos.length === 0) {
    return { rows: [], savedAt: null };
  }

  const base =
    opts?.baseRows ?? activos.map((c) => colaboradorToGridRow(c, catalogo, plantaNombre));
  const empKeys = activos
    .map((c) => canonicalEmpNoAttendance(c.noEmpleado))
    .filter(Boolean);
  const stored = prefetchedWeek
    ? resolveMergedStoredGridForPlanta(weekStartIso, scopeId, empKeys, prefetchedWeek)
    : (await loadAttendanceGridForPlantaWithMeta(weekStartIso, scopeId, empKeys, null)).grid;

  const normStored = stored?.rows?.length ? normalizeStoredRows(stored.rows) : [];
  let rows: GridRow[];

  if (soloCaptura) {
    rows =
      normStored.length > 0
        ? fusionarCapturaSemanalDesdeExpediente(base, normStored)
        : sortGridRowsByPosicion(
            base.map((r) => withComputedTotals(r, gridRowServiceNo(r))),
          );
  } else {
    let merged = base;
    if (normStored.length) {
      merged = mergeAttendanceRowsWithStoredAndVacantes(base, normStored);
      merged = appendFilasGuardadasFueraDeBase(
        merged,
        normStored,
        todosColaboradores,
        plantaNombre,
        catalogo,
      );
    }
    merged = injectCatalogVacantes(merged, listVacantesPorPlanta(plantaNombre));
    rows = aplicarTotalesPorFila(merged, base);
  }

  return {
    rows,
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
  reemplazarEmpNos?: Set<string>,
): Promise<{ rows: GridRow[]; savedAt: string | null }> {
  const scopeId = plantaToStorageKey(plantaNombre);
  if (!scopeId || colaboradoresPlanta.length === 0) {
    return { rows: [], savedAt: null };
  }

  const base = colaboradoresPlanta.map((c) => colaboradorToGridRow(c, catalogo, plantaNombre));
  const empKeys = colaboradoresPlanta.map((c) => c.noEmpleado);
  const stored = prefetchedWeek
    ? resolveMergedStoredGridForPlanta(weekStartIso, scopeId, empKeys, prefetchedWeek)
    : (await loadAttendanceGridForPlantaWithMeta(weekStartIso, scopeId, empKeys, null)).grid;

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

  if (reemplazarEmpNos?.size) {
    merged = merged.map((r) => {
      const k = empNoClaveGridRow(r);
      if (!k || !reemplazarEmpNos.has(k)) return r;
      return {
        ...r,
        shifts: emptyShifts(WEEK_COLUMNS.length),
        totals: { ...ZERO_TOTALS },
      };
    });
  }

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
  const cache = capturaBase(colaboradores, catalogo);
  const { activos, base } = baseDePlanta(cache, plantaNombre);
  const { rows } = await mergePlantaWeekBlock(
    activos,
    plantaNombre,
    catalogo,
    weekStartIso,
    prefetchedWeek ?? null,
    colaboradores,
    { soloCapturaActivos: true, baseRows: base },
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
  opts?: { numerosEmpleadoEnCsv?: Set<string>; reemplazarEmpNos?: Set<string> },
): Promise<GridRow[]> {
  const enPlanta = colaboradoresParaAsistenciaCsvImport(colaboradores, plantaNombre);
  if (opts?.numerosEmpleadoEnCsv?.size) {
    const ya = new Set(
      enPlanta.map((c) => canonicalEmpNoAttendance(c.noEmpleado)).filter(Boolean),
    );
    for (const c of colaboradores) {
      const k = canonicalEmpNoAttendance(c.noEmpleado);
      if (!k || !opts.numerosEmpleadoEnCsv.has(k) || ya.has(k)) continue;
      enPlanta.push(c);
      ya.add(k);
    }
    enPlanta.sort((a, b) => a.noEmpleado.localeCompare(b.noEmpleado, "es", { numeric: true }));
  }
  const { rows } = await mergePlantaWeekBlockForCsvImport(
    enPlanta,
    colaboradores,
    plantaNombre,
    catalogo,
    weekStartIso,
    prefetchedWeek ?? null,
    opts?.reemplazarEmpNos,
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
  const cache = capturaBase(colaboradores, catalogo);
  const plantasCaptura = [...cache.grupos.keys()].sort((a, b) => a.localeCompare(b, "es"));

  if (plantasCaptura.length === 0) {
    return { rows: [], remote: { status: "empty" }, lastSavedAt: null };
  }

  const prefetch = await getAttendanceWeekPrefetch(weekStartIso);

  const blocks = await Promise.all(
    plantasCaptura.map((planta) => {
      const { activos, base } = baseDePlanta(cache, planta);
      return mergePlantaWeekBlock(
        activos,
        planta,
        catalogo,
        weekStartIso,
        prefetch,
        colaboradores,
        { soloCapturaActivos: true, baseRows: base },
      );
    }),
  );

  let lastSavedAt: string | null = null;
  const allRows: GridRow[] = [];
  for (const block of blocks) {
    if (block.rows.length > 0) allRows.push(...block.rows);
    lastSavedAt = maxSavedAtIso(lastSavedAt, block.savedAt ?? undefined);
  }

  allRows.sort((a, b) =>
    String(a.employeeNo ?? a.id ?? "").localeCompare(
      String(b.employeeNo ?? b.id ?? ""),
      "es",
      { numeric: true },
    ),
  );

  return {
    rows: allRows,
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
