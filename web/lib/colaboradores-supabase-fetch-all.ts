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
    .map((r) => {
      const c = normalizeToCompleto(r.data);
      if (!c) return null;
      const dbNo = String(r.no_empleado ?? "").trim().toUpperCase();
      if (!dbNo) return c;
      // La PK de la tabla manda: evita filas “fantasma” con data.noEmpleado distinto.
      return { ...c, noEmpleado: dbNo, form: { ...c.form, noEmpleado1: dbNo } };
    })
    .filter((c): c is ColaboradorCompleto => c !== null);
}

export async function countColaboradoresEnSupabase(admin: SupabaseClient): Promise<number> {
  const { count, error } = await admin.from("colaboradores").select("*", { count: "exact", head: true });
  if (error) throw new Error(hintSupabaseClientError(error.message));
  return count ?? 0;
}

/** Carga solo los expedientes pedidos (por lotes). Ideal para corrección CSV de 100–miles de filas. */
export async function fetchColaboradoresDbRowsByNos(
  admin: SupabaseClient,
  nos: string[],
  opts?: { chunkSize?: number },
): Promise<ColaboradorDbRow[]> {
  const variants = new Set<string>();
  for (const raw of nos) {
    const t = String(raw ?? "").trim();
    if (!t) continue;
    variants.add(t);
    variants.add(t.toUpperCase());
    // Misma clave canónica que usa el CSV (quita ceros a la izquierda / .0 de Excel)
    const compact = t.replace(/\u00a0/g, " ").trim();
    if (/^\d+\.0+$/.test(compact)) variants.add(compact.replace(/\.0+$/, ""));
    if (/^\d+$/.test(compact.replace(/^0+/, "") || "0")) {
      const n = String(Number.parseInt(compact, 10));
      if (n && n !== "NaN") variants.add(n);
    }
  }
  const unique = [...variants].filter(Boolean);
  if (unique.length === 0) return [];

  const chunkSize = Math.max(50, Math.min(opts?.chunkSize ?? 200, 300));
  const byKey = new Map<string, ColaboradorDbRow>();

  for (let i = 0; i < unique.length; i += chunkSize) {
    const chunk = unique.slice(i, i + chunkSize);
    const { data, error } = await admin
      .from("colaboradores")
      .select("no_empleado, data")
      .in("no_empleado", chunk);
    if (error) throw new Error(hintSupabaseClientError(error.message));
    for (const row of (data ?? []) as ColaboradorDbRow[]) {
      byKey.set(String(row.no_empleado ?? "").trim().toUpperCase(), row);
    }
  }

  return [...byKey.values()];
}
