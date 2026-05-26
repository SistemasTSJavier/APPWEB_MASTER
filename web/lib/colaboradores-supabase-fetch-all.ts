import { normalizeToCompleto } from "@/lib/colaboradores-normalize";
import type { ColaboradorCompleto } from "@/lib/colaboradores-types";
import { hintSupabaseClientError } from "@/lib/supabase/admin";
import type { SupabaseClient } from "@supabase/supabase-js";

/** PostgREST/Supabase devuelve como maximo ~1000 filas por peticion sin paginar. */
export const COLABORADORES_SUPABASE_PAGE_SIZE = 1000;

export type ColaboradorDbRow = { no_empleado: string; data: unknown };

/**
 * Lee todos los expedientes paginando (evita truncar listados >1000).
 */
export async function fetchAllColaboradoresDbRows(admin: SupabaseClient): Promise<ColaboradorDbRow[]> {
  const out: ColaboradorDbRow[] = [];
  let from = 0;

  while (true) {
    const { data, error } = await admin
      .from("colaboradores")
      .select("no_empleado, data")
      .order("no_empleado", { ascending: true })
      .range(from, from + COLABORADORES_SUPABASE_PAGE_SIZE - 1);

    if (error) throw new Error(hintSupabaseClientError(error.message));

    const page = (data ?? []) as ColaboradorDbRow[];
    if (page.length === 0) break;

    out.push(...page);
    if (page.length < COLABORADORES_SUPABASE_PAGE_SIZE) break;
    from += COLABORADORES_SUPABASE_PAGE_SIZE;
  }

  return out;
}

/** Solo columna `data` (compatibilidad con rutas que no usan no_empleado). */
export async function fetchAllColaboradoresData(admin: SupabaseClient): Promise<unknown[]> {
  const rows = await fetchAllColaboradoresDbRows(admin);
  return rows.map((r) => r.data);
}

export async function fetchAllColaboradoresCompletos(admin: SupabaseClient): Promise<ColaboradorCompleto[]> {
  const rows = await fetchAllColaboradoresDbRows(admin);
  return rows
    .map((r) => normalizeToCompleto(r.data))
    .filter((c): c is ColaboradorCompleto => c !== null);
}

export async function countColaboradoresEnSupabase(admin: SupabaseClient): Promise<number> {
  const { count, error } = await admin.from("colaboradores").select("*", { count: "exact", head: true });
  if (error) throw new Error(hintSupabaseClientError(error.message));
  return count ?? 0;
}
