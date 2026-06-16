/** Ruta publica para que el oficial firme con codigo (sin cuenta ni login). */
export const MOPER_FIRMA_PUBLIC_PATH = "/moper/firma";

/** Ruta interna MOPER (requiere sesion Supabase). */
export const MOPER_INTERNO_PATH = "/moper";

export type MoperFirmaInternaTipo = "rh" | "gerente" | "control";

export function moperFirmaPublicUrl(codigo?: string): string {
  const c = String(codigo ?? "").trim().toUpperCase();
  return c ? `${MOPER_FIRMA_PUBLIC_PATH}?codigo=${encodeURIComponent(c)}` : MOPER_FIRMA_PUBLIC_PATH;
}

/** Enlace directo al registro para firmantes internos (RH, gerente, centro de control). */
export function moperRegistroInternoUrl(registroId: number, firma?: MoperFirmaInternaTipo): string {
  const id = Number(registroId);
  if (!Number.isFinite(id) || id <= 0) return MOPER_INTERNO_PATH;
  const params = new URLSearchParams({ registro: String(id) });
  if (firma) params.set("firma", firma);
  return `${MOPER_INTERNO_PATH}?${params.toString()}`;
}

export function isMoperFirmaPublicPage(pathname: string): boolean {
  const p = pathname.replace(/\/$/, "") || "/";
  return p === MOPER_FIRMA_PUBLIC_PATH || p.startsWith(`${MOPER_FIRMA_PUBLIC_PATH}/`);
}

/** GET /api/moper/codigo/:codigo — consulta registro por codigo de acceso. */
export function isMoperCodigoPublicApi(pathname: string, method: string): boolean {
  return method.toUpperCase() === "GET" && pathname.startsWith("/api/moper/codigo/");
}

/**
 * PATCH /api/moper/:id/firma — sin sesion solo aplica a firma "conformidad" con codigo valido (validado en servidor).
 */
export function isMoperFirmaConformidadPublicApi(pathname: string, method: string): boolean {
  return method.toUpperCase() === "PATCH" && /^\/api\/moper\/\d+\/firma$/.test(pathname);
}

export function isMoperPublicApi(pathname: string, method: string): boolean {
  return isMoperCodigoPublicApi(pathname, method) || isMoperFirmaConformidadPublicApi(pathname, method);
}
