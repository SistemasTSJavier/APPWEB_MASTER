/** Formulario público vía QR (sin login). */
export const IDEAS_PUBLIC_PATH = "/ideas-que-transforman";

/** Panel interno: pendientes y aceptados. */
export const IDEAS_PANEL_PATH = "/ideas-que-transforman/panel";

export function isIdeasPublicPage(pathname: string): boolean {
  const p = pathname.replace(/\/$/, "") || "/";
  return p === IDEAS_PUBLIC_PATH;
}

/** POST /api/ideas-que-transforman — envío anónimo desde el QR. */
export function isIdeasPublicApi(pathname: string, method: string): boolean {
  const p = pathname.replace(/\/$/, "") || "/";
  return method.toUpperCase() === "POST" && p === "/api/ideas-que-transforman";
}
