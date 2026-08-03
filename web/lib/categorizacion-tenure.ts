import {
  addMonths,
  addYears,
  differenceInDays,
  differenceInMonths,
  differenceInYears,
  parseISO,
  startOfDay,
} from "date-fns";
import { normalizarFechaParaInputDate } from "@/lib/fecha-input-normalize";

/** Convierte texto de expediente a `YYYY-MM-DD` o cadena vacía. */
export function parseFechaIngresoYmd(raw: string): string {
  const t = String(raw ?? "").trim();
  if (!t) return "";
  const n = normalizarFechaParaInputDate(t);
  if (n) return n;
  // ISO con hora: 2020-03-15T00:00:00
  const iso = /^(\d{4})-(\d{2})-(\d{2})/.exec(t);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;
  return "";
}

function parseFechaIngresoDate(raw: string): Date | null {
  const ymd = parseFechaIngresoYmd(raw);
  if (!ymd) return null;
  const d = parseISO(ymd);
  if (Number.isNaN(d.getTime())) return null;
  return startOfDay(d);
}

/**
 * Antigüedad desde fecha de ingreso hasta hoy (o `ref`):
 * años, meses y días calendario (p. ej. "2 años, 3 meses y 5 días").
 */
export function textoTiempoEnEmpresa(fechaIngreso: string, ref: Date = new Date()): string {
  const start = parseFechaIngresoDate(fechaIngreso);
  if (!start) return "Sin fecha de ingreso";

  const end = startOfDay(ref);
  if (start > end) return "Por iniciar";

  const years = differenceInYears(end, start);
  let cursor = addYears(start, years);
  const months = differenceInMonths(end, cursor);
  cursor = addMonths(cursor, months);
  const days = differenceInDays(end, cursor);

  const partes: string[] = [];
  if (years > 0) partes.push(`${years} año${years === 1 ? "" : "s"}`);
  if (months > 0) partes.push(`${months} mes${months === 1 ? "" : "es"}`);
  if (days > 0) partes.push(`${days} día${days === 1 ? "" : "s"}`);

  if (partes.length === 0) return "Menos de 1 día";
  if (partes.length === 1) return partes[0]!;
  if (partes.length === 2) return `${partes[0]} y ${partes[1]}`;
  return `${partes[0]}, ${partes[1]} y ${partes[2]}`;
}

/** YYYY-MM del ingreso, o null si no hay fecha válida. */
export function mesYmDesdeFechaIngreso(fechaIngreso: string | null | undefined): string | null {
  const ymd = parseFechaIngresoYmd(String(fechaIngreso ?? ""));
  if (!ymd || ymd.length < 7) return null;
  const ym = ymd.slice(0, 7);
  return /^\d{4}-\d{2}$/.test(ym) ? ym : null;
}

/**
 * ¿Debía existir el colaborador en el mes del historial?
 * Si ingresó en abril, marzo no aplica. Sin fecha de ingreso → se incluye (no ocultar).
 */
export function colaboradorVigenteEnMesHistorial(
  fechaIngreso: string | null | undefined,
  periodMonth: string | null | undefined,
): boolean {
  const mesIngreso = mesYmDesdeFechaIngreso(fechaIngreso);
  if (!mesIngreso) return true;
  const mes = String(periodMonth ?? "").trim().slice(0, 7);
  if (!/^\d{4}-\d{2}$/.test(mes)) return true;
  return mesIngreso <= mes;
}

export function filtrarPorVigenciaEnMesHistorial<T extends { fechaIngreso?: string | null }>(
  rows: T[],
  periodMonth: string | null | undefined,
): T[] {
  return rows.filter((r) => colaboradorVigenteEnMesHistorial(r.fechaIngreso, periodMonth));
}
