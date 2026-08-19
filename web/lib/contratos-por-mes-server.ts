import type { SupabaseClient } from "@supabase/supabase-js";
import type { ColaboradorCompleto } from "@/lib/colaboradores-types";
import {
  expedienteColaboradorValido,
  fechaIngresoNormalizadaColaborador,
  prepararColaboradorParaMetricas,
} from "@/lib/colaboradores-baja";
import { attendanceRowEmpKey } from "@/lib/attendance-integrity";
import { mondaysEnMesCalendario } from "@/lib/categorizacion-faltas-cuadricula";
import { servicioCoincideFiltroCat, serviciosAgrupadosUnicosDesdePersonal } from "@/lib/categorizacion-filtros-servicio";
import type { ContratoPorMesFila, ContratosPorMesReport } from "@/lib/contratos-por-mes";
import { mesActualMx, mesYmValido } from "@/lib/contratos-por-mes";
import { fetchAllColaboradoresCompletos } from "@/lib/colaboradores-supabase-fetch-all";
import { servicioLineaColaborador } from "@/lib/servicio-agrupacion";
import { createSupabaseServiceRoleClient, hintSupabaseClientError, isSupabaseServerConfigured } from "@/lib/supabase/admin";

const TURNS = ["D", "T", "N"] as const;
const CACHE_TTL_MS = 3 * 60 * 1000;

type ShiftDay = Partial<Record<(typeof TURNS)[number], string>>;

let colaboradoresCache: {
  list: ColaboradorCompleto[];
  at: number;
} | null = null;

export function invalidateContratosPorMesCache(): void {
  colaboradoresCache = null;
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

function isAsist(v: string): boolean {
  const u = v.trim().toUpperCase();
  return u === "A" || /^\d+$/.test(u);
}

function isDdExtra(v: string): boolean {
  const u = v.trim().toUpperCase();
  if (!/^DD/i.test(u)) return false;
  return /\d/.test(u.slice(2));
}

function diaTieneTrabajo(day: ShiftDay): boolean {
  for (const turn of TURNS) {
    const v = String(day[turn] ?? "").trim();
    if (!v) continue;
    if (isAsist(v) || isDdExtra(v)) return true;
  }
  return false;
}

/** Días laborados por N.º empleado según cuadrícula (asistencia A/número o extra DD+número). */
async function diasTrabajadosPorEmpleadoEnMes(
  admin: SupabaseClient,
  mesYm: string,
): Promise<Map<string, number>> {
  const ym = mesYm.slice(0, 7);
  const [ys, ms] = ym.split("-").map((x) => Number(x));
  const y = ys || new Date().getFullYear();
  const m0 = (ms || 1) - 1;
  const monthStart = new Date(y, m0, 1);
  monthStart.setHours(0, 0, 0, 0);
  const monthEnd = new Date(y, m0 + 1, 0);
  monthEnd.setHours(0, 0, 0, 0);

  const mondays = mondaysEnMesCalendario(ym);
  const weekIsos = mondays.map((m) => dateToIsoYmd(m));
  const diasPorEmpleado = new Map<string, Set<string>>();

  if (weekIsos.length === 0) return new Map();

  const { data, error } = await admin
    .from("cuadricula_asistencia")
    .select("week_start_iso, payload")
    .in("week_start_iso", weekIsos);
  if (error) throw new Error(hintSupabaseClientError(error.message));

  for (const row of data ?? []) {
    const weekIso = String(row.week_start_iso ?? "").trim();
    const monday = mondays.find((m) => dateToIsoYmd(m) === weekIso);
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

      let fechas = diasPorEmpleado.get(no);
      if (!fechas) {
        fechas = new Set<string>();
        diasPorEmpleado.set(no, fechas);
      }

      for (let di = 0; di < shifts.length && di < 7; di++) {
        const day = shifts[di] as ShiftDay | undefined;
        if (!day || !diaTieneTrabajo(day)) continue;
        const fecha = addDays(monday, di);
        fecha.setHours(0, 0, 0, 0);
        if (fecha < monthStart || fecha > monthEnd) continue;
        fechas.add(dateToIsoYmd(fecha));
      }
    }
  }

  const out = new Map<string, number>();
  for (const [no, fechas] of diasPorEmpleado) {
    if (fechas.size > 0) out.set(no, fechas.size);
  }
  return out;
}

async function listColaboradoresCached(forceRefresh: boolean): Promise<ColaboradorCompleto[]> {
  const now = Date.now();
  if (!forceRefresh && colaboradoresCache && now - colaboradoresCache.at < CACHE_TTL_MS) {
    return colaboradoresCache.list;
  }
  const admin = createSupabaseServiceRoleClient();
  if (!admin) return [];
  const list = await fetchAllColaboradoresCompletos(admin);
  colaboradoresCache = { list, at: now };
  return list;
}

function empKeyColaborador(c: ColaboradorCompleto): string {
  return String(c.noEmpleado ?? "").trim().toUpperCase();
}

function filaDesdeColaborador(c: ColaboradorCompleto, diasTrabajados: number): ContratoPorMesFila {
  const prep = prepararColaboradorParaMetricas(c);
  return {
    noEmpleado: String(c.noEmpleado ?? "").trim(),
    nombreCompleto: String(c.nombreCompleto ?? "").trim(),
    servicio: servicioLineaColaborador(prep),
    fechaIngreso: fechaIngresoNormalizadaColaborador(prep),
    diasTrabajados,
  };
}

export async function buildContratosPorMesReportServer(opts: {
  mesYm?: string;
  servicio?: string;
  forceRefresh?: boolean;
}): Promise<ContratosPorMesReport> {
  const mesYm = (opts.mesYm ?? mesActualMx()).trim().slice(0, 7);
  const servicioFiltro = String(opts.servicio ?? "").trim();

  if (!mesYmValido(mesYm)) {
    return {
      mesYm,
      servicio: servicioFiltro,
      rows: [],
      servicios: [],
      fuente: "sin_datos",
      generadoEn: new Date().toISOString(),
    };
  }

  if (!isSupabaseServerConfigured()) {
    return {
      mesYm,
      servicio: servicioFiltro,
      rows: [],
      servicios: [],
      fuente: "sin_datos",
      generadoEn: new Date().toISOString(),
    };
  }

  const admin = createSupabaseServiceRoleClient();
  if (!admin) {
    return {
      mesYm,
      servicio: servicioFiltro,
      rows: [],
      servicios: [],
      fuente: "sin_datos",
      generadoEn: new Date().toISOString(),
    };
  }

  try {
    const [diasPorEmp, colaboradores] = await Promise.all([
      diasTrabajadosPorEmpleadoEnMes(admin, mesYm),
      listColaboradoresCached(opts.forceRefresh === true),
    ]);

    const porNo = new Map<string, ColaboradorCompleto>();
    for (const c of colaboradores) {
      if (!expedienteColaboradorValido(c)) continue;
      const key = empKeyColaborador(c);
      if (!key) continue;
      porNo.set(key, c);
    }

    const candidatos: ContratoPorMesFila[] = [];
    for (const [no, dias] of diasPorEmp) {
      const c = porNo.get(no);
      if (!c) continue;
      candidatos.push(filaDesdeColaborador(c, dias));
    }

    candidatos.sort((a, b) => {
      const na = a.noEmpleado.replace(/\D/g, "").padStart(12, "0");
      const nb = b.noEmpleado.replace(/\D/g, "").padStart(12, "0");
      if (na !== nb) return na.localeCompare(nb, "es");
      return a.nombreCompleto.localeCompare(b.nombreCompleto, "es");
    });

    const servicios = serviciosAgrupadosUnicosDesdePersonal(
      candidatos.map((r) => ({ servicio: r.servicio })),
    );

    const rows = servicioFiltro
      ? candidatos.filter((r) => servicioCoincideFiltroCat(r.servicio, servicioFiltro))
      : candidatos;

    return {
      mesYm,
      servicio: servicioFiltro,
      rows,
      servicios,
      fuente: "supabase",
      generadoEn: new Date().toISOString(),
    };
  } catch {
    return {
      mesYm,
      servicio: servicioFiltro,
      rows: [],
      servicios: [],
      fuente: "sin_datos",
      generadoEn: new Date().toISOString(),
    };
  }
}
