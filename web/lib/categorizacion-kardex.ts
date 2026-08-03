/** Helpers de kardex / capacitaciones (sin deps de servidor). */

const CURSO_LEGACY_ADMIN = "PROMEDIO RÁPIDO (ADMIN)";

function pareceUuid(s: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s.trim());
}

/**
 * Nombre visible en kardex / historial.
 * Solo oculta la etiqueta admin legacy; conserva nombres reales del catálogo.
 */
export function etiquetaCursoKardexVisible(nombre: string | null | undefined): string {
  const raw = String(nombre ?? "").trim();
  if (!raw || pareceUuid(raw)) return "";
  const n = raw.toUpperCase();
  if (n === CURSO_LEGACY_ADMIN || n.includes("PROMEDIO RÁPIDO")) return "";
  return raw;
}

/** Oculta comentarios internos de captura rápida. */
export function comentarioKardexVisible(comentarios: string | null | undefined): string {
  const t = String(comentarios ?? "").trim();
  if (!t) return "";
  if (/captura\s*r[aá]pida/i.test(t)) return "";
  return t;
}
