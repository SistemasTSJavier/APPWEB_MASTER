import type { SgcDepartamentoId } from "@/lib/sgc-calidad";

/**
 * Roles de aplicación (`app_role` en metadata de Supabase Auth).
 *
 * Resumen:
 * - admin: acceso total.
 * - rh: acceso total operativo (incl. MOPER).
 * - aux_rh: solo Altas y Bajas; puede registrar, editar y guardar en ambos módulos (auxrh@tacticalsupport.com.mx).
 * - gerente_rh: inicio, bajas, colaboradores (solo lectura), MOPER (registra/edita) y Gestores proceso. Sin altas, expedientes legal, servicios ni ficha técnica.
 * - mejora_continua: inicio, MOPER y Bajas solo ver; Colaboradores ver + export CSV; SGC igual que admin (subir/eliminar, todos los departamentos).
 * - nominas: inicio, Colaboradores, MOPER consulta y recepción de documentos completados (marca recibido).
 * - aux_legal: Colaboradores, Expedientes legal e historial MOPER (consulta).
 * - gerente_legal: lo mismo + Alertas contrato (contratos de prueba).
 * - editor_cuadricula: inicio, Bajas, Colaboradores y MOPER solo consulta; Cuadrícula con captura/guardado e import CSV.
 * - capacitacion: inicio y sección Categorización únicamente.
 * - relaciones_laborales: inicio y MOPER (registrar, editar y guardar); sin otros módulos.
 * - gerente_operaciones: solo MOPER; firma como Gerente de Operaciones (gerenteoperaciones@tacticalsupport.com.mx).
 * - contabilidad: solo MOPER; consulta documentos completados y marca recepción oficial (contabilidad@tacticalsupport.com.mx).
 * - cliente_enfoque: solo consulta del dashboard de categorización (todos los módulos), limitado al servicio del acceso temporal.
 */
export type AppRole =
  | "admin"
  | "nominas"
  | "mejora_continua"
  | "rh"
  | "gerente_rh"
  | "aux_rh"
  | "aux_legal"
  | "gerente_legal"
  | "editor_cuadricula"
  | "capacitacion"
  | "relaciones_laborales"
  | "gerente_operaciones"
  | "contabilidad"
  | "cliente_enfoque";

/** Correos previstos para usuarios legales (referencia al crear usuarios en Supabase). */
export const AUX_LEGAL_EMAIL = "auxlegal@tacticalsupport.com.mx";
export const GERENTE_LEGAL_EMAIL = "gerentelegal@tacticalsupport.com.mx";

/** Coordinador centro de control: editor de cuadrícula (metadata app_role: editor_cuadricula). */
export const EDITOR_CUADRICULA_EMAIL = "coordinadorcentrodecontrol@tacticalsupport.com.mx";

/** Usuario de capacitación: acceso a Categorización (metadata app_role: capacitacion o correo autorizado). */
export const CAPACITACION_EMAIL = "capacitacion@tacticalsupport.com.mx";

/** Relaciones laborales: solo MOPER con edición (metadata app_role: relaciones_laborales o este correo). */
export const RELACIONES_LABORALES_EMAIL = "relacioneslaborales@tacticalsupport.com.mx";

/** Aux RH: solo Altas y Bajas (metadata app_role: aux_rh o este correo). */
export const AUX_RH_EMAIL = "auxrh@tacticalsupport.com.mx";

/** Gerente de operaciones: solo MOPER y firma gerente (metadata app_role: gerente_operaciones o este correo). */
export const GERENTE_OPERACIONES_EMAIL = "gerenteoperaciones@tacticalsupport.com.mx";

/** Contabilidad: solo MOPER; marca recepción de documentos completados (metadata app_role: contabilidad o este correo). */
export const CONTABILIDAD_EMAIL = "contabilidad@tacticalsupport.com.mx";

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
  editor_cuadricula: "editor_cuadricula",
  "editor cuadricula": "editor_cuadricula",
  "editor cuadrícula": "editor_cuadricula",
  coordinador_centro_control: "editor_cuadricula",
  "coordinador centro de control": "editor_cuadricula",
  capacitacion: "capacitacion",
  capacitación: "capacitacion",
  "capacitacion rh": "capacitacion",
  relaciones_laborales: "relaciones_laborales",
  "relaciones laborales": "relaciones_laborales",
  relacioneslaborales: "relaciones_laborales",
  gerente_operaciones: "gerente_operaciones",
  "gerente operaciones": "gerente_operaciones",
  gerenteoperaciones: "gerente_operaciones",
  contabilidad: "contabilidad",
  contable: "contabilidad",
  cliente_enfoque: "cliente_enfoque",
  "cliente enfoque": "cliente_enfoque",
  cliente_enfoque_cliente: "cliente_enfoque",
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
  editor_cuadricula: "Editor cuadrícula",
  capacitacion: "Capacitación",
  relaciones_laborales: "Relaciones laborales",
  gerente_operaciones: "Gerente operaciones",
  contabilidad: "Contabilidad",
  cliente_enfoque: "Cliente enfoque",
};

/** Rol efectivo: metadata `app_role` o correos corporativos conocidos. */
export function resolveAppRoleFromUser(user: {
  email?: string | null;
  user_metadata?: Record<string, unknown> | null;
  app_metadata?: Record<string, unknown> | null;
}): AppRole | null {
  const e = (user.email ?? "").trim().toLowerCase();
  if (e === AUX_RH_EMAIL.toLowerCase()) return "aux_rh";
  if (e === GERENTE_OPERACIONES_EMAIL.toLowerCase()) return "gerente_operaciones";
  if (e === CONTABILIDAD_EMAIL.toLowerCase()) return "contabilidad";
  const fromMeta = parseAppRole(user.user_metadata?.app_role ?? user.app_metadata?.app_role);
  if (fromMeta) return fromMeta;
  if (e === RELACIONES_LABORALES_EMAIL.toLowerCase()) return "relaciones_laborales";
  return null;
}

/** Primera sección de la ruta, p. ej. `/colaboradores/xxx` → `/colaboradores` */
export function routeSection(pathname: string): string {
  const p = pathname.replace(/\/$/, "") || "/";
  if (p === "/") return "/";
  const seg = p.split("/").filter(Boolean)[0];
  return seg ? `/${seg}` : "/";
}

const SECTION_ROLES: Record<string, readonly AppRole[]> = {
  "/": [
    "admin",
    "rh",
    "gerente_rh",
    "mejora_continua",
    "nominas",
    "aux_legal",
    "gerente_legal",
    "editor_cuadricula",
    "capacitacion",
    "relaciones_laborales",
  ],
  "/altas": ["admin", "rh", "aux_rh"],
  "/bajas": ["admin", "rh", "aux_rh", "gerente_rh", "mejora_continua", "editor_cuadricula"],
  "/colaboradores": ["admin", "rh", "gerente_rh", "mejora_continua", "nominas", "aux_legal", "gerente_legal", "editor_cuadricula"],
  "/cuadricula": ["admin", "rh", "gerente_rh", "mejora_continua", "nominas", "editor_cuadricula"],
  "/expedientes-legal": ["admin", "rh", "aux_legal", "gerente_legal"],
  "/ds3": ["admin", "rh", "aux_legal", "gerente_legal"],
  "/gerente-legal": ["admin", "gerente_legal"],
  "/moper": [
    "admin",
    "rh",
    "gerente_rh",
    "mejora_continua",
    "nominas",
    "aux_legal",
    "gerente_legal",
    "editor_cuadricula",
    "relaciones_laborales",
    "gerente_operaciones",
    "contabilidad",
  ],
  "/servicios": ["admin", "rh"],
  "/sgc": ["admin", "mejora_continua"],
  "/gestores-proceso": ["admin", "rh", "gerente_rh"],
  "/categorizacion": ["admin", "gerente_rh", "capacitacion"],
  "/bonos": ["admin", "nominas", "gerente_rh"],
};

export function mayAccessFichaTecnica(role: AppRole, _email?: string | null): boolean {
  return role === "admin";
}

/** Categorización: admin, gerente RH, capacitacion, correo capacitacion o cliente enfoque con acceso vigente. */
export function roleMayAccessCategorizacion(role: AppRole, email?: string | null): boolean {
  if (role === "cliente_enfoque") return true;
  if (role === "admin" || role === "gerente_rh" || role === "capacitacion") return true;
  const e = (email ?? "").trim().toLowerCase();
  return e === CAPACITACION_EMAIL.toLowerCase();
}

/** Bonos por asistencia: Administrador, Nóminas y Gerente RH. */
export function roleMayAccessBonos(role: AppRole): boolean {
  return role === "admin" || role === "nominas" || role === "gerente_rh";
}

export function roleEsClienteEnfoque(role: AppRole): boolean {
  return role === "cliente_enfoque";
}

export function canAccessPath(role: AppRole, pathname: string, userEmail?: string | null): boolean {
  if (pathname.startsWith("/auth/signout")) return true;
  const sec = routeSection(pathname);
  if (sec === "/ficha-tecnica") {
    return mayAccessFichaTecnica(role, userEmail);
  }
  if (sec === "/categorizacion") {
    if (role === "cliente_enfoque") {
      return (
        pathname === "/categorizacion/dashboard" || pathname.startsWith("/categorizacion/dashboard/")
      );
    }
    return roleMayAccessCategorizacion(role, userEmail);
  }
  const allowed = SECTION_ROLES[sec];
  if (!allowed) return role === "admin";
  return role === "admin" || (allowed as readonly AppRole[]).includes(role);
}

/** Roles legales: solo colaboradores y expedientes legal (lectura). */
export function esRolLegalSoloLectura(role: AppRole): boolean {
  return role === "aux_legal" || role === "gerente_legal";
}

/** Alertas de vencimiento de contrato de prueba: solo Administrador y Gerente Legal. */
export function roleMayAccessGerenteLegalContratos(role: AppRole): boolean {
  return role === "admin" || role === "gerente_legal";
}

/** Modulo DC-3 (consulta y subida de archivos por colaborador). */
export function roleMayAccessDs3(role: AppRole): boolean {
  return roleMayAccessExpedientesLegal(role);
}

export function roleMayEditDs3(role: AppRole): boolean {
  return roleMayEditColaboradoresLegacyRh(role);
}

/** Modulo Expedientes legal (pagina y API de listado de PDFs). */
export function roleMayAccessExpedientesLegal(role: AppRole): boolean {
  return (
    role === "admin" ||
    role === "rh" ||
    role === "aux_legal" ||
    role === "gerente_legal" ||
    role === "editor_cuadricula"
  );
}

/** Tras login o acceso denegado. */
export function defaultHomeForRole(role: AppRole): string {
  if (role === "cliente_enfoque") return "/categorizacion/dashboard";
  if (role === "relaciones_laborales" || role === "gerente_operaciones" || role === "contabilidad") return "/moper";
  if (role === "aux_rh") return "/altas";
  return "/";
}

export function inicioHrefParaRol(role: AppRole): string {
  if (role === "cliente_enfoque") return "/categorizacion/dashboard";
  if (role === "relaciones_laborales" || role === "gerente_operaciones" || role === "contabilidad") return "/moper";
  if (role === "aux_rh") return "/altas";
  return "/";
}

/** Enlaces del menú lateral (sin página de inicio). */
export function appSidebarModuleLinks(role: AppRole, userEmail?: string | null): { href: string; label: string }[] {
  if (role === "cliente_enfoque") {
    return [{ href: "/categorizacion/dashboard", label: "Dashboard categorización" }];
  }
  if (role === "aux_rh") {
    return [
      { href: "/altas", label: "Altas" },
      { href: "/bajas", label: "Bajas" },
    ];
  }
  if (role === "gerente_operaciones") {
    return [{ href: "/moper", label: "Moper" }];
  }
  if (role === "contabilidad") {
    return [{ href: "/moper", label: "Moper" }];
  }
  return homeSidebarLinks(role, userEmail);
}

/** Muestra enlace «Inicio» en la barra lateral. */
export function roleShowsInicioNav(role: AppRole): boolean {
  return role !== "aux_rh" && role !== "gerente_operaciones" && role !== "contabilidad" && role !== "cliente_enfoque";
}

/** Altas: importar / guardar expediente nuevo. Administrador y Aux RH (Gerente RH solo consulta en Altas). */
export function roleMayWriteAltas(role: AppRole): boolean {
  return role === "admin" || role === "aux_rh";
}

/** Expediente Colaboradores (módulo UI): editar expediente. Solo administrador. */
export function roleMayEditColaboradores(role: AppRole): boolean {
  return role === "admin";
}

/** Guardar expediente vía API (Altas, Bajas e importaciones masivas). Admin, RH y Aux RH. */
export function roleMayWriteExpedienteColaborador(role: AppRole): boolean {
  return role === "admin" || role === "rh" || role === "aux_rh";
}

/** Misma regla que edición de expediente (import CSV columna, vacantes en editor). */
export function roleMayEditColaboradoresVacantes(role: AppRole): boolean {
  return roleMayEditColaboradores(role);
}

/** Bajas: registrar y editar bajas (módulo UI). */
export function roleMayWriteBajas(role: AppRole): boolean {
  return role === "admin" || role === "rh" || role === "aux_rh";
}

/** Expedientes legal (edición de PDFs). Admin y RH. */
export function roleMayEditColaboradoresLegacyRh(role: AppRole): boolean {
  return role === "admin" || role === "rh";
}

/** Filtro por rango de fecha de baja (módulo Bajas y cuadrícula → Bajas). */
export function roleMayFilterBajasPorFechaBaja(role: AppRole): boolean {
  return role === "admin" || role === "gerente_rh";
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
    role === "gerente_legal" ||
    role === "editor_cuadricula"
  );
}

/** Exportar CSV desde Colaboradores (filtros y selección); sin edición de expediente. */
export function roleMayExportColaboradoresCsv(role: AppRole): boolean {
  return role === "admin" || role === "rh" || role === "mejora_continua";
}

export function roleMayWriteMoperHistorial(role: AppRole): boolean {
  return role === "admin" || role === "rh" || role === "gerente_rh" || role === "relaciones_laborales";
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
    role === "gerente_legal" ||
    role === "editor_cuadricula" ||
    role === "relaciones_laborales" ||
    role === "gerente_operaciones" ||
    role === "contabilidad"
  );
}

/** Marcar MOPER como recibido (cambio oficial): Nóminas o Contabilidad. */
export function roleMayMarcarRecibidoContabilidadMoper(role: AppRole): boolean {
  return role === "nominas" || role === "contabilidad";
}

/** Reenviar notificación por correo a contabilidad. */
export function roleMayReenviarEmailContabilidadMoper(role: AppRole): boolean {
  return role === "admin" || role === "rh" || role === "gerente_rh" || role === "relaciones_laborales";
}

/** Lectura del catálogo (lista desplegable): operación y cuadrícula (nóminas, gerente RH, mejora). */
export function roleMayReadServiciosCatalogo(role: AppRole): boolean {
  return (
    role === "admin" ||
    role === "rh" ||
    role === "gerente_rh" ||
    role === "mejora_continua" ||
    role === "nominas" ||
    role === "editor_cuadricula"
  );
}

export function roleMayEditServiciosCatalogo(role: AppRole): boolean {
  return role === "admin" || role === "rh";
}

/** Importación CSV del catálogo (2 col: nombre + N.º; 3 col: + planta); solo administrador. */
/** Cuadrícula / asistencia: lectura (GET). */
export function roleMayReadCuadriculaAsistencia(role: AppRole): boolean {
  const allowed = SECTION_ROLES["/cuadricula"];
  return role === "admin" || (allowed != null && (allowed as readonly AppRole[]).includes(role));
}

/** Cuadrícula: captura y guardado (administrador y editor de cuadrícula). */
export function roleMayEditCuadricula(role: AppRole): boolean {
  return role === "admin" || role === "editor_cuadricula";
}

/** Importar CSV de códigos de asistencia (semana / todas las plantas). */
export function roleMayImportCuadriculaAsistenciaCsv(role: AppRole): boolean {
  return roleMayEditCuadricula(role);
}

/** Cuadrícula / asistencia: guardar en servidor (POST / sync). */
export function roleMayWriteCuadriculaAsistencia(role: AppRole): boolean {
  return roleMayEditCuadricula(role);
}

export function roleMayImportServiciosCatalogoDosColumnasAdmin(role: AppRole): boolean {
  return role === "admin";
}

/** Sistemas de gestión de calidad (sección SGC). */
export function roleMayAccessSgc(role: AppRole): boolean {
  return role === "admin" || role === "mejora_continua";
}

export function roleMayUploadSgc(role: AppRole): boolean {
  return roleMayAccessSgc(role);
}

/** Subir y eliminar archivos en SGC (admin y mejora continua). */
export function roleMayDeleteSgc(role: AppRole): boolean {
  return roleMayAccessSgc(role);
}

/** Elegir cualquier departamento en SGC (admin y mejora continua). */
export function roleMayPickSgcDepartamento(role: AppRole): boolean {
  return roleMayAccessSgc(role);
}

export function sgcDepartamentoFijoPorRol(_role: AppRole): SgcDepartamentoId | null {
  return null;
}

/** Comparativa de gestores del proceso (altas / expediente). */
export function roleMayAccessGestoresProceso(role: AppRole): boolean {
  return role === "admin" || role === "rh" || role === "gerente_rh";
}

/** Enlaces del panel lateral en la página de inicio (según rol). */
export function homeSidebarLinks(role: AppRole, userEmail?: string | null): { href: string; label: string }[] {
  if (role === "aux_rh") {
    return [
      { href: "/altas", label: "Altas" },
      { href: "/bajas", label: "Bajas" },
    ];
  }
  if (role === "capacitacion") {
    return [{ href: "/categorizacion", label: "Categorización" }];
  }
  if (role === "relaciones_laborales") {
    return [{ href: "/moper", label: "Moper" }];
  }
  if (role === "gerente_operaciones") {
    return [{ href: "/moper", label: "Moper" }];
  }
  if (role === "contabilidad") {
    return [{ href: "/moper", label: "Moper" }];
  }

  const items: { href: string; label: string; roles: readonly AppRole[] }[] = [
    { href: "/altas", label: "Altas", roles: ["admin", "rh", "aux_rh"] },
    { href: "/servicios", label: "Servicios", roles: ["admin", "rh"] },
    { href: "/bajas", label: "Bajas", roles: ["admin", "rh", "aux_rh", "gerente_rh", "mejora_continua", "editor_cuadricula"] },
    {
      href: "/cuadricula",
      label: "Cuadrícula",
      roles: ["admin", "rh", "gerente_rh", "mejora_continua", "nominas", "editor_cuadricula"],
    },
    {
      href: "/colaboradores",
      label: "Colaboradores",
      roles: ["admin", "rh", "gerente_rh", "mejora_continua", "nominas", "aux_legal", "gerente_legal", "editor_cuadricula"],
    },
    { href: "/expedientes-legal", label: "Expedientes legal", roles: ["admin", "rh", "aux_legal", "gerente_legal"] },
    { href: "/ds3", label: "DC-3", roles: ["admin", "rh", "aux_legal", "gerente_legal"] },
    {
      href: "/gerente-legal/contratos",
      label: "Alertas contrato",
      roles: ["admin", "gerente_legal"],
    },
    { href: "/ficha-tecnica", label: "Ficha técnica", roles: ["admin", "rh"] },
    {
      href: "/moper",
      label: "Moper",
      roles: [
        "admin",
        "rh",
        "gerente_rh",
        "mejora_continua",
        "nominas",
        "aux_legal",
        "gerente_legal",
        "editor_cuadricula",
        "relaciones_laborales",
        "gerente_operaciones",
        "contabilidad",
      ],
    },
    {
      href: "/sgc",
      label: "SGC",
      roles: ["admin", "mejora_continua"],
    },
    {
      href: "/gestores-proceso",
      label: "Gestores proceso",
      roles: ["admin", "rh", "gerente_rh"],
    },
    {
      href: "/categorizacion",
      label: "Categorización",
      roles: ["admin", "gerente_rh", "capacitacion"],
    },
    {
      href: "/bonos",
      label: "Bonos",
      roles: ["admin", "nominas", "gerente_rh"],
    },
  ];
  return items.filter((i) => {
    if (role === "admin") return true;
    if (i.href === "/ficha-tecnica") return mayAccessFichaTecnica(role, userEmail);
    if (i.href === "/categorizacion") return roleMayAccessCategorizacion(role, userEmail);
    return i.roles.includes(role);
  });
}
