import { parseAppRole, type AppRole } from "@/lib/app-role";
import {
  decodeRolSelectValue,
  encodeRolSelectValue,
  esSlugCatalogoValido,
  slugCatalogo,
  type CatalogoItem,
  type CatalogoTipo,
  type DepartamentoOpcion,
} from "@/lib/app-catalogos-shared";
import {
  createSupabaseServiceRoleClient,
  isSupabaseServerConfigured,
} from "@/lib/supabase/admin";
import { isSgcDepartamentoId, SGC_DEPARTAMENTOS, type SgcDepartamentoId } from "@/lib/sgc-calidad";

export type { CatalogoItem, CatalogoTipo, DepartamentoOpcion };
export {
  decodeRolSelectValue,
  encodeRolSelectValue,
  esSlugCatalogoValido,
  ROL_CATALOGO_PREFIX,
  slugCatalogo,
} from "@/lib/app-catalogos-shared";

/** Roles que pueden usarse como plantilla de un rol personalizado. */
const ROLES_BASE_CATALOGO: readonly AppRole[] = [
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
];

function db() {
  if (!isSupabaseServerConfigured()) return null;
  return createSupabaseServiceRoleClient();
}

function mapRow(row: Record<string, unknown>): CatalogoItem {
  const tipo = String(row.tipo ?? "") === "rol" ? "rol" : "departamento";
  const baseRaw = row.base_role == null || row.base_role === "" ? null : String(row.base_role);
  return {
    id: String(row.id ?? "").trim(),
    tipo,
    label: String(row.label ?? "").trim(),
    baseRole: baseRaw ? parseAppRole(baseRaw) : null,
    activo: row.activo !== false,
    createdAt: String(row.created_at ?? ""),
    esBuiltin: false,
  };
}

export async function listarCatalogo(tipo?: CatalogoTipo, soloActivos = true): Promise<CatalogoItem[]> {
  const client = db();
  if (!client) return [];
  let q = client.from("app_catalogos").select("*").order("label", { ascending: true });
  if (tipo) q = q.eq("tipo", tipo);
  if (soloActivos) q = q.eq("activo", true);
  const { data, error } = await q;
  if (error) throw new Error(error.message);
  return (data ?? []).map((r) => mapRow(r as Record<string, unknown>));
}

export async function obtenerCatalogoItem(id: string): Promise<CatalogoItem | null> {
  const client = db();
  if (!client) return null;
  const key = String(id ?? "").trim();
  if (!key) return null;
  const { data, error } = await client.from("app_catalogos").select("*").eq("id", key).maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) return null;
  return mapRow(data as Record<string, unknown>);
}

export async function listarDepartamentosOpciones(): Promise<DepartamentoOpcion[]> {
  const custom = await listarCatalogo("departamento", true);
  const seen = new Set<string>();
  const out: DepartamentoOpcion[] = [];
  for (const d of SGC_DEPARTAMENTOS) {
    seen.add(d.id);
    out.push({ id: d.id, label: d.label, esBuiltin: true });
  }
  for (const c of custom) {
    if (seen.has(c.id)) continue;
    seen.add(c.id);
    out.push({ id: c.id, label: c.label, esBuiltin: false });
  }
  return out;
}

export async function departamentoExiste(id: string): Promise<boolean> {
  const key = String(id ?? "").trim();
  if (!key) return false;
  if (isSgcDepartamentoId(key)) return true;
  if (!esSlugCatalogoValido(key)) return false;
  const item = await obtenerCatalogoItem(key);
  return Boolean(item && item.tipo === "departamento" && item.activo);
}

export async function etiquetaDepartamento(id: string): Promise<string> {
  const key = String(id ?? "").trim();
  if (!key) return "—";
  const builtin = SGC_DEPARTAMENTOS.find((d) => d.id === key);
  if (builtin) return builtin.label;
  const item = await obtenerCatalogoItem(key);
  if (item?.tipo === "departamento") return item.label;
  return key;
}

export type CrearCatalogoInput = {
  tipo: CatalogoTipo;
  label: string;
  /** Opcional; si vacío se deriva del label. */
  id?: string;
  /** Obligatorio si tipo=rol. */
  baseRole?: string;
};

export async function crearCatalogoItem(input: CrearCatalogoInput): Promise<CatalogoItem> {
  const client = db();
  if (!client) throw new Error("Supabase no configurado.");

  const tipo = input.tipo;
  const label = String(input.label ?? "").trim().slice(0, 80);
  if (label.length < 2) throw new Error("Indique un nombre (mínimo 2 caracteres).");

  let id = slugCatalogo(input.id?.trim() || label);
  if (!esSlugCatalogoValido(id)) {
    throw new Error("Identificador inválido. Use letras, números y guiones (ej. ventas).");
  }

  if (tipo === "departamento") {
    if (isSgcDepartamentoId(id)) {
      throw new Error("Ese departamento ya existe en el sistema.");
    }
  }

  let baseRole: string | null = null;
  if (tipo === "rol") {
    const role = parseAppRole(input.baseRole);
    if (!role || !(ROLES_BASE_CATALOGO as readonly string[]).includes(role)) {
      throw new Error("Seleccione un rol base válido para el nuevo rol.");
    }
    baseRole = role;
    if (parseAppRole(id) && (ROLES_BASE_CATALOGO as readonly string[]).includes(parseAppRole(id)!)) {
      id = `rol-${id}`;
    }
  }

  const existing = await obtenerCatalogoItem(id);
  if (existing) {
    if (existing.activo) throw new Error("Ya existe un elemento con ese identificador.");
    const { data, error } = await client
      .from("app_catalogos")
      .update({
        label,
        tipo,
        base_role: baseRole,
        activo: true,
      })
      .eq("id", id)
      .select("*")
      .single();
    if (error || !data) throw new Error(error?.message ?? "No se pudo reactivar el elemento.");
    return mapRow(data as Record<string, unknown>);
  }

  const { data, error } = await client
    .from("app_catalogos")
    .insert({
      id,
      tipo,
      label,
      base_role: baseRole,
      activo: true,
    })
    .select("*")
    .single();
  if (error || !data) throw new Error(error?.message ?? "No se pudo crear el elemento.");
  return mapRow(data as Record<string, unknown>);
}

export async function desactivarCatalogoItem(id: string): Promise<void> {
  const client = db();
  if (!client) throw new Error("Supabase no configurado.");
  const key = String(id ?? "").trim();
  if (!key) throw new Error("Id inválido.");
  const { error } = await client.from("app_catalogos").update({ activo: false }).eq("id", key);
  if (error) throw new Error(error.message);
}

/** Re-export tipo departamento para metadatos (builtin o catálogo). */
export type DepartamentoId = SgcDepartamentoId | string;
