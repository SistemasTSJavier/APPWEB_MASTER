import type { SupabaseClient } from "@supabase/supabase-js";
import {
  colaboradorActivoParaMetricas,
  fechaIngresoNormalizadaColaborador,
  prepararColaboradorParaMetricas,
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
import { parseFechaIngresoYmd } from "@/lib/categorizacion-tenure";
import { servicioLineaColaborador } from "@/lib/servicio-agrupacion";
import {
  cargarIncidenciasCuadriculaEnRango,
  clavesAsistenciaColaborador,
  colaboradorIncumpleBonoEnPeriodo,
  dateToIsoYmd,
} from "@/lib/cuadricula-incidencias-asistencia";
import {
  BONOS_ANTIGUEDAD_TOPE_90,
  BONOS_MILESTONES,
  type BonosFila,
  type BonosMilestone,
  type BonosPayload,
} from "@/lib/bonos-types";
import { fechaYmdEnSemana, semanaDesdeIso, type SemanaLunDom } from "@/lib/semana-lun-dom";

const MS_DIA = 86_400_000;
const TZ_MX = "America/Mexico_City";

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

/** Hoy calendario en America/Mexico_City (medianoche local del proceso). */
export function hoyMexicoCityDate(ref: Date = new Date()): Date {
  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone: TZ_MX,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const ymd = fmt.format(ref);
  const d = parseYmd(ymd);
  if (d) return d;
  const fallback = new Date(ref);
  fallback.setHours(0, 0, 0, 0);
  return fallback;
}

/** Fecha de ingreso usable para bonos (expediente + form + parseo flexible). */
export function fechaIngresoBonos(c: ColaboradorCompleto): string {
  const n = fechaIngresoNormalizadaColaborador(c);
  if (n) return n;
  for (const raw of [String(c.fechaIngreso ?? "").trim(), String(c.form?.fechaIngreso ?? "").trim()]) {
    if (!raw) continue;
    const ymd = parseFechaIngresoYmd(raw);
    if (ymd) return ymd;
  }
  return "";
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
  const raw = String(c.form?.localForaneo ?? "").trim().toUpperCase();
  if (!raw) return "LOCAL";
  if (raw === "LOCAL" || raw.startsWith("LOCAL")) return "LOCAL";
  return raw;
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
  const prep = prepararColaboradorParaMetricas(c);
  if (!colaboradorActivoParaMetricas(prep)) return false;
  if (!colaboradorEsLocalBonos(prep)) return false;
  if (!servicioEsElegibleBonos(servicioColaborador(prep))) return false;
  return true;
}

/**
 * Hito cumplido sin F/PSGS en el periodo ingreso→cumplimiento.
 * Con `requiereVentanaAntiguedad`: solo si hoy sigue en la ventana del hito (15–29, etc.).
 */
function evaluarHitoCumplido(
  fechaIngreso: string,
  hito: BonosMilestone,
  hoy: Date,
  incidencias: Awaited<ReturnType<typeof cargarIncidenciasCuadriculaEnRango>>,
  claves: string[],
  opts?: { requiereVentanaAntiguedad?: boolean; diasActivos?: number | null },
): HitoCumplido | null {
  const periodo = periodoBonoDesdeIngreso(fechaIngreso, hito);
  if (!periodo) return null;
  if (periodo.fin > hoy) return null;

  if (opts?.requiereVentanaAntiguedad) {
    const dias = opts.diasActivos ?? diasActivosDesdeIngreso(fechaIngreso, hoy);
    if (dias == null || !antiguedadEnRangoHito(dias, hito)) return null;
  }

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

/**
 * Sin filtro de semana: solo el hito vigente por antigüedad actual.
 * Con semana: todos los hitos cuya fecha de cumplimiento cae en esa semana (aunque ya hayan pasado de ventana).
 */
function hitosBonosColaborador(
  fechaIngreso: string,
  incidencias: Awaited<ReturnType<typeof cargarIncidenciasCuadriculaEnRango>>,
  claves: string[],
  hoy: Date,
  bonoFiltro: BonosMilestone | null,
  semana: SemanaLunDom | null,
): HitoCumplido[] {
  const diasActivos = diasActivosDesdeIngreso(fechaIngreso, hoy);
  if (diasActivos == null || diasActivos < 15) return [];

  const candidatos: BonosMilestone[] = bonoFiltro != null ? [bonoFiltro] : [...BONOS_MILESTONES];
  const out: HitoCumplido[] = [];

  for (const hito of candidatos) {
    if (semana) {
      const periodo = periodoBonoDesdeIngreso(fechaIngreso, hito);
      if (!periodo) continue;
      if (!fechaYmdEnSemana(periodo.finYmd, semana)) continue;
      const ok = evaluarHitoCumplido(fechaIngreso, hito, hoy, incidencias, claves);
      if (ok) out.push(ok);
      continue;
    }

    const vigente = hitoVigentePorAntiguedad(diasActivos);
    if (vigente == null || vigente !== hito) continue;
    const ok = evaluarHitoCumplido(fechaIngreso, hito, hoy, incidencias, claves, {
      requiereVentanaAntiguedad: true,
      diasActivos,
    });
    if (ok) out.push(ok);
  }

  return out;
}

export async function buildBonosReport(
  admin: SupabaseClient,
  opts?: { servicio?: string; bonoDias?: BonosMilestone | null; weekStartIso?: string | null },
): Promise<BonosPayload> {
  const hoy = hoyMexicoCityDate();

  const semanaEvaluacion = opts?.weekStartIso?.trim()
    ? semanaDesdeIso(opts.weekStartIso.trim())
    : null;

  const colaboradores = await fetchAllColaboradoresCompletos(admin);
  const elegibles = colaboradores
    .map((c) => prepararColaboradorParaMetricas(c))
    .filter((c) => colaboradorElegibleBonos(c));

  const servicioFiltro = opts?.servicio?.trim() ?? "";
  const bonoFiltro = opts?.bonoDias ?? null;

  let minIngreso: Date | null = null;
  for (const c of elegibles) {
    const ing = parseYmd(fechaIngresoBonos(c));
    if (!ing) continue;
    if (!minIngreso || ing < minIngreso) minIngreso = ing;
  }

  const incidencias =
    minIngreso != null
      ? await cargarIncidenciasCuadriculaEnRango(admin, minIngreso, hoy)
      : new Map();

  const filas: BonosFila[] = [];

  for (const c of elegibles) {
    const fechaIngreso = fechaIngresoBonos(c);
    if (!fechaIngreso) continue;

    const servicio = servicioColaborador(c);
    if (servicioFiltro && !servicioCoincideFiltroCat(servicio, servicioFiltro)) continue;

    const claves = clavesAsistenciaColaborador(c);
    if (claves.length === 0) continue;

    const hitos = hitosBonosColaborador(
      fechaIngreso,
      incidencias,
      claves,
      hoy,
      bonoFiltro,
      semanaEvaluacion,
    );

    for (const hito of hitos) {
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
  }

  // Con semana, el filtro ya se aplicó al evaluar hitos; sin semana no hace falta.
  const filasFiltradas = filas;

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
