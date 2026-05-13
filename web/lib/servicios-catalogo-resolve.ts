/** Misma normalización que `normNombre` en `/api/servicios`. */
export function normNombreServicioCatalogo(s: string): string {
  return s.trim().replace(/\s+/g, " ").toUpperCase();
}

/**
 * Si el texto coincide (normalizado) con un nombre del catálogo, devuelve ese nombre tal como está guardado.
 * Si no hay lista o no hay coincidencia, devuelve `raw` recortado.
 */
export function nombreServicioCanonicoDesdeCatalogo(
  raw: string,
  catalogo: readonly { nombre: string }[],
): string {
  const t = raw.trim();
  if (!t || catalogo.length === 0) return t;
  const key = normNombreServicioCatalogo(t);
  for (const row of catalogo) {
    if (normNombreServicioCatalogo(row.nombre) === key) {
      return row.nombre;
    }
  }
  return t;
}
