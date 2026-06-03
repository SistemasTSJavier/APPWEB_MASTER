import type { CatPersonalRow } from "@/lib/categorizacion-types";

/**
 * Servicios corporativos / administrativos que no participan en categorización operativa.
 * Comparación sin espacios para tolerar variantes (ej. ADMINISTRACION SPACELAB vs ADMINISTRACIONSPACE LAB).
 */
const CAT_SERVICIOS_NO_CALIFICAN: readonly string[] = [
  "ADMINISTRACION SPACELAB",
  "ADMINISTRACION SPACE LAB",
  "COMERCIAL",
  "CONTABILIDAD",
  "DIRECCION",
  "DIRECCION DE INGENIERIA (SPACELAB)",
  "INTENDENCIA",
  "LEGAL",
  "MATRIZ TACTICAL",
  "OPERACIONES",
  "MEJORA CONTINUA",
  "RECLUTAMIENTO CHIAPAS",
  "RECURSOS HUMANOS",
  "SISTEMAS",
  "SPACELAB",
];

const EXCLUIDOS_COMPACTOS = new Set(
  CAT_SERVICIOS_NO_CALIFICAN.map((s) => claveServicioCompacta(s)),
);

export function normalizarServicioCategorizacion(s: string): string {
  return s.trim().replace(/\s+/g, " ").toUpperCase();
}

export function claveServicioCompacta(s: string): string {
  return normalizarServicioCategorizacion(s).replace(/\s/g, "");
}

/** Servicio asignado que sí debe aparecer en módulos de calificación. */
export function servicioCatPersonalEsCalificable(servicio: string): boolean {
  const compact = claveServicioCompacta(servicio);
  if (!compact) return true;
  return !EXCLUIDOS_COMPACTOS.has(compact);
}

export function filtrarPersonalServiciosCalificables<T extends { servicio?: string }>(rows: T[]): T[] {
  return rows.filter((r) => servicioCatPersonalEsCalificable(String(r.servicio ?? "")));
}

export function filtrarCatPersonalCalificable(rows: CatPersonalRow[]): CatPersonalRow[] {
  return filtrarPersonalServiciosCalificables(rows);
}

export function etiquetasServiciosNoCalifican(): string[] {
  return [...CAT_SERVICIOS_NO_CALIFICAN];
}
