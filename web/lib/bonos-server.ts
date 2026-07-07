import type { SupabaseClient } from "@supabase/supabase-js";
import {
  colaboradorEstaActivoEnOperacion,
  fechaIngresoNormalizadaColaborador,
} from "@/lib/colaboradores-baja";
import type { ColaboradorCompleto } from "@/lib/colaboradores-types";
import { fetchAllColaboradoresCompletos } from "@/lib/colaboradores-supabase-fetch-all";
import {
  servicioClaveFiltroCat,
  servicioCoincideFiltroCat,
} from "@/lib/categorizacion-filtros-servicio";
import {
  claveServicioCompacta,
  servicioCatPersonalEsCalificable,
} from "@/lib/categorizacion-servicios-calificables";
import { servicioLineaColaborador } from "@/lib/servicio-agrupacion";
import {
  cargarIncidenciasCuadriculaEnRango,
  clavesAsistenciaColaborador,
  colaboradorIncumpleBonoEnPeriodo,
  dateToIsoYmd,
} from "@/lib/cuadricula-incidencias-asistencia";
import {
  BONOS_ANTIGUEDAD_TOPE_90,
  type BonosFila,
  type BonosMilestone,
  type BonosPayload,
} from "@/lib/bonos-types";
import { fechaYmdEnSemana, semanaDesdeIso } from "@/lib/semana-lun-dom";

const MS_DIA = 86_400_000;

/** Servicios administrativos/corporativos excluidos de bonos (variante MATRIZ TACTICA sin L). */
const BONOS_SERVICIOS_EXCLUIDOS_EXTRA = new Set([
  claveServicioCompacta("MATRIZ TACTICA"),
  claveServicioCompacta("ADMINISTRACION"),
]);

type PeriodoBono = { inicio: Date; fin: Date; inicioYmd: string; finYmd: string };

type HitoCumplido = {
  bonoDias: BonosMilestone;
  fechaCumplimiento: string;
  periodoEvaluadoDesde: string;
  periodoEvaluadoHasta: string;
};

function parseYmd(ymd: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(ymd.trim());
  if (!m) return null;
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  d.setHours(0, 0, 0, 0);
  return Number.isNaN(d.getTime()) ? null : d;
}

function addDays(d: Date, n: number): Date {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  x.setHours(0, 0, 0, 0);
  return x;
}

/** Días calendario activos desde ingreso hasta hoy (0 = mismo día de ingreso). */
export function diasActivosDesdeIngreso(fechaIngreso: string, hoy: Date): number | null {
  const hire = parseYmd(fechaIngreso);
  if (!hire || hire > hoy) return null;
  return Math.floor((hoy.getTime() - hire.getTime()) / MS_DIA);
}

/** Periodo evaluado: fecha de ingreso → ingreso + N días (fecha de cumplimiento). */
export function periodoBonoDesdeIngreso(fechaIngreso: string, dias: BonosMilestone): PeriodoBono | null {
  const inicio = parseYmd(fechaIngreso);
  if (!inicio) return null;
  const fin = addDays(inicio, dias);
  return {
    inicio,
    fin,
    inicioYmd: dateToIsoYmd(inicio),
    finYmd: dateToIsoYmd(fin),
  };
}

/**
 * Hito que corresponde a la antigüedad actual:
 * 15–29 → 15 | 30–59 → 30 | 60–89 → 60 | 90–119 → 90
 */
export function hitoVigentePorAntiguedad(diasActivos: number): BonosMilestone | null {
  if (diasActivos < 15) return null;
  if (diasActivos < 30) return 15;
  if (diasActivos < 60) return 30;
  if (diasActivos < 90) return 60;
  if (diasActivos < BONOS_ANTIGUEDAD_TOPE_90) return 90;
  return null;
}

export function antiguedadEnRangoHito(diasActivos: number, hito: BonosMilestone): boolean {
  switch (hito) {
    case 15:
      return diasActivos >= 15 && diasActivos < 30;
    case 30:
      return diasActivos >= 30 && diasActivos < 60;
    case 60:
      return diasActivos >= 60 && diasActivos < 90;
    case 90:
      return diasActivos >= 90 && diasActivos < BONOS_ANTIGUEDAD_TOPE_90;
    default:
      return false;
  }
}

function servicioColaborador(c: ColaboradorCompleto): string {
  return (
    servicioLineaColaborador(c) ||
    String(c.servicioAsignado ?? c.form?.servicio ?? c.ultimoServicio ?? "").trim()
  );
}

function localForaneoColaborador(c: ColaboradorCompleto): string {
  return String(c.form?.localForaneo ?? "LOCAL").trim().toUpperCase() || "LOCAL";
}

export function colaboradorEsLocalBonos(c: ColaboradorCompleto): boolean {
  return localForaneoColaborador(c) === "LOCAL";
}

export function servicioEsElegibleBonos(servicio: string): boolean {
  if (!servicioCatPersonalEsCalificable(servicio)) return false;
  const compact = claveServicioCompacta(servicio);
  if (BONOS_SERVICIOS_EXCLUIDOS_EXTRA.has(compact)) return false;
  return true;
}

export function colaboradorElegibleBonos(c: ColaboradorCompleto): boolean {
  if (!colaboradorEstaActivoEnOperacion(c)) return false;
  if (!colaboradorEsLocalBonos(c)) return false;
  if (!servicioEsElegibleBonos(servicioColaborador(c))) return false;
  return true;
}

function evaluarHitoAntiguedad(
  fechaIngreso: string,
  hito: BonosMilestone,
  diasActivos: number,
  hoy: Date,
  incidencias: Awaited<ReturnType<typeof cargarIncidenciasCuadriculaEnRango>>,
  claves: string[],
): HitoCumplido | null {
  if (!antiguedadEnRangoHito(diasActivos, hito)) return null;

  const periodo = periodoBonoDesdeIngreso(fechaIngreso, hito);
  if (!periodo) return null;
  if (periodo.fin > hoy) return null;

  if (colaboradorIncumpleBonoEnPeriodo(incidencias, claves, periodo)) {
    return null;
  }

  return {
    bonoDias: hito,
    fechaCumplimiento: periodo.finYmd,
    periodoEvaluadoDesde: periodo.inicioYmd,
    periodoEvaluadoHasta: periodo.finYmd,
  };
}

function evaluarColaboradorBonos(
  c: ColaboradorCompleto,
  fechaIngreso: string,
  incidencias: Awaited<ReturnType<typeof cargarIncidenciasCuadriculaEnRango>>,
  hoy: Date,
  bonoFiltro: BonosMilestone | null,
): HitoCumplido | null {
  const diasActivos = diasActivosDesdeIngreso(fechaIngreso, hoy);
  if (diasActivos == null || diasActivos < 15) return null;

  const claves = clavesAsistenciaColaborador(c);
  if (claves.length === 0) return null;

  if (bonoFiltro != null) {
    return evaluarHitoAntiguedad(fechaIngreso, bonoFiltro, diasActivos, hoy, incidencias, claves);
  }

  const hito = hitoVigentePorAntiguedad(diasActivos);
  if (!hito) return null;
  return evaluarHitoAntiguedad(fechaIngreso, hito, diasActivos, hoy, incidencias, claves);
}

export async function buildBonosReport(
  admin: SupabaseClient,
  opts?: { servicio?: string; bonoDias?: BonosMilestone | null; weekStartIso?: string | null },
): Promise<BonosPayload> {
  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0);

  const semanaEvaluacion = opts?.weekStartIso?.trim()
    ? semanaDesdeIso(opts.weekStartIso.trim())
    : null;

  const colaboradores = await fetchAllColaboradoresCompletos(admin);
  const elegibles = colaboradores.filter((c) => colaboradorElegibleBonos(c));

  const servicioFiltro = opts?.servicio?.trim() ?? "";
  const bonoFiltro = opts?.bonoDias ?? null;

  let minIngreso: Date | null = null;
  for (const c of elegibles) {
    const ing = parseYmd(fechaIngresoNormalizadaColaborador(c));
    if (!ing) continue;
    if (!minIngreso || ing < minIngreso) minIngreso = ing;
  }

  const incidencias =
    minIngreso != null
      ? await cargarIncidenciasCuadriculaEnRango(admin, minIngreso, hoy)
      : new Map();

  const filas: BonosFila[] = [];

  for (const c of elegibles) {
    const fechaIngreso = fechaIngresoNormalizadaColaborador(c);
    if (!fechaIngreso) continue;

    const servicio = servicioColaborador(c);
    if (servicioFiltro && !servicioCoincideFiltroCat(servicio, servicioFiltro)) continue;

    const claves = clavesAsistenciaColaborador(c);
    if (claves.length === 0) continue;

    const hito = evaluarColaboradorBonos(c, fechaIngreso, incidencias, hoy, bonoFiltro);
    if (!hito) continue;

    filas.push({
      noEmpleado: claves[0]!,
      nombre: String(c.nombreCompleto ?? c.form?.nombreCompleto ?? "").trim(),
      fechaIngreso,
      servicio,
      localForaneo: localForaneoColaborador(c),
      bonoDias: hito.bonoDias,
      fechaCumplimiento: hito.fechaCumplimiento,
      periodoEvaluadoDesde: hito.periodoEvaluadoDesde,
      periodoEvaluadoHasta: hito.periodoEvaluadoHasta,
    });
  }

  let filasFiltradas = filas;
  if (semanaEvaluacion) {
    filasFiltradas = filas.filter((f) => fechaYmdEnSemana(f.fechaCumplimiento, semanaEvaluacion));
  }

  filasFiltradas.sort((a, b) => {
    if (a.bonoDias !== b.bonoDias) return a.bonoDias - b.bonoDias;
    const cmp = a.fechaCumplimiento.localeCompare(b.fechaCumplimiento, "es");
    if (cmp !== 0) return cmp;
    return a.nombre.localeCompare(b.nombre, "es", { sensitivity: "base" });
  });

  const serviciosSet = new Set<string>();
  for (const c of elegibles) {
    const clave = servicioClaveFiltroCat(servicioColaborador(c));
    if (clave) serviciosSet.add(clave);
  }

  return {
    filas: filasFiltradas,
    servicios: [...serviciosSet].sort((a, b) => a.localeCompare(b, "es", { numeric: true })),
    generadoEn: new Date().toISOString(),
    totalActivos: elegibles.length,
    totalConBono: filasFiltradas.length,
    fechaReferencia: dateToIsoYmd(hoy),
    semanaEvaluacion: semanaEvaluacion
      ? {
          lunesYmd: semanaEvaluacion.lunesYmd,
          domingoYmd: semanaEvaluacion.domingoYmd,
          etiqueta: semanaEvaluacion.etiqueta,
        }
      : undefined,
  };
}

export function parseBonosMilestone(raw: string | null | undefined): BonosMilestone | null {
  const n = Number(raw);
  if (n === 15 || n === 30 || n === 60 || n === 90) return n;
  return null;
}
