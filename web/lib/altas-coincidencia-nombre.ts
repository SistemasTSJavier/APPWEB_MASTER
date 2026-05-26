import type { ColaboradorCompleto } from "@/lib/colaboradores-types";
import { colaboradorTieneBaja } from "@/lib/colaboradores-baja";
import { normalizarFechaParaInputDate } from "@/lib/fecha-input-normalize";

/** Compara nombres ignorando mayúsculas, espacios múltiples y acentos. */
export function normalizarNombreParaCoincidencia(raw: string): string {
  return String(raw ?? "")
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .trim()
    .toUpperCase()
    .replace(/\s+/g, " ");
}

export function fechaBajaNormalizadaColaborador(c: ColaboradorCompleto): string {
  return normalizarFechaParaInputDate(String(c.form?.fechaBaja ?? "").trim()) || "";
}

/**
 * Expedientes con el mismo nombre normalizado, con fecha de baja en expediente.
 * Excluye el N° indicado (p. ej. el que se esta capturando) para no duplicar el aviso por numero.
 */
export function findColaboradoresNombreCoincideConBaja(
  list: ColaboradorCompleto[],
  nombreCompletoForm: string,
  options?: { excludeNoEmpleado?: string; minNormalizedLength?: number },
): ColaboradorCompleto[] {
  const norm = normalizarNombreParaCoincidencia(nombreCompletoForm);
  const minL = options?.minNormalizedLength ?? 8;
  if (norm.length < minL) return [];
  const excl = (options?.excludeNoEmpleado ?? "").trim().toUpperCase();
  const out: ColaboradorCompleto[] = [];
  for (const c of list) {
    if (excl && c.noEmpleado.trim().toUpperCase() === excl) continue;
    if (!colaboradorTieneBaja(c)) continue;
    const cn = normalizarNombreParaCoincidencia(c.nombreCompleto ?? "");
    if (cn === norm) out.push(c);
  }
  return out;
}

/** Entre varias coincidencias, prioriza la fecha de baja mas reciente (YYYY-MM-DD). */
export function mejorCoincidenciaNombreConBajaPorBajaReciente(matches: ColaboradorCompleto[]): ColaboradorCompleto | null {
  if (matches.length === 0) return null;
  if (matches.length === 1) return matches[0]!;
  return [...matches].sort((a, b) => fechaBajaNormalizadaColaborador(b).localeCompare(fechaBajaNormalizadaColaborador(a)))[0] ?? null;
}

/** Coincidencia exacta de nombre normalizado (activos e inactivos). */
export function findColaboradoresPorNombreExacto(
  list: ColaboradorCompleto[],
  nombreCompletoForm: string,
  options?: { excludeNoEmpleado?: string; minNormalizedLength?: number },
): ColaboradorCompleto[] {
  const norm = normalizarNombreParaCoincidencia(nombreCompletoForm);
  const minL = options?.minNormalizedLength ?? 8;
  if (norm.length < minL) return [];
  const excl = (options?.excludeNoEmpleado ?? "").trim().toUpperCase();
  const out: ColaboradorCompleto[] = [];
  for (const c of list) {
    if (excl && c.noEmpleado.trim().toUpperCase() === excl) continue;
    const cn = normalizarNombreParaCoincidencia(c.nombreCompleto ?? "");
    if (cn === norm) out.push(c);
  }
  return out;
}

/** Elige un expediente cuando hay varios con el mismo nombre. */
export function elegirMejorCoincidenciaPorNombre(
  matches: ColaboradorCompleto[],
  noCsv?: string,
): ColaboradorCompleto | null {
  if (matches.length === 0) return null;
  const no = (noCsv ?? "").trim().toUpperCase();
  if (no) {
    const exactNo = matches.find((m) => m.noEmpleado.trim().toUpperCase() === no);
    if (exactNo) return exactNo;
  }
  if (matches.length === 1) return matches[0]!;
  const conBaja = matches.filter(colaboradorTieneBaja);
  if (conBaja.length === 1) return conBaja[0]!;
  if (conBaja.length > 1) return mejorCoincidenciaNombreConBajaPorBajaReciente(conBaja);
  return matches[0]!;
}
