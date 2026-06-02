import type { VacanteRegistro } from "@/lib/vacantes-catalog";

export type VacantesCatalogRemoteMeta = {
  status: "ok" | "empty" | "no_config" | "auth" | "forbidden" | "error";
  message?: string;
  httpStatus?: number;
};

function metaFromHttpStatus(status: number, bodyText?: string): VacantesCatalogRemoteMeta {
  if (status === 503) {
    return {
      status: "no_config",
      httpStatus: status,
      message:
        "El servidor no tiene Supabase configurado (SUPABASE_SERVICE_ROLE_KEY y NEXT_PUBLIC_SUPABASE_URL).",
    };
  }
  if (status === 401) {
    return { status: "auth", httpStatus: status, message: "Sesión expirada. Vuelva a iniciar sesión." };
  }
  if (status === 403) {
    return { status: "forbidden", httpStatus: status, message: "Su rol no puede sincronizar vacantes en el servidor." };
  }
  return {
    status: "error",
    httpStatus: status,
    message: bodyText?.trim() || `Error del servidor (HTTP ${status}).`,
  };
}

/** Catálogo de vacantes en Supabase (producción). */
export async function fetchVacantesCatalogRemote(): Promise<{
  items: VacanteRegistro[];
  savedAt: string | null;
  meta: VacantesCatalogRemoteMeta;
}> {
  try {
    const r = await fetch("/api/vacantes/catalog", {
      cache: "no-store",
      credentials: "same-origin",
    });
    if (!r.ok) {
      const t = await r.text();
      return { items: [], savedAt: null, meta: metaFromHttpStatus(r.status, t) };
    }
    const data = (await r.json()) as { items?: VacanteRegistro[]; savedAt?: string | null };
    const items = Array.isArray(data.items) ? data.items : [];
    return {
      items,
      savedAt: data.savedAt ?? null,
      meta: items.length > 0 ? { status: "ok" } : { status: "empty" },
    };
  } catch (e) {
    return {
      items: [],
      savedAt: null,
      meta: {
        status: "error",
        message: e instanceof Error ? e.message : "Error de red al cargar vacantes.",
      },
    };
  }
}

/** Reemplaza el catálogo completo en el servidor. */
export async function pushVacantesCatalogRemote(
  items: VacanteRegistro[],
): Promise<{ ok: boolean; uploaded: number; savedAt?: string; meta?: VacantesCatalogRemoteMeta }> {
  const savedAt = new Date().toISOString();
  try {
    const r = await fetch("/api/vacantes/catalog", {
      method: "POST",
      credentials: "same-origin",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ items, savedAt }),
    });
    if (!r.ok) {
      const t = await r.text();
      return { ok: false, uploaded: 0, meta: metaFromHttpStatus(r.status, t) };
    }
    const j = (await r.json()) as { uploaded?: number; savedAt?: string };
    return {
      ok: true,
      uploaded: j.uploaded ?? items.length,
      savedAt: j.savedAt ?? savedAt,
    };
  } catch (e) {
    return {
      ok: false,
      uploaded: 0,
      meta: {
        status: "error",
        message: e instanceof Error ? e.message : "Error de red al subir vacantes.",
      },
    };
  }
}
