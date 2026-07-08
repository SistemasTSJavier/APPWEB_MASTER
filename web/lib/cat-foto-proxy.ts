/**
 * Proxy same-origin para fotos de colaboradores en el dashboard de categorización.
 * Evita imágenes rotas por CORS o buckets sin lectura pública: el servidor descarga
 * la imagen con service-role y la reenvía desde el mismo origen.
 */

const DATA_O_BLOB = /^(data:|blob:)/i;

/** true si la URL apunta a un objeto de Supabase Storage (público). */
export function esUrlStorageSupabase(url: string): boolean {
  return url.includes("/storage/v1/object/");
}

/**
 * Devuelve la fuente a usar en el `<img>`.
 * - data:/blob: → sin cambios.
 * - URL de Supabase Storage → se enruta por el proxy same-origin.
 * - Otras (relativas o del mismo origen) → sin cambios.
 */
export function fotoProxySrc(url: string | null | undefined): string | null {
  const src = String(url ?? "").trim();
  if (!src) return null;
  if (DATA_O_BLOB.test(src)) return src;
  if (esUrlStorageSupabase(src)) {
    return `/api/categorizacion/dashboard/foto?url=${encodeURIComponent(src)}`;
  }
  return src;
}
