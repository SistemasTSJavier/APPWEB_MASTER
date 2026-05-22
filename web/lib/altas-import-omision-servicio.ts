import type { CsvFieldKey } from "@/lib/empleado-csv-map";

/** Formulario Parte 1: servicio/planta/posición desde catálogo Vacantes (Cuadrícula). */
export const ALTAS_FORM_USA_VACANTES_CUADRICULA = true;

/** Importación masiva CSV: servicio/posición siguen ignoradas (captura manual después). */
export const ALTAS_IMPORT_OMITE_SERVICIO_POSICION = true;

const CSV_KEYS_OMITIDAS: readonly CsvFieldKey[] = [
  "servicio",
  "servicioFinal",
  "noServicio",
  "posicion",
];

const FORM_KEYS_OMITIDAS = ["servicio", "servicioFinal", "noServicio", "posicion"] as const;

export function csvKeysOmitidasEnImportMasivo(): readonly CsvFieldKey[] {
  return ALTAS_IMPORT_OMITE_SERVICIO_POSICION ? CSV_KEYS_OMITIDAS : [];
}

export function omitServicioPosicionEnImportPick<T extends Partial<Record<CsvFieldKey, string>>>(
  picked: T,
): T {
  if (!ALTAS_IMPORT_OMITE_SERVICIO_POSICION) return picked;
  const out = { ...picked };
  for (const k of CSV_KEYS_OMITIDAS) delete out[k];
  return out;
}

export function formRecordSinServicioPosicionImport(form: Record<string, string>): Record<string, string> {
  if (!ALTAS_IMPORT_OMITE_SERVICIO_POSICION) return form;
  const out = { ...form };
  for (const k of FORM_KEYS_OMITIDAS) delete out[k];
  return out;
}

export function filtrarKeysPlantillaImport(keys: readonly CsvFieldKey[]): CsvFieldKey[] {
  if (!ALTAS_IMPORT_OMITE_SERVICIO_POSICION) return [...keys];
  const omit = new Set<CsvFieldKey>(CSV_KEYS_OMITIDAS);
  return keys.filter((k) => !omit.has(k));
}
