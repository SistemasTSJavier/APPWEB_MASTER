/**
 * Roles de aplicación (campo `app_role` en user metadata de Supabase Auth).
 * Valores recomendados en Dashboard: Authentication → Users → User Metadata (JSON).
 *
 * Resumen rutas (`canAccessPath` + middleware):
 * - admin: todas las secciones; login → /
 * - rh: /, altas, bajas, colaboradores, expedientes-legal, moper, servicios; expedientes y catálogo; en Altas solo el administrador guarda o importa
 * - gerente_rh: /, colaboradores, expedientes-legal, moper, servicios; sin altas/bajas; puede editar expedientes, MOPER y catálogo
 * - mejora_continua: / (inicio con métricas), colaboradores y expedientes-legal solo lectura
 * - nominas: /, colaboradores y expedientes-legal (solo lectura / copiar datos); sin guardar expedientes
 * - aux_legal / gerente_legal: inicio (métricas), colaboradores y expedientes-legal (solo lectura)
 */
export type AppRole = "admin" | "nominas" | "mejora_continua" | "rh" | "gerente_rh" | "aux_legal" | "gerente_legal";

/** Correos previstos para usuarios legales (referencia al crear usuarios en Supabase). */
export const AUX_LEGAL_EMAIL = "auxlegal@tacticalsupport.com.mx";
export const GERENTE_LEGAL_EMAIL = "gerentelegal@tacticalsupport.com.mx";

const ROLE_ALIASES: Record<string, AppRole> = {
  admin: "admin",
  administrador: "admin",
  nominas: "nominas",
  nomina: "nominas",
  "nóminas": "nominas",
  mejora_continua: "mejora_continua",
  "mejora continua": "mejora_continua",
  rh: "rh",
  recursos_humanos: "rh",
  "recursos humanos": "rh",
  gerente_rh: "gerente_rh",
  "gerente rh": "gerente_rh",
  gerenterh: "gerente_rh",
  aux_legal: "aux_legal",
  "aux legal": "aux_legal",
  auxlegal: "aux_legal",
  gerente_legal: "gerente_legal",
  "gerente legal": "gerente_legal",
  gerentelegal: "gerente_legal",
};

export function parseAppRole(raw: unknown): AppRole | null {
  if (raw == null || raw === "") return null;
  const key = String(raw).trim().toLowerCase().replace(/\s+/g, " ");
  return ROLE_ALIASES[key] ?? null;
}

export const APP_ROLE_LABEL: Record<AppRole, string> = {
  admin: "Administrador",
  nominas: "Nóminas",
  mejora_continua: "Mejora continua",
  rh: "Recursos humanos",
  gerente_rh: "Gerente RH",
  aux_legal: "Aux legal",
  gerente_legal: "Gerente legal",
};

/** Primera sección de la ruta, p. ej. `/colaboradores/xxx` → `/colaboradores` */
export function routeSection(pathname: string): string {
  const p = pathname.replace(/\/$/, "") || "/";
  if (p === "/") return "/";
  const seg = p.split("/").filter(Boolean)[0];
  return seg ? `/${seg}` : "/";
}

const SECTION_ROLES: Record<string, readonly AppRole[]> = {
  "/": ["admin", "rh", "gerente_rh", "mejora_continua", "nominas", "aux_legal", "gerente_legal"],
  "/altas": ["admin", "rh"],
  "/bajas": ["admin", "rh"],
  "/colaboradores": ["admin", "rh", "gerente_rh", "mejora_continua", "nominas", "aux_legal", "gerente_legal"],
  "/expedientes-legal": ["admin", "rh", "gerente_rh", "mejora_continua", "nominas", "aux_legal", "gerente_legal"],
  "/moper": ["admin", "rh", "gerente_rh"],
  "/servicios": ["admin", "rh", "gerente_rh"],
};

/** Único usuario RRHH con acceso a Ficha técnica (además de admin). Correo en minúsculas. */
export const FICHA_TECNICA_AUX_RH_EMAIL = "auxrh@tacticalsupport.com.mx";

export function mayAccessFichaTecnica(role: AppRole, email: string | null | undefined): boolean {
  if (role === "admin") return true;
  const e = (email ?? "").trim().toLowerCase();
  return e === FICHA_TECNICA_AUX_RH_EMAIL.toLowerCase();
}

export function canAccessPath(role: AppRole, pathname: string, userEmail?: string | null): boolean {
  if (pathname.startsWith("/auth/signout")) return true;
  const sec = routeSection(pathname);
  if (sec === "/ficha-tecnica") {
    return mayAccessFichaTecnica(role, userEmail);
  }
  const allowed = SECTION_ROLES[sec];
  if (!allowed) return role === "admin";
  return role === "admin" || (allowed as readonly AppRole[]).includes(role);
}

/** Roles legales: solo colaboradores y expedientes legal (lectura); comparten panel de inicio con métricas. */
export function esRolLegalSoloLectura(role: AppRole): boolean {
  return role === "aux_legal" || role === "gerente_legal";
}

/** Tras login o acceso denegado: siempre el panel de inicio. */
export function defaultHomeForRole(_role: AppRole): string {
  return "/";
}

/** Enlace “inicio” en UI heredada (misma landing para todos los roles). */
export function inicioHrefParaRol(_role: AppRole): string {
  return "/";
}

export function roleMayWriteAltas(role: AppRole): boolean {
  return role === "admin";
}

export function roleMayEditColaboradores(role: AppRole): boolean {
  return role === "admin" || role === "rh" || role === "gerente_rh";
}

export function roleMayReadColaboradoresApi(role: AppRole): boolean {
  /** nominas y legal: lectura; POST sigue vetado en la ruta salvo editores. */
  return (
    role === "admin" ||
    role === "rh" ||
    role === "gerente_rh" ||
    role === "mejora_continua" ||
    role === "nominas" ||
    role === "aux_legal" ||
    role === "gerente_legal"
  );
}

export function roleMayWriteMoperHistorial(role: AppRole): boolean {
  return role === "admin" || role === "rh" || role === "gerente_rh";
}

/** Vaciar tabla de historial MOPER (operación destructiva). Solo administrador. */
export function roleMayPurgeMoperHistorial(role: AppRole): boolean {
  return role === "admin";
}

export function roleMayReadMoperHistorialApi(role: AppRole): boolean {
  return role === "admin" || role === "rh" || role === "gerente_rh" || role === "mejora_continua";
}

export function roleMayReadServiciosCatalogo(role: AppRole): boolean {
  return role === "admin" || role === "rh" || role === "gerente_rh";
}

export function roleMayEditServiciosCatalogo(role: AppRole): boolean {
  /** gerente_rh entra al módulo Servicios desde el mismo menú que RH para mantener catálogo al editar expedientes/MOPER */
  return role === "admin" || role === "rh" || role === "gerente_rh";
}

/** Enlaces del panel lateral en la página de inicio (según rol). */
export function homeSidebarLinks(role: AppRole, userEmail?: string | null): { href: string; label: string }[] {
  const items: { href: string; label: string; roles: readonly AppRole[] }[] = [
    { href: "/altas", label: "Altas", roles: ["rh"] },
    { href: "/servicios", label: "Servicios", roles: ["rh", "gerente_rh"] },
    { href: "/bajas", label: "Bajas", roles: ["rh"] },
    { href: "/colaboradores", label: "Colaboradores", roles: ["rh", "gerente_rh", "mejora_continua", "nominas", "aux_legal", "gerente_legal"] },
    { href: "/expedientes-legal", label: "Expedientes legal", roles: ["rh", "gerente_rh", "mejora_continua", "nominas", "aux_legal", "gerente_legal"] },
    { href: "/ficha-tecnica", label: "Ficha técnica", roles: ["rh"] },
    { href: "/moper", label: "Moper", roles: ["rh", "gerente_rh"] },
  ];
  return items.filter((i) => {
    if (role === "admin") return true;
    if (i.href === "/ficha-tecnica") return mayAccessFichaTecnica(role, userEmail);
    return i.roles.includes(role);
  });
}
