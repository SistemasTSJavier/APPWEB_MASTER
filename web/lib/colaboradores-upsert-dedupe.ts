import type { ColaboradorCompleto } from "@/lib/colaboradores-types";
import { normalizarNombreParaCoincidencia } from "@/lib/altas-coincidencia-nombre";

const MIN_NOMBRE_DEDUPE = 8;

/**
 * PostgreSQL no permite el mismo `no_empleado` dos veces en un solo `INSERT … ON CONFLICT`.
 * Prioridad de clave: **nombre normalizado** (si alcanza longitud mínima), luego N° empleado.
 * La última fila gana.
 */
export function dedupeColaboradoresUpsertLastWins(payloads: ColaboradorCompleto[]): {
  unique: ColaboradorCompleto[];
  duplicateRowsMerged: number;
} {
  const byNombre = new Map<string, ColaboradorCompleto>();
  const byNo = new Map<string, ColaboradorCompleto>();

  for (const p of payloads) {
    const no = String(p.noEmpleado ?? "").trim().toUpperCase();
    const nombreNorm = normalizarNombreParaCoincidencia(p.nombreCompleto ?? "");

    if (nombreNorm.length >= MIN_NOMBRE_DEDUPE) {
      const prev = byNombre.get(nombreNorm);
      if (prev) byNo.delete(String(prev.noEmpleado ?? "").trim().toUpperCase());
      byNombre.set(nombreNorm, p);
    }

    if (no) byNo.set(no, p);
  }

  const uniqueByNo = new Map<string, ColaboradorCompleto>();
  for (const p of byNombre.values()) {
    const no = String(p.noEmpleado ?? "").trim().toUpperCase();
    if (no) uniqueByNo.set(no, p);
  }
  for (const [no, p] of byNo) {
    if (!uniqueByNo.has(no)) uniqueByNo.set(no, p);
  }

  const unique = [...uniqueByNo.values()];
  return {
    unique,
    duplicateRowsMerged: Math.max(0, payloads.length - unique.length),
  };
}
