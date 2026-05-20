import type { ColaboradorCompleto } from "@/lib/colaboradores-types";
import type { CatalogoServicioItem } from "@/lib/servicios-catalogo-client";
import { colaboradorTieneBaja, fechaBajaNormalizadaColaborador } from "@/lib/colaboradores-baja";
import { formatoDesdeYyyyMmDd } from "@/lib/fecha-formato-display";
import { colaboradorToGridRow, gridRowServiceNo } from "./cuadriculaColaboradoresBridge";
import type { GridRow } from "./mockData";
import { withComputedTotals } from "./attendanceTotals";

import { empNoClaveGridRow } from "@/lib/attendance-emp-no";

function empKey(row: Pick<GridRow, "employeeNo" | "id">): string {
  return empNoClaveGridRow(row);
}

/** Sincroniza estatus y fecha de baja desde expediente. */
export function enrichGridRowsEstatus(
  rows: GridRow[],
  colaboradores: ColaboradorCompleto[],
): GridRow[] {
  const byNo = new Map(colaboradores.map((c) => [c.noEmpleado.trim(), c]));
  return rows.map((r) => {
    if (r.vacant) return { ...r, estatus: undefined, fechaBaja: "—" };
    const c = byNo.get(empKey(r));
    if (!c) return r;
    const enBaja = colaboradorTieneBaja(c);
    const fb = fechaBajaNormalizadaColaborador(c);
    return {
      ...r,
      estatus: enBaja ? "BAJA" : "ACTIVO",
      fechaBaja: enBaja && fb ? formatoDesdeYyyyMmDd(fb) : "—",
    };
  });
}

/**
 * Añade filas guardadas de empleados que ya no están en la base (p. ej. baja con historial de semana).
 */
export function appendFilasGuardadasFueraDeBase(
  merged: GridRow[],
  storedRows: GridRow[],
  colaboradores: ColaboradorCompleto[],
  plantaNombre: string,
  catalogo: CatalogoServicioItem[],
): GridRow[] {
  const plantaNorm = plantaNombre.trim().toUpperCase();
  const byNo = new Map(colaboradores.map((c) => [c.noEmpleado.trim(), c]));
  const keys = new Set(merged.filter((r) => !r.vacant).map((r) => empKey(r)).filter(Boolean));
  const out = [...merged];

  for (const r of storedRows) {
    if (r.vacant) continue;
    const k = empKey(r);
    if (!k || keys.has(k)) continue;
    const pl = (r.plantaLinea ?? "").trim().toUpperCase();
    if (plantaNorm && pl && pl !== plantaNorm) continue;

    const c = byNo.get(k);
    let row: GridRow;
    if (c) {
      const base = colaboradorToGridRow(c, catalogo, plantaNombre);
      row = {
        ...base,
        shifts:
          r.shifts?.length === base.shifts.length ? r.shifts : base.shifts,
        rowServiceNo: base.rowServiceNo ?? r.rowServiceNo,
        servicioLinea: base.servicioLinea ?? r.servicioLinea,
        plantaLinea: base.plantaLinea ?? r.plantaLinea ?? plantaNorm,
      };
    } else {
      row = {
        ...r,
        estatus: r.estatus ?? "BAJA",
        fechaBaja: r.fechaBaja ?? "—",
        plantaLinea: r.plantaLinea ?? plantaNorm,
      };
    }
    out.push(withComputedTotals(row, gridRowServiceNo(row)));
    keys.add(k);
  }
  return out;
}
