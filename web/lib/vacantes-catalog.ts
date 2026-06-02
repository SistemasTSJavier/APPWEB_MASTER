import type { CatalogoServicioItem } from "@/lib/servicios-catalogo-client";
import { normalizarVacanteRegistro } from "@/lib/vacantes-servicio";
import { slotFromVacanteRegistro, slotVacanteKey, type SlotVacante } from "@/lib/vacantes-slot";

export const VACANTES_CATALOG_KEY = "attendance:v2:vacantes-catalog";

export const VACANTES_CATALOG_UPDATED_EVENT = "vacantes-catalog-updated";

export interface VacanteRegistro {
  id: string;
  planta: string;
  posicion: string;
  puesto?: string;
  servicioLinea?: string;
  rowServiceNo?: string;
  notas?: string;
  updatedAt: string;
}

function notifyVacantesUpdated(): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(VACANTES_CATALOG_UPDATED_EVENT));
}

export function loadVacantesCatalogo(): VacanteRegistro[] {
  try {
    const raw = localStorage.getItem(VACANTES_CATALOG_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    const out: VacanteRegistro[] = [];
    for (const item of parsed) {
      if (!item || typeof item !== "object") continue;
      const o = item as Record<string, unknown>;
      const planta = String(o.planta ?? "").trim().toUpperCase();
      const posicion = String(o.posicion ?? "").trim().toUpperCase();
      if (!planta || !posicion) continue;
      out.push({
        id: String(o.id ?? `vacant:${planta}:${posicion}`),
        planta,
        posicion,
        puesto: String(o.puesto ?? "").trim().toUpperCase() || undefined,
        servicioLinea: String(o.servicioLinea ?? "").trim().toUpperCase() || undefined,
        rowServiceNo: String(o.rowServiceNo ?? "").trim() || undefined,
        notas: String(o.notas ?? "").trim() || undefined,
        updatedAt: String(o.updatedAt ?? new Date().toISOString()),
      });
    }
    return out.sort((a, b) => {
      const cp = a.planta.localeCompare(b.planta, "es", { numeric: true });
      if (cp !== 0) return cp;
      const cs = (a.servicioLinea ?? "").localeCompare(b.servicioLinea ?? "", "es", { numeric: true });
      if (cs !== 0) return cs;
      return a.posicion.localeCompare(b.posicion, "es", { numeric: true });
    });
  } catch {
    return [];
  }
}

export function saveVacantesCatalogoDirect(items: VacanteRegistro[]): boolean {
  try {
    localStorage.setItem(VACANTES_CATALOG_KEY, JSON.stringify(items));
    notifyVacantesUpdated();
    return true;
  } catch {
    return false;
  }
}

export function removeVacanteFromCatalog(id: string): boolean {
  const key = id.trim();
  if (!key) return false;
  const next = loadVacantesCatalogo().filter((v) => v.id !== key);
  if (next.length === loadVacantesCatalogo().length) return false;
  return saveVacantesCatalogoDirect(next);
}

export function removeVacanteBySlot(slot: SlotVacante): boolean {
  const sk = slotVacanteKey(slot);
  const next = loadVacantesCatalogo().filter((v) => slotVacanteKey(slotFromVacanteRegistro(v)) !== sk);
  if (next.length === loadVacantesCatalogo().length) return false;
  return saveVacantesCatalogoDirect(next);
}

/** Registra una vacante si no existe el mismo slot (planta + servicio + posición). */
export function addVacanteRegistro(
  entry: {
    planta: string;
    posicion: string;
    puesto?: string;
    servicioLinea?: string;
    rowServiceNo?: string;
    notas?: string;
  },
  catalogo: CatalogoServicioItem[] = [],
): VacanteRegistro | null {
  const planta = entry.planta.trim().toUpperCase();
  const posicion = entry.posicion.trim().toUpperCase();
  if (!planta || !posicion) return null;

  const draft = normalizarVacanteRegistro(
    {
      id: `vacant:tmp:${Date.now()}`,
      planta,
      posicion,
      puesto: entry.puesto,
      servicioLinea: entry.servicioLinea,
      rowServiceNo: entry.rowServiceNo,
      notas: entry.notas,
      updatedAt: new Date().toISOString(),
    },
    catalogo,
  );
  if (!draft.servicioLinea && !draft.rowServiceNo) return null;

  const all = loadVacantesCatalogo();
  const sk = slotVacanteKey(slotFromVacanteRegistro(draft));
  if (all.some((v) => slotVacanteKey(slotFromVacanteRegistro(v)) === sk)) {
    return null;
  }

  const scope = planta.replace(/\s+/g, "_");
  const noPart = (draft.rowServiceNo ?? "").trim().replace(/\s+/g, "_") || "srv";
  const nomPart = (draft.servicioLinea ?? "").slice(0, 24).replace(/\s+/g, "_") || "srv";
  const registro: VacanteRegistro = {
    ...draft,
    id: `vacant:planta_${scope}:${noPart}:${nomPart}:${posicion}`,
  };
  if (!saveVacantesCatalogoDirect([...all, registro])) return null;
  return registro;
}

export type VacanteRegistroPatch = {
  planta: string;
  posicion: string;
  puesto?: string;
  servicioLinea?: string;
  rowServiceNo?: string;
  notas?: string;
};

/** Actualiza una vacante existente (planta, servicio, posición, puesto, notas). */
export function updateVacanteRegistro(
  id: string,
  entry: VacanteRegistroPatch,
  catalogo: CatalogoServicioItem[] = [],
): VacanteRegistro | null {
  const key = id.trim();
  if (!key) return null;

  const all = loadVacantesCatalogo();
  const idx = all.findIndex((v) => v.id === key);
  if (idx < 0) return null;

  const planta = entry.planta.trim().toUpperCase();
  const posicion = entry.posicion.trim().toUpperCase();
  if (!planta || !posicion) return null;

  const draft = normalizarVacanteRegistro(
    {
      ...all[idx]!,
      planta,
      posicion,
      puesto: entry.puesto,
      servicioLinea: entry.servicioLinea,
      rowServiceNo: entry.rowServiceNo,
      notas: entry.notas,
      updatedAt: new Date().toISOString(),
    },
    catalogo,
  );
  if (!draft.servicioLinea && !draft.rowServiceNo) return null;

  const sk = slotVacanteKey(slotFromVacanteRegistro(draft));
  const dup = all.find((v, i) => i !== idx && slotVacanteKey(slotFromVacanteRegistro(v)) === sk);
  if (dup) return null;

  const updated: VacanteRegistro = {
    ...draft,
    id: all[idx]!.id,
    updatedAt: new Date().toISOString(),
  };
  const next = [...all];
  next[idx] = updated;
  if (!saveVacantesCatalogoDirect(next)) return null;
  return updated;
}
