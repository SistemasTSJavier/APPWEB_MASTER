import type { ColaboradorCompleto } from "@/lib/colaboradores-types";
import { limpiarPosicionDuplicadaDeNoServicio } from "@/lib/colaboradores-catalogo-display";
import { normalizarFechaParaInputDate } from "@/lib/fecha-input-normalize";

/** Campos editables solo con N° de empleado (panel admin en Altas). */
export const ALTAS_CAMPOS_UNA_COLUMNA: { id: string; label: string; esFecha?: boolean }[] = [
  { id: "nombreCompleto", label: "Nombre completo" },
  { id: "fechaIngreso", label: "Fecha de ingreso", esFecha: true },
  { id: "fechaBaja", label: "Fecha de baja", esFecha: true },
  { id: "reingreso", label: "Reingreso", esFecha: true },
  { id: "servicio", label: "Servicio (Parte 1 / alta)" },
  { id: "noServicio", label: "N.º servicio (Parte 1)" },
  { id: "planta", label: "Planta (Parte 1)" },
  { id: "puesto", label: "Puesto" },
  { id: "posicion", label: "Posicion" },
  { id: "imss", label: "IMSS (NSS en expediente)" },
  { id: "ultimoServicio", label: "Ultimo servicio (linea expediente)" },
  { id: "envio", label: "Envio" },
  { id: "reyna", label: "Reyna" },
  { id: "numeroFolio", label: "Numero de expediente" },
  { id: "curp", label: "CURP" },
  { id: "rfc", label: "RFC" },
  { id: "telefonoPersonalCasa", label: "Telefono personal / casa" },
  { id: "banco", label: "Banco" },
  { id: "numeroCuenta", label: "Numero de cuenta" },
  { id: "clabeInterbancaria", label: "CLABE interbancaria" },
  { id: "noTarjeta", label: "Numero de tarjeta" },
  { id: "sueldoMensual", label: "Sueldo mensual" },
];

/**
 * Aplica un unico valor al expediente existente sin tocar el resto de `form` ni familiares.
 * Mantiene `registeredAt` y fusiona claves relacionadas (ingreso, servicio/puesto MOPER, NSS).
 */
export function aplicarUnSoloCampoColaborador(
  existing: ColaboradorCompleto,
  campo: string,
  valorRaw: string,
): ColaboradorCompleto {
  const valor = valorRaw.trim();
  const form = { ...existing.form };

  if (campo === "nombreCompleto") {
    form.nombreCompleto = valor;
    return { ...existing, nombreCompleto: valor, form };
  }
  if (campo === "fechaIngreso") {
    const n = normalizarFechaParaInputDate(valor) || valor;
    form.fechaIngreso = n;
    return { ...existing, fechaIngreso: n || existing.fechaIngreso, form };
  }
  if (campo === "fechaBaja" || campo === "reingreso") {
    const n = normalizarFechaParaInputDate(valor) || valor;
    form[campo] = n;
    return { ...existing, form };
  }
  if (campo === "servicio") {
    form.servicio = valor;
    form.servicioFinal = valor;
    form.ultimoServicio = valor;
    const p = existing.moperActual?.puesto ?? existing.puesto;
    return {
      ...existing,
      servicioAsignado: valor,
      ultimoServicio: valor,
      form,
      moperActual: { servicio: valor, puesto: p },
    };
  }
  if (campo === "puesto") {
    form.puesto = valor;
    form.puestoFinal = valor;
    const s = existing.moperActual?.servicio ?? existing.servicioAsignado;
    return {
      ...existing,
      puesto: valor,
      form,
      moperActual: { servicio: s, puesto: valor },
    };
  }
  if (campo === "posicion") {
    return { ...existing, posicion: valor, form: { ...form, posicion: valor } };
  }
  if (campo === "noServicio") {
    form.noServicio = valor;
    return limpiarPosicionDuplicadaDeNoServicio({ ...existing, form }, valor);
  }
  if (campo === "planta") {
    form.planta = valor;
    return { ...existing, form };
  }
  if (campo === "imss") {
    form.imss = valor;
    return { ...existing, nss: valor, form };
  }
  if (campo === "ultimoServicio") {
    form.ultimoServicio = valor;
    return { ...existing, ultimoServicio: valor, form };
  }

  form[campo] = valor;
  return { ...existing, form };
}
