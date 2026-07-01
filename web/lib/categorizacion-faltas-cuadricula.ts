/**
 * Faltas del mes desde cuadrícula de asistencia (Supabase `cuadricula_asistencia`).
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { attendanceRowEmpKey } from "@/lib/attendance-integrity";
import { hintSupabaseClientError } from "@/lib/supabase/admin";

export type FaltasMesEmpleado = {
  total: number;
  /** Fechas dd/mm/aaaa con falta en el mes. */
  fechas: string[];
};

export type FaltasMesMap = Record<string, FaltasMesEmpleado>;

const TURNS = ["D", "T", "N"] as const;

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
  return x;
}

function dateToIsoYmd(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function formatDateEs(d: Date): string {
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  return `${dd}/${mm}/${d.getFullYear()}`;
}

export function mesCalendarioActualYm(hoy = new Date()): string {
  const y = hoy.getFullYear();
  const m = String(hoy.getMonth() + 1).padStart(2, "0");
  return `${y}-${m}`;
}

/** Lunes de cada semana que intersecta el mes `yyyy-mm`. */
export function mondaysEnMesCalendario(ym: string): Date[] {
  const [ys, ms] = ym.split("-").map((x) => Number(x));
  const y = ys || new Date().getFullYear();
  const m0 = (ms || 1) - 1;
  const monthStart = new Date(y, m0, 1);
  monthStart.setHours(0, 0, 0, 0);
  const monthEnd = new Date(y, m0 + 1, 0);
  monthEnd.setHours(0, 0, 0, 0);
  let wk = mondayOfWeek(monthStart);
  while (addDays(wk, 6) < monthStart) wk = addDays(wk, 7);
  const list: Date[] = [];
  while (wk <= monthEnd) {
    list.push(new Date(wk));
    wk = addDays(wk, 7);
  }
  return list;
}

export function isFaltaCodigoAsistencia(raw: string): boolean {
  const u = raw.trim().toUpperCase();
  return u === "F" || /^F[1-9]\d*$/i.test(u);
}

function normalizarNoEmpleado(raw: string): string {
  return raw.trim().toUpperCase();
}

function empNoDesdeFila(o: Record<string, unknown>): string {
  return attendanceRowEmpKey(o);
}

type ShiftDay = Partial<Record<(typeof TURNS)[number], string>>;

function contarFaltasFilaEnMes(
  shifts: ShiftDay[],
  weekMonday: Date,
  monthStart: Date,
  monthEnd: Date,
): { count: number; fechas: string[] } {
  const fechasSet = new Set<string>();
  let count = 0;
  for (let di = 0; di < shifts.length && di < 7; di++) {
    const day = shifts[di];
    if (!day) continue;
    const fecha = addDays(weekMonday, di);
    fecha.setHours(0, 0, 0, 0);
    if (fecha < monthStart || fecha > monthEnd) continue;
    let diaTieneFalta = false;
    for (const turn of TURNS) {
      const v = String(day[turn] ?? "");
      if (isFaltaCodigoAsistencia(v)) {
        count += 1;
        diaTieneFalta = true;
      }
    }
    if (diaTieneFalta) fechasSet.add(formatDateEs(fecha));
  }
  return { count, fechas: [...fechasSet] };
}

function mergeFaltas(map: FaltasMesMap, no: string, add: { count: number; fechas: string[] }): void {
  if (!no || add.count === 0) return;
  const prev = map[no] ?? { total: 0, fechas: [] };
  const fechasSet = new Set([...prev.fechas, ...add.fechas]);
  map[no] = {
    total: prev.total + add.count,
    fechas: [...fechasSet],
  };
}

function procesarPayloadSemana(
  payload: unknown,
  weekMonday: Date,
  monthStart: Date,
  monthEnd: Date,
  out: FaltasMesMap,
): void {
  if (!payload || typeof payload !== "object") return;
  const rows = (payload as { rows?: unknown }).rows;
  if (!Array.isArray(rows)) return;
  for (const raw of rows) {
    if (!raw || typeof raw !== "object") continue;
    const o = raw as Record<string, unknown>;
    const no = empNoDesdeFila(o);
    if (!no) continue;
    const shifts = o.shifts;
    if (!Array.isArray(shifts)) continue;
    const add = contarFaltasFilaEnMes(shifts as ShiftDay[], weekMonday, monthStart, monthEnd);
    mergeFaltas(out, no, add);
  }
}

/** Cuenta faltas (turnos F / F1…) por empleado en el mes calendario indicado. */
export async function contarFaltasMesDesdeCuadricula(
  admin: SupabaseClient,
  mesYm?: string,
): Promise<{ mesYm: string; faltas: FaltasMesMap }> {
  const ym = (mesYm ?? mesCalendarioActualYm()).trim();
  const [ys, ms] = ym.split("-").map((x) => Number(x));
  const y = ys || new Date().getFullYear();
  const m0 = (ms || 1) - 1;
  const monthStart = new Date(y, m0, 1);
  monthStart.setHours(0, 0, 0, 0);
  const monthEnd = new Date(y, m0 + 1, 0);
  monthEnd.setHours(0, 0, 0, 0);

  const mondays = mondaysEnMesCalendario(ym);
  const weekIsos = mondays.map((m) => dateToIsoYmd(m));
  const out: FaltasMesMap = {};

  if (weekIsos.length === 0) return { mesYm: ym, faltas: out };

  const { data, error } = await admin
    .from("cuadricula_asistencia")
    .select("week_start_iso, payload")
    .in("week_start_iso", weekIsos);

  if (error) throw new Error(hintSupabaseClientError(error.message));

  for (const row of data ?? []) {
    const weekIso = String(row.week_start_iso ?? "").trim();
    const monday = mondays.find((m) => dateToIsoYmd(m) === weekIso);
    if (!monday) continue;
    procesarPayloadSemana(row.payload, monday, monthStart, monthEnd, out);
  }

  for (const key of Object.keys(out)) {
    out[key]!.fechas.sort((a, b) => {
      const pa = a.split("/").map(Number);
      const pb = b.split("/").map(Number);
      const da = new Date(pa[2] ?? 0, (pa[1] ?? 1) - 1, pa[0] ?? 1).getTime();
      const db = new Date(pb[2] ?? 0, (pb[1] ?? 1) - 1, pb[0] ?? 1).getTime();
      return da - db;
    });
  }

  return { mesYm: ym, faltas: out };
}

export function faltasMesParaEmpleado(map: FaltasMesMap, noEmpleado: string): FaltasMesEmpleado {
  return map[normalizarNoEmpleado(noEmpleado)] ?? { total: 0, fechas: [] };
}

export function etiquetaFaltasMes(f: FaltasMesEmpleado): string {
  if (f.total <= 0) return "";
  const fechas = f.fechas.length > 0 ? f.fechas.join("; ") : "";
  return fechas ? `${f.total} falta(s) · ${fechas}` : `${f.total} falta(s)`;
}
