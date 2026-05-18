/**
 * Herramientas de migración (enviar a producción, CSV de códigos, etc.).
 * Ocultas en build de producción. Forzar en despliegue: NEXT_PUBLIC_CUADRICULA_DEV_TOOLS=1
 */
export function showCuadriculaDevTools(): boolean {
  const forced =
    typeof process !== "undefined"
      ? process.env.NEXT_PUBLIC_CUADRICULA_DEV_TOOLS?.trim().toLowerCase()
      : undefined;
  if (forced === "1" || forced === "true" || forced === "yes") return true;
  if (forced === "0" || forced === "false" || forced === "no") return false;

  if (typeof process !== "undefined" && process.env.NODE_ENV === "production") {
    return false;
  }
  if (typeof import.meta !== "undefined" && import.meta.env?.PROD) {
    return false;
  }
  return true;
}
