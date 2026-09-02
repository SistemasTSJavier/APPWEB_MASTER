/**
 * Faltas (F / F1…) y PSGS desde cuadrícula de asistencia (`cuadricula_asistencia_dias`).
 * Bonos: solo F y PSGS descalifican; CAP, INC, VAC y PCGS no afectan el cumplimiento.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { canonicalEmpNoAttendance } from "@/lib/attendance-emp-no";
import type { ColaboradorCompleto } from "@/lib/colaboradores-types";
import { isFaltaCodigoAsistencia } from "@/lib/categorizacion-faltas-cuadricula";
import { hintSupabaseClientError } from "@/lib/supabase/admin";

const CUADRICULA_PAGE_SIZE = 500;

export type IncidenciaAsistenciaKind = "falta" | "psgs";

export type IncidenciaAsistenciaDia = { ymd: string; kind: IncidenciaAsistenciaKind };

export type PeriodoAsistencia = {
  inicio: Date;
  fin: Date;
  inicioYmd: string;
  finYmd: string;
};

function parseYmd(ymd: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(ymd.trim());
  if (!m) return null;
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  d.setHours(0, 0, 0, 0);
  return Number.isNaN(d.getTime()) ? null : d;
}

export function dateToIsoYmd(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function celdaAsistencia(raw: unknown): string {
  return String(raw ?? "").trim();
}

/** Normaliza código de celda (mayúsculas, sin puntuación final). */
export function normalizarCodigoAsistenciaCelda(raw: string): string {
  return raw.trim().toUpperCase().replace(/[.,;]+$/g, "");
}

/** Tokens en una celda (p. ej. «CAP» o «D/CAP»). */
export function codigosEnCeldaAsistencia(raw: string): string[] {
  const v = celdaAsistencia(raw);
  if (!v) return [];
  if (/[+/|]/.test(v)) {
    return v
      .split(/[+/|]/)
      .map((p) => normalizarCodigoAsistenciaCelda(p))
      .filter(Boolean);
  }
  const norm = normalizarCodigoAsistenciaCelda(v);
  return norm ? [norm] : [];
}

/**
 * Bonos: únicamente falta (F / F1…) o PSGS eliminan el cumplimiento.
 * CAP, INC, VAC, PCGS y demás códigos no descalifican.
 */
export function codigoDescalificaCumplimientoBono(raw: string): boolean {
  return codigosEnCeldaAsistencia(raw).some((c) => isFaltaCodigoAsistencia(c) || c === "PSGS");
}

function isPsgsCodigo(raw: string): boolean {
  return codigosEnCeldaAsistencia(raw).some((c) => c === "PSGS");
}

function isFaltaCodigoCelda(raw: string): boolean {
  return codigosEnCeldaAsistencia(raw).some((c) => isFaltaCodigoAsistencia(c));
}

function mergeIncidencias(
  map: Map<string, IncidenciaAsistenciaDia[]>,
  no: string,
  add: IncidenciaAsistenciaDia[],
): void {
  if (!no || add.length === 0) return;
  const prev = map.get(no) ?? [];
  map.set(no, [...prev, ...add]);
}

/** Claves de N.º empleado posibles en expediente ↔ cuadrícula. */
export function clavesAsistenciaColaborador(c: ColaboradorCompleto): string[] {
  const keys = new Set<string>();
  for (const raw of [c.noEmpleado, c.form?.noEmpleado1, c.form?.noEmpleado]) {
    const k = canonicalEmpNoAttendance(String(raw ?? ""));
    if (k) keys.add(k);
  }
  return [...keys];
}

export function clavesAsistenciaEmpleado(rawNo: string): string[] {
  const k = canonicalEmpNoAttendance(String(rawNo ?? ""));
  return k ? [k] : [];
}

/**
 * Lee incidencias (falta / PSGS) en un rango de fechas desde `cuadricula_asistencia_dias`.
 * Pagina para no truncar en ~1000 filas de PostgREST.
 */
export async function cargarIncidenciasCuadriculaEnRango(
  admin: SupabaseClient,
  desde: Date,
  hasta: Date,
): Promise<Map<string, IncidenciaAsistenciaDia[]>> {
  const out = new Map<string, IncidenciaAsistenciaDia[]>();
  const rangeStart = new Date(desde);
  rangeStart.setHours(0, 0, 0, 0);
  const rangeEnd = new Date(hasta);
  rangeEnd.setHours(0, 0, 0, 0);
  const inicioYmd = dateToIsoYmd(rangeStart);
  const finYmd = dateToIsoYmd(rangeEnd);
  let offset = 0;

  while (true) {
    const { data, error } = await admin
      .from("cuadricula_asistencia_dias")
      .select("employee_no, fecha, codigo_d, codigo_t, codigo_n")
      .gte("fecha", inicioYmd)
      .lte("fecha", finYmd)
      .order("fecha", { ascending: true })
      .order("employee_no", { ascending: true })
      .range(offset, offset + CUADRICULA_PAGE_SIZE - 1);

    if (error) throw new Error(hintSupabaseClientError(error.message));

    const page = data ?? [];
    if (page.length === 0) break;

    for (const row of page) {
      const no = canonicalEmpNoAttendance(String(row.employee_no ?? ""));
      if (!no) continue;
      const ymd = String(row.fecha ?? "").trim();
      if (!ymd) continue;

      let tieneFalta = false;
      let tienePsgs = false;
      for (const col of ["codigo_d", "codigo_t", "codigo_n"] as const) {
        const v = celdaAsistencia((row as Record<string, unknown>)[col]);
        if (!v) continue;
        if (!codigoDescalificaCumplimientoBono(v)) continue;
        if (isFaltaCodigoCelda(v)) tieneFalta = true;
        if (isPsgsCodigo(v)) tienePsgs = true;
      }
      const add: IncidenciaAsistenciaDia[] = [];
      if (tieneFalta) add.push({ ymd, kind: "falta" });
      if (tienePsgs) add.push({ ymd, kind: "psgs" });
      mergeIncidencias(out, no, add);
    }

    if (page.length < CUADRICULA_PAGE_SIZE) break;
    offset += CUADRICULA_PAGE_SIZE;
  }

  return out;
}

export function incidenciasEnPeriodo(
  map: Map<string, IncidenciaAsistenciaDia[]>,
  clavesEmpleado: string[],
  periodo: PeriodoAsistencia,
): { faltas: number; psgs: number; dias: string[] } {
  const diasFalta = new Set<string>();
  const diasPsgs = new Set<string>();
  const claves = new Set(clavesEmpleado.map((k) => canonicalEmpNoAttendance(k)).filter(Boolean));
  if (claves.size === 0) {
    return { faltas: 0, psgs: 0, dias: [] };
  }

  // Coincide por clave canónica (tolera ceros a la izquierda / variantes en el mapa).
  for (const [mapKey, list] of map) {
    const canon = canonicalEmpNoAttendance(mapKey);
    if (!canon || !claves.has(canon)) continue;
    for (const ev of list) {
      if (ev.ymd < periodo.inicioYmd || ev.ymd > periodo.finYmd) continue;
      if (ev.kind === "falta") diasFalta.add(ev.ymd);
      else diasPsgs.add(ev.ymd);
    }
  }

  return {
    faltas: diasFalta.size,
    psgs: diasPsgs.size,
    dias: [...new Set([...diasFalta, ...diasPsgs])].sort(),
  };
}

export function colaboradorTieneIncidenciaAsistenciaEnPeriodo(
  map: Map<string, IncidenciaAsistenciaDia[]>,
  clavesEmpleado: string[],
  periodo: PeriodoAsistencia,
): boolean {
  const { faltas, psgs } = incidenciasEnPeriodo(map, clavesEmpleado, periodo);
  return faltas >= 1 || psgs >= 1;
}

/** Bonos: true si hay falta o PSGS en el periodo (CAP/INC/VAC/PCGS no cuentan). */
export function colaboradorIncumpleBonoEnPeriodo(
  map: Map<string, IncidenciaAsistenciaDia[]>,
  clavesEmpleado: string[],
  periodo: PeriodoAsistencia,
): boolean {
  return colaboradorTieneIncidenciaAsistenciaEnPeriodo(map, clavesEmpleado, periodo);
}

export function periodoDesdeIngresoHasta(fechaIngreso: string, fin: Date): PeriodoAsistencia | null {
  const inicio = parseYmd(fechaIngreso);
  if (!inicio || inicio > fin) return null;
  return {
    inicio,
    fin,
    inicioYmd: dateToIsoYmd(inicio),
    finYmd: dateToIsoYmd(fin),
  };
}
