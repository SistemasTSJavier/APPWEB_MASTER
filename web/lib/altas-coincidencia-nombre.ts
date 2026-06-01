import type { ColaboradorCompleto } from "@/lib/colaboradores-types";
import { colaboradorTieneBaja } from "@/lib/colaboradores-baja";
import { nombreCompletoDesdePartes } from "@/lib/altas-form-catalogo";
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

/** Nombre visible del expediente (linea, form o partes del alta). */
export function nombreCompletoExpediente(c: ColaboradorCompleto): string {
  const linea = String(c.nombreCompleto ?? "").trim();
  if (linea) return linea;
  const form = String(c.form?.nombreCompleto ?? "").trim();
  if (form) return form;
  return nombreCompletoDesdePartes(
    String(c.form?.apellidoPaterno ?? ""),
    String(c.form?.apellidoMaterno ?? ""),
    String(c.form?.nombres ?? ""),
  );
}

/** Coincidencia exacta de nombre normalizado contra todos los expedientes. */
export function findColaboradoresPorNombreExpediente(
  list: ColaboradorCompleto[],
  nombreCsv: string,
  options?: { minNormalizedLength?: number },
): ColaboradorCompleto[] {
  const norm = normalizarNombreParaCoincidencia(nombreCsv);
  const minL = options?.minNormalizedLength ?? 5;
  if (norm.length < minL) return [];
  const out: ColaboradorCompleto[] = [];
  const seen = new Set<string>();
  for (const c of list) {
    const cn = normalizarNombreParaCoincidencia(nombreCompletoExpediente(c));
    if (cn !== norm) continue;
    const key = c.noEmpleado.trim().toUpperCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(c);
  }
  return out;
}

export type ResolverExpedienteRenumeracionResult =
  | { ok: true; colaborador: ColaboradorCompleto }
  | { ok: false; message: string };

/**
 * Localiza un expediente por nombre para renumeracion.
 * Prioriza activos (sin baja); si hay varios con el mismo nombre, devuelve error.
 */
export function resolverExpedientePorNombreRenumeracion(
  list: ColaboradorCompleto[],
  nombreCsv: string,
): ResolverExpedienteRenumeracionResult {
  const nombre = nombreCsv.trim();
  if (!nombre) {
    return { ok: false, message: "NOMBRE VACIO" };
  }

  const matches = findColaboradoresPorNombreExpediente(list, nombre);
  if (matches.length === 0) {
    return { ok: false, message: `«${nombre}»: SIN EXPEDIENTE CON ESE NOMBRE` };
  }

  const activos = matches.filter((c) => !colaboradorTieneBaja(c));
  const pool = activos.length > 0 ? activos : matches;

  if (pool.length === 1) {
    return { ok: true, colaborador: pool[0]! };
  }

  const nums = pool.map((c) => c.noEmpleado.trim()).join(", ");
  return {
    ok: false,
    message: `«${nombre}»: HAY ${pool.length} EXPEDIENTES (${nums}). ACOTA EL NOMBRE O CORRIGE DUPLICADOS.`,
  };
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
