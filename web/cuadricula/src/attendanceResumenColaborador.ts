import type { ColaboradorCompleto } from "@/lib/colaboradores-types";
import type { CatalogoServicioItem } from "@/lib/servicios-catalogo-client";
import { mondaysInCalendarMonth } from "./attendanceExportSummary";
import {
  loadAttendanceGridForPlantaWithMeta,
  normalizeStoredRows,
  weekStartToIso,
} from "./attendanceStorage";
import {
  colaboradorToGridRow,
  gridRowServiceNo,
  plantaToStorageKey,
} from "./cuadriculaColaboradoresBridge";
import type { GridRow } from "./mockData";
import { WEEK_COLUMNS } from "./mockData";
import { withComputedTotals } from "./attendanceTotals";

export type SemanaResumenColaborador = {
  monday: Date;
  weekIso: string;
  row: GridRow | null;
};

/**
 * Fila de un colaborador en una semana (activo o baja), leyendo guardado por planta.
 * No depende de la cuadrícula de captura (solo activos).
 */
export async function loadFilaAsistenciaColaboradorSemana(
  colaboradores: ColaboradorCompleto[],
  catalogo: CatalogoServicioItem[],
  plantaNombre: string,
  employeeKey: string,
  weekStartIso: string,
): Promise<GridRow | null> {
  const key = employeeKey.trim();
  const planta = plantaNombre.trim();
  if (!key || !planta) return null;

  const c = colaboradores.find((x) => x.noEmpleado.trim() === key);
  if (!c) return null;

  const scopeId = plantaToStorageKey(planta);
  if (!scopeId) return null;

  const base = colaboradorToGridRow(c, catalogo, planta);
  const { grid } = await loadAttendanceGridForPlantaWithMeta(weekStartIso, scopeId, [key]);
  const norm = grid?.rows?.length ? normalizeStoredRows(grid.rows, grid.serviceNo) : [];
  const stored = norm.find((r) => String(r.employeeNo ?? r.id ?? "").trim() === key);

  if (!stored?.shifts?.length || stored.shifts.length !== WEEK_COLUMNS.length) {
    return withComputedTotals(base, gridRowServiceNo(base));
  }

  return withComputedTotals(
    {
      ...base,
      shifts: stored.shifts,
      rowServiceNo: base.rowServiceNo ?? stored.rowServiceNo,
      servicioLinea: base.servicioLinea ?? stored.servicioLinea,
      plantaLinea: base.plantaLinea ?? stored.plantaLinea ?? planta,
    },
    gridRowServiceNo(base),
  );
}

/** Totales por semana (lun–dom) de un colaborador en un mes calendario. */
export async function loadResumenMensualColaborador(
  colaboradores: ColaboradorCompleto[],
  catalogo: CatalogoServicioItem[],
  plantaNombre: string,
  employeeKey: string,
  mesYm: string,
): Promise<SemanaResumenColaborador[]> {
  const planta = plantaNombre.trim();
  const key = employeeKey.trim();
  if (!planta || !key) return [];

  return Promise.all(
    mondaysInCalendarMonth(mesYm).map(async (monday) => {
      const weekIso = weekStartToIso(monday);
      const row = await loadFilaAsistenciaColaboradorSemana(
        colaboradores,
        catalogo,
        planta,
        key,
        weekIso,
      );
      return { monday, weekIso, row };
    }),
  );
}
