/** Utilidades de semana calendario (lunes–domingo), alineadas con Cuadrícula. */

export function mondayOfWeek(d: Date): Date {
  const c = new Date(d);
  c.setHours(0, 0, 0, 0);
  const day = c.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  c.setDate(c.getDate() + diff);
  return c;
}

export function addDays(d: Date, n: number): Date {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  x.setHours(0, 0, 0, 0);
  return x;
}

export function dateToIsoYmd(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function parseIsoYmdLocal(ymd: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(ymd.trim());
  if (!m) return null;
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  d.setHours(0, 0, 0, 0);
  return Number.isNaN(d.getTime()) ? null : d;
}

export function formatDateEs(d: Date): string {
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  return `${dd}/${mm}/${d.getFullYear()}`;
}

export type SemanaLunDom = {
  lunes: Date;
  domingo: Date;
  lunesYmd: string;
  domingoYmd: string;
  etiqueta: string;
};

export function semanaDesdeLunes(lunes: Date): SemanaLunDom {
  const start = new Date(lunes);
  start.setHours(0, 0, 0, 0);
  const domingo = addDays(start, 6);
  return {
    lunes: start,
    domingo,
    lunesYmd: dateToIsoYmd(start),
    domingoYmd: dateToIsoYmd(domingo),
    etiqueta: `Lun–Dom: ${formatDateEs(start)} – ${formatDateEs(domingo)}`,
  };
}

export function semanaDesdeIso(lunesYmd: string): SemanaLunDom | null {
  const lunes = parseIsoYmdLocal(lunesYmd);
  if (!lunes) return null;
  return semanaDesdeLunes(lunes);
}

/** Fecha YYYY-MM-DD cae en la semana lun–dom (inclusive). */
export function fechaYmdEnSemana(fechaYmd: string, semana: SemanaLunDom): boolean {
  const ymd = fechaYmd.trim();
  return ymd >= semana.lunesYmd && ymd <= semana.domingoYmd;
}
