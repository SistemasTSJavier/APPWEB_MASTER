import { aplicarUnSoloCampoColaborador } from "@/lib/altas-un-campo";
import { parseCorreccionCsvDosColumnas } from "@/lib/altas-csv-correccion-dos-columnas";
import { normalizeNoEmpleado } from "@/lib/colaboradores-normalize";
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
 * Aplica CSV de corrección (2 columnas) en memoria contra un mapa ya cargado.
 * Si el mismo N° aparece varias veces, gana la última fila.
 */
export function procesarCorreccionCsvDosColumnasEnMemoria(
  csvText: string,
  byNo: Map<string, ColaboradorCompleto>,
): CorreccionDosColumnasProcessResult {
  const parsed = parseCorreccionCsvDosColumnas(csvText);
  if (!parsed.ok) {
    return { ok: false, errors: parsed.errors };
  }

  const toWrite = new Map<string, ColaboradorCompleto>();
  const avisos: string[] = [];
  let sinExpediente = 0;
  const campo = parsed.fieldKey;

  for (const { noEmpleado, valor } of parsed.rows) {
    const no = normalizeNoEmpleado(noEmpleado);
    const prev = toWrite.get(no) ?? byNo.get(no);
    if (!prev) {
      sinExpediente++;
      if (avisos.length < 200) {
        avisos.push(`${no}: SIN EXPEDIENTE`);
      }
      continue;
    }
    try {
      const next = aplicarUnSoloCampoColaborador(prev, campo, valor);
      toWrite.set(no, { ...next, registeredAt: prev.registeredAt });
    } catch (err) {
      if (avisos.length < 200) {
        avisos.push(`${no}: ${err instanceof Error ? err.message : String(err)}`);
      }
    }
  }

  const updated = [...toWrite.values()];
  return {
    ok: true,
    fieldKey: campo,
    updated,
    actualizados: updated.length,
    sinExpediente,
    avisos,
  };
}
