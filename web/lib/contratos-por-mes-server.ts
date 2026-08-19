import type { ColaboradorCompleto } from "@/lib/colaboradores-types";
import { createSupabaseServiceRoleClient, isSupabaseServerConfigured } from "@/lib/supabase/admin";
import { fetchAllColaboradoresCompletos } from "@/lib/colaboradores-supabase-fetch-all";

const CACHE_TTL_MS = 3 * 60 * 1000;

let colaboradoresCache: {
  list: ColaboradorCompleto[];
  fuente: "supabase" | "sin_datos";
  at: number;
} | null = null;

export function invalidateContratosPorMesCache(): void {
  colaboradoresCache = null;
}

async function listColaboradoresContratosPorMesUncached(): Promise<{
  list: ColaboradorCompleto[];
  fuente: "supabase" | "sin_datos";
}> {
  if (!isSupabaseServerConfigured()) {
    return { list: [], fuente: "sin_datos" };
  }
  const admin = createSupabaseServiceRoleClient();
  if (!admin) return { list: [], fuente: "sin_datos" };

  try {
    const list = await fetchAllColaboradoresCompletos(admin);
    return { list, fuente: "supabase" };
  } catch {
    return { list: [], fuente: "sin_datos" };
  }
}

export async function listColaboradoresContratosPorMesServer(options?: {
  forceRefresh?: boolean;
}): Promise<{
  list: ColaboradorCompleto[];
  fuente: "supabase" | "sin_datos";
}> {
  const force = options?.forceRefresh === true;
  const now = Date.now();
  if (!force && colaboradoresCache && now - colaboradoresCache.at < CACHE_TTL_MS) {
    return { list: colaboradoresCache.list, fuente: colaboradoresCache.fuente };
  }

  const fresh = await listColaboradoresContratosPorMesUncached();
  colaboradoresCache = { ...fresh, at: now };
  return fresh;
}
