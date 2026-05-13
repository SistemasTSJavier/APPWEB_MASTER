import type { CsvFieldKey } from "@/lib/empleado-csv-map";

/** Tablas MySQL de colaborador expuestas como módulos en la plataforma. */
export const CSV_MYSQL_TABLES = [
  "empleado_master",
  "empleado_identidad",
  "empleado_salud",
  "empleado_nomina_reclutamiento",
  "familiar",
  "empleado_moper",
] as const;

export type CsvMysqlTable = (typeof CSV_MYSQL_TABLES)[number];

export const CSV_TABLE_LABEL: Record<CsvMysqlTable, string> = {
  empleado_master: "empleado_master",
  empleado_identidad: "empleado_identidad",
  empleado_salud: "empleado_salud",
  empleado_nomina_reclutamiento: "empleado_nomina_reclutamiento",
  familiar: "familiar",
  empleado_moper: "empleado_moper",
};

/** Columnas CSV admitidas por cada tabla (además de no_empleado donde aplique). */
export const CSV_TABLE_KEYS: Record<CsvMysqlTable, readonly CsvFieldKey[]> = {
  empleado_master: [
    "noEmpleado",
    "nombreCompleto",
    "estatusEmpleado",
    "fechaIngreso",
    "fechaBaja",
    "envio",
    "reyna",
    "reingreso",
    "puesto",
    "puestoFinal",
    "servicio",
    "servicioFinal",
    "posicion",
    "localForaneo",
    "numeroFolio",
    "escolaridad",
    "creditoInfonavit",
    "noIfe",
    "licenciaConducir",
    "cartaNoAntecedentes",
    "idiomas",
    "ultimoServicio",
    "registradoAt",
  ],
  empleado_identidad: [
    "noEmpleado",
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
    "domicilio",
    "telefono",
    "telefonoCasa",
    "telefonoPersonalCasa",
    "escolaridad",
  ],
  empleado_salud: [
    "noEmpleado",
    "estaturaPeso",
    "tipoSangre",
    "alergicoA",
    "enfermedadTratamiento",
    "diabetico",
    "hipertenso",
    "emergenciaNombre",
    "emergenciaTelefono",
  ],
  empleado_nomina_reclutamiento: [
    "noEmpleado",
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
  familiar: ["noEmpleado", "nombreFamiliar", "parentescoCsv", "fechaNacimientoFamiliar", "beneficiarioBancario"],
  empleado_moper: ["noEmpleado", "moper1", "moper2", "moper3", "moper4", "moper5", "moper6", "moper7"],
};

export function pickFieldsForTable(
  row: Partial<Record<CsvFieldKey, string>>,
  table: CsvMysqlTable,
): Partial<Record<CsvFieldKey, string>> {
  const out: Partial<Record<CsvFieldKey, string>> = {};
  for (const k of CSV_TABLE_KEYS[table]) {
    if (row[k] !== undefined) out[k] = row[k];
  }
  return out;
}

export function isCsvMysqlTable(s: string): s is CsvMysqlTable {
  return (CSV_MYSQL_TABLES as readonly string[]).includes(s);
}

/** Campos de empleado_master en CSV (sin no_empleado), para detectar si la fila trae datos master. */
const MASTER_DATA_KEYS = CSV_TABLE_KEYS.empleado_master.filter((k) => k !== "noEmpleado");

export function hasMasterCsvData(fields: Partial<Record<CsvFieldKey, string>>): boolean {
  return MASTER_DATA_KEYS.some((k) => fields[k] !== undefined);
}

/** Orden sugerido de columnas para plantilla CSV única (sin repetir no_empleado). */
export function getCompletoCsvFieldKeys(): CsvFieldKey[] {
  const seen = new Set<CsvFieldKey>();
  const out: CsvFieldKey[] = [];
  for (const table of CSV_MYSQL_TABLES) {
    for (const k of CSV_TABLE_KEYS[table]) {
      if (!seen.has(k)) {
        seen.add(k);
        out.push(k);
      }
    }
  }
  return out;
}
