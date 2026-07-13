import type { ColaboradorCompleto } from "@/lib/colaboradores-types";
import { limpiarPosicionDuplicadaDeNoServicio } from "@/lib/colaboradores-catalogo-display";
import { normalizarFechaParaInputDate } from "@/lib/fecha-input-normalize";
import {
  alinearColaboradorTrasImportColumnaPuesto,
  alinearColaboradorTrasImportColumnaServicio,
} from "@/lib/servicio-agrupacion";

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
 * Actualiza también snapshots (`servicioAsignado`, `moperActual`, etc.) para que la lista
 * de Colaboradores refleje el cambio (sobre todo servicio y puesto).
 *
 * Pensado para corrección CSV de 2 columnas: NO respeta la omisión del import masivo.
 */
export function aplicarUnSoloCampoColaborador(
  existing: ColaboradorCompleto,
  campoRaw: string,
  valorRaw: string,
): ColaboradorCompleto {
  const campo = mapCampoCorreccion(campoRaw);
  const valor = valorRaw.trim();
  const form = { ...existing.form };
  const no = existing.noEmpleado.trim().toUpperCase();

  if (campo === "nombreCompleto") {
    form.nombreCompleto = valor;
    return { ...existing, noEmpleado: no, nombreCompleto: valor, form: { ...form, noEmpleado1: no } };
  }
  if (campo === "fechaIngreso") {
    const n = normalizarFechaParaInputDate(valor) || valor;
    form.fechaIngreso = n;
    return {
      ...existing,
      noEmpleado: no,
      fechaIngreso: n || existing.fechaIngreso,
      form: { ...form, noEmpleado1: no },
    };
  }
  if (campo === "fechaBaja" || campo === "reingreso") {
    const n = normalizarFechaParaInputDate(valor) || valor;
    form[campo] = n;
    return { ...existing, noEmpleado: no, form: { ...form, noEmpleado1: no } };
  }
  if (campo === "fechaNacimiento") {
    const n = normalizarFechaParaInputDate(valor) || valor;
    form.fechaNacimiento = n;
    return { ...existing, noEmpleado: no, form: { ...form, noEmpleado1: no } };
  }

  // Servicio / servicioFinal / ultimoServicio → alinear línea vigente (moper + snapshots)
  if (campo === "servicio" || campo === "servicioFinal") {
    const aligned = alinearColaboradorTrasImportColumnaServicio(existing, valor);
    return {
      ...aligned,
      noEmpleado: no,
      form: { ...aligned.form, noEmpleado1: no },
    };
  }
  if (campo === "ultimoServicio") {
    const aligned = alinearColaboradorTrasImportColumnaServicio(existing, valor);
    return {
      ...aligned,
      noEmpleado: no,
      ultimoServicio: valor,
      form: { ...aligned.form, ultimoServicio: valor, noEmpleado1: no },
    };
  }

  if (campo === "puesto" || campo === "puestoFinal") {
    const aligned = alinearColaboradorTrasImportColumnaPuesto(existing, valor);
    return {
      ...aligned,
      noEmpleado: no,
      form: { ...aligned.form, noEmpleado1: no },
    };
  }

  if (campo === "posicion") {
    return {
      ...existing,
      noEmpleado: no,
      posicion: valor,
      form: { ...form, posicion: valor, noEmpleado1: no },
    };
  }
  if (campo === "noServicio") {
    form.noServicio = valor;
    const cleaned = limpiarPosicionDuplicadaDeNoServicio(
      { ...existing, noEmpleado: no, form: { ...form, noEmpleado1: no } },
      valor,
    );
    return cleaned;
  }
  if (campo === "planta") {
    form.planta = valor;
    return { ...existing, noEmpleado: no, form: { ...form, noEmpleado1: no } };
  }
  if (campo === "imss") {
    form.imss = valor;
    return { ...existing, noEmpleado: no, nss: valor, form: { ...form, noEmpleado1: no } };
  }
  if (campo === "localForaneo") {
    form.localForaneo = valor;
    return { ...existing, noEmpleado: no, form: { ...form, noEmpleado1: no } };
  }
  if (campo === "numeroFolio") {
    form.numeroFolio = valor;
    return { ...existing, noEmpleado: no, form: { ...form, noEmpleado1: no } };
  }

  // Teléfonos: varias claves CSV → un campo de form
  if (
    campo === "telefonoPersonalCasa" ||
    campo === "telefono" ||
    campo === "telefonoCasa"
  ) {
    form.telefonoPersonalCasa = valor;
    return { ...existing, noEmpleado: no, form: { ...form, noEmpleado1: no } };
  }
  if (campo === "emergenciaLlamarA") {
    form.emergenciaNombre = valor;
    form.emergenciaLlamarA = valor;
    return { ...existing, noEmpleado: no, form: { ...form, noEmpleado1: no } };
  }
  if (campo === "telefonoEmergencia") {
    form.emergenciaTelefono = valor;
    form.telefonoEmergencia = valor;
    return { ...existing, noEmpleado: no, form: { ...form, noEmpleado1: no } };
  }

  // Cualquier otro campo reconocido → solo form (CURP, RFC, banco, etc.)
  form[campo] = valor;
  return { ...existing, noEmpleado: no, form: { ...form, noEmpleado1: no } };
}

/** Normaliza alias de cabecera CSV a clave de corrección. */
function mapCampoCorreccion(campoRaw: string): string {
  const c = String(campoRaw ?? "").trim();
  if (c === "servicioFinal") return "servicio";
  if (c === "puestoFinal") return "puesto";
  return c;
}
