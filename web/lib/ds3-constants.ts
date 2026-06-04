/** Bucket Supabase Storage para archivos DS3 por colaborador. */
export const DS3_BUCKET = "colaboradores-ds3";

/** Máximo 5 MB por archivo después de optimizar. */
export const DS3_MAX_BYTES = 5 * 1024 * 1024;

export const DS3_MAX_MB = 5;

/** Límite de archivos por selección en la UI. */
export const DS3_MAX_ARCHIVOS_POR_LOTE = 25;

export const DS3_MIME_PERMITIDOS = [
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
] as const;

export type Ds3MimePermitido = (typeof DS3_MIME_PERMITIDOS)[number];
