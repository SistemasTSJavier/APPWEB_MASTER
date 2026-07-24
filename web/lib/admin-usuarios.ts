import type { User } from "@supabase/supabase-js";
import {
  decodeRolSelectValue,
  departamentoExiste,
  encodeRolSelectValue,
  esSlugCatalogoValido,
  etiquetaDepartamento,
  obtenerCatalogoItem,
} from "@/lib/app-catalogos";
import {
  APP_MODULOS_HABILITABLES,
  APP_ROLE_LABEL,
  homeSidebarLinks,
  parseAppRole,
  parseModulosCapacidades,
  parseModulosHabilitados,
  roleMayDeleteSgc,
  roleMayEditColaboradores,
  roleMayEditCuadricula,
  roleMayEditDs3,
  roleMayEditServiciosCatalogo,
  roleMayUploadSgc,
  roleMayWriteAltas,
  roleMayWriteBajas,
  roleMayWriteExpedienteColaborador,
  roleMayWriteMoperHistorial,
  routeSection,
  type AppModuloId,
  type AppRole,
  type ModuloCapacidad,
} from "@/lib/app-role";
import { isSgcDepartamentoId, SGC_DEPARTAMENTOS } from "@/lib/sgc-calidad";
import {
  createSupabaseServiceRoleClient,
  isSupabaseServerConfigured,
} from "@/lib/supabase/admin";

/** Roles asignables desde el panel de usuarios (sin accesos temporales de cliente). */
export const ADMIN_USUARIO_ROLES: readonly AppRole[] = [
  "admin",
  "rh",
  "gerente_rh",
  "aux_rh",
  "mejora_continua",
  "nominas",
  "contabilidad",
  "aux_legal",
  "gerente_legal",
  "editor_cuadricula",
  "capacitacion",
  "relaciones_laborales",
  "gerente_operaciones",
] as const;

export type AdminUsuario = {
  id: string;
  email: string;
  nombre: string;
  departamento: string;
  departamentoLabel: string;
  appRole: AppRole | null;
  appRoleLabel: string;
  /** Id de rol del catálogo (si aplica). */
  rolCustomId: string | null;
  /** Valor para el select (builtin o catalogo:id). */
  rolSelectValue: string;
  modulos: AppModuloId[];
  capacidades: ModuloCapacidad[];
  createdAt: string;
  lastSignInAt: string | null;
  esClienteEnfoque: boolean;
};

export type AdminUsuarioCreateInput = {
  email: string;
  password: string;
  nombre: string;
  departamento: string;
  appRole: string;
  modulos?: unknown;
  capacidades?: unknown;
};

export type AdminUsuarioUpdateInput = {
  nombre?: string;
  departamento?: string;
  appRole?: string;
  password?: string;
  modulos?: unknown;
  capacidades?: unknown;
};

function db() {
  if (!isSupabaseServerConfigured()) return null;
  return createSupabaseServiceRoleClient();
}

function metaString(meta: Record<string, unknown>, key: string): string {
  const v = meta[key];
  if (v == null || v === "") return "";
  return String(v).trim();
}

export function nombreDesdeMetadata(meta: Record<string, unknown>): string {
  return (
    metaString(meta, "nombre") ||
    metaString(meta, "full_name") ||
    metaString(meta, "name") ||
    ""
  );
}

export function departamentoDesdeMetadata(meta: Record<string, unknown>): string {
  const raw = metaString(meta, "departamento");
  if (!raw) return "";
  if (isSgcDepartamentoId(raw) || esSlugCatalogoValido(raw)) return raw;
  return "";
}

export function rolCustomIdDesdeMetadata(meta: Record<string, unknown>): string | null {
  const id = metaString(meta, "rol_custom_id");
  return id || null;
}

/** Capacidades sugeridas según el rol (menú + editar/eliminar donde el rol ya escribe). */
export function capacidadesSugeridasParaRol(role: AppRole): ModuloCapacidad[] {
  if (role === "admin") {
    return APP_MODULOS_HABILITABLES.map((m) => ({
      modulo: m.id,
      ver: true,
      editar: true,
      eliminar: true,
    }));
  }
  const links = homeSidebarLinks(role);
  const mods = parseModulosHabilitados(links.map((l) => routeSection(l.href)));
  return mods.map((modulo) => {
    let editar = false;
    let eliminar = false;
    switch (modulo) {
      case "/colaboradores":
        editar = roleMayEditColaboradores(role) || roleMayWriteExpedienteColaborador(role);
        break;
      case "/altas":
        editar = roleMayWriteAltas(role);
        break;
      case "/bajas":
        editar = roleMayWriteBajas(role);
        break;
      case "/servicios":
        editar = roleMayEditServiciosCatalogo(role);
        break;
      case "/cuadricula":
        editar = roleMayEditCuadricula(role);
        break;
      case "/moper":
        editar = roleMayWriteMoperHistorial(role);
        break;
      case "/ds3":
        editar = roleMayEditDs3(role);
        break;
      case "/sgc":
        editar = roleMayUploadSgc(role);
        eliminar = roleMayDeleteSgc(role);
        break;
      default:
        break;
    }
    return { modulo, ver: true, editar, eliminar };
  });
}

export function modulosSugeridosParaRol(role: AppRole): AppModuloId[] {
  return capacidadesSugeridasParaRol(role).map((c) => c.modulo);
}

function capacidadesDesdeUsuarioMeta(meta: Record<string, unknown>): ModuloCapacidad[] {
  const caps = parseModulosCapacidades(meta.modulos_capacidades);
  if (caps.length > 0) return caps;
  const mods = parseModulosHabilitados(meta.modulos_habilitados);
  return mods.map((modulo) => ({ modulo, ver: true, editar: false, eliminar: false }));
}

export function mapAuthUserToAdminUsuario(user: User): AdminUsuario {
  const meta = (user.user_metadata ?? {}) as Record<string, unknown>;
  const role = parseAppRole(meta.app_role ?? user.app_metadata?.app_role);
  const departamento = departamentoDesdeMetadata(meta);
  const rolCustomId = rolCustomIdDesdeMetadata(meta);
  const rolCustomLabel = metaString(meta, "rol_custom_label");
  const depLabelMeta = metaString(meta, "departamento_label");
  const esClienteEnfoque = role === "cliente_enfoque" || Boolean(metaString(meta, "cat_enfoque_servicio"));
  const capacidades = capacidadesDesdeUsuarioMeta(meta);
  const modulos = capacidades.filter((c) => c.ver || c.editar || c.eliminar).map((c) => c.modulo);

  return {
    id: user.id,
    email: String(user.email ?? "").trim().toLowerCase(),
    nombre: nombreDesdeMetadata(meta),
    departamento,
    departamentoLabel: departamento
      ? depLabelMeta ||
        SGC_DEPARTAMENTOS.find((d) => d.id === departamento)?.label ||
        departamento
      : "—",
    appRole: role,
    appRoleLabel: rolCustomLabel || (role ? APP_ROLE_LABEL[role] : "Sin rol"),
    rolCustomId,
    rolSelectValue: encodeRolSelectValue({
      appRole: role ?? "rh",
      rolCustomId,
    }),
    modulos,
    capacidades,
    createdAt: String(user.created_at ?? ""),
    lastSignInAt: user.last_sign_in_at ? String(user.last_sign_in_at) : null,
    esClienteEnfoque,
  };
}

async function listAllAuthUsers() {
  const client = db();
  if (!client) throw new Error("Supabase no configurado.");
  const users: User[] = [];
  let page = 1;
  const perPage = 200;
  while (true) {
    const { data, error } = await client.auth.admin.listUsers({ page, perPage });
    if (error) throw new Error(error.message);
    const batch = data.users ?? [];
    users.push(...batch);
    if (batch.length < perPage) break;
    page += 1;
    if (page > 50) break;
  }
  return { client, users };
}

export async function listarAdminUsuarios(): Promise<AdminUsuario[]> {
  const { users } = await listAllAuthUsers();
  const rows = users.map(mapAuthUserToAdminUsuario);
  // Enriquecer etiquetas de departamentos del catálogo si no vienen en metadata.
  await Promise.all(
    rows.map(async (u) => {
      if (!u.departamento || u.departamentoLabel !== u.departamento) return;
      u.departamentoLabel = await etiquetaDepartamento(u.departamento);
    }),
  );
  return rows.sort((a, b) => (a.nombre || a.email).localeCompare(b.nombre || b.email, "es"));
}

function validarEmail(email: string): string | null {
  const e = email.trim().toLowerCase();
  if (!e || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)) return null;
  return e;
}

function validarPassword(password: string): string | null {
  const p = password.trim();
  if (p.length < 8) return null;
  return p;
}

function validarNombre(nombre: string): string {
  return String(nombre ?? "").trim().slice(0, 120);
}

async function validarDepartamento(
  raw: string,
): Promise<{ id: string; label: string | null }> {
  const d = String(raw ?? "").trim();
  if (!d) return { id: "", label: null };
  if (!(await departamentoExiste(d))) {
    throw new Error("Departamento no válido. Agréguelo en el catálogo primero.");
  }
  const label = await etiquetaDepartamento(d);
  return { id: d, label };
}

async function resolverRolAsignacion(raw: string): Promise<{
  appRole: AppRole;
  rolCustomId: string | null;
  rolCustomLabel: string | null;
}> {
  const decoded = decodeRolSelectValue(raw);
  if (decoded.kind === "catalogo" && decoded.catalogoId) {
    const item = await obtenerCatalogoItem(decoded.catalogoId);
    if (!item || item.tipo !== "rol" || !item.activo || !item.baseRole) {
      throw new Error("Rol del catálogo no válido o inactivo.");
    }
    if (!(ADMIN_USUARIO_ROLES as readonly string[]).includes(item.baseRole)) {
      throw new Error("El rol base del catálogo no es válido.");
    }
    return {
      appRole: item.baseRole,
      rolCustomId: item.id,
      rolCustomLabel: item.label,
    };
  }
  const role = parseAppRole(decoded.appRole ?? raw);
  if (!role || !(ADMIN_USUARIO_ROLES as readonly string[]).includes(role)) {
    throw new Error("Rol no válido.");
  }
  return { appRole: role, rolCustomId: null, rolCustomLabel: null };
}

function validarCapacidades(raw: unknown, role: AppRole): ModuloCapacidad[] {
  if (role === "admin") return capacidadesSugeridasParaRol("admin");
  let caps = parseModulosCapacidades(raw);
  if (caps.length === 0 && Array.isArray(raw)) {
    // Compat: array de ids → solo ver
    const mods = parseModulosHabilitados(raw);
    caps = mods.map((modulo) => ({ modulo, ver: true, editar: false, eliminar: false }));
  }
  caps = caps.filter((c) => c.ver || c.editar || c.eliminar);
  if (caps.length === 0) {
    throw new Error("Habilite al menos un módulo con permiso Ver, Editar o Eliminar.");
  }
  return caps.map((c) => ({
    ...c,
    ver: c.ver || c.editar || c.eliminar,
  }));
}

function metaDesdeCapacidades(caps: ModuloCapacidad[]) {
  return {
    modulos_capacidades: caps,
    modulos_habilitados: caps.filter((c) => c.ver || c.editar || c.eliminar).map((c) => c.modulo),
  };
}

export async function crearAdminUsuario(input: AdminUsuarioCreateInput): Promise<AdminUsuario> {
  const client = db();
  if (!client) throw new Error("Supabase no configurado.");

  const email = validarEmail(input.email);
  if (!email) throw new Error("Correo no válido.");
  const password = validarPassword(input.password);
  if (!password) throw new Error("La contraseña debe tener al menos 8 caracteres.");
  const nombre = validarNombre(input.nombre);
  if (nombre.length < 2) throw new Error("Indique el nombre (mínimo 2 caracteres).");
  const departamento = await validarDepartamento(input.departamento);
  const rol = await resolverRolAsignacion(input.appRole);
  const capacidades = validarCapacidades(
    input.capacidades ?? input.modulos ?? capacidadesSugeridasParaRol(rol.appRole),
    rol.appRole,
  );

  const { data, error } = await client.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: {
      app_role: rol.appRole,
      nombre,
      departamento: departamento.id || null,
      departamento_label: departamento.id ? departamento.label : null,
      rol_custom_id: rol.rolCustomId,
      rol_custom_label: rol.rolCustomLabel,
      ...metaDesdeCapacidades(capacidades),
    },
  });
  if (error || !data.user) throw new Error(error?.message ?? "No se pudo crear el usuario.");
  return mapAuthUserToAdminUsuario(data.user);
}

export async function actualizarAdminUsuario(
  id: string,
  input: AdminUsuarioUpdateInput,
): Promise<AdminUsuario> {
  const client = db();
  if (!client) throw new Error("Supabase no configurado.");

  const userId = String(id ?? "").trim();
  if (!userId) throw new Error("Id inválido.");

  const { data: current, error: getErr } = await client.auth.admin.getUserById(userId);
  if (getErr || !current.user) throw new Error(getErr?.message ?? "Usuario no encontrado.");

  const prevMeta = { ...((current.user.user_metadata ?? {}) as Record<string, unknown>) };
  const nextMeta: Record<string, unknown> = { ...prevMeta };

  if (input.nombre !== undefined) {
    const nombre = validarNombre(input.nombre);
    if (nombre.length < 2) throw new Error("Indique el nombre (mínimo 2 caracteres).");
    nextMeta.nombre = nombre;
  }
  if (input.departamento !== undefined) {
    const departamento = await validarDepartamento(input.departamento);
    nextMeta.departamento = departamento.id || null;
    nextMeta.departamento_label = departamento.id ? departamento.label : null;
  }

  let roleForCaps =
    parseAppRole(nextMeta.app_role) ??
    parseAppRole(current.user.user_metadata?.app_role) ??
    ("rh" as AppRole);

  if (input.appRole !== undefined) {
    const rol = await resolverRolAsignacion(input.appRole);
    roleForCaps = rol.appRole;
    nextMeta.app_role = rol.appRole;
    nextMeta.rol_custom_id = rol.rolCustomId;
    nextMeta.rol_custom_label = rol.rolCustomLabel;
  }

  if (input.capacidades !== undefined || input.modulos !== undefined) {
    const caps = validarCapacidades(input.capacidades ?? input.modulos, roleForCaps);
    Object.assign(nextMeta, metaDesdeCapacidades(caps));
  } else if (input.appRole !== undefined && !Array.isArray(prevMeta.modulos_capacidades)) {
    Object.assign(nextMeta, metaDesdeCapacidades(capacidadesSugeridasParaRol(roleForCaps)));
  }

  const patch: {
    user_metadata: Record<string, unknown>;
    password?: string;
  } = { user_metadata: nextMeta };

  if (input.password !== undefined && String(input.password).trim() !== "") {
    const password = validarPassword(String(input.password));
    if (!password) throw new Error("La contraseña debe tener al menos 8 caracteres.");
    patch.password = password;
  }

  const { data, error } = await client.auth.admin.updateUserById(userId, patch);
  if (error || !data.user) throw new Error(error?.message ?? "No se pudo actualizar el usuario.");
  return mapAuthUserToAdminUsuario(data.user);
}

export async function eliminarAdminUsuario(id: string, actorUserId: string): Promise<void> {
  const client = db();
  if (!client) throw new Error("Supabase no configurado.");

  const userId = String(id ?? "").trim();
  if (!userId) throw new Error("Id inválido.");
  if (userId === actorUserId) throw new Error("No puede eliminar su propia cuenta.");

  const { error } = await client.auth.admin.deleteUser(userId);
  if (error) throw new Error(error.message);
}
