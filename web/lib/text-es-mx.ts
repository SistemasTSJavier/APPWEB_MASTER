/**
 * Normalización de texto para español (México): locale y conservación de ñ.
 * Evita que NFD + quitar marcas combinantes convierta ñ → n (error típico al importar CSV).
 */

/** Carácter de uso privado improbable en datos reales; protege ñ durante el strip de marcas. */
const ENYE_SENTINEL = "\uE800";

/**
 * Minúsculas `es-MX`, forma NFC, elimina diacríticos en vocales (á→a…), **mantiene ñ**.
 * Útil para claves de cabecera CSV y comparaciones laxas sin perder eñe.
 */
export function foldSpanishForAsciiKeys(s: string): string {
  let t = s.trim().toLocaleLowerCase("es-MX").normalize("NFC");
  t = t.replace(/\u00f1/g, ENYE_SENTINEL);
  t = t.normalize("NFD").replace(/\p{M}/gu, "");
  return t.replaceAll(ENYE_SENTINEL, "ñ");
}

/** Texto legible: NFC + trim (misma línea visual que en México para ñ y tildes). */
export function normalizeSpanishMxText(s: string): string {
  return s.trim().normalize("NFC");
}

/** Igual que texto legible; cadena vacía → `null` (campos opcionales en BD). */
export function normalizeSpanishMxOptional(s: string | null | undefined): string | null {
  if (s == null) return null;
  const t = normalizeSpanishMxText(String(s));
  return t === "" ? null : t;
}
