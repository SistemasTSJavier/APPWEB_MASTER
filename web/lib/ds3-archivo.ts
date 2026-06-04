import { DS3_MIME_PERMITIDOS, type Ds3MimePermitido } from "@/lib/ds3-constants";

export type Ds3ArchivoListado = {
  name: string;
  path: string;
  url: string;
  updatedAt: string | null;
  sizeBytes: number | null;
  mimeType: string;
  originalLabel: string;
};

const EXT_POR_MIME: Record<Ds3MimePermitido, string> = {
  "application/pdf": ".pdf",
  "image/jpeg": ".jpg",
  "image/png": ".png",
  "image/webp": ".webp",
};

export function mimeDs3Permitido(mime: string): mime is Ds3MimePermitido {
  return (DS3_MIME_PERMITIDOS as readonly string[]).includes(mime.toLowerCase());
}

export function extensionPorMime(mime: string): string {
  const m = mime.toLowerCase() as Ds3MimePermitido;
  return EXT_POR_MIME[m] ?? "";
}

/** Nombre seguro para objeto en storage (sin rutas). */
export function sanitizarNombreOriginal(nombre: string): string {
  const base = nombre
    .replace(/[/\\?%*:|"<>]/g, "_")
    .replace(/\.\./g, "_")
    .trim()
    .slice(0, 120);
  return base || "archivo";
}

export function etiquetaDesdeNombreStorage(storageName: string): string {
  const idx = storageName.indexOf("_");
  if (idx < 0) return storageName;
  return storageName.slice(idx + 1);
}

export function esPdfMime(mime: string): boolean {
  return mime.toLowerCase() === "application/pdf";
}

export function esImagenMime(mime: string): boolean {
  return /^image\/(jpeg|png|webp)$/i.test(mime);
}

export function puedePrevisualizarEnPagina(mime: string): boolean {
  return esPdfMime(mime) || esImagenMime(mime);
}
