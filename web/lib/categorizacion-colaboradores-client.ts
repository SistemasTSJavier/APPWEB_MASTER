import type { CatColaboradorActivoOpcion } from "@/lib/categorizacion-types";

let colaboradoresActivosCache: CatColaboradorActivoOpcion[] | null = null;
let colaboradoresActivosInflight: Promise<CatColaboradorActivoOpcion[]> | null = null;

export function invalidateColaboradoresActivosCatCache(): void {
  colaboradoresActivosCache = null;
  colaboradoresActivosInflight = null;
}

export function setColaboradoresActivosCatCache(rows: CatColaboradorActivoOpcion[]): void {
  colaboradoresActivosCache = rows;
}

/**
 * Colaboradores activos en expedientes (sección Colaboradores).
 * Reutiliza caché en la misma sesión; use forceRefresh tras altas/bajas/MOPER.
 */
export async function fetchColaboradoresActivosCat(options?: {
  forceRefresh?: boolean;
  q?: string;
}): Promise<CatColaboradorActivoOpcion[]> {
  const q = options?.q?.trim();
  if (q) {
    const r = await fetch(`/api/categorizacion/colaboradores-activos?q=${encodeURIComponent(q)}`, {
      cache: "no-store",
    });
    const j = await r.json();
    if (!r.ok) throw new Error(j.error ?? `Error ${r.status}`);
    return Array.isArray(j.rows) ? (j.rows as CatColaboradorActivoOpcion[]) : [];
  }

  if (options?.forceRefresh) invalidateColaboradoresActivosCatCache();
  if (colaboradoresActivosCache) return colaboradoresActivosCache;

  if (!colaboradoresActivosInflight) {
    colaboradoresActivosInflight = (async () => {
      const r = await fetch("/api/categorizacion/colaboradores-activos", { cache: "no-store" });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error ?? `Error ${r.status}`);
      const rows = Array.isArray(j.rows) ? (j.rows as CatColaboradorActivoOpcion[]) : [];
      colaboradoresActivosCache = rows;
      return rows;
    })().finally(() => {
      colaboradoresActivosInflight = null;
    });
  }
  return colaboradoresActivosInflight;
}
