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
  if (result.ignoredUnknownNo > 0) {
    avisos.unshift(
      `${result.ignoredUnknownNo} FILA(S) CON N° SIN EXPEDIENTE (NO SE ACTUALIZARON). REVISE FORMATO DEL N° (EJ. SIN .0 DE EXCEL).`,
    );
  }

  return {
    ok: true,
    fieldKey: result.dataFieldKey,
    updated: result.updated,
    actualizados: result.updated.length,
    sinExpediente: result.ignoredUnknownNo,
    avisos: avisos.slice(0, 200),
  };
}

export { mapaColaboradoresPorNo };
