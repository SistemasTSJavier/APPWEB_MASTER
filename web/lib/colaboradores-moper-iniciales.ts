import type { ColaboradorCompleto, MoperEstadoLinea } from "@/lib/colaboradores-types";

/** Valores mostrados como SERVICIO INICIAL / PUESTO INICIAL en MOPER (alta + últimos movimientos). */
export function getMoperInicialesParaFormulario(c: ColaboradorCompleto): MoperEstadoLinea {
  if (c.moperActual) {
    return {
      servicio:
        (
          c.moperActual.servicio.trim() ||
          c.ultimoServicio.trim() ||
          c.servicioAsignado.trim()
        ) || "",
      puesto: (c.moperActual.puesto.trim() || c.puesto.trim()) || "",
    };
  }
  return {
    servicio: (c.ultimoServicio.trim() || c.servicioAsignado.trim()) || "",
    puesto: c.puesto.trim(),
  };
}
