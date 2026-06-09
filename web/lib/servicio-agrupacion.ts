import type { ColaboradorCompleto } from "@/lib/colaboradores-types";

/**
 * Servicio capturado en **Colaboradores** (expediente / form).
 * Prioridad: `form.servicioFinal` → `form.servicio` → snapshot → MOPER.
 * La cuadrícula y altas deben reflejar lo guardado en esa sección.
 */
export function servicioExpedienteColaborador(c: ColaboradorCompleto): string {
  const fFinal = String(c.form?.servicioFinal ?? "").trim();
  const fSrv = String(c.form?.servicio ?? "").trim();
  const asignado = String(c.servicioAsignado ?? "").trim();
  const ultimo = String(c.ultimoServicio ?? "").trim();
  const moper = String(c.moperActual?.servicio ?? "").trim();
  return fFinal || fSrv || asignado || ultimo || moper;
}

/**
 * Línea de servicio **vigente** (post-MOPER): primero MOPER actual, luego último movimiento,
 * después alta (`servicioAsignado`) y expediente. Así la lista y filtros reflejan el servicio actual.
 */
export function servicioLineaColaborador(c: ColaboradorCompleto): string {
  const m = (c.moperActual?.servicio ?? "").trim();
  const u = (c.ultimoServicio ?? "").trim();
  const a = (c.servicioAsignado ?? "").trim();
  const f = (typeof c.form?.servicio === "string" ? c.form.servicio : "").trim();
  return m || u || a || f;
}

/** CAT y U-ERRE comparten modelo: mismo servicio agrupado, variante por sufijo (zona / sitio). */
export const SERVICIOS_CON_VARIANTE_ZONA = new Set(["CAT", "U-ERRE"]);

export function servicioAgrupadoUsaZona(claveServicio: string): boolean {
  return SERVICIOS_CON_VARIANTE_ZONA.has(claveServicio);
}

/**
 * Agrupa variantes CAT (CAT SANTA, CAT RAMOS…) y U-ERRE (U-ERRE ..., U ERRE ...)
 * en una sola clave para conteos de servicios distintos y filtros sin inflar el número por zona.
 */
export function claveServicioAgrupada(raw: string): string {
  const t = raw.trim().replace(/\s+/g, " ");
  if (!t) return "";
  const u = t.toUpperCase();
  if (/^CAT\b/.test(u)) return "CAT";
  if (/^U[\s.-]*ERRE\b/.test(u)) return "U-ERRE";
  return u;
}

/**
 * Texto de variante después del nombre base (ej. CAT SANTA CAT → zona "SANTA CAT", CAT → "").
 * Solo distingue sufijo cuando la línea empieza por CAT o U-ERRE; en otro caso devuelve "".
 */
export function zonaVarianteServicio(raw: string): string {
  const t = raw.trim().replace(/\s+/g, " ");
  if (!t) return "";
  const u = t.toUpperCase();
  let m: RegExpExecArray | null;
  if ((m = /^CAT\b\s*(.*)$/.exec(u))) return (m[1] ?? "").trim();
  if ((m = /^U[\s.-]*ERRE\b\s*(.*)$/.exec(u))) return (m[1] ?? "").trim();
  return "";
}

/** Valor interno para filtro "solo registros sin sufijo de zona". */
export const ZONA_FILTRO_SIN_SUFIJO = "__sin_zona__";

/**
 * La lista prioriza `moperActual.servicio` sobre expediente (`servicioLineaColaborador`).
 * Tras importar CSV de una sola columna de servicio, sin esto el dato queda en `form`/`servicioAsignado`
 * pero sigue viéndose el servicio MOPER anterior.
 */
export function alinearColaboradorTrasImportColumnaServicio(c: ColaboradorCompleto, servicioTexto: string): ColaboradorCompleto {
  const s = servicioTexto.trim();
  if (!s) return c;
  const puestoLinea = (c.moperActual?.puesto ?? c.puesto ?? "").trim();
  const form = {
    ...c.form,
    servicio: s,
    servicioFinal: s,
    ultimoServicio: s,
  };
  return {
    ...c,
    servicioAsignado: s,
    ultimoServicio: s,
    form,
    moperActual: {
      servicio: s,
      puesto: puestoLinea,
    },
  };
}
