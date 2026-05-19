import type { ColaboradorCompleto } from "@/lib/colaboradores-types";
import { colaboradorTieneBaja } from "@/lib/colaboradores-baja";
import { normalizarFechaParaInputDate } from "@/lib/fecha-input-normalize";
import { servicioLineaColaborador } from "@/lib/servicio-agrupacion";

export type CumpleaneroMes = {
  servicio: string;
  nombre: string;
  /** Texto para mostrar (día y mes en español). */
  fechaCumpleanos: string;
  puesto: string;
  /** Día del mes (1–31) para ordenar. */
  diaDelMes: number;
};

function puestoLineaColaborador(c: ColaboradorCompleto): string {
  return (
    (c.puesto || "").trim() ||
    (c.moperActual?.puesto ?? "").trim() ||
    String(c.form?.puesto ?? "").trim() ||
    String(c.form?.puestoFinal ?? "").trim()
  );
}

const TZ = "America/Mexico_City";

/** Mes y día calendario en zona America/Mexico_City. */
export function hoyMexicoCity(d: Date = new Date()): { month: number; day: number } {
  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone: TZ,
    month: "numeric",
    day: "numeric",
  });
  const parts = fmt.formatToParts(d);
  return {
    month: Number(parts.find((p) => p.type === "month")?.value ?? 0),
    day: Number(parts.find((p) => p.type === "day")?.value ?? 0),
  };
}

/** Mes calendario 1–12 en zona America/Mexico_City. */
export function mesCalendarioMexicoCity(d: Date = new Date()): number {
  return hoyMexicoCity(d).month;
}

function formatearDiaMesCumpleanos(ymd: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(ymd);
  if (!m) return ymd;
  try {
    const d = new Date(`${m[1]}-${m[2]}-${m[3]}T12:00:00Z`);
    return new Intl.DateTimeFormat("es-MX", {
      day: "numeric",
      month: "long",
      timeZone: "UTC",
    }).format(d);
  } catch {
    return `${Number(m[3])}/${Number(m[2])}`;
  }
}

/**
 * Colaboradores activos cuyo cumpleaños cae desde hoy (inclusive) hasta fin del mes
 * calendario actual en America/Mexico_City. No incluye cumpleaños ya pasados este mes.
 * Orden: por día del mes, luego nombre.
 */
export function cumpleanosActivosEnMes(
  list: ColaboradorCompleto[],
  month?: number,
  diaDesde?: number,
  ref: Date = new Date(),
): CumpleaneroMes[] {
  const hoy = hoyMexicoCity(ref);
  const mes = month ?? hoy.month;
  const diaMin = diaDesde ?? hoy.day;
  if (mes < 1 || mes > 12 || diaMin < 1) return [];

  const out: CumpleaneroMes[] = [];

  for (const c of list) {
    if (colaboradorTieneBaja(c)) continue;

    const ymd = normalizarFechaParaInputDate(String(c.form?.fechaNacimiento ?? ""));
    if (!ymd) continue;

    const parts = /^(\d{4})-(\d{2})-(\d{2})/.exec(ymd);
    if (!parts) continue;

    const mesNac = Number(parts[2]);
    const dia = Number(parts[3]);
    if (mesNac !== mes || dia < diaMin || dia > 31) continue;

    const nombre = String(c.nombreCompleto ?? "").trim() || String(c.form?.nombreCompleto ?? "").trim();
    if (!nombre) continue;

    out.push({
      servicio: servicioLineaColaborador(c) || "—",
      nombre,
      fechaCumpleanos: formatearDiaMesCumpleanos(ymd),
      puesto: puestoLineaColaborador(c) || "—",
      diaDelMes: dia,
    });
  }

  out.sort((a, b) => a.diaDelMes - b.diaDelMes || a.nombre.localeCompare(b.nombre, "es"));

  return out;
}
