export type CatalogoServicioItem = {
  id: string;
  nombre: string;
  /** N.º corto (cuadrícula / asistencia); opcional. */
  numero_servicio?: string | null;
  /** Planta o sitio; opcional. */
  planta?: string | null;
};

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

export type AgregarServicioCatalogoInput =
  | string
  | {
      nombre: string;
      numero_servicio?: string | null;
      planta?: string | null;
    };

export async function agregarServicioCatalogo(input: AgregarServicioCatalogoInput): Promise<CatalogoServicioItem> {
  const body =
    typeof input === "string"
      ? { nombre: input }
      : {
          nombre: input.nombre,
          numero_servicio: input.numero_servicio ?? null,
          planta: input.planta ?? null,
        };
  const r = await fetch("/api/servicios", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
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

export async function actualizarServicioCatalogo(input: {
  id: string;
  nombre?: string;
  numero_servicio?: string | null;
  planta?: string | null;
}): Promise<CatalogoServicioItem> {
  const r = await fetch("/api/servicios", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  const t = await r.text();
  if (r.status === 409 || r.status === 400) {
    let msg = t;
    try {
      msg = JSON.parse(t).error ?? t;
    } catch {
      /* */
    }
    throw new Error(typeof msg === "string" ? msg : "NO SE PUDO ACTUALIZAR");
  }
  if (!r.ok) {
    throw new Error(t || `HTTP ${r.status}`);
  }
  const j = JSON.parse(t) as { item?: CatalogoServicioItem };
  if (!j.item?.id) throw new Error("RESPUESTA INVALIDA DEL SERVIDOR.");
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

export type ServiciosImportDosColumnasResult = {
  inserted: number;
  updated: number;
  skipped: number;
  totalInput: number;
  errors: { line: number; message: string }[];
  /** Presente si la BD no tiene migración 008 o hubo filas cuyo N.º no se pudo aplicar. */
  hint008?: string;
  skippedNumeroSinColumnaEnBd?: number;
  /** Presente si la BD no tiene migración 010 (planta). */
  hint010?: string;
  skippedPlantaSinColumnaEnBd?: number;
};

export async function importarServiciosCatalogoDosColumnasCsv(file: File): Promise<ServiciosImportDosColumnasResult> {
  const fd = new FormData();
  fd.append("file", file);
  const r = await fetch("/api/servicios/import-dos-columnas", {
    method: "POST",
    body: fd,
  });
  const t = await r.text();
  if (r.status === 403 || r.status === 400) {
    let msg = t;
    try {
      msg = JSON.parse(t).error ?? t;
    } catch {
      /* */
    }
    throw new Error(typeof msg === "string" ? msg : "NO SE PUDO IMPORTAR");
  }
  if (!r.ok) {
    let msg = t;
    try {
      const j = JSON.parse(t) as { error?: string; hint?: string };
      msg = [j.error, j.hint].filter(Boolean).join(" — ") || t;
    } catch {
      /* */
    }
    throw new Error(msg || `HTTP ${r.status}`);
  }
  return JSON.parse(t) as ServiciosImportDosColumnasResult;
}
