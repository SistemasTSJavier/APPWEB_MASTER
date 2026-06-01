import {
  mapaColaboradoresPorNo,
  procesarCsvActualizacionUnaColumna,
} from "@/lib/colaboradores-csv-columna-import";
import type { ColaboradorCompleto } from "@/lib/colaboradores-types";

export type CorreccionDosColumnasProcessOk = {
  ok: true;
  fieldKey: string;
  updated: ColaboradorCompleto[];
  actualizados: number;
  sinExpediente: number;
  omitidosSinExpediente: string[];
  avisos: string[];
};

export type CorreccionDosColumnasProcessErr = { ok: false; errors: string[] };

export type CorreccionDosColumnasProcessResult =
  | CorreccionDosColumnasProcessOk
  | CorreccionDosColumnasProcessErr;

/**
 * CSV de corrección (N° empleado + un campo): misma lógica que importación por columna en Colaboradores.
 */
export function procesarCorreccionCsvDosColumnasEnMemoria(
  csvText: string,
  byNo: Map<string, ColaboradorCompleto>,
): CorreccionDosColumnasProcessResult {
  const result = procesarCsvActualizacionUnaColumna(csvText, byNo);
  if (!result.ok) {
    return { ok: false, errors: [result.message] };
  }

  const avisos: string[] = result.errors.map((e) => `FILA ${e.row}: ${e.message}`);

  return {
    ok: true,
    fieldKey: result.dataFieldKey,
    updated: result.updated,
    actualizados: result.updated.length,
    sinExpediente: result.ignoredUnknownNo,
    omitidosSinExpediente: result.omitidosSinExpediente,
    avisos: avisos.slice(0, 200),
  };
}

export { mapaColaboradoresPorNo };
