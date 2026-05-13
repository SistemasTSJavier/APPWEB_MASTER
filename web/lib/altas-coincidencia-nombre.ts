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
