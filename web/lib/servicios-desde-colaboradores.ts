import type { ColaboradorCompleto } from "@/lib/colaboradores-types";

/** Texto estable para deduplicar en catálogo (mayúsculas, espacios colapsados). */
export function normalizarLineaServicioCatalogo(s: string): string {
  return s.trim().replace(/\s+/g, " ").toUpperCase();
}

/**
 * Todas las variantes literales de servicio que aparecen en expedientes
 * (`servicioAsignado`, `ultimoServicio`, MOPER actual, expediente ALTAS).
 */
export function serviciosLiteralesUnicosDesdeExpedientes(list: ColaboradorCompleto[]): string[] {
  const set = new Set<string>();
  for (const c of list) {
    const campos = [
      c.servicioAsignado,
      c.ultimoServicio,
      c.moperActual?.servicio,
      typeof c.form?.servicio === "string" ? c.form.servicio : "",
    ];
    for (const raw of campos) {
      const n = normalizarLineaServicioCatalogo(String(raw ?? ""));
      if (n) set.add(n);
    }
  }
  return [...set].sort((a, b) => a.localeCompare(b, "es"));
}
