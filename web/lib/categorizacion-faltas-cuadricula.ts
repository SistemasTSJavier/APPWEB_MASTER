/**
 * Faltas del mes desde cuadrícula de asistencia (tabla `cuadricula_asistencia_dias`).
 */
import type { SupabaseClient } from "@supabase/supabase-js";
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

/**
 * Mes de referencia para categorización en desfase (faltas / ausentismos / recompensas del dashboard).
 * Usa el mes calendario anterior al actual.
 */
export function mesCalendarioAnteriorYm(hoy = new Date()): string {
  const d = new Date(hoy.getFullYear(), hoy.getMonth() - 1, 1);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
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

function mergeFaltas(map: FaltasMesMap, no: string, add: { count: number; fechas: string[] }): void {
  if (!no || add.count === 0) return;
  const prev = map[no] ?? { total: 0, fechas: [] };
  const fechasSet = new Set([...prev.fechas, ...add.fechas]);
  map[no] = {
    total: prev.total + add.count,
    fechas: [...fechasSet],
  };
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

  const out: FaltasMesMap = {};
  const inicioYmd = dateToIsoYmd(monthStart);
  const finYmd = dateToIsoYmd(monthEnd);
  const PAGE = 1000;
  let offset = 0;

  while (true) {
    const { data, error } = await admin
      .from("cuadricula_asistencia_dias")
      .select("employee_no, fecha, codigo_d, codigo_t, codigo_n")
      .gte("fecha", inicioYmd)
      .lte("fecha", finYmd)
      .order("fecha", { ascending: true })
      .order("employee_no", { ascending: true })
      .range(offset, offset + PAGE - 1);

    if (error) throw new Error(hintSupabaseClientError(error.message));

    const page = data ?? [];
    if (page.length === 0) break;

    for (const row of page) {
      const no = normalizarNoEmpleado(String(row.employee_no ?? ""));
      if (!no) continue;
      const fechaIso = String(row.fecha ?? "").trim();
      if (!fechaIso) continue;
      const [yy, mm, dd] = fechaIso.split("-").map(Number);
      const fecha = new Date(yy || 1970, (mm || 1) - 1, dd || 1);
      fecha.setHours(0, 0, 0, 0);

      let count = 0;
      for (const turn of TURNS) {
        const col = turn === "D" ? "codigo_d" : turn === "T" ? "codigo_t" : "codigo_n";
        const v = String((row as Record<string, unknown>)[col] ?? "");
        if (isFaltaCodigoAsistencia(v)) count += 1;
      }
      if (count === 0) continue;
      mergeFaltas(out, no, { count, fechas: [formatDateEs(fecha)] });
    }

    if (page.length < PAGE) break;
    offset += PAGE;
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
