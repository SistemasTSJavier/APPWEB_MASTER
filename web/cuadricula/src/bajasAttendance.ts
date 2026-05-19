import type { ColaboradorCompleto } from "@/lib/colaboradores-types";
import type { BajasRow } from "./bajasMock";
import { emptyBajasShifts } from "./bajasMock";
import type { AttendanceWeekPrefetch } from "./attendanceStorage";
import {
  loadAttendanceGridForPlantaWithMeta,
  normalizeStoredRows,
  weekStartToIso,
} from "./attendanceStorage";
import { fetchAttendanceWeekRemote } from "./attendanceRemote";
import {
  colaboradorConBajaToBajasRow,
  plantaExpedienteColaborador,
  plantaToStorageKey,
} from "./cuadriculaColaboradoresBridge";
import { WEEK_COLUMNS } from "./mockData";

function shiftsFromStored(
  shifts: { D: string; T: string; N: string }[] | undefined,
): BajasRow["shifts"] {
  if (!shifts || shifts.length !== WEEK_COLUMNS.length) return emptyBajasShifts();
  return shifts.map((d) => ({
    D: typeof d.D === "string" ? d.D : "",
    T: typeof d.T === "string" ? d.T : "",
    N: typeof d.N === "string" ? d.N : "",
  }));
}

/**
 * Filas de bajas con celdas D/T/N de la semana indicada, leídas de la misma
 * fuente que la cuadrícula de asistencia (localStorage + servidor por planta).
 */
export async function loadBajasRowsWithAsistencia(
  bajas: ColaboradorCompleto[],
  catalogNombre: string,
  noServicioCatalogo: string,
  weekStart: Date,
): Promise<BajasRow[]> {
  if (bajas.length === 0) return [];

  const weekIso = weekStartToIso(weekStart);
  const byPlantaScope = new Map<string, ColaboradorCompleto[]>();

  for (const c of bajas) {
    const planta = plantaExpedienteColaborador(c).trim().toUpperCase();
    if (!planta) continue;
    const scopeKey = plantaToStorageKey(planta);
    const bucket = byPlantaScope.get(scopeKey) ?? [];
    bucket.push(c);
    byPlantaScope.set(scopeKey, bucket);
  }

  let prefetch: AttendanceWeekPrefetch | null = null;
  if (byPlantaScope.size > 0) {
    prefetch = await fetchAttendanceWeekRemote(weekIso);
  }

  const rowsByEmp = new Map<string, BajasRow>();

  await Promise.all(
    [...byPlantaScope.entries()].map(async ([scopeKey, grupo]) => {
      const empNos = grupo.map((c) => c.noEmpleado);
      const { grid } = await loadAttendanceGridForPlantaWithMeta(
        weekIso,
        scopeKey,
        empNos,
        prefetch,
      );

      const shiftsByEmp = new Map<string, BajasRow["shifts"]>();
      if (grid?.rows?.length) {
        for (const r of normalizeStoredRows(grid.rows, grid.serviceNo)) {
          const k = String(r.employeeNo ?? r.id ?? "").trim();
          if (k) shiftsByEmp.set(k, shiftsFromStored(r.shifts));
        }
      }

      for (const c of grupo) {
        const base = colaboradorConBajaToBajasRow(c, catalogNombre, noServicioCatalogo);
        const key = c.noEmpleado.trim();
        const shifts = shiftsByEmp.get(key) ?? emptyBajasShifts();
        rowsByEmp.set(key, { ...base, shifts });
      }
    }),
  );

  for (const c of bajas) {
    const key = c.noEmpleado.trim();
    if (!rowsByEmp.has(key)) {
      rowsByEmp.set(key, colaboradorConBajaToBajasRow(c, catalogNombre, noServicioCatalogo));
    }
  }

  return bajas.map((c) => rowsByEmp.get(c.noEmpleado.trim())!);
}

export type BajasGrupoServicioCarga = {
  bajas: ColaboradorCompleto[];
  catalogNombre: string;
  noServicio: string;
};

/** Varias selecciones de catálogo: una fila por persona y servicio (historial por planta). */
export async function loadBajasRowsMultiServicio(
  grupos: BajasGrupoServicioCarga[],
  weekStart: Date,
): Promise<BajasRow[]> {
  if (grupos.length === 0) return [];
  const bloques = await Promise.all(
    grupos.map((g) =>
      loadBajasRowsWithAsistencia(g.bajas, g.catalogNombre, g.noServicio, weekStart),
    ),
  );
  return bloques.flat();
}
