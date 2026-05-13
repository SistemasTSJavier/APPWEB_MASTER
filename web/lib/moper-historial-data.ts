import type { MoperHistorialEntrada } from "@/lib/moper-historial-types";
import { SupabaseDataError } from "@/lib/supabase-data-error";

async function readErrorBody(r: Response): Promise<string> {
  try {
    const t = await r.text();
    if (!t) return r.statusText || `HTTP ${r.status}`;
    try {
      const j = JSON.parse(t) as { error?: unknown };
      if (typeof j?.error === "string" && j.error.trim()) return j.error.trim();
    } catch {
      /* texto plano */
    }
    return t;
  } catch {
    return r.statusText || `HTTP ${r.status}`;
  }
}

async function remotePush(entry: MoperHistorialEntrada): Promise<void> {
  const { historialId: _hid, ...payload } = entry;
  const r = await fetch("/api/moper-historial", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (r.status === 503) {
    throw new SupabaseDataError(
      "HISTORIAL MOPER NO DISPONIBLE: CONFIGURA SUPABASE SERVICE ROLE EN EL SERVIDOR.",
    );
  }
  if (!r.ok) throw new SupabaseDataError(await readErrorBody(r));
}

async function remoteListPorEmpleado(noEmpleado: string): Promise<MoperHistorialEntrada[]> {
  const q = encodeURIComponent(noEmpleado.trim().toUpperCase());
  const r = await fetch(`/api/moper-historial?no_empleado=${q}`, { cache: "no-store" });
  if (r.status === 503) {
    throw new SupabaseDataError(
      "NO SE PUDO CARGAR HISTORIAL MOPER: SUPABASE NO CONFIGURADO EN EL SERVIDOR.",
    );
  }
  if (!r.ok) throw new SupabaseDataError(await readErrorBody(r));
  return r.json() as Promise<MoperHistorialEntrada[]>;
}

async function remoteListReciente(limit: number): Promise<MoperHistorialEntrada[]> {
  const r = await fetch(`/api/moper-historial?limit=${encodeURIComponent(String(limit))}`, { cache: "no-store" });
  if (r.status === 503) {
    throw new SupabaseDataError(
      "NO SE PUDO CARGAR HISTORIAL MOPER: SUPABASE NO CONFIGURADO EN EL SERVIDOR.",
    );
  }
  if (!r.ok) throw new SupabaseDataError(await readErrorBody(r));
  return r.json() as Promise<MoperHistorialEntrada[]>;
}

export type MoperHistorialListaFiltros = {
  /** Max 500 (API). Por defecto 300 en cliente. */
  limit?: number;
  /** Fecha inicio inclusiva YYYY-MM-DD (hora inicio día local). */
  desde?: string;
  /** Fecha fin inclusiva YYYY-MM-DD. */
  hasta?: string;
  /** Texto que debe aparecer en servicio inicial o final (sin distinguir mayúsculas). */
  servicio?: string;
};

async function remoteListFiltrado(f: MoperHistorialListaFiltros): Promise<MoperHistorialEntrada[]> {
  const params = new URLSearchParams();
  params.set("limit", String(Math.min(500, Math.max(1, f.limit ?? 300))));
  if (f.desde?.trim()) params.set("desde", f.desde.trim());
  if (f.hasta?.trim()) params.set("hasta", f.hasta.trim());
  if (f.servicio?.trim()) params.set("servicio", f.servicio.trim());
  const r = await fetch(`/api/moper-historial?${params.toString()}`, { cache: "no-store" });
  if (r.status === 503) {
    throw new SupabaseDataError(
      "NO SE PUDO CARGAR HISTORIAL MOPER: SUPABASE NO CONFIGURADO EN EL SERVIDOR.",
    );
  }
  if (!r.ok) throw new SupabaseDataError(await readErrorBody(r));
  return r.json() as Promise<MoperHistorialEntrada[]>;
}

export async function pushMoperHistorial(entry: MoperHistorialEntrada): Promise<void> {
  await remotePush(entry);
}

export async function listMoperHistorialPorEmpleado(noEmpleado: string): Promise<MoperHistorialEntrada[]> {
  return remoteListPorEmpleado(noEmpleado);
}

/** Ultimos movimientos de todos los colaboradores (mas recientes primero). Max limit 500 en API. */
export async function listMoperHistorialReciente(limit = 100): Promise<MoperHistorialEntrada[]> {
  return remoteListReciente(Math.min(500, Math.max(1, limit)));
}

/** Lista global con filtros opcionales de fecha y texto de servicio (API GET sin `no_empleado`). */
export async function listMoperHistorialFiltrado(f: MoperHistorialListaFiltros): Promise<MoperHistorialEntrada[]> {
  return remoteListFiltrado(f);
}

/** Elimina una fila del historial MOPER en Supabase (`historialId` del GET). */
export async function deleteMoperHistorial(id: string): Promise<void> {
  const r = await fetch(`/api/moper-historial?id=${encodeURIComponent(id.trim())}`, { method: "DELETE" });
  if (r.status === 503) {
    throw new SupabaseDataError(
      "NO SE PUDO ELIMINAR: SUPABASE NO CONFIGURADO EN EL SERVIDOR.",
    );
  }
  if (!r.ok) throw new SupabaseDataError(await readErrorBody(r));
}

/** Vacía todo el historial MOPER (solo API permite si el usuario es admin). */
export async function deleteAllMoperHistorial(): Promise<void> {
  const r = await fetch("/api/moper-historial?all=1", { method: "DELETE" });
  if (r.status === 503) {
    throw new SupabaseDataError(
      "NO SE PUDO VACIAR HISTORIAL: SUPABASE NO CONFIGURADO EN EL SERVIDOR.",
    );
  }
  if (!r.ok) throw new SupabaseDataError(await readErrorBody(r));
}
