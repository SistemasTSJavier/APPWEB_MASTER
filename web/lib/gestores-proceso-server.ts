import type { ColaboradorCompleto } from "@/lib/colaboradores-types";
import { createSupabaseServiceRoleClient, isSupabaseServerConfigured } from "@/lib/supabase/admin";
import { fetchAllColaboradoresCompletos } from "@/lib/colaboradores-supabase-fetch-all";

const CACHE_TTL_MS = 3 * 60 * 1000;

let colaboradoresCache: {
  list: ColaboradorCompleto[];
  fuente: "supabase" | "sin_datos";
  at: number;
} | null = null;

/** Invalida caché en memoria (p. ej. tras import masivo). */
export function invalidateColaboradoresGestoresCache(): void {
  colaboradoresCache = null;
}

async function listColaboradoresGestoresServerUncached(): Promise<{
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

export async function listColaboradoresGestoresServer(options?: {
  forceRefresh?: boolean;
}): Promise<{
  list: ColaboradorCompleto[];
  fuente: "supabase" | "sin_datos";
}> {
  const force = options?.forceRefresh === true;
  const now = Date.now();
  if (
    !force &&
    colaboradoresCache &&
    now - colaboradoresCache.at < CACHE_TTL_MS
  ) {
    return { list: colaboradoresCache.list, fuente: colaboradoresCache.fuente };
  }

  const fresh = await listColaboradoresGestoresServerUncached();
  colaboradoresCache = { ...fresh, at: now };
  return fresh;
}
