/**
 * Capa de datos: solo Supabase via API del servidor (service role).
 */
import type { ColaboradorCompleto, ColaboradorSnapshot } from "@/lib/colaboradores-types";
import { sincronizarEstadoBajaEnColaborador } from "@/lib/colaboradores-baja";
import { SupabaseDataError } from "@/lib/supabase-data-error";

async function readErrorBody(r: Response): Promise<string> {
  try {
    const t = await r.text();
    if (!t) return r.statusText || `HTTP ${r.status}`;
    if (r.status === 503) {
      try {
        const j = JSON.parse(t) as { error?: string; missingEnv?: string[]; hint?: string };
        const parts = [j.error, j.missingEnv?.length ? `FALTAN: ${j.missingEnv.join(", ")}` : "", j.hint].filter(Boolean);
        if (parts.length) return parts.join(" — ");
      } catch {
        /* texto plano */
      }
    }
    return t;
  } catch {
    return r.statusText || `HTTP ${r.status}`;
  }
}

async function remoteList(): Promise<ColaboradorCompleto[]> {
  const r = await fetch("/api/colaboradores", { cache: "no-store" });
  if (r.status === 503) {
    throw new SupabaseDataError(await readErrorBody(r));
  }
  if (!r.ok) throw new SupabaseDataError(await readErrorBody(r));
  return r.json() as Promise<ColaboradorCompleto[]>;
}

async function remoteUpsert(data: ColaboradorCompleto): Promise<void> {
  const r = await fetch("/api/colaboradores", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (r.status === 503) {
    throw new SupabaseDataError(
      "NO SE PUDO GUARDAR: SUPABASE SERVICE ROLE NO CONFIGURADO O API NO DISPONIBLE.",
    );
  }
  if (!r.ok) throw new SupabaseDataError(await readErrorBody(r));
}

async function remoteBatch(items: ColaboradorCompleto[]): Promise<void> {
  const r = await fetch("/api/colaboradores/batch", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ items }),
  });
  if (r.status === 503) {
    throw new SupabaseDataError(
      "IMPORTACION NO DISPONIBLE: CONFIGURA SUPABASE SERVICE ROLE EN EL SERVIDOR.",
    );
  }
  if (!r.ok) throw new SupabaseDataError(await readErrorBody(r));
}

/** Caché en memoria del listado (evita GET completo repetido en la misma sesión). */
let colaboradoresListCache: ColaboradorCompleto[] | null = null;
let colaboradoresListInflight: Promise<ColaboradorCompleto[]> | null = null;

export function invalidateColaboradoresListCache(): void {
  colaboradoresListCache = null;
  colaboradoresListInflight = null;
}

function patchColaboradoresListCache(data: ColaboradorCompleto): void {
  if (!colaboradoresListCache) return;
  const key = data.noEmpleado.trim().toUpperCase();
  const idx = colaboradoresListCache.findIndex((c) => c.noEmpleado === key);
  if (idx >= 0) colaboradoresListCache[idx] = data;
  else colaboradoresListCache.push(data);
}

async function fetchColaboradoresListCached(): Promise<ColaboradorCompleto[]> {
  if (colaboradoresListCache) return colaboradoresListCache;
  if (!colaboradoresListInflight) {
    colaboradoresListInflight = remoteList()
      .then((list) => {
        colaboradoresListCache = list;
        return list;
      })
      .finally(() => {
        colaboradoresListInflight = null;
      });
  }
  return colaboradoresListInflight;
}

export async function listColaboradoresCompletos(options?: {
  forceRefresh?: boolean;
}): Promise<ColaboradorCompleto[]> {
  if (options?.forceRefresh) invalidateColaboradoresListCache();
  return fetchColaboradoresListCached();
}

export async function findColaboradorCompletoByNo(noEmpleado: string): Promise<ColaboradorCompleto | null> {
  const list = await fetchColaboradoresListCached();
  const key = noEmpleado.trim().toUpperCase();
  return list.find((c) => c.noEmpleado === key) ?? null;
}

export async function findColaboradorByNo(noEmpleado: string): Promise<ColaboradorSnapshot | null> {
  const c = await findColaboradorCompletoByNo(noEmpleado);
  if (!c) return null;
  return {
    noEmpleado: c.noEmpleado,
    nombreCompleto: c.nombreCompleto,
    fechaIngreso: c.fechaIngreso,
    servicioAsignado: c.servicioAsignado,
    ultimoServicio: c.ultimoServicio,
    nss: c.nss,
    posicion: c.posicion,
    puesto: c.puesto,
  };
}

export async function upsertColaboradorCompleto(data: ColaboradorCompleto): Promise<void> {
  const prepared = sincronizarEstadoBajaEnColaborador(data);
  await remoteUpsert(prepared);
  patchColaboradoresListCache(prepared);
}

export async function upsertColaboradoresBatch(items: ColaboradorCompleto[]): Promise<void> {
  await remoteBatch(items);
  invalidateColaboradoresListCache();
}

/** Alinea snapshot, Parte 1 del expediente (`form`) y `moperActual` con un destino MOPER (mismo criterio que al guardar un movimiento). */
export function mergeColaboradorConDestinoMoper(
  c: ColaboradorCompleto,
  servicioFinal: string,
  puestoFinal: string,
): ColaboradorCompleto {
  const servicioFi = servicioFinal.trim();
  const puestoFi = puestoFinal.trim();

  const form = { ...c.form };
  if (servicioFi) {
    form.servicio = servicioFi;
    form.servicioFinal = servicioFi;
    form.ultimoServicio = servicioFi;
  }
  if (puestoFi) {
    form.puesto = puestoFi;
    form.puestoFinal = puestoFi;
  }

  return {
    ...c,
    servicioAsignado: servicioFi || c.servicioAsignado,
    ultimoServicio: servicioFi || c.ultimoServicio,
    puesto: puestoFi || c.puesto,
    form,
    moperActual: {
      servicio: servicioFi || c.moperActual?.servicio || c.servicioAsignado,
      puesto: puestoFi || c.moperActual?.puesto || c.puesto,
    },
  };
}

export async function aplicarMoperMovimiento(
  noEmpleado: string,
  cambio: { servicioFinal: string; puestoFinal: string },
): Promise<ColaboradorCompleto | null> {
  const c = await findColaboradorCompletoByNo(noEmpleado);
  if (!c) return null;
  const siguiente = mergeColaboradorConDestinoMoper(c, cambio.servicioFinal, cambio.puestoFinal);
  await upsertColaboradorCompleto(siguiente);
  return siguiente;
}

export type SincronizarMoperResultado = {
  updated: number;
  sinCambio: number;
  sinExpediente: number;
  personasEnHistorial?: number;
};

async function remoteSincronizarMoper(): Promise<SincronizarMoperResultado> {
  const r = await fetch("/api/colaboradores/sincronizar-moper", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: "{}",
  });
  if (r.status === 503) {
    throw new SupabaseDataError(
      "SINCRONIZACION NO DISPONIBLE: CONFIGURA SUPABASE SERVICE ROLE EN EL SERVIDOR.",
    );
  }
  if (!r.ok) throw new SupabaseDataError(await readErrorBody(r));
  return r.json() as Promise<SincronizarMoperResultado>;
}

/** Repasa el historial MOPER en Supabase y actualiza expedientes para coincidir con el ultimo movimiento por persona. */
export async function sincronizarColaboradoresConHistorialMoper(): Promise<SincronizarMoperResultado> {
  return remoteSincronizarMoper();
}
