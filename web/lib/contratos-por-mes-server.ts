import type { SupabaseClient } from "@supabase/supabase-js";
import type { ColaboradorCompleto } from "@/lib/colaboradores-types";
import {
  estatusEmpleadoNormalizado,
  expedienteColaboradorValido,
  fechaIngresoNormalizadaColaborador,
  prepararColaboradorParaMetricas,
} from "@/lib/colaboradores-baja";
import {
  isFaltaCodigoAsistencia,
  mondaysEnMesCalendario,
} from "@/lib/categorizacion-faltas-cuadricula";
import { servicioCoincideFiltroCat, serviciosAgrupadosUnicosDesdePersonal, variantesServicioDesdeFilas, filaCoincideVarianteServicio, servicioUsaFiltroPlanta } from "@/lib/categorizacion-filtros-servicio";
import type { ContratoPorMesFila, ContratosPorMesPeriodo, ContratosPorMesReport } from "@/lib/contratos-por-mes";
import {
  anioActualMx,
  anioValido,
  labelAnio,
  labelMesYm,
  mesActualMx,
  mesYmValido,
} from "@/lib/contratos-por-mes";
import { fetchAllColaboradoresCompletos } from "@/lib/colaboradores-supabase-fetch-all";
import { servicioLineaColaborador } from "@/lib/servicio-agrupacion";
import { createSupabaseServiceRoleClient, hintSupabaseClientError, isSupabaseServerConfigured } from "@/lib/supabase/admin";

const TURNS = ["D", "T", "N"] as const;
const CACHE_TTL_MS = 3 * 60 * 1000;

type ShiftDay = Partial<Record<(typeof TURNS)[number], string>>;

type EmpAsistenciaAgg = {
  diasTrabajados: Set<string>;
  fechasFaltas: Set<string>;
  nombreGrid: string;
  servicioGrid: string;
};

let colaboradoresCache: {
  list: ColaboradorCompleto[];
  at: number;
} | null = null;

export function invalidateContratosPorMesCache(): void {
  colaboradoresCache = null;
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

function diaTieneFalta(day: ShiftDay): boolean {
  for (const turn of TURNS) {
    const v = String(day[turn] ?? "").trim();
    if (v && isFaltaCodigoAsistencia(v)) return true;
  }
  return false;
}

function mondaysEnAnioCalendario(anio: number): Date[] {
  const seen = new Set<string>();
  const out: Date[] = [];
  for (let m = 1; m <= 12; m++) {
    const ym = `${anio}-${String(m).padStart(2, "0")}`;
    for (const monday of mondaysEnMesCalendario(ym)) {
      const iso = dateToIsoYmd(monday);
      if (seen.has(iso)) continue;
      seen.add(iso);
      out.push(monday);
    }
  }
  return out;
}

function rangoPeriodo(periodo: ContratosPorMesPeriodo, mesYm: string, anio: number): {
  rangeStart: Date;
  rangeEnd: Date;
  mondays: Date[];
  periodoLabel: string;
} {
  if (periodo === "anio") {
    const rangeStart = new Date(anio, 0, 1);
    rangeStart.setHours(0, 0, 0, 0);
    const rangeEnd = new Date(anio, 11, 31);
    rangeEnd.setHours(0, 0, 0, 0);
    return {
      rangeStart,
      rangeEnd,
      mondays: mondaysEnAnioCalendario(anio),
      periodoLabel: labelAnio(anio),
    };
  }

  const ym = mesYm.slice(0, 7);
  const [ys, ms] = ym.split("-").map((x) => Number(x));
  const y = ys || new Date().getFullYear();
  const m0 = (ms || 1) - 1;
  const rangeStart = new Date(y, m0, 1);
  rangeStart.setHours(0, 0, 0, 0);
  const rangeEnd = new Date(y, m0 + 1, 0);
  rangeEnd.setHours(0, 0, 0, 0);
  return {
    rangeStart,
    rangeEnd,
    mondays: mondaysEnMesCalendario(ym),
    periodoLabel: labelMesYm(ym),
  };
}

/** Asistencia y faltas por N.º empleado según cuadrícula en el periodo. */
async function asistenciaPorEmpleadoEnPeriodo(
  admin: SupabaseClient,
  periodo: ContratosPorMesPeriodo,
  mesYm: string,
  anio: number,
): Promise<Map<string, EmpAsistenciaAgg>> {
  const { rangeStart, rangeEnd } = rangoPeriodo(periodo, mesYm, anio);
  const porEmpleado = new Map<string, EmpAsistenciaAgg>();

  const inicioYmd = dateToIsoYmd(rangeStart);
  const finYmd = dateToIsoYmd(rangeEnd);
  const PAGE = 1000;
  let offset = 0;

  while (true) {
    const { data, error } = await admin
      .from("cuadricula_asistencia_dias")
      .select("employee_no, fecha, codigo_d, codigo_t, codigo_n, nombre, servicio")
      .gte("fecha", inicioYmd)
      .lte("fecha", finYmd)
      .order("fecha", { ascending: true })
      .order("employee_no", { ascending: true })
      .range(offset, offset + PAGE - 1);
    if (error) throw new Error(hintSupabaseClientError(error.message));

    const page = data ?? [];
    if (page.length === 0) break;

    for (const row of page) {
      const no = String(row.employee_no ?? "").trim().toUpperCase();
      if (!no) continue;
      const fechaIso = String(row.fecha ?? "").trim();
      if (!fechaIso) continue;

      const day: ShiftDay = {
        D: String(row.codigo_d ?? ""),
        T: String(row.codigo_t ?? ""),
        N: String(row.codigo_n ?? ""),
      };

      let agg = porEmpleado.get(no);
      if (!agg) {
        agg = {
          diasTrabajados: new Set<string>(),
          fechasFaltas: new Set<string>(),
          nombreGrid: String(row.nombre ?? "").trim(),
          servicioGrid: String(row.servicio ?? "").trim(),
        };
        porEmpleado.set(no, agg);
      } else {
        const nombre = String(row.nombre ?? "").trim();
        const srv = String(row.servicio ?? "").trim();
        if (nombre) agg.nombreGrid = nombre;
        if (srv) agg.servicioGrid = srv;
      }

      if (diaTieneTrabajo(day)) {
        agg.diasTrabajados.add(fechaIso);
      }
      if (diaTieneFalta(day)) {
        const [y, m, d] = fechaIso.split("-").map(Number);
        const fecha = new Date(y || 1970, (m || 1) - 1, d || 1);
        fecha.setHours(0, 0, 0, 0);
        agg.fechasFaltas.add(formatDateEs(fecha));
      }
    }

    if (page.length < PAGE) break;
    offset += PAGE;
  }

  return porEmpleado;
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

function colaboradorEstaActivo(c: ColaboradorCompleto): boolean {
  const est = estatusEmpleadoNormalizado(c.form);
  return est !== "INACTIVO" && est !== "BAJA";
}

function filaDesdeColaborador(
  c: ColaboradorCompleto,
  agg: EmpAsistenciaAgg,
): ContratoPorMesFila | null {
  if (agg.diasTrabajados.size === 0) return null;
  const prep = prepararColaboradorParaMetricas(c);
  const fechasFaltas = [...agg.fechasFaltas].sort((a, b) => {
    const [da, ma, ya] = a.split("/").map(Number);
    const [db, mb, yb] = b.split("/").map(Number);
    return new Date(ya, ma - 1, da).getTime() - new Date(yb, mb - 1, db).getTime();
  });
  return {
    noEmpleado: String(c.noEmpleado ?? "").trim(),
    nombreCompleto: String(c.nombreCompleto ?? "").trim(),
    servicio: servicioLineaColaborador(prep),
    fechaIngreso: fechaIngresoNormalizadaColaborador(prep),
    diasTrabajados: agg.diasTrabajados.size,
    fechasFaltas,
    activo: colaboradorEstaActivo(prep),
  };
}

function filaDesdeCuadricula(no: string, agg: EmpAsistenciaAgg): ContratoPorMesFila | null {
  if (agg.diasTrabajados.size === 0) return null;
  const fechasFaltas = [...agg.fechasFaltas].sort((a, b) => {
    const [da, ma, ya] = a.split("/").map(Number);
    const [db, mb, yb] = b.split("/").map(Number);
    return new Date(ya, ma - 1, da).getTime() - new Date(yb, mb - 1, db).getTime();
  });
  return {
    noEmpleado: no,
    nombreCompleto: agg.nombreGrid || no,
    servicio: agg.servicioGrid,
    fechaIngreso: "",
    diasTrabajados: agg.diasTrabajados.size,
    fechasFaltas,
    activo: false,
  };
}

function emptyReport(
  periodo: ContratosPorMesPeriodo,
  mesYm: string,
  anio: number | null,
  servicioFiltro: string,
  periodoLabel: string,
  varianteFiltro = "",
): ContratosPorMesReport {
  return {
    periodo,
    mesYm,
    anio,
    periodoLabel,
    servicio: servicioFiltro,
    variante: varianteFiltro,
    rows: [],
    servicios: [],
    variantesServicio: [],
    fuente: "sin_datos",
    generadoEn: new Date().toISOString(),
  };
}

export async function buildContratosPorMesReportServer(opts: {
  periodo?: ContratosPorMesPeriodo;
  mesYm?: string;
  anio?: number;
  servicio?: string;
  variante?: string;
  forceRefresh?: boolean;
}): Promise<ContratosPorMesReport> {
  const periodo: ContratosPorMesPeriodo = opts.periodo === "anio" ? "anio" : "mes";
  const mesYm = (opts.mesYm ?? mesActualMx()).trim().slice(0, 7);
  const anio = opts.anio ?? anioActualMx();
  const servicioFiltro = String(opts.servicio ?? "").trim();
  const varianteFiltro = String(opts.variante ?? "").trim();

  if (periodo === "mes" && !mesYmValido(mesYm)) {
    return emptyReport(periodo, mesYm, null, servicioFiltro, labelMesYm(mesYm), varianteFiltro);
  }
  if (periodo === "anio" && !anioValido(anio)) {
    return emptyReport(periodo, mesYm, anio, servicioFiltro, labelAnio(anio), varianteFiltro);
  }

  const { periodoLabel } = rangoPeriodo(periodo, mesYm, anio);

  if (!isSupabaseServerConfigured()) {
    return emptyReport(periodo, mesYm, periodo === "anio" ? anio : null, servicioFiltro, periodoLabel, varianteFiltro);
  }

  const admin = createSupabaseServiceRoleClient();
  if (!admin) {
    return emptyReport(periodo, mesYm, periodo === "anio" ? anio : null, servicioFiltro, periodoLabel, varianteFiltro);
  }

  try {
    const [asistenciaPorEmp, colaboradores] = await Promise.all([
      asistenciaPorEmpleadoEnPeriodo(admin, periodo, mesYm, anio),
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
    for (const [no, agg] of asistenciaPorEmp) {
      const c = porNo.get(no);
      const fila = c ? filaDesdeColaborador(c, agg) : filaDesdeCuadricula(no, agg);
      if (fila) candidatos.push(fila);
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

    const delServicio = servicioFiltro
      ? candidatos.filter((r) => servicioCoincideFiltroCat(r.servicio, servicioFiltro))
      : candidatos;

    const variantesServicio =
      servicioFiltro && servicioUsaFiltroPlanta(servicioFiltro)
        ? variantesServicioDesdeFilas(delServicio, servicioFiltro)
        : [];

    let rows = delServicio;
    if (varianteFiltro && servicioUsaFiltroPlanta(servicioFiltro)) {
      rows = rows.filter((r) => filaCoincideVarianteServicio(r.servicio, varianteFiltro));
    }

    return {
      periodo,
      mesYm: periodo === "mes" ? mesYm : "",
      anio: periodo === "anio" ? anio : null,
      periodoLabel,
      servicio: servicioFiltro,
      variante: varianteFiltro,
      rows,
      servicios,
      variantesServicio,
      fuente: "supabase",
      generadoEn: new Date().toISOString(),
    };
  } catch {
    return emptyReport(periodo, mesYm, periodo === "anio" ? anio : null, servicioFiltro, periodoLabel, varianteFiltro);
  }
}
