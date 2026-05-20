import type { ColaboradorCompleto } from "@/lib/colaboradores-types";
import { colaboradorTieneBaja } from "@/lib/colaboradores-baja";
import { servicioLineaColaborador } from "@/lib/servicio-agrupacion";
import {
  canonicalNoServicioCatalogo,
  plantaExpedienteColaborador,
  posicionLaboralColaborador,
} from "@/lib/colaboradores-catalogo-display";
import { reconciliarServicioVacante } from "@/lib/vacantes-servicio";
import type { CatalogoServicioItem } from "@/lib/servicios-catalogo-client";
import {
  addVacanteRegistro,
  loadVacantesCatalogo,
  type VacanteRegistro,
} from "@/lib/vacantes-catalog";
import { slotFromVacanteRegistro, slotVacanteKey } from "@/lib/vacantes-slot";

export type RegistrarVacanteBajaResult = {
  ok: boolean;
  creada: boolean;
  motivo?: string;
  registro?: VacanteRegistro;
};

export type VacanteDesdeBajaDatos = {
  planta: string;
  posicion: string;
  puesto?: string;
  servicioLinea?: string;
  rowServiceNo?: string;
};

/** Planta, servicio y posición del expediente para el catálogo de vacantes. */
export function datosVacanteDesdeColaboradorBaja(
  c: ColaboradorCompleto,
  catalogo: CatalogoServicioItem[] = [],
): VacanteDesdeBajaDatos | null {
  const planta = plantaExpedienteColaborador(c).trim().toUpperCase();
  const posicion = posicionLaboralColaborador(c, catalogo).trim().toUpperCase();
  if (!planta || !posicion) return null;

  const lineaExp = servicioLineaColaborador(c);
  const noExp = canonicalNoServicioCatalogo(String(c.form?.noServicio ?? ""));
  const { servicioLinea, rowServiceNo } = reconciliarServicioVacante(
    { planta, servicioLinea: lineaExp, rowServiceNo: noExp },
    catalogo,
  );
  const puesto =
    (c.puesto ?? String(c.form?.puesto ?? "")).trim().toUpperCase() || undefined;

  return {
    planta,
    posicion,
    puesto,
    servicioLinea: servicioLinea || undefined,
    rowServiceNo: rowServiceNo || undefined,
  };
}

function notaVacantePorBaja(c: ColaboradorCompleto): string {
  const no = c.noEmpleado.trim().toUpperCase();
  const fb = String(c.form?.fechaBaja ?? "").trim();
  if (no && fb) return `Vacante por baja — ${no} (${fb})`;
  if (no) return `Vacante por baja — ${no}`;
  return "Vacante por baja";
}

/**
 * Al dar de baja, registra la posición en el catálogo de vacantes (local)
 * para que Altas pueda asignarla en un reingreso.
 */
export function registrarVacantePorBajaColaborador(
  c: ColaboradorCompleto,
  catalogo: CatalogoServicioItem[] = [],
): RegistrarVacanteBajaResult {
  if (!colaboradorTieneBaja(c)) {
    return { ok: false, creada: false, motivo: "El colaborador no tiene fecha de baja." };
  }

  const datos = datosVacanteDesdeColaboradorBaja(c, catalogo);
  if (!datos) {
    return {
      ok: false,
      creada: false,
      motivo: "No hay planta o posición laboral en el expediente.",
    };
  }

  const sk = slotVacanteKey(datos);
  const yaRegistrada = loadVacantesCatalogo().some(
    (v) => slotVacanteKey(slotFromVacanteRegistro(v)) === sk,
  );
  if (yaRegistrada) {
    return { ok: true, creada: false, motivo: "La vacante ya estaba en el catálogo." };
  }

  const registro = addVacanteRegistro(
    {
      ...datos,
      notas: notaVacantePorBaja(c),
    },
    catalogo,
  );
  if (!registro) {
    return {
      ok: false,
      creada: false,
      motivo: "No se pudo guardar la vacante (almacenamiento local bloqueado).",
    };
  }

  return { ok: true, creada: true, registro };
}
