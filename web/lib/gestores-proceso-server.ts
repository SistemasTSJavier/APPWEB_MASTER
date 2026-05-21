import { normalizeToCompleto } from "@/lib/colaboradores-normalize";
import type { ColaboradorCompleto } from "@/lib/colaboradores-types";
import { createSupabaseServiceRoleClient, isSupabaseServerConfigured } from "@/lib/supabase/admin";

export async function listColaboradoresGestoresServer(): Promise<{
  list: ColaboradorCompleto[];
  fuente: "supabase" | "sin_datos";
}> {
  if (!isSupabaseServerConfigured()) {
    return { list: [], fuente: "sin_datos" };
  }
  const admin = createSupabaseServiceRoleClient();
  if (!admin) return { list: [], fuente: "sin_datos" };

  const { data, error } = await admin.from("colaboradores").select("data");
  if (error) return { list: [], fuente: "sin_datos" };

  const list = (data ?? [])
    .map((r: { data: unknown }) => normalizeToCompleto(r.data))
    .filter((c): c is ColaboradorCompleto => c !== null);

  return { list, fuente: "supabase" };
}
