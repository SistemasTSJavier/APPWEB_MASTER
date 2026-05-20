import {
  canonicalNoServicioCatalogo,
  normPlantaCatalogo,
} from "@/lib/colaboradores-catalogo-display";
import {
  loadVacantesCatalogo,
  removeVacanteBySlot,
  type VacanteRegistro,
} from "@/lib/vacantes-catalog";
import { identificadorServicioVacante } from "@/lib/vacantes-servicio";
import type { AltaServicioContexto } from "@/lib/vacantes-slot";
import {
  normPosicionKey,
  slotFromVacanteRegistro,
  vacanteCoincideServicioAlta,
} from "@/lib/vacantes-slot";

export type { AltaServicioContexto };

/** Clave estable: N.º + nombre de servicio (no mezcla Administración / Comercial). */
export function claveServicioVacante(v: VacanteRegistro): string {
  const id = identificadorServicioVacante(v);
  return id ? `svc:${id}` : "";
}

export function vacanteCoincideClaveServicio(v: VacanteRegistro, clave: string): boolean {
  if (!clave) return false;
  return claveServicioVacante(v) === clave;
}

export type ServicioVacanteOpcion = {
  clave: string;
  servicioLinea: string;
  rowServiceNo: string;
  vacantes: number;
};

/** Servicios distintos que tienen al menos una vacante en catálogo. */
export function listarServiciosDesdeVacantes(catalogo: VacanteRegistro[]): ServicioVacanteOpcion[] {
  const map = new Map<string, ServicioVacanteOpcion>();
  for (const v of catalogo) {
    const clave = claveServicioVacante(v);
    if (!clave) continue;
    const prev = map.get(clave);
    if (prev) {
      prev.vacantes += 1;
      continue;
    }
    map.set(clave, {
      clave,
      servicioLinea: (v.servicioLinea ?? "").trim().toUpperCase() || "—",
      rowServiceNo: canonicalNoServicioCatalogo(v.rowServiceNo ?? ""),
      vacantes: 1,
    });
  }
  return [...map.values()].sort((a, b) => {
    const c = a.servicioLinea.localeCompare(b.servicioLinea, "es", { numeric: true });
    if (c !== 0) return c;
    return a.rowServiceNo.localeCompare(b.rowServiceNo, "es", { numeric: true });
  });
}

/** Plantas con vacantes para ese servicio. */
export function listarPlantasVacantesPorServicio(
  claveServicio: string,
  catalogo: VacanteRegistro[],
): string[] {
  if (!claveServicio) return [];
  const set = new Set<string>();
  for (const v of catalogo) {
    if (!vacanteCoincideClaveServicio(v, claveServicio)) continue;
    const p = normPlantaCatalogo(v.planta);
    if (p) set.add(p);
  }
  return [...set].sort((a, b) => a.localeCompare(b, "es", { numeric: true }));
}

/** Vacantes de un servicio en una planta (para elegir posición). */
export function listarVacantesPorServicioYPlanta(
  claveServicio: string,
  planta: string,
  catalogo: VacanteRegistro[],
): VacanteRegistro[] {
  const p = normPlantaCatalogo(planta);
  if (!claveServicio || !p) return [];
  return catalogo
    .filter((v) => vacanteCoincideClaveServicio(v, claveServicio) && normPlantaCatalogo(v.planta) === p)
    .sort((a, b) => a.posicion.localeCompare(b.posicion, "es", { numeric: true }));
}

export function buscarVacantePorId(id: string): VacanteRegistro | null {
  const key = id.trim();
  if (!key) return null;
  return loadVacantesCatalogo().find((v) => v.id === key) ?? null;
}

/** Vacantes del catálogo que corresponden al servicio/planta del alta. */
export function listarVacantesParaAlta(alta: AltaServicioContexto): VacanteRegistro[] {
  const planta = alta.planta.trim();
  const servicio = alta.servicioLinea.trim();
  const no = alta.rowServiceNo.trim();
  if (!planta || (!servicio && !no)) return [];

  return loadVacantesCatalogo()
    .filter((v) => vacanteCoincideServicioAlta(v, alta))
    .sort((a, b) => a.posicion.localeCompare(b.posicion, "es", { numeric: true }));
}

export function buscarVacanteAltaPorPosicion(
  alta: AltaServicioContexto,
  posicion: string,
): VacanteRegistro | null {
  const pk = normPosicionKey(posicion);
  if (!pk) return null;
  return listarVacantesParaAlta(alta).find((v) => normPosicionKey(v.posicion) === pk) ?? null;
}

/** Rellena contexto de alta desde una vacante del catálogo. */
export function datosAltaDesdeVacante(v: VacanteRegistro): {
  servicio: string;
  noServicio: string;
  planta: string;
  posicion: string;
  puesto: string;
  claveServicio: string;
} {
  return {
    servicio: (v.servicioLinea ?? "").trim().toUpperCase(),
    noServicio: (v.rowServiceNo ?? "").trim(),
    planta: normPlantaCatalogo(v.planta),
    posicion: v.posicion.trim().toUpperCase(),
    puesto: (v.puesto ?? "").trim().toUpperCase(),
    claveServicio: claveServicioVacante(v),
  };
}

/** Al guardar el alta, quita la vacante ocupada del catálogo local. */
export function consumirVacanteEnAlta(alta: AltaServicioContexto, posicion: string): boolean {
  const v = buscarVacanteAltaPorPosicion(alta, posicion);
  if (!v) return false;
  return removeVacanteBySlot(slotFromVacanteRegistro(v));
}

export function consumirVacantePorId(id: string): boolean {
  const v = buscarVacantePorId(id);
  if (!v) return false;
  return removeVacanteBySlot(slotFromVacanteRegistro(v));
}
