import type { CatPersonalRow } from "@/lib/categorizacion-types";

let catPersonalCache: CatPersonalRow[] | null = null;
let catPersonalInflight: Promise<CatPersonalRow[]> | null = null;

export function invalidateCatPersonalCache(): void {
  catPersonalCache = null;
  catPersonalInflight = null;
}

export function setCatPersonalCache(rows: CatPersonalRow[]): void {
  catPersonalCache = rows;
}

export function patchCatPersonalCache(row: CatPersonalRow): void {
  if (!catPersonalCache) return;
  const key = row.noEmpleado.trim().toUpperCase();
  const idx = catPersonalCache.findIndex((p) => p.noEmpleado === key);
  if (idx >= 0) catPersonalCache[idx] = row;
  else catPersonalCache.push(row);
}

/** Listado de cat_personal (GET). Reutiliza caché en la misma sesión del navegador. */
export async function fetchCatPersonalList(options?: {
  forceRefresh?: boolean;
}): Promise<CatPersonalRow[]> {
  if (options?.forceRefresh) invalidateCatPersonalCache();
  if (catPersonalCache) return catPersonalCache;
  if (!catPersonalInflight) {
    catPersonalInflight = (async () => {
      const r = await fetch("/api/categorizacion/personal", { cache: "no-store" });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error ?? `Error ${r.status}`);
      const rows = Array.isArray(j.rows) ? (j.rows as CatPersonalRow[]) : [];
      catPersonalCache = rows;
      return rows;
    })().finally(() => {
      catPersonalInflight = null;
    });
  }
  return catPersonalInflight;
}
