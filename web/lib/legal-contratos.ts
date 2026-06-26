import {
  addMonths,
  differenceInCalendarDays,
  differenceInMonths,
  format,
  parseISO,
  startOfDay,
} from "date-fns";
import { es } from "date-fns/locale";
import type { ColaboradorCompleto } from "@/lib/colaboradores-types";
import {
  colaboradorEstaActivoEnOperacion,
  fechaIngresoNormalizadaColaborador,
  servicioAsignadoDesdeExpediente,
} from "@/lib/colaboradores-baja";
import { plantaExpedienteColaborador, normPlantaCatalogo } from "@/lib/colaboradores-catalogo-display";
import { parseFechaIngresoYmd } from "@/lib/categorizacion-tenure";

/** Destino de alertas automáticas (contratos por vencer). */
export const LEGAL_CONTRATOS_ALERTA_EMAIL = "legal@tacticalsupport.com.mx";

export const MESES_PRUEBA_ADMIN = 3;
export const MESES_PRUEBA_OPERATIVA = 2;
export const MESES_MAX_EN_SECCION = 4;
/** Envío automático de correo si quedan este número de días o menos (incluye el día 0). */
export const DIAS_ALERTA_EMAIL = 8;

export type LegalContratoVista = "activas" | "historial";

export type LegalContratoFila = {
  noEmpleado: string;
  nombre: string;
  servicio: string;
  planta: string;
  fechaIngreso: string;
  mesesPrueba: number;
  fechaVencimientoContrato: string;
  diasRestantes: number;
  textoRestante: string;
  esPlantaAdministracion: boolean;
  nuevoEnMes: boolean;
  mesesAntiguedad: number;
  alertaEmailPendiente: boolean;
  alertaEmailEnviada: boolean;
};

function yearMonthMexicoCity(d: Date): { year: number; month: number } {
  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Mexico_City",
    year: "numeric",
    month: "numeric",
  });
  const parts = fmt.formatToParts(d);
  return {
    year: Number(parts.find((p) => p.type === "year")?.value ?? 0),
    month: Number(parts.find((p) => p.type === "month")?.value ?? 0),
  };
}

function fechaEnMesCalendarioMx(fechaYmd: string, year: number, month: number): boolean {
  const m = /^(\d{4})-(\d{1,2})-(\d{1,2})/.exec(fechaYmd);
  if (!m) return false;
  return Number(m[1]) === year && Number(m[2]) === month;
}

export function esPlantaAdministracion(planta: string): boolean {
  const p = normPlantaCatalogo(planta);
  if (!p) return false;
  return p.includes("ADMINISTRACION");
}

export function mesesPruebaPorPlanta(planta: string): number {
  return esPlantaAdministracion(planta) ? MESES_PRUEBA_ADMIN : MESES_PRUEBA_OPERATIVA;
}

export function fechaVencimientoContratoYmd(fechaIngresoYmd: string, planta: string): string {
  const start = parseFechaIngresoDate(fechaIngresoYmd);
  if (!start) return "";
  const fin = addMonths(start, mesesPruebaPorPlanta(planta));
  return format(fin, "yyyy-MM-dd");
}

function parseFechaIngresoDate(raw: string): Date | null {
  const ymd = parseFechaIngresoYmd(raw);
  if (!ymd) return null;
  const d = parseISO(ymd);
  if (Number.isNaN(d.getTime())) return null;
  return startOfDay(d);
}

export function esAltaMesActualMx(fechaIngresoYmd: string, ref: Date = new Date()): boolean {
  if (!fechaIngresoYmd) return false;
  const { year, month } = yearMonthMexicoCity(ref);
  return fechaEnMesCalendarioMx(fechaIngresoYmd, year, month);
}

/** Nuevo en el mes o antigüedad estrictamente menor a 3 meses. */
export function esColaboradorNuevoParaLegal(fechaIngresoYmd: string, ref: Date = new Date()): boolean {
  if (!fechaIngresoYmd) return false;
  if (esAltaMesActualMx(fechaIngresoYmd, ref)) return true;
  const start = parseFechaIngresoDate(fechaIngresoYmd);
  if (!start) return false;
  return differenceInMonths(startOfDay(ref), start) < 3;
}

/** Desaparece de la sección con 4 o más meses de antigüedad. */
export function superaAntiguedadMaximaLegal(fechaIngresoYmd: string, ref: Date = new Date()): boolean {
  const start = parseFechaIngresoDate(fechaIngresoYmd);
  if (!start) return true;
  return differenceInMonths(startOfDay(ref), start) >= MESES_MAX_EN_SECCION;
}

export function textoTiempoRestanteContrato(diasRestantes: number): string {
  if (diasRestantes < 0) {
    const d = Math.abs(diasRestantes);
    return `Vencido hace ${d} día${d === 1 ? "" : "s"}`;
  }
  if (diasRestantes === 0) return "Vence hoy";
  if (diasRestantes === 1) return "1 día restante";
  if (diasRestantes < 7) return `${diasRestantes} días restantes`;
  const semanas = Math.floor(diasRestantes / 7);
  if (diasRestantes < 30) {
    return `${diasRestantes} días (${semanas} sem.)`;
  }
  return `${diasRestantes} días restantes`;
}

export function diasHastaVencimiento(fechaVencimientoYmd: string, ref: Date = new Date()): number {
  const fin = parseFechaIngresoDate(fechaVencimientoYmd);
  if (!fin) return 0;
  return differenceInCalendarDays(fin, startOfDay(ref));
}

export function colaboradorElegibleSeccionLegal(c: ColaboradorCompleto, ref: Date = new Date()): boolean {
  if (!colaboradorEstaActivoEnOperacion(c)) return false;
  const ingreso = fechaIngresoNormalizadaColaborador(c);
  if (!ingreso) return false;
  if (superaAntiguedadMaximaLegal(ingreso, ref)) return false;
  return esColaboradorNuevoParaLegal(ingreso, ref);
}

export function filaContratoDesdeColaborador(
  c: ColaboradorCompleto,
  ref: Date,
  alertasEnviadas: Set<string>,
): LegalContratoFila | null {
  if (!colaboradorElegibleSeccionLegal(c, ref)) return null;

  const ingreso = fechaIngresoNormalizadaColaborador(c);
  const planta = plantaExpedienteColaborador(c);
  const vencimiento = fechaVencimientoContratoYmd(ingreso, planta);
  if (!vencimiento) return null;

  const start = parseFechaIngresoDate(ingreso)!;
  const mesesAntiguedad = differenceInMonths(startOfDay(ref), start);
  const diasRestantes = diasHastaVencimiento(vencimiento, ref);
  const claveAlerta = `${c.noEmpleado.trim().toUpperCase()}|${vencimiento}`;
  const enviada = alertasEnviadas.has(claveAlerta);
  const pendiente = diasRestantes >= 0 && diasRestantes <= DIAS_ALERTA_EMAIL && !enviada;

  return {
    noEmpleado: c.noEmpleado.trim().toUpperCase(),
    nombre: String(c.nombreCompleto ?? c.form?.nombreCompleto ?? "").trim(),
    servicio: servicioAsignadoDesdeExpediente(c) || String(c.ultimoServicio ?? "").trim(),
    planta,
    fechaIngreso: ingreso,
    mesesPrueba: mesesPruebaPorPlanta(planta),
    fechaVencimientoContrato: vencimiento,
    diasRestantes,
    textoRestante: textoTiempoRestanteContrato(diasRestantes),
    esPlantaAdministracion: esPlantaAdministracion(planta),
    nuevoEnMes: esAltaMesActualMx(ingreso, ref),
    mesesAntiguedad,
    alertaEmailPendiente: pendiente,
    alertaEmailEnviada: enviada,
  };
}

export function clasificarPorVista(fila: LegalContratoFila, vista: LegalContratoVista): boolean {
  if (vista === "activas") return fila.diasRestantes >= 0;
  return fila.diasRestantes < 0;
}

export function filtrarFilasContrato(
  filas: LegalContratoFila[],
  opts: { vista: LegalContratoVista; servicio?: string; busqueda?: string },
): LegalContratoFila[] {
  let out = filas.filter((f) => clasificarPorVista(f, opts.vista));
  const srv = (opts.servicio ?? "").trim().toUpperCase();
  if (srv) {
    out = out.filter((f) => f.servicio.trim().toUpperCase() === srv);
  }
  const q = (opts.busqueda ?? "").trim().toLowerCase();
  if (q) {
    out = out.filter(
      (f) =>
        f.noEmpleado.toLowerCase().includes(q) ||
        f.nombre.toLowerCase().includes(q) ||
        f.servicio.toLowerCase().includes(q),
    );
  }
  out.sort((a, b) => {
    if (a.diasRestantes !== b.diasRestantes) return a.diasRestantes - b.diasRestantes;
    return a.nombre.localeCompare(b.nombre, "es", { sensitivity: "base" });
  });
  return out;
}

export function serviciosUnicosContratos(filas: LegalContratoFila[]): string[] {
  const set = new Set<string>();
  for (const f of filas) {
    const s = f.servicio.trim().toUpperCase();
    if (s) set.add(s);
  }
  return [...set].sort((a, b) => a.localeCompare(b, "es", { numeric: true }));
}

export function formatearFechaLegibleMx(ymd: string): string {
  const d = parseFechaIngresoDate(ymd);
  if (!d) return ymd || "—";
  return format(d, "d MMM yyyy", { locale: es });
}
