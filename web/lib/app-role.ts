import { isSgcDepartamentoId, esFormatoDepartamentoId, type SgcDepartamentoId } from "@/lib/sgc-calidad";

/**
 * Roles de aplicación (`app_role` en metadata de Supabase Auth).
 *
 * Resumen:
 * - admin: acceso total.
 * - rh: acceso total operativo (incl. MOPER).
 * - aux_rh: solo Altas y Bajas; puede registrar, editar y guardar en ambos módulos (auxrh@tacticalsupport.com.mx).
 * - gerente_rh: inicio, bajas, colaboradores (solo lectura), MOPER (registra/edita) y Gestores proceso. Sin altas, expedientes legal, servicios ni ficha técnica.
 * - mejora_continua: inicio, MOPER y Bajas solo ver; Colaboradores ver + export CSV; SGC (subir/reemplazar/eliminar todos los deptos) e Ideas que transforman.
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

/** Módulos que el administrador puede habilitar por usuario (`user_metadata.modulos_habilitados`). */
export const APP_MODULOS_HABILITABLES = [
  { id: "/altas", label: "Altas" },
  { id: "/servicios", label: "Servicios" },
  { id: "/bajas", label: "Bajas" },
  { id: "/cuadricula", label: "Cuadrícula" },
  { id: "/colaboradores", label: "Colaboradores" },
  { id: "/expedientes-legal", label: "Expedientes legal" },
  { id: "/ds3", label: "DC-3" },
  { id: "/gerente-legal", label: "Alertas contrato" },
  { id: "/ficha-tecnica", label: "Ficha técnica" },
  { id: "/moper", label: "Moper" },
  { id: "/sgc", label: "SGC" },
  { id: "/ideas-que-transforman", label: "Ideas que transforman" },
  { id: "/gestores-proceso", label: "Gestores proceso" },
  { id: "/categorizacion", label: "Categorización" },
  { id: "/pruebas-efectividad-operativa", label: "Efectividad operativa" },
  { id: "/bonos", label: "Bonos" },
] as const;

export type AppModuloId = (typeof APP_MODULOS_HABILITABLES)[number]["id"];

const APP_MODULO_ID_SET = new Set<string>(APP_MODULOS_HABILITABLES.map((m) => m.id));

export function esAppModuloId(v: string): v is AppModuloId {
  return APP_MODULO_ID_SET.has(v);
}

/** Normaliza lista de módulos desde metadata (ignora valores inválidos). */
export function parseModulosHabilitados(raw: unknown): AppModuloId[] {
  let data = raw;
  if (typeof data === "string") {
    try {
      data = JSON.parse(data) as unknown;
    } catch {
      return [];
    }
  }
  if (!Array.isArray(data)) return [];
  const out: AppModuloId[] = [];
  const seen = new Set<string>();
  for (const item of data) {
    const id = String(item ?? "").trim().replace(/\/$/, "") || "";
    const sec = id.startsWith("/") ? routeSection(id) : "";
    const key = esAppModuloId(id) ? id : esAppModuloId(sec) ? sec : null;
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push(key);
  }
  return out;
}

export function modulosHabilitadosDesdeMetadata(
  userMetadata?: Record<string, unknown> | null,
): AppModuloId[] {
  const caps = parseModulosCapacidades(userMetadata?.modulos_capacidades);
  if (caps.length > 0) {
    return caps.filter((c) => c.ver || c.editar || c.eliminar).map((c) => c.modulo);
  }
  return parseModulosHabilitados(userMetadata?.modulos_habilitados);
}

/** Capacidades por módulo: ver / editar / eliminar. */
export type ModuloCapacidad = {
  modulo: AppModuloId;
  ver: boolean;
  editar: boolean;
  eliminar: boolean;
};

export function parseModulosCapacidades(raw: unknown): ModuloCapacidad[] {
  let data = raw;
  if (typeof data === "string") {
    try {
      data = JSON.parse(data) as unknown;
    } catch {
      return [];
    }
  }
  if (!Array.isArray(data)) return [];
  const byModulo = new Map<AppModuloId, ModuloCapacidad>();
  for (const item of data) {
    if (!item || typeof item !== "object") continue;
    const o = item as Record<string, unknown>;
    const moduloRaw = String(o.modulo ?? o.id ?? "").trim();
    const sec = moduloRaw.startsWith("/") ? routeSection(moduloRaw) : "";
    const modulo = esAppModuloId(moduloRaw) ? moduloRaw : esAppModuloId(sec) ? sec : null;
    if (!modulo) continue;
    let ver = o.ver === true || o.ver === "true" || o.ver === 1;
    let editar = o.editar === true || o.editar === "true" || o.editar === 1;
    let eliminar = o.eliminar === true || o.eliminar === "true" || o.eliminar === 1;
    if (editar || eliminar) ver = true;
    if (!ver && !editar && !eliminar) continue;
    byModulo.set(modulo, { modulo, ver, editar, eliminar });
  }
  return [...byModulo.values()];
}

/** True si el admin configuró módulos (capacidades o lista); entonces el rol ya no abre todo el menú. */
export function tieneModulosExplicitos(userMetadata?: Record<string, unknown> | null): boolean {
  if (parseModulosCapacidades(userMetadata?.modulos_capacidades).length > 0) return true;
  return parseModulosHabilitados(userMetadata?.modulos_habilitados).length > 0;
}

/** Ruta de navegación para un id de módulo (algunos apuntan a subrutas). */
export function hrefNavParaModulo(modulo: AppModuloId): string {
  if (modulo === "/gerente-legal") return "/gerente-legal/contratos";
  if (modulo === "/ideas-que-transforman") return "/ideas-que-transforman/panel";
  return modulo;
}

/**
 * Capacidades efectivas del usuario.
 * - Si hay `modulos_capacidades`, se usan.
 * - Si no, null = sin restricción extra (vale el rol + `modulos_habilitados` en navegación).
 */
export function capacidadesDesdeMetadata(
  userMetadata?: Record<string, unknown> | null,
): ModuloCapacidad[] | null {
  const caps = parseModulosCapacidades(userMetadata?.modulos_capacidades);
  if (caps.length > 0) return caps;
  return null;
}

export function capacidadDeModulo(
  userMetadata: Record<string, unknown> | null | undefined,
  modulo: AppModuloId,
): ModuloCapacidad | null {
  const caps = capacidadesDesdeMetadata(userMetadata);
  if (caps == null) return null;
  return caps.find((c) => c.modulo === modulo) ?? { modulo, ver: false, editar: false, eliminar: false };
}

export function userMayModulo(
  role: AppRole,
  userMetadata: Record<string, unknown> | null | undefined,
  modulo: AppModuloId,
  accion: "ver" | "editar" | "eliminar",
): boolean {
  if (role === "admin") return true;
  const cap = capacidadDeModulo(userMetadata, modulo);
  if (cap == null) {
    // Sin capacidades explícitas: el rol manda.
    return true;
  }
  if (accion === "ver") return cap.ver || cap.editar || cap.eliminar;
  if (accion === "editar") return cap.editar;
  return cap.eliminar;
}

/** Colaboradores: solo nombre + no. empleado cuando tiene ver y no editar (con capacidades explícitas). */
export function colaboradoresConsultaLimitada(
  role: AppRole,
  userMetadata?: Record<string, unknown> | null,
): boolean {
  if (role === "admin") return false;
  // Solo con `modulos_capacidades` explícitas; `modulos_habilitados` legado no limita el expediente.
  const caps = parseModulosCapacidades(userMetadata?.modulos_capacidades);
  if (caps.length === 0) return false;
  const cap = caps.find((c) => c.modulo === "/colaboradores");
  if (!cap) return false;
  return cap.ver && !cap.editar;
}

/** Clave de módulo para una ruta (p. ej. panel de ideas → `/ideas-que-transforman`). */
export function moduloIdParaPath(pathname: string): AppModuloId | null {
  const sec = routeSection(pathname);
  if (esAppModuloId(sec)) return sec;
  return null;
}

export function enlacePermitidoPorModulos(
  href: string,
  modulos: readonly string[] | null | undefined,
): boolean {
  if (!modulos || modulos.length === 0) return true;
  const sec = routeSection(href);
  if (sec === "/") return true;
  return modulos.some((m) => m === sec || m === href || href.startsWith(`${m}/`));
}

export function filtrarEnlacesPorModulos<T extends { href: string }>(
  links: T[],
  modulos: readonly string[] | null | undefined,
): T[] {
  if (!modulos || modulos.length === 0) return links;
  return links.filter((l) => enlacePermitidoPorModulos(l.href, modulos));
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
  "/sgc": [
    "admin",
    "mejora_continua",
    "rh",
    "gerente_rh",
    "aux_rh",
    "nominas",
    "contabilidad",
    "aux_legal",
    "gerente_legal",
    "relaciones_laborales",
    "gerente_operaciones",
    "editor_cuadricula",
    "capacitacion",
  ],
  "/usuarios": ["admin"],
  "/ideas-que-transforman": ["admin", "mejora_continua"],
  "/gestores-proceso": ["admin", "rh", "gerente_rh"],
  "/categorizacion": ["admin", "gerente_rh", "capacitacion"],
  "/pruebas-efectividad-operativa": ["admin", "gerente_rh", "capacitacion"],
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

/** Pruebas operativas: mismos capturistas que Categorización; cliente solo consulta su dashboard. */
export function roleMayAccessPruebasEfectividad(role: AppRole, email?: string | null): boolean {
  return roleMayAccessCategorizacion(role, email);
}

export function roleMayCapturePruebasEfectividad(role: AppRole, email?: string | null): boolean {
  return role !== "cliente_enfoque" && roleMayAccessCategorizacion(role, email);
}

/** Bonos por asistencia: Administrador, Nóminas y Gerente RH. */
export function roleMayAccessBonos(role: AppRole): boolean {
  return role === "admin" || role === "nominas" || role === "gerente_rh";
}

export function roleEsClienteEnfoque(role: AppRole): boolean {
  return role === "cliente_enfoque";
}

/** Ideas que transforman (panel interno): solo Administrador y Mejora continua. */
export function roleMayAccessIdeasQueTransforman(role: AppRole): boolean {
  return role === "admin" || role === "mejora_continua";
}

/** Panel de usuarios de la aplicación: solo Administrador. */
export function roleMayAccessAdminUsuarios(role: AppRole): boolean {
  return role === "admin";
}

export function canAccessPath(
  role: AppRole,
  pathname: string,
  userEmail?: string | null,
  modulosHabilitados?: readonly string[] | null,
): boolean {
  if (pathname.startsWith("/auth/signout")) return true;
  const sec = routeSection(pathname);
  if (sec === "/usuarios") {
    return roleMayAccessAdminUsuarios(role);
  }

  // Formulario público de ideas (sin panel).
  if (sec === "/ideas-que-transforman") {
    const p = pathname.replace(/\/$/, "") || "/";
    if (p === "/ideas-que-transforman") return true;
  }

  if (role === "admin") return true;

  const mods =
    modulosHabilitados && modulosHabilitados.length > 0
      ? modulosHabilitados.filter((m): m is AppModuloId => esAppModuloId(String(m)))
      : [];

  // Con módulos asignados por admin: solo esos (el rol ya no abre el resto).
  if (mods.length > 0) {
    if (sec === "/") return true;
    const modulo = moduloIdParaPath(pathname);
    if (!modulo) return false;
    return mods.includes(modulo);
  }

  // Sin lista explícita: acceso por rol (comportamiento legado).
  if (sec === "/ideas-que-transforman") {
    if (!roleMayAccessIdeasQueTransforman(role)) return false;
  } else if (sec === "/ficha-tecnica") {
    if (!mayAccessFichaTecnica(role, userEmail)) return false;
  } else if (sec === "/categorizacion") {
    if (role === "cliente_enfoque") {
      return (
        pathname === "/categorizacion/dashboard" || pathname.startsWith("/categorizacion/dashboard/")
      );
    }
    if (!roleMayAccessCategorizacion(role, userEmail)) return false;
  } else if (sec === "/pruebas-efectividad-operativa") {
    if (role === "cliente_enfoque") {
      return (
        pathname === "/pruebas-efectividad-operativa/dashboard" ||
        pathname.startsWith("/pruebas-efectividad-operativa/dashboard/")
      );
    }
    if (!roleMayAccessPruebasEfectividad(role, userEmail)) return false;
  } else {
    const allowed = SECTION_ROLES[sec];
    if (!allowed) {
      return false;
    }
    if (!(allowed as readonly AppRole[]).includes(role)) {
      return false;
    }
  }

  if (role === "cliente_enfoque") return true;
  return true;
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
export function appSidebarModuleLinks(
  role: AppRole,
  userEmail?: string | null,
  modulosHabilitados?: readonly string[] | null,
): { href: string; label: string }[] {
  if (role === "admin") {
    return homeSidebarLinks(role, userEmail);
  }

  const mods =
    modulosHabilitados && modulosHabilitados.length > 0
      ? modulosHabilitados.filter((m): m is AppModuloId => esAppModuloId(String(m)))
      : [];

  // Lista explícita del admin: menú = solo esos módulos (no el menú completo del rol).
  if (mods.length > 0) {
    const byId = new Map(APP_MODULOS_HABILITABLES.map((m) => [m.id, m.label]));
    return mods
      .filter((id) => byId.has(id))
      .map((id) => ({
        href: hrefNavParaModulo(id),
        label: byId.get(id) ?? id,
      }));
  }

  // Sin restricción explícita: menú según rol.
  let links: { href: string; label: string }[];
  if (role === "cliente_enfoque") {
    links = [
      { href: "/categorizacion/dashboard", label: "Dashboard categorización" },
      { href: "/pruebas-efectividad-operativa/dashboard", label: "Efectividad operativa" },
    ];
  } else if (role === "aux_rh") {
    links = [
      { href: "/altas", label: "Altas" },
      { href: "/bajas", label: "Bajas" },
      { href: "/sgc", label: "SGC" },
    ];
  } else if (role === "gerente_operaciones") {
    links = [
      { href: "/moper", label: "Moper" },
      { href: "/sgc", label: "SGC" },
    ];
  } else if (role === "contabilidad") {
    links = [
      { href: "/moper", label: "Moper" },
      { href: "/sgc", label: "SGC" },
    ];
  } else {
    links = homeSidebarLinks(role, userEmail);
  }
  return links;
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
  if (role === "admin" || role === "mejora_continua") return true;
  return sgcDepartamentoFijoPorRol(role) != null;
}

/** Subir / reemplazar archivos SGC: solo Administrador y Mejora continua. */
export function roleMayUploadSgc(role: AppRole): boolean {
  return role === "admin" || role === "mejora_continua";
}

/** Eliminar archivos SGC: solo Administrador y Mejora continua. */
export function roleMayDeleteSgc(role: AppRole): boolean {
  return role === "admin" || role === "mejora_continua";
}

/** Elegir cualquier departamento en SGC (admin y mejora continua). */
export function roleMayPickSgcDepartamento(role: AppRole): boolean {
  return role === "admin" || role === "mejora_continua";
}

/** Departamento fijo de consulta; null = puede ver/gestionar todos (admin / mejora continua). */
export function sgcDepartamentoFijoPorRol(role: AppRole): SgcDepartamentoId | null {
  switch (role) {
    case "rh":
    case "gerente_rh":
    case "aux_rh":
      return "recursos-humanos";
    case "nominas":
    case "contabilidad":
      return "contabilidad";
    case "aux_legal":
    case "gerente_legal":
      return "legal";
    case "relaciones_laborales":
      return "relaciones-laborales";
    case "gerente_operaciones":
    case "editor_cuadricula":
    case "capacitacion":
      return "operaciones";
    default:
      return null;
  }
}

/**
 * Departamento SGC efectivo: metadata `departamento` si es válida; si no, el mapeo por rol.
 * Admin / mejora continua → null (pueden elegir todos).
 */
export function sgcDepartamentoDesdeUsuario(
  role: AppRole,
  userMetadata?: Record<string, unknown> | null,
): SgcDepartamentoId | null {
  if (role === "admin" || role === "mejora_continua") return null;
  const raw = String(userMetadata?.departamento ?? "").trim();
  if (isSgcDepartamentoId(raw) || esFormatoDepartamentoId(raw)) return raw as SgcDepartamentoId;
  return sgcDepartamentoFijoPorRol(role);
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
      { href: "/sgc", label: "SGC" },
    ];
  }
  if (role === "capacitacion") {
    return [
      { href: "/categorizacion", label: "Categorización" },
      { href: "/pruebas-efectividad-operativa", label: "Efectividad operativa" },
      { href: "/sgc", label: "SGC" },
    ];
  }
  if (role === "relaciones_laborales") {
    return [
      { href: "/moper", label: "Moper" },
      { href: "/sgc", label: "SGC" },
    ];
  }
  if (role === "gerente_operaciones") {
    return [
      { href: "/moper", label: "Moper" },
      { href: "/sgc", label: "SGC" },
    ];
  }
  if (role === "contabilidad") {
    return [
      { href: "/moper", label: "Moper" },
      { href: "/sgc", label: "SGC" },
    ];
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
      href: "/usuarios",
      label: "Usuarios",
      roles: ["admin"],
    },
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
      roles: [
        "admin",
        "mejora_continua",
        "rh",
        "gerente_rh",
        "aux_rh",
        "nominas",
        "contabilidad",
        "aux_legal",
        "gerente_legal",
        "relaciones_laborales",
        "gerente_operaciones",
        "editor_cuadricula",
        "capacitacion",
      ],
    },
    {
      href: "/ideas-que-transforman/panel",
      label: "Ideas que transforman",
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
      href: "/pruebas-efectividad-operativa",
      label: "Efectividad operativa",
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
    if (i.href === "/pruebas-efectividad-operativa") {
      return roleMayAccessPruebasEfectividad(role, userEmail);
    }
    if (i.href === "/sgc") return roleMayAccessSgc(role);
    if (i.href === "/usuarios") return roleMayAccessAdminUsuarios(role);
    return i.roles.includes(role);
  });
}
