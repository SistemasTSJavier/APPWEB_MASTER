/** Bucket público (misma id en Supabase Storage). */
export const EXPEDIENTE_LEGAL_BUCKET = "colaboradores-expedientes-legal";

/**
 * Tamaño máximo por PDF (debe coincidir con `storage.buckets.file_size_limit` en Supabase).
 * Migraciones: 006 (instalación inicial) y 007 (actualizar proyectos ya creados).
 */
export const EXPEDIENTE_LEGAL_MAX_BYTES = 268435456; // 256 MiB
