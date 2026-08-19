import type { ColaboradorCompleto } from "@/lib/colaboradores-types";
import {
  expedienteColaboradorValido,
  fechaBajaNormalizadaColaborador,
  fechaIngresoNormalizadaColaborador,
  prepararColaboradorParaMetricas,
} from "@/lib/colaboradores-baja";
import { mesYmDesdeFechaIngreso } from "@/lib/categorizacion-tenure";
import { normalizarFechaParaInputDate } from "@/lib/fecha-input-normalize";
import { servicioLineaColaborador } from "@/lib/servicio-agrupacion";

export type ContratoPorMesFila = {
  noEmpleado: string;
  nombreCompleto: string;
  servicio: string;
  fechaIngreso: string;
  /** Alta con fecha de ingreso en el mes seleccionado. */
  altaEnMes: boolean;
};

function mesYmValido(mesYm: string): boolean {
  return /^\d{4}-\d{2}$/.test(String(mesYm ?? "").trim().slice(0, 7));
}

function primerDiaMesYm(mesYm: string): string {
  return `${mesYm.slice(0, 7)}-01`;
}

/** Último día del mes calendario (YYYY-MM-DD). */
function ultimoDiaMesYm(mesYm: string): string {
  const ym = mesYm.slice(0, 7);
  const [y, m] = ym.split("-").map(Number);
  const last = new Date(y, m, 0);
  const dd = String(last.getDate()).padStart(2, "0");
  const mm = String(m).padStart(2, "0");
  return `${y}-${mm}-${dd}`;
}

function finLaboralYmd(c: ColaboradorCompleto): string {
  const udl = normalizarFechaParaInputDate(String(c.form?.ultimoDiaLaborado ?? "").trim());
  const fb = fechaBajaNormalizadaColaborador(c);
  return udl || fb;
}

/**
 * Incluye colaboradores que:
 * - se dieron de alta en el mes, o
 * - estuvieron activos en algún momento del mes (ingreso ≤ fin de mes y baja ≥ inicio de mes), o
 * - siguen activos sin baja y ya habían ingresado antes o durante el mes.
 */
export function colaboradorIncluidoContratosPorMes(
  c: ColaboradorCompleto,
  mesYm: string,
): boolean {
  if (!mesYmValido(mesYm)) return false;
  if (!expedienteColaboradorValido(c)) return false;

  const prep = prepararColaboradorParaMetricas(c);
  const ingreso = fechaIngresoNormalizadaColaborador(prep);
  const mes = mesYm.slice(0, 7);
  const mesIngreso = mesYmDesdeFechaIngreso(ingreso);

  if (mesIngreso === mes) return true;

  const inicioMes = primerDiaMesYm(mes);
  const finMes = ultimoDiaMesYm(mes);
  const finLab = finLaboralYmd(prep);

  if (ingreso && ingreso > finMes) return false;
  if (mesIngreso && mesIngreso > mes) return false;
  if (finLab && finLab < inicioMes) return false;

  if (!ingreso) return true;

  return ingreso <= finMes;
}

export function filaContratoPorMesDesdeColaborador(
  c: ColaboradorCompleto,
  mesYm: string,
): ContratoPorMesFila | null {
  if (!colaboradorIncluidoContratosPorMes(c, mesYm)) return null;
  const prep = prepararColaboradorParaMetricas(c);
  const ingreso = fechaIngresoNormalizadaColaborador(prep);
  const mes = mesYm.slice(0, 7);
  return {
    noEmpleado: String(c.noEmpleado ?? "").trim(),
    nombreCompleto: String(c.nombreCompleto ?? "").trim(),
    servicio: servicioLineaColaborador(prep),
    fechaIngreso: ingreso,
    altaEnMes: mesYmDesdeFechaIngreso(ingreso) === mes,
  };
}

export function buildContratosPorMesReport(
  list: ColaboradorCompleto[],
  mesYm: string,
): ContratoPorMesFila[] {
  const mes = mesYm.slice(0, 7);
  if (!mesYmValido(mes)) return [];

  const rows: ContratoPorMesFila[] = [];
  for (const c of list) {
    const f = filaContratoPorMesDesdeColaborador(c, mes);
    if (f) rows.push(f);
  }

  rows.sort((a, b) => {
    const na = a.noEmpleado.replace(/\D/g, "").padStart(12, "0");
    const nb = b.noEmpleado.replace(/\D/g, "").padStart(12, "0");
    if (na !== nb) return na.localeCompare(nb, "es");
    return a.nombreCompleto.localeCompare(b.nombreCompleto, "es");
  });

  return rows;
}

function csvCell(value: string): string {
  const s = String(value ?? "").replace(/"/g, '""');
  if (/[",\n\r]/.test(s)) return `"${s}"`;
  return s;
}

/** CSV UTF-8 con BOM: N.º, nombre, servicio, fecha ingreso. */
export function contratosPorMesToCsv(rows: ContratoPorMesFila[]): string {
  const headers = ["NO_EMPLEADO", "NOMBRE_COMPLETO", "SERVICIO", "FECHA_INGRESO"];
  const lines = [headers.map(csvCell).join(",")];
  for (const r of rows) {
    lines.push(
      [r.noEmpleado, r.nombreCompleto, r.servicio, r.fechaIngreso].map(csvCell).join(","),
    );
  }
  return "\uFEFF" + lines.join("\r\n");
}

export function mesActualMx(): string {
  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Mexico_City",
    year: "numeric",
    month: "2-digit",
  });
  const parts = fmt.formatToParts(new Date());
  const y = parts.find((p) => p.type === "year")?.value ?? "0000";
  const m = parts.find((p) => p.type === "month")?.value ?? "01";
  return `${y}-${m}`;
}

export function labelMesYm(mesYm: string): string {
  const [y, m] = mesYm.slice(0, 7).split("-").map(Number);
  if (!y || !m) return mesYm;
  const d = new Date(y, m - 1, 1);
  return d.toLocaleDateString("es-MX", { month: "long", year: "numeric", timeZone: "UTC" });
}
