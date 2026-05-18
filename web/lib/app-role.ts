/**
 * Roles de aplicación (`app_role` en metadata de Supabase Auth).
 *
 * Resumen:
 * - admin: acceso total.
 * - rh: acceso total operativo (incl. MOPER).
 * - aux_rh: todas las secciones excepto MOPER; puede registrar/editar (no solo ver). Incluye Cuadrícula.
 * - gerente_rh: inicio, bajas, colaboradores (solo lectura) y MOPER (registra/edita). Sin altas, expedientes legal, servicios ni ficha técnica.
 * - mejora_continua: inicio, MOPER y Bajas solo ver; Colaboradores ver + export CSV (filtros, selección).
 * - nominas: inicio, Colaboradores y MOPER solo consulta (sin expedientes legal ni export CSV).
 * - aux_legal / gerente_legal: Colaboradores, Expedientes legal e historial MOPER solo consulta.
 */
export type AppRole =
  | "admin"
  | "nominas"
  | "mejora_continua"
  | "rh"
  | "gerente_rh"
  | "aux_rh"
  | "aux_legal"
  | "gerente_legal";

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
  aux_rh: "aux_rh",
  "aux rh": "aux_rh",
  auxrh: "aux_rh",
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
  aux_rh: "Aux RH",
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
  "/": ["admin", "rh", "aux_rh", "gerente_rh", "mejora_continua", "nominas", "aux_legal", "gerente_legal"],
  "/altas": ["admin", "rh", "aux_rh"],
  "/bajas": ["admin", "rh", "aux_rh", "gerente_rh", "mejora_continua"],
  "/colaboradores": ["admin", "rh", "aux_rh", "gerente_rh", "mejora_continua", "nominas", "aux_legal", "gerente_legal"],
  "/cuadricula": ["admin", "rh", "aux_rh", "gerente_rh", "mejora_continua", "nominas"],
  "/expedientes-legal": ["admin", "rh", "aux_rh", "aux_legal", "gerente_legal"],
  "/moper": ["admin", "rh", "gerente_rh", "mejora_continua", "nominas", "aux_legal", "gerente_legal"],
  "/servicios": ["admin", "rh", "aux_rh"],
};

/** Único usuario RRHH con acceso legacy a Ficha técnica por correo (además de admin y roles ampliados). */
export const FICHA_TECNICA_AUX_RH_EMAIL = "auxrh@tacticalsupport.com.mx";

export function mayAccessFichaTecnica(role: AppRole, email: string | null | undefined): boolean {
  if (role === "admin" || role === "aux_rh") return true;
  const e = (email ?? "").trim().toLowerCase();
  if (role === "rh" && e === FICHA_TECNICA_AUX_RH_EMAIL.toLowerCase()) return true;
  return false;
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

/** Roles legales: solo colaboradores y expedientes legal (lectura). */
export function esRolLegalSoloLectura(role: AppRole): boolean {
  return role === "aux_legal" || role === "gerente_legal";
}

/** Modulo Expedientes legal (pagina y API de listado de PDFs). */
export function roleMayAccessExpedientesLegal(role: AppRole): boolean {
  return (
    role === "admin" ||
    role === "rh" ||
    role === "aux_rh" ||
    role === "aux_legal" ||
    role === "gerente_legal"
  );
}

/** Tras login o acceso denegado: siempre el panel de inicio. */
export function defaultHomeForRole(_role: AppRole): string {
  return "/";
}

export function inicioHrefParaRol(_role: AppRole): string {
  return "/";
}

/** Altas: importar / guardar expediente nuevo. Administrador y Aux RH (Gerente RH solo consulta en Altas). */
export function roleMayWriteAltas(role: AppRole): boolean {
  return role === "admin" || role === "aux_rh";
}

/** Expediente Colaboradores (POST, fotos, import CSV columna, sincronizar MOPER→expediente). */
export function roleMayEditColaboradores(role: AppRole): boolean {
  return role === "admin" || role === "rh" || role === "aux_rh";
}

export function roleMayReadColaboradoresApi(role: AppRole): boolean {
  return (
    role === "admin" ||
    role === "rh" ||
    role === "aux_rh" ||
    role === "gerente_rh" ||
    role === "mejora_continua" ||
    role === "nominas" ||
    role === "aux_legal" ||
    role === "gerente_legal"
  );
}

/** Exportar CSV desde Colaboradores (filtros y selección); sin edición de expediente. */
export function roleMayExportColaboradoresCsv(role: AppRole): boolean {
  return role === "admin" || role === "rh" || role === "aux_rh" || role === "mejora_continua";
}

export function roleMayWriteMoperHistorial(role: AppRole): boolean {
  return role === "admin" || role === "rh" || role === "gerente_rh";
}

export function roleMayPurgeMoperHistorial(role: AppRole): boolean {
  return role === "admin";
}

export function roleMayReadMoperHistorialApi(role: AppRole): boolean {
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

/** Lectura del catálogo (lista desplegable): operación y cuadrícula (nóminas, gerente RH, mejora). */
export function roleMayReadServiciosCatalogo(role: AppRole): boolean {
  return (
    role === "admin" ||
    role === "rh" ||
    role === "aux_rh" ||
    role === "gerente_rh" ||
    role === "mejora_continua" ||
    role === "nominas"
  );
}

export function roleMayEditServiciosCatalogo(role: AppRole): boolean {
  return role === "admin" || role === "rh" || role === "aux_rh";
}

/** Importación CSV del catálogo (2 col: nombre + N.º; 3 col: + planta); solo administrador. */
/** Cuadrícula / asistencia: lectura (GET). */
export function roleMayReadCuadriculaAsistencia(role: AppRole): boolean {
  const allowed = SECTION_ROLES["/cuadricula"];
  return role === "admin" || (allowed != null && (allowed as readonly AppRole[]).includes(role));
}

/** Cuadrícula / asistencia: guardar (POST). */
export function roleMayWriteCuadriculaAsistencia(role: AppRole): boolean {
  return roleMayReadCuadriculaAsistencia(role);
}

export function roleMayImportServiciosCatalogoDosColumnasAdmin(role: AppRole): boolean {
  return role === "admin";
}

/** Enlaces del panel lateral en la página de inicio (según rol). */
export function homeSidebarLinks(role: AppRole, userEmail?: string | null): { href: string; label: string }[] {
  const items: { href: string; label: string; roles: readonly AppRole[] }[] = [
    { href: "/altas", label: "Altas", roles: ["admin", "rh", "aux_rh"] },
    { href: "/servicios", label: "Servicios", roles: ["admin", "rh", "aux_rh"] },
    { href: "/bajas", label: "Bajas", roles: ["admin", "rh", "aux_rh", "gerente_rh", "mejora_continua"] },
    {
      href: "/cuadricula",
      label: "Cuadrícula",
      roles: ["admin", "rh", "aux_rh", "gerente_rh", "mejora_continua", "nominas"],
    },
    {
      href: "/colaboradores",
      label: "Colaboradores",
      roles: ["admin", "rh", "aux_rh", "gerente_rh", "mejora_continua", "nominas", "aux_legal", "gerente_legal"],
    },
    { href: "/expedientes-legal", label: "Expedientes legal", roles: ["admin", "rh", "aux_rh", "aux_legal", "gerente_legal"] },
    { href: "/ficha-tecnica", label: "Ficha técnica", roles: ["admin", "rh", "aux_rh"] },
    {
      href: "/moper",
      label: "Moper",
      roles: ["admin", "rh", "gerente_rh", "mejora_continua", "nominas", "aux_legal", "gerente_legal"],
    },
  ];
  return items.filter((i) => {
    if (role === "admin") return true;
    if (i.href === "/ficha-tecnica") return mayAccessFichaTecnica(role, userEmail);
    return i.roles.includes(role);
  });
}
