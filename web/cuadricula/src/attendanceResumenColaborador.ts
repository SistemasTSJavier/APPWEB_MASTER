import type { ColaboradorCompleto } from "@/lib/colaboradores-types";
import type { CatalogoServicioItem } from "@/lib/servicios-catalogo-client";
import { mondaysInCalendarMonth } from "./attendanceExportSummary";
import { weekStartToIso } from "./attendanceStorage";
import { mergeRowForEmployeeInWeek } from "./attendanceSemanaColaborador";
import type { GridRow } from "./mockData";

export type SemanaResumenColaborador = {
  monday: Date;
  weekIso: string;
  row: GridRow | null;
};

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
      const row = await mergeRowForEmployeeInWeek(
        colaboradores,
        planta,
        catalogo,
        weekIso,
        key,
      );
      return { monday, weekIso, row };
    }),
  );
}
