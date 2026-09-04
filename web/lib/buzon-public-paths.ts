/** Rutas públicas del Buzón (sin login). */
export const BUZON_PUBLIC_PATH = "/buzon";

/** Panel interno: listado, estatus y notas. */
export const BUZON_PANEL_PATH = "/buzon/panel";

export function isBuzonPublicPage(pathname: string): boolean {
  const p = pathname.replace(/\/$/, "") || "/";
  return p === BUZON_PUBLIC_PATH;
}

/** POST crear + GET verificar por código — sin sesión. */
export function isBuzonPublicApi(pathname: string, method: string): boolean {
  const p = pathname.replace(/\/$/, "") || "/";
  const m = method.toUpperCase();
  if (m === "POST" && p === "/api/buzon") return true;
  if (m === "GET" && p === "/api/buzon/verificar") return true;
  return false;
}
