import { ALTAS_ETIQUETA_PARTE_IMPORT } from "@/lib/altas-import-partes";

/**
 * Claves del objeto `form` del colaborador, alineadas con cada parte del modulo ALTAS / import por parte.
 */
export const ALTAS_FORM_KEYS_PARTE: Record<number, readonly string[]> = {
  1: [
    "noEmpleado1",
    "fechaIngreso",
    "fechaBaja",
    "envio",
    "reyna",
    "reingreso",
    "nombreCompleto",
    "puesto",
    "servicio",
    "posicion",
    "localForaneo",
    "numeroFolio",
    "creditoInfonavit",
    "escolaridad",
    "licenciaConducir",
    "cartaNoAntecedentes",
    "idiomas",
    "estatusEmpleado",
    "puestoFinal",
    "servicioFinal",
    "registeredAt",
    "fechaRenuncia",
    "ultimoDiaLaborado",
    "motivoSeparacion",
    "especificacion",
    "comentarioBaja",
  ],
  2: [
    "apellidoPaterno",
    "apellidoMaterno",
    "nombres",
    "fechaNacimiento",
    "edad",
    "estadoCivil",
    "curp",
    "rfc",
    "noIfe",
    "imss",
    "codigoPostal",
    "estadoNatal",
    "direccionCompleta",
    "telefonoPersonalCasa",
  ],
  3: [
    "estaturaPeso",
    "tipoSangre",
    "alergicoA",
    "enfermedadTratamiento",
    "diabetico",
    "hipertenso",
    "emergenciaLlamarA",
    "telefonoEmergencia",
  ],
  4: [
    "banco",
    "numeroCuenta",
    "clabeInterbancaria",
    "noTarjeta",
    "sueldoMensual",
    "fuenteReclutamiento",
    "gestorProceso",
    "estudioSocioeconomico",
    "documentacionOriginal",
  ],
  5: [],
  6: ["moper1", "moper2", "moper3", "moper4", "moper5", "moper6", "moper7", "ultimoServicio"],
};

const LABELS: Record<string, string> = {
  noEmpleado1: "NO DE EMPLEADO",
  fechaIngreso: "FECHA DE INGRESO",
  fechaBaja: "FECHA DE BAJA",
  envio: "ENVIO",
  reyna: "REYNA",
  reingreso: "REINGRESO",
  nombreCompleto: "NOMBRE COMPLETO",
  puesto: "PUESTO",
  servicio: "SERVICIO (CLIENTE/LUGAR)",
  posicion: "POSICION",
  localForaneo: "LOCAL/FORANEO",
  numeroFolio: "NUMERO DE EXPEDIENTE",
  creditoInfonavit: "CREDITO INFONAVIT",
  noIfe: "NO. INE / IFE",
  licenciaConducir: "LICENCIA DE CONDUCIR",
  cartaNoAntecedentes: "CARTA NO ANTECEDENTES / NO PENALES",
  idiomas: "IDIOMAS EXTERNOS",
  estatusEmpleado: "ESTATUS EMPLEADO",
  puestoFinal: "PUESTO FINAL",
  servicioFinal: "SERVICIO FINAL",
  registeredAt: "REGISTRADO EN (EXPEDIENTE)",
  fechaRenuncia: "FECHA DE RENUNCIA",
  ultimoDiaLaborado: "ULTIMO DIA LABORADO",
  motivoSeparacion: "MOTIVO DE SEPARACION",
  especificacion: "ESPECIFICACION (BAJA)",
  comentarioBaja: "COMENTARIO (BAJA)",
  apellidoPaterno: "APELLIDO PATERNO",
  apellidoMaterno: "APELLIDO MATERNO",
  nombres: "NOMBRE(S)",
  fechaNacimiento: "FECHA DE NACIMIENTO",
  edad: "EDAD",
  estadoCivil: "ESTADO CIVIL",
  curp: "CURP",
  rfc: "RFC",
  imss: "IMSS",
  codigoPostal: "CODIGO POSTAL",
  estadoNatal: "ESTADO NATAL",
  direccionCompleta: "ESTADO / MUNICIPIO / COLONIA / CALLE Y NUMERO",
  telefonoPersonalCasa: "TELEFONO PERSONAL / CASA",
  escolaridad: "ESCOLARIDAD",
  estaturaPeso: "ESTATURA/PESO",
  tipoSangre: "TIPO DE SANGRE",
  alergicoA: "ALERGICO A",
  enfermedadTratamiento: "ENFERMEDAD / TRATAMIENTO",
  diabetico: "DIABETICO",
  hipertenso: "HIPERTENSO",
  emergenciaLlamarA: "EN EMERGENCIA LLAMAR A",
  telefonoEmergencia: "TELEFONO DE EMERGENCIA",
  banco: "BANCO",
  numeroCuenta: "NO. CUENTA",
  clabeInterbancaria: "CLABE INTERBANCARIA",
  noTarjeta: "NO. TARJETA",
  sueldoMensual: "SUELDO MENSUAL",
  fuenteReclutamiento: "FUENTE DE RECLUTAMIENTO",
  gestorProceso: "GESTOR DEL PROCESO",
  estudioSocioeconomico: "ESTUDIO SOCIOECONOMICO",
  documentacionOriginal: "DOCUMENTACION ORIGINAL (CONTABILIDAD)",
  moper1: "MOPER 1",
  moper2: "MOPER 2",
  moper3: "MOPER 3",
  moper4: "MOPER 4",
  moper5: "MOPER 5",
  moper6: "MOPER 6",
  moper7: "MOPER 7",
  ultimoServicio: "ULTIMO SERVICIO (FORMULARIO)",
};

export function etiquetaCampoExpediente(key: string): string {
  if (LABELS[key]) return LABELS[key];
  return key
    .replace(/([A-Z])/g, " $1")
    .replace(/_/g, " ")
    .trim()
    .toUpperCase();
}

export type FormParteGrupo = {
  parte: number;
  titulo: string;
  entries: Array<{ key: string; label: string; value: string }>;
};

/** Agrupa entradas no vacias del expediente por parte ALTAS. El sobrante va a "Otros campos". */
export function groupFormByAltasPartes(form: Record<string, string>): FormParteGrupo[] {
  const used = new Set<string>();
  const out: FormParteGrupo[] = [];

  for (let p = 1; p <= 6; p++) {
    const keys = ALTAS_FORM_KEYS_PARTE[p] ?? [];
    const entries: FormParteGrupo["entries"] = [];
    for (const k of keys) {
      const raw = form[k];
      if (raw === undefined || String(raw).trim() === "") continue;
      used.add(k);
      entries.push({ key: k, label: etiquetaCampoExpediente(k), value: String(raw) });
    }
    if (entries.length > 0) {
      out.push({
        parte: p,
        titulo: ALTAS_ETIQUETA_PARTE_IMPORT[p] ?? `PARTE ${p}`,
        entries,
      });
    }
  }

  const otros: FormParteGrupo["entries"] = [];
  for (const [k, v] of Object.entries(form)) {
    if (used.has(k) || String(v ?? "").trim() === "") continue;
    otros.push({ key: k, label: etiquetaCampoExpediente(k), value: String(v) });
  }
  if (otros.length > 0) {
    out.push({
      parte: 0,
      titulo: "OTROS CAMPOS (IMPORT / LEGACY)",
      entries: otros,
    });
  }

  return out;
}
