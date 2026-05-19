import {
  canonicalNoServicioCatalogo,
  normPlantaCatalogo,
  valorCoincideConNoServicio,
} from "@/lib/colaboradores-catalogo-display";
import { claveServicioAgrupada } from "@/lib/servicio-agrupacion";
import type { VacanteRegistro } from "@/lib/vacantes-catalog";

const SLOT_SEP = "\u001f";

export type SlotVacante = {
  planta: string;
  posicion: string;
  servicioLinea: string;
  rowServiceNo: string;
};

export function normPosicionKey(p: string): string {
  const t = p.trim().toUpperCase();
  return t === "—" || t === "-" ? "" : t;
}

function normServicioLinea(s: string): string {
  return s.trim().replace(/\s+/g, " ").toUpperCase();
}

export function serviciosLineaCoinciden(a: string, b: string): boolean {
  const na = normServicioLinea(a);
  const nb = normServicioLinea(b);
  if (!na || !nb) return !na && !nb;
  if (na === nb) return true;
  const ka = claveServicioAgrupada(na);
  const kb = claveServicioAgrupada(nb);
  return Boolean(ka && kb && ka === kb);
}

/** Clave única: planta + N.º servicio (o línea) + posición. */
export function slotVacanteKey(slot: {
  planta: string;
  posicion: string;
  servicioLinea?: string;
  rowServiceNo?: string;
}): string {
  const planta = slot.planta.trim().toUpperCase();
  const posicion = normPosicionKey(slot.posicion);
  const no = canonicalNoServicioCatalogo(slot.rowServiceNo ?? "");
  const servicio = normServicioLinea(slot.servicioLinea ?? "");
  const servicioId = no || servicio;
  return `${planta}${SLOT_SEP}${servicioId}${SLOT_SEP}${posicion}`;
}

export function slotFromVacanteRegistro(v: VacanteRegistro): SlotVacante {
  return {
    planta: v.planta,
    posicion: v.posicion,
    servicioLinea: (v.servicioLinea ?? "").trim().toUpperCase(),
    rowServiceNo: (v.rowServiceNo ?? "").trim(),
  };
}

export type AltaServicioContexto = {
  servicioLinea: string;
  rowServiceNo: string;
  planta: string;
};

/** Mismo servicio y planta (sin comparar posición). */
export function vacanteCoincideServicioAlta(
  v: VacanteRegistro,
  alta: AltaServicioContexto,
): boolean {
  const plantaAlta = normPlantaCatalogo(alta.planta);
  if (!plantaAlta || normPlantaCatalogo(v.planta) !== plantaAlta) return false;

  const noAlta = canonicalNoServicioCatalogo(alta.rowServiceNo);
  const noVac = canonicalNoServicioCatalogo(v.rowServiceNo ?? "");
  if (noAlta && noVac) return valorCoincideConNoServicio(noVac, noAlta);

  const lineaAlta = normServicioLinea(alta.servicioLinea);
  const lineaVac = normServicioLinea(v.servicioLinea ?? "");
  if (lineaAlta && lineaVac) return serviciosLineaCoinciden(lineaAlta, lineaVac);

  return Boolean(noAlta || lineaAlta);
}

export function slotVacanteCoincideAlta(slot: SlotVacante, alta: AltaServicioContexto): boolean {
  return vacanteCoincideServicioAlta(
    {
      id: "",
      planta: slot.planta,
      posicion: slot.posicion,
      servicioLinea: slot.servicioLinea,
      rowServiceNo: slot.rowServiceNo,
      updatedAt: "",
    },
    alta,
  );
}
