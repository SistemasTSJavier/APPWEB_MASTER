export type CatalogoServicioItem = { id: string; nombre: string };

export type ServiciosCatalogoResponse = { items: CatalogoServicioItem[] };

export async function fetchServiciosCatalogo(): Promise<CatalogoServicioItem[]> {
  const r = await fetch("/api/servicios", { cache: "no-store" });
  if (r.status === 503) {
    return [];
  }
  if (!r.ok) {
    const t = await r.text();
    throw new Error(t || `HTTP ${r.status}`);
  }
  const j = (await r.json()) as ServiciosCatalogoResponse;
  return Array.isArray(j.items) ? j.items : [];
}

export async function agregarServicioCatalogo(nombre: string): Promise<CatalogoServicioItem> {
  const r = await fetch("/api/servicios", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ nombre }),
  });
  const t = await r.text();
  if (r.status === 409 || r.status === 400) {
    let msg = t;
    try {
      msg = JSON.parse(t).error ?? t;
    } catch {
      /* texto plano */
    }
    throw new Error(typeof msg === "string" ? msg : "NO SE PUDO AGREGAR");
  }
  if (!r.ok) {
    throw new Error(t || `HTTP ${r.status}`);
  }
  const j = JSON.parse(t) as { item?: CatalogoServicioItem };
  if (!j.item?.nombre) throw new Error("RESPUESTA INVALIDA DEL SERVIDOR.");
  return j.item;
}

export async function eliminarServicioCatalogo(id: string): Promise<void> {
  const r = await fetch(`/api/servicios?id=${encodeURIComponent(id)}`, { method: "DELETE" });
  if (!r.ok) {
    const t = await r.text();
    throw new Error(t || `HTTP ${r.status}`);
  }
}

export type ServiciosIntegrarResult = {
  inserted: number;
  duplicated: number;
  totalCandidates: number;
  expedientes: number;
};

/** Añade al catálogo todas las líneas de servicio distintas encontradas en expedientes (omit duplicados en BD). */
export async function integrarServiciosDesdeExpedientes(): Promise<ServiciosIntegrarResult> {
  const r = await fetch("/api/servicios/integrar-expedientes", { method: "POST" });
  const t = await r.text();
  if (r.status === 503 || !r.ok) {
    let msg = t;
    try {
      const j = JSON.parse(t) as { error?: string; hint?: string };
      msg = [j.error, j.hint].filter(Boolean).join(" — ") || t;
    } catch {
      /* */
    }
    throw new Error(msg || `HTTP ${r.status}`);
  }
  return JSON.parse(t) as ServiciosIntegrarResult;
}

