/**
 * Faltas (F / F1…) y PSGS desde cuadrícula de asistencia (`cuadricula_asistencia`).
 * Misma lectura de códigos y claves de empleado que el módulo Cuadrícula.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { attendanceRowEmpKey } from "@/lib/attendance-integrity";
import { canonicalEmpNoAttendance } from "@/lib/attendance-emp-no";
import type { ColaboradorCompleto } from "@/lib/colaboradores-types";
import { isFaltaCodigoAsistencia } from "@/lib/categorizacion-faltas-cuadricula";
import { hintSupabaseClientError } from "@/lib/supabase/admin";

const TURNS = ["D", "T", "N"] as const;
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

function mondayOfWeek(d: Date): Date {
  const c = new Date(d);
  c.setHours(0, 0, 0, 0);
  const day = c.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  c.setDate(c.getDate() + diff);
  return c;
}

function addDays(d: Date, n: number): Date {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  x.setHours(0, 0, 0, 0);
  return x;
}

function mondaysEnRango(desde: Date, hasta: Date): Date[] {
  const start = new Date(desde);
  start.setHours(0, 0, 0, 0);
  const end = new Date(hasta);
  end.setHours(0, 0, 0, 0);
  let wk = mondayOfWeek(start);
  while (addDays(wk, 6) < start) wk = addDays(wk, 7);
  const list: Date[] = [];
  while (wk <= end) {
    list.push(new Date(wk));
    wk = addDays(wk, 7);
  }
  return list;
}

function celdaAsistencia(raw: unknown): string {
  return String(raw ?? "").trim();
}

function isPsgsCodigo(raw: string): boolean {
  return raw.trim().toUpperCase() === "PSGS";
}

type ShiftDay = Partial<Record<(typeof TURNS)[number], unknown>>;

function incidenciasFilaEnRango(
  shifts: ShiftDay[],
  weekMonday: Date,
  rangeStart: Date,
  rangeEnd: Date,
): IncidenciaAsistenciaDia[] {
  const out: IncidenciaAsistenciaDia[] = [];
  for (let di = 0; di < shifts.length && di < 7; di++) {
    const day = shifts[di];
    if (!day) continue;
    const fecha = addDays(weekMonday, di);
    if (fecha < rangeStart || fecha > rangeEnd) continue;
    const ymd = dateToIsoYmd(fecha);
    let tieneFalta = false;
    let tienePsgs = false;
    for (const turn of TURNS) {
      const v = celdaAsistencia(day[turn]);
      if (!v) continue;
      if (isFaltaCodigoAsistencia(v)) tieneFalta = true;
      else if (isPsgsCodigo(v)) tienePsgs = true;
    }
    if (tieneFalta) out.push({ ymd, kind: "falta" });
    if (tienePsgs) out.push({ ymd, kind: "psgs" });
  }
  return out;
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
 * Lee todas las cuadrículas (todas las plantas/scope) en un rango de fechas.
 * Pagina para no truncar en ~1000 filas de PostgREST.
 */
export async function cargarIncidenciasCuadriculaEnRango(
  admin: SupabaseClient,
  desde: Date,
  hasta: Date,
): Promise<Map<string, IncidenciaAsistenciaDia[]>> {
  const mondays = mondaysEnRango(desde, hasta);
  const out = new Map<string, IncidenciaAsistenciaDia[]>();
  if (mondays.length === 0) return out;

  const firstMondayIso = dateToIsoYmd(mondays[0]!);
  const lastMondayIso = dateToIsoYmd(mondays[mondays.length - 1]!);
  let offset = 0;

  while (true) {
    const { data, error } = await admin
      .from("cuadricula_asistencia")
      .select("week_start_iso, payload")
      .gte("week_start_iso", firstMondayIso)
      .lte("week_start_iso", lastMondayIso)
      .order("week_start_iso", { ascending: true })
      .order("scope_key", { ascending: true })
      .range(offset, offset + CUADRICULA_PAGE_SIZE - 1);

    if (error) throw new Error(hintSupabaseClientError(error.message));

    const page = data ?? [];
    if (page.length === 0) break;

    for (const row of page) {
      const weekIso = String(row.week_start_iso ?? "").trim();
      const monday = parseYmd(weekIso);
      if (!monday) continue;
      const payload = row.payload;
      if (!payload || typeof payload !== "object") continue;
      const rows = (payload as { rows?: unknown }).rows;
      if (!Array.isArray(rows)) continue;
      for (const raw of rows) {
        if (!raw || typeof raw !== "object") continue;
        const o = raw as Record<string, unknown>;
        const no = attendanceRowEmpKey(o);
        if (!no) continue;
        const shifts = o.shifts;
        if (!Array.isArray(shifts)) continue;
        const add = incidenciasFilaEnRango(shifts as ShiftDay[], monday, desde, hasta);
        mergeIncidencias(out, no, add);
      }
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

  for (const clave of claves) {
    const list = map.get(clave) ?? [];
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
