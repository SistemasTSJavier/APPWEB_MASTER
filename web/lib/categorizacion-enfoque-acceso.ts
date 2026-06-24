import { randomBytes, randomUUID } from "crypto";
import type { SupabaseClient, User } from "@supabase/supabase-js";
import {
  colaboradorCalificableEnCategorizacion,
  colaboradorToCatPersonal,
  listCatPersonal,
  servicioVigenteColaboradorCategorizacion,
  upsertCatPersonalMany,
} from "@/lib/categorizacion-server";
import {
  normalizarServicioCategorizacion,
  serviciosCoincidenCat,
} from "@/lib/categorizacion-servicios-calificables";
import { fetchAllColaboradoresCompletos } from "@/lib/colaboradores-supabase-fetch-all";
import {
  createSupabaseServiceRoleClient,
  isSupabaseServerConfigured,
} from "@/lib/supabase/admin";

export type CatEnfoqueAccesoCliente = {
  id: string;
  servicio: string;
  email: string;
  userId: string | null;
  fechaInicio: string;
  fechaFin: string;
  activo: boolean;
  creadoPor: string;
  nota: string;
  createdAt: string;
  updatedAt: string;
  vigente: boolean;
};

export type CatEnfoqueAccesoCreado = CatEnfoqueAccesoCliente & {
  passwordPlano: string;
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

/** Acceso leído desde user_metadata (no depende de PostgREST ni tabla SQL). */
export function accesoDesdeAuthUser(user: Pick<User, "id" | "email" | "user_metadata" | "updated_at">): CatEnfoqueAccesoCliente | null {
  const meta = (user.user_metadata ?? {}) as Record<string, unknown>;
  const servicio = normalizarServicioCategorizacion(metaString(meta, "cat_enfoque_servicio"));
  if (!servicio) return null;

  const fechaInicio = metaString(meta, "cat_enfoque_fecha_inicio").slice(0, 10);
  const fechaFin = metaString(meta, "cat_enfoque_fecha_fin").slice(0, 10);
  const hoy = fechaYmdHoy();
  const role = metaString(meta, "app_role").toLowerCase();
  const activo = role === "cliente_enfoque" && meta.cat_enfoque_activo !== false;
  const vigente = activo && Boolean(fechaInicio && fechaFin) && fechaInicio <= hoy && hoy <= fechaFin;

  return {
    id: metaString(meta, "cat_enfoque_acceso_id") || user.id,
    servicio,
    email: String(user.email ?? metaString(meta, "cat_enfoque_email")).toLowerCase(),
    userId: user.id || null,
    fechaInicio,
    fechaFin,
    activo,
    creadoPor: metaString(meta, "cat_enfoque_creado_por"),
    nota: metaString(meta, "cat_enfoque_nota"),
    createdAt: metaString(meta, "cat_enfoque_created_at") || String(user.updated_at ?? ""),
    updatedAt: String(user.updated_at ?? metaString(meta, "cat_enfoque_updated_at")),
    vigente,
  };
}

export function fechaYmdHoy(): string {
  return new Date().toISOString().slice(0, 10);
}

export function accesoEnfoqueClienteVigente(a: Pick<CatEnfoqueAccesoCliente, "activo" | "fechaInicio" | "fechaFin">): boolean {
  const hoy = fechaYmdHoy();
  return a.activo && Boolean(a.fechaInicio && a.fechaFin) && a.fechaInicio <= hoy && hoy <= a.fechaFin;
}

function slugServicioEmail(servicio: string): string {
  const s = normalizarServicioCategorizacion(servicio)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 24);
  return s || "servicio";
}

function generarPasswordTemporal(): string {
  return randomBytes(9).toString("base64url").slice(0, 12);
}

function generarEmailAcceso(servicio: string): string {
  const token = randomBytes(4).toString("hex");
  return `enfoque.${slugServicioEmail(servicio)}.${token}@acceso.tacticalsupport.mx`;
}

async function listAllAuthUsers(client: SupabaseClient): Promise<User[]> {
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
  return users;
}

async function findAuthUserPorAccesoId(client: SupabaseClient, accesoId: string): Promise<User | null> {
  const id = accesoId.trim();
  if (!id) return null;
  const { data, error } = await client.auth.admin.getUserById(id);
  if (!error && data.user) {
    const acceso = accesoDesdeAuthUser(data.user);
    if (acceso && (acceso.id === id || data.user.id === id)) return data.user;
  }
  const users = await listAllAuthUsers(client);
  return (
    users.find((u) => {
      const acceso = accesoDesdeAuthUser(u);
      return acceso?.id === id || u.id === id;
    }) ?? null
  );
}

export async function listCatEnfoqueAccesosCliente(
  admin?: SupabaseClient | null,
): Promise<CatEnfoqueAccesoCliente[]> {
  const client = admin ?? db();
  if (!client) return [];
  const users = await listAllAuthUsers(client);
  return users
    .map((u) => accesoDesdeAuthUser(u))
    .filter((a): a is CatEnfoqueAccesoCliente => a !== null)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function getCatEnfoqueAccesoPorUserId(
  userId: string,
  admin?: SupabaseClient | null,
): Promise<CatEnfoqueAccesoCliente | null> {
  const client = admin ?? db();
  if (!client || !userId.trim()) return null;
  const { data, error } = await client.auth.admin.getUserById(userId.trim());
  if (error || !data.user) return null;
  return accesoDesdeAuthUser(data.user);
}

export async function getCatEnfoqueAccesoPorEmail(
  email: string,
  admin?: SupabaseClient | null,
): Promise<CatEnfoqueAccesoCliente | null> {
  const client = admin ?? db();
  if (!client) return null;
  const needle = email.trim().toLowerCase();
  if (!needle) return null;
  const users = await listAllAuthUsers(client);
  const user = users.find((u) => (u.email ?? "").trim().toLowerCase() === needle) ?? null;
  return user ? accesoDesdeAuthUser(user) : null;
}

export async function crearCatEnfoqueAccesoCliente(input: {
  servicio: string;
  fechaInicio: string;
  fechaFin: string;
  nota?: string;
  creadoPor: string;
  email?: string;
  password?: string;
  admin?: SupabaseClient | null;
}): Promise<CatEnfoqueAccesoCreado> {
  const client = input.admin ?? db();
  if (!client) throw new Error("Supabase no configurado");

  const servicio = normalizarServicioCategorizacion(input.servicio);
  if (!servicio) throw new Error("Indique el servicio.");
  const fechaInicio = input.fechaInicio.trim().slice(0, 10);
  const fechaFin = input.fechaFin.trim().slice(0, 10);
  if (!fechaInicio || !fechaFin) throw new Error("Indique fecha de inicio y fin.");
  if (fechaFin < fechaInicio) throw new Error("La fecha fin debe ser posterior o igual a la de inicio.");

  const email = (input.email?.trim() || generarEmailAcceso(servicio)).toLowerCase();
  const password = input.password?.trim() || generarPasswordTemporal();
  const accesoId = randomUUID();
  const now = new Date().toISOString();
  const creadoPor = input.creadoPor.trim();
  const nota = String(input.nota ?? "").trim();

  const { data: authUser, error: authErr } = await client.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: {
      app_role: "cliente_enfoque",
      cat_enfoque_acceso_id: accesoId,
      cat_enfoque_servicio: servicio,
      cat_enfoque_fecha_inicio: fechaInicio,
      cat_enfoque_fecha_fin: fechaFin,
      cat_enfoque_activo: true,
      cat_enfoque_creado_por: creadoPor,
      cat_enfoque_nota: nota,
      cat_enfoque_email: email,
      cat_enfoque_created_at: now,
      cat_enfoque_updated_at: now,
    },
  });
  if (authErr) throw new Error(authErr.message);
  if (!authUser.user) throw new Error("Usuario creado sin datos de respuesta.");

  const userId = authUser.user.id;
  const acceso = accesoDesdeAuthUser(authUser.user);
  if (!acceso) throw new Error("No se pudo registrar el acceso en el usuario.");

  await syncCatPersonalActivosPorServicio(servicio, client);

  return { ...acceso, passwordPlano: password };
}

export async function revocarCatEnfoqueAccesoCliente(
  id: string,
  admin?: SupabaseClient | null,
): Promise<void> {
  const client = admin ?? db();
  if (!client) throw new Error("Supabase no configurado");

  const user = await findAuthUserPorAccesoId(client, id);
  if (!user?.id) throw new Error("Acceso no encontrado.");

  const meta = { ...(user.user_metadata ?? {}) } as Record<string, unknown>;
  const now = new Date().toISOString();
  const { error } = await client.auth.admin.updateUserById(user.id, {
    user_metadata: {
      ...meta,
      app_role: "revocado",
      cat_enfoque_activo: false,
      cat_enfoque_updated_at: now,
    },
  });
  if (error) throw new Error(error.message);
}

/** Sincroniza cat_personal solo con colaboradores activos y calificables del servicio. */
export async function syncCatPersonalActivosPorServicio(
  servicio: string,
  admin?: SupabaseClient | null,
): Promise<{ sincronizados: number }> {
  const client = admin ?? db();
  if (!client) throw new Error("Supabase no configurado");
  const srv = normalizarServicioCategorizacion(servicio);
  if (!srv) return { sincronizados: 0 };

  const [colaboradores, existing] = await Promise.all([
    fetchAllColaboradoresCompletos(client),
    listCatPersonal(client),
  ]);
  const existingByNo = new Map(existing.map((p) => [p.noEmpleado, p]));
  const activos = colaboradores.filter((c) => {
    if (!colaboradorCalificableEnCategorizacion(c)) return false;
    return serviciosCoincidenCat(servicioVigenteColaboradorCategorizacion(c), srv);
  });

  const rows = activos.map((c) => {
    const no = c.noEmpleado.trim().toUpperCase();
    const prev = existingByNo.get(no);
    return colaboradorToCatPersonal(c, prev?.periodoEvaluacion ?? "");
  });
  await upsertCatPersonalMany(rows, client);
  return { sincronizados: rows.length };
}

export function colaboradorPerteneceServicioEnfoque(servicioColaborador: string, servicioAcceso: string): boolean {
  return serviciosCoincidenCat(servicioColaborador, servicioAcceso);
}
