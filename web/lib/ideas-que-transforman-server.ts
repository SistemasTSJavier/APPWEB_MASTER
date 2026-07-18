import { createSupabaseServiceRoleClient, isSupabaseServerConfigured } from "@/lib/supabase/admin";
import {
  mapIdeaRow,
  type IdeaCreateInput,
  type IdeaEstado,
  type IdeaQueTransforma,
} from "@/lib/ideas-que-transforman";

function adminClient() {
  if (!isSupabaseServerConfigured()) return null;
  return createSupabaseServiceRoleClient();
}

export async function insertarIdea(data: IdeaCreateInput): Promise<
  { ok: true; row: IdeaQueTransforma } | { ok: false; error: string }
> {
  const admin = adminClient();
  if (!admin) return { ok: false, error: "Servidor sin configuración de base de datos." };

  const { data: row, error } = await admin
    .from("ideas_que_transforman")
    .insert({
      nombre: data.nombre,
      departamento_autor: data.departamentoAutor,
      problema: data.problema,
      solucion: data.solucion,
      beneficio: data.beneficio,
      departamento_afectado: data.departamentoAfectado,
      estado: "pendiente",
    })
    .select("*")
    .single();

  if (error || !row) {
    return { ok: false, error: error?.message ?? "No se pudo guardar la idea." };
  }
  return { ok: true, row: mapIdeaRow(row as Record<string, unknown>) };
}

export async function listarIdeas(estado?: IdeaEstado): Promise<
  { ok: true; rows: IdeaQueTransforma[] } | { ok: false; error: string }
> {
  const admin = adminClient();
  if (!admin) return { ok: false, error: "Servidor sin configuración de base de datos." };

  let q = admin.from("ideas_que_transforman").select("*").order("created_at", { ascending: false });
  if (estado) q = q.eq("estado", estado);

  const { data, error } = await q;
  if (error) return { ok: false, error: error.message };
  return {
    ok: true,
    rows: (data ?? []).map((r) => mapIdeaRow(r as Record<string, unknown>)),
  };
}

export async function aceptarIdea(
  id: string,
  email: string,
): Promise<{ ok: true; row: IdeaQueTransforma } | { ok: false; error: string; status?: number }> {
  const admin = adminClient();
  if (!admin) return { ok: false, error: "Servidor sin configuración de base de datos." };

  const ideaId = String(id ?? "").trim();
  if (!ideaId) return { ok: false, error: "Id inválido.", status: 400 };

  const { data: row, error } = await admin
    .from("ideas_que_transforman")
    .update({
      estado: "aceptado",
      aceptado_at: new Date().toISOString(),
      aceptado_por_email: (email ?? "").trim().slice(0, 200),
    })
    .eq("id", ideaId)
    .eq("estado", "pendiente")
    .select("*")
    .maybeSingle();

  if (error) return { ok: false, error: error.message };
  if (!row) return { ok: false, error: "Idea no encontrada o ya aceptada.", status: 404 };
  return { ok: true, row: mapIdeaRow(row as Record<string, unknown>) };
}
