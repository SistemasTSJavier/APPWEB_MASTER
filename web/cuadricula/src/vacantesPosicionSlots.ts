import type { ColaboradorCompleto } from "@/lib/colaboradores-types";
import {
  canonicalNoServicioCatalogo,
  noServicioColaborador,
  nombreServicioCatalogoColaborador,
  normPlantaCatalogo,
  plantaExpedienteColaborador,
  posicionLaboralColaborador,
  valorCoincideConNoServicio,
} from "@/lib/colaboradores-catalogo-display";
import type { CatalogoServicioItem } from "@/lib/servicios-catalogo-client";
import { colaboradorTieneBaja } from "@/lib/colaboradores-baja";
import { listarPlantasDeColaboradores } from "./cuadriculaColaboradoresBridge";
import type { VacanteRegistro } from "@/lib/vacantes-catalog";
import {
  normPosicionKey,
  serviciosLineaCoinciden,
  slotFromVacanteRegistro,
  slotVacanteKey,
  type SlotVacante,
} from "@/lib/vacantes-slot";

export {
  normPosicionKey,
  slotFromVacanteRegistro,
  slotVacanteKey,
  type SlotVacante,
};

export type PosicionLibreVacante = SlotVacante & {
  puestoSugerido: string;
};

export type DatosPosicionPlanta = SlotVacante & {
  puestoSugerido: string;
};

const SLOT_SEP = "\u001f";

function normServicioLinea(s: string): string {
  return s.trim().replace(/\s+/g, " ").toUpperCase();
}

export function encodeSlotKey(slot: SlotVacante): string {
  return [slot.planta, slot.rowServiceNo, slot.servicioLinea, slot.posicion].join(SLOT_SEP);
}

export function decodeSlotKey(raw: string): SlotVacante | null {
  const parts = raw.split(SLOT_SEP);
  if (parts.length !== 4) return null;
  const planta = parts[0]!.trim().toUpperCase();
  const posicion = parts[3]!.trim().toUpperCase();
  if (!planta || !posicion) return null;
  return {
    planta,
    rowServiceNo: parts[1]!.trim(),
    servicioLinea: normServicioLinea(parts[2]!),
    posicion,
  };
}

export function listarPlantasParaVacantes(
  colaboradores: ColaboradorCompleto[],
  catalogo: CatalogoServicioItem[],
): string[] {
  const set = new Set<string>();
  for (const p of listarPlantasDeColaboradores(colaboradores)) set.add(p);
  for (const item of catalogo) {
    const p = normPlantaCatalogo(item.planta ?? "");
    if (p) set.add(p);
  }
  return [...set].sort((a, b) => a.localeCompare(b, "es", { numeric: true }));
}

export function colaboradorCoincideSlot(
  c: ColaboradorCompleto,
  slot: SlotVacante,
  catalogo: CatalogoServicioItem[],
): boolean {
  const p = slot.planta.trim().toUpperCase();
  if (plantaExpedienteColaborador(c).trim().toUpperCase() !== p) return false;
  if (normPosicionKey(posicionLaboralColaborador(c, catalogo)) !== normPosicionKey(slot.posicion)) {
    return false;
  }
  const noCol = noServicioColaborador(c, catalogo, { plantaContexto: p });
  const lineaCol = nombreServicioCatalogoColaborador(c, catalogo, { plantaContexto: p });
  const noSlot = canonicalNoServicioCatalogo(slot.rowServiceNo);
  if (noSlot && noCol) {
    return valorCoincideConNoServicio(noCol, noSlot);
  }
  if (slot.servicioLinea && lineaCol) {
    return serviciosLineaCoinciden(lineaCol, slot.servicioLinea);
  }
  if (noSlot || slot.servicioLinea) {
    return false;
  }
  return true;
}

function slotDesdeColaborador(
  c: ColaboradorCompleto,
  planta: string,
  catalogo: CatalogoServicioItem[],
): SlotVacante | null {
  const p = planta.trim().toUpperCase();
  if (plantaExpedienteColaborador(c).trim().toUpperCase() !== p) return null;
  const posicion = normPosicionKey(posicionLaboralColaborador(c, catalogo));
  if (!posicion) return null;
  return {
    planta: p,
    posicion: posicionLaboralColaborador(c, catalogo).trim().toUpperCase(),
    servicioLinea: nombreServicioCatalogoColaborador(c, catalogo, { plantaContexto: p }) || "—",
    rowServiceNo: noServicioColaborador(c, catalogo, { plantaContexto: p }) || "",
  };
}

/** Slots distintos (planta + servicio + posición) vistos en expedientes de esa planta. */
export function listarSlotsConocidosEnPlanta(
  colaboradores: ColaboradorCompleto[],
  planta: string,
  catalogo: CatalogoServicioItem[],
): SlotVacante[] {
  const p = planta.trim().toUpperCase();
  if (!p) return [];
  const byKey = new Map<string, SlotVacante>();
  for (const c of colaboradores) {
    const slot = slotDesdeColaborador(c, p, catalogo);
    if (!slot) continue;
    byKey.set(slotVacanteKey(slot), slot);
  }
  return [...byKey.values()].sort((a, b) => {
    const cs = a.servicioLinea.localeCompare(b.servicioLinea, "es", { numeric: true });
    if (cs !== 0) return cs;
    const cn = a.rowServiceNo.localeCompare(b.rowServiceNo, "es", { numeric: true });
    if (cn !== 0) return cn;
    return a.posicion.localeCompare(b.posicion, "es", { numeric: true });
  });
}

export function resolverDatosSlot(
  slot: SlotVacante,
  colaboradores: ColaboradorCompleto[],
  catalogo: CatalogoServicioItem[],
): DatosPosicionPlanta {
  let fallback: ColaboradorCompleto | null = null;

  for (const c of colaboradores) {
    if (!colaboradorCoincideSlot(c, slot, catalogo)) continue;
    if (!colaboradorTieneBaja(c)) {
      const p = slot.planta.trim().toUpperCase();
      return {
        ...slot,
        posicion: slot.posicion.trim().toUpperCase(),
        servicioLinea:
          nombreServicioCatalogoColaborador(c, catalogo, { plantaContexto: p }) || slot.servicioLinea,
        rowServiceNo: noServicioColaborador(c, catalogo, { plantaContexto: p }) || slot.rowServiceNo,
        puestoSugerido: (c.puesto ?? "").trim().toUpperCase(),
      };
    }
    fallback ??= c;
  }

  if (fallback) {
    const p = slot.planta.trim().toUpperCase();
    return {
      ...slot,
      posicion: slot.posicion.trim().toUpperCase(),
      servicioLinea:
        nombreServicioCatalogoColaborador(fallback, catalogo, { plantaContexto: p }) ||
        slot.servicioLinea,
      rowServiceNo:
        noServicioColaborador(fallback, catalogo, { plantaContexto: p }) || slot.rowServiceNo,
      puestoSugerido: (fallback.puesto ?? "").trim().toUpperCase(),
    };
  }

  return {
    ...slot,
    posicion: slot.posicion.trim().toUpperCase(),
    puestoSugerido: "",
  };
}

/** @deprecated Use resolverDatosSlot con slot completo (servicio + posición). */
export function resolverDatosPosicionEnPlanta(
  planta: string,
  posicion: string,
  colaboradores: ColaboradorCompleto[],
  catalogo: CatalogoServicioItem[],
  hint?: { servicioLinea?: string; rowServiceNo?: string },
): DatosPosicionPlanta {
  const p = planta.trim().toUpperCase();
  const slots = listarSlotsConocidosEnPlanta(colaboradores, p, catalogo);
  const pk = normPosicionKey(posicion);
  const noHint = canonicalNoServicioCatalogo(hint?.rowServiceNo ?? "");
  const lineaHint = normServicioLinea(hint?.servicioLinea ?? "");

  const match = slots.find((s) => {
    if (normPosicionKey(s.posicion) !== pk) return false;
    if (noHint && s.rowServiceNo) return valorCoincideConNoServicio(s.rowServiceNo, noHint);
    if (lineaHint && s.servicioLinea) return serviciosLineaCoinciden(s.servicioLinea, lineaHint);
    return true;
  });

  if (match) return resolverDatosSlot(match, colaboradores, catalogo);

  return resolverDatosSlot(
    {
      planta: p,
      posicion: posicion.trim().toUpperCase(),
      servicioLinea: lineaHint || "—",
      rowServiceNo: hint?.rowServiceNo?.trim() ?? "",
    },
    colaboradores,
    catalogo,
  );
}

/** Slots libres: sin colaborador activo en ese servicio+posición ni vacante ya registrada. */
export function listarPosicionesLibresParaVacante(
  planta: string,
  colaboradores: ColaboradorCompleto[],
  catalogo: CatalogoServicioItem[],
  vacantesCatalogo: VacanteRegistro[],
): PosicionLibreVacante[] {
  const p = planta.trim().toUpperCase();
  if (!p) return [];

  const ocupadasActivas = new Set<string>();
  for (const c of colaboradores) {
    if (colaboradorTieneBaja(c)) continue;
    const slot = slotDesdeColaborador(c, p, catalogo);
    if (slot) ocupadasActivas.add(slotVacanteKey(slot));
  }

  const vacantesReg = new Set(
    vacantesCatalogo
      .filter((v) => v.planta === p)
      .map((v) => slotVacanteKey(slotFromVacanteRegistro(v))),
  );

  const out: PosicionLibreVacante[] = [];
  for (const slot of listarSlotsConocidosEnPlanta(colaboradores, p, catalogo)) {
    const key = slotVacanteKey(slot);
    if (ocupadasActivas.has(key) || vacantesReg.has(key)) continue;
    const datos = resolverDatosSlot(slot, colaboradores, catalogo);
    out.push({
      ...slot,
      servicioLinea: datos.servicioLinea,
      rowServiceNo: datos.rowServiceNo,
      puestoSugerido: datos.puestoSugerido,
    });
  }
  return out;
}
