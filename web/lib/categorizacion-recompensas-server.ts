import {
  esCatRecompensaTipo,
  normalizarMesYm,
  type CatRecompensaRow,
  type CatRecompensaTipo,
} from "@/lib/categorizacion-recompensas";
import { createSupabaseServiceRoleClient, isSupabaseServerConfigured } from "@/lib/supabase/admin";
import type { SupabaseClient } from "@supabase/supabase-js";

function db(admin?: SupabaseClient | null): SupabaseClient | null {
  if (admin) return admin;
  if (!isSupabaseServerConfigured()) return null;
  return createSupabaseServiceRoleClient();
}

function normalizarNo(no: string): string {
  return String(no ?? "").trim().toUpperCase();
}

function mapRow(r: Record<string, unknown>): CatRecompensaRow {
  return {
    id: String(r.id),
    noEmpleado: normalizarNo(String(r.no_empleado ?? "")),
    tipo: (String(r.tipo) as CatRecompensaTipo) || "bono",
    descripcion: String(r.descripcion ?? "").trim(),
    mes: String(r.mes ?? "").trim(),
    createdAt: String(r.created_at ?? ""),
    updatedAt: String(r.updated_at ?? ""),
  };
}

export async function listCatRecompensas(
  opts?: { noEmpleado?: string },
  admin?: SupabaseClient | null,
): Promise<CatRecompensaRow[]> {
  const client = db(admin);
  if (!client) return [];
  let q = client.from("cat_recompensa").select("*").order("mes", { ascending: false }).order("created_at", { ascending: false });
  const no = opts?.noEmpleado ? normalizarNo(opts.noEmpleado) : "";
  if (no) q = q.eq("no_empleado", no);
  const { data, error } = await q;
  if (error) throw new Error(error.message);
  return (data ?? []).map((r) => mapRow(r as Record<string, unknown>));
}

export async function listCatRecompensasPorEmpleados(
  nos: string[],
  admin?: SupabaseClient | null,
): Promise<Map<string, CatRecompensaRow[]>> {
  const out = new Map<string, CatRecompensaRow[]>();
  const client = db(admin);
  if (!client || nos.length === 0) return out;
  const keys = [...new Set(nos.map(normalizarNo).filter(Boolean))];
  const { data, error } = await client
    .from("cat_recompensa")
    .select("*")
    .in("no_empleado", keys)
    .order("mes", { ascending: false })
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  for (const raw of data ?? []) {
    const row = mapRow(raw as Record<string, unknown>);
    const list = out.get(row.noEmpleado) ?? [];
    list.push(row);
    out.set(row.noEmpleado, list);
  }
  return out;
}

export async function upsertCatRecompensa(
  input: {
    id?: string;
    noEmpleado: string;
    tipo: string;
    descripcion?: string;
    mes: string;
  },
  admin?: SupabaseClient | null,
): Promise<CatRecompensaRow> {
  const client = db(admin);
  if (!client) throw new Error("Supabase no configurado");
  const noEmpleado = normalizarNo(input.noEmpleado);
  if (!noEmpleado) throw new Error("Indique N° de empleado.");
  if (!esCatRecompensaTipo(input.tipo)) throw new Error("Tipo de recompensa inválido.");
  const mes = normalizarMesYm(input.mes);
  if (!mes) throw new Error("Mes inválido (use AAAA-MM).");
  const descripcion = String(input.descripcion ?? "").trim();
  if ((input.tipo === "bono" || input.tipo === "reconocimiento") && !descripcion) {
    throw new Error(input.tipo === "bono" ? "Indique de qué es el bono." : "Indique de qué es el reconocimiento.");
  }

  const now = new Date().toISOString();
  const id = String(input.id ?? "").trim();
  if (id) {
    const { data, error } = await client
      .from("cat_recompensa")
      .update({
        no_empleado: noEmpleado,
        tipo: input.tipo,
        descripcion,
        mes,
        updated_at: now,
      })
      .eq("id", id)
      .select("*")
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!data) throw new Error("Registro no encontrado.");
    return mapRow(data as Record<string, unknown>);
  }

  const { data, error } = await client
    .from("cat_recompensa")
    .insert({
      no_empleado: noEmpleado,
      tipo: input.tipo,
      descripcion,
      mes,
      created_at: now,
      updated_at: now,
    })
    .select("*")
    .single();
  if (error) throw new Error(error.message);
  return mapRow(data as Record<string, unknown>);
}

export async function deleteCatRecompensa(id: string, admin?: SupabaseClient | null): Promise<void> {
  const client = db(admin);
  if (!client) throw new Error("Supabase no configurado");
  const key = String(id ?? "").trim();
  if (!key) throw new Error("Id requerido.");
  const { error } = await client.from("cat_recompensa").delete().eq("id", key);
  if (error) throw new Error(error.message);
}
