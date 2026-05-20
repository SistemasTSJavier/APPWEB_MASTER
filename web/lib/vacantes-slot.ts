import {
  canonicalNoServicioCatalogo,
  normPlantaCatalogo,
  valorCoincideConNoServicio,
} from "@/lib/colaboradores-catalogo-display";
import {
  identificadorServicioVacante,
  normServicioLineaVacante,
  serviciosLineaCoincidenVacante,
} from "@/lib/vacantes-servicio";
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

/** @deprecated Prefer serviciosLineaCoincidenVacante (vacantes / altas). */
export function serviciosLineaCoinciden(a: string, b: string): boolean {
  return serviciosLineaCoincidenVacante(a, b);
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
  const servicioId = identificadorServicioVacante(slot);
  return `${planta}${SLOT_SEP}${servicioId}${SLOT_SEP}${posicion}`;
}

export function slotFromVacanteRegistro(v: VacanteRegistro): SlotVacante {
  return {
    planta: v.planta,
    posicion: v.posicion,
    servicioLinea: normServicioLineaVacante(v.servicioLinea ?? ""),
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
  const lineaAlta = normServicioLineaVacante(alta.servicioLinea);
  const lineaVac = normServicioLineaVacante(v.servicioLinea ?? "");

  if (noAlta && noVac) {
    if (!valorCoincideConNoServicio(noVac, noAlta)) return false;
    if (lineaAlta && lineaVac && lineaAlta !== lineaVac) {
      return serviciosLineaCoincidenVacante(lineaAlta, lineaVac);
    }
    return true;
  }

  if (lineaAlta && lineaVac) {
    return lineaAlta === lineaVac || serviciosLineaCoincidenVacante(lineaAlta, lineaVac);
  }

  return false;
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
