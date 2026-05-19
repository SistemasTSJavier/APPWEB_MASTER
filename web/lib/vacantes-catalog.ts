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
