import type { ColaboradorCompleto } from "@/lib/colaboradores-types";
import { createSupabaseServiceRoleClient, isSupabaseServerConfigured } from "@/lib/supabase/admin";
import { fetchAllColaboradoresCompletos } from "@/lib/colaboradores-supabase-fetch-all";

export async function listColaboradoresGestoresServer(): Promise<{
  list: ColaboradorCompleto[];
  fuente: "supabase" | "sin_datos";
}> {
  if (!isSupabaseServerConfigured()) {
    return { list: [], fuente: "sin_datos" };
  }
  const admin = createSupabaseServiceRoleClient();
  if (!admin) return { list: [], fuente: "sin_datos" };

  let list: ColaboradorCompleto[] = [];
  try {
    list = await fetchAllColaboradoresCompletos(admin);
  } catch {
    return { list: [], fuente: "sin_datos" };
  }

  return { list, fuente: "supabase" };
}
