import type { ColaboradorCompleto } from "@/lib/colaboradores-types";

/**
 * PostgreSQL no permite el mismo `no_empleado` dos veces en un solo `INSERT … ON CONFLICT`.
 * Si el lote trae duplicados, la última fila gana para ese número.
 */
export function dedupeColaboradoresUpsertLastWins(payloads: ColaboradorCompleto[]): {
  unique: ColaboradorCompleto[];
  duplicateRowsMerged: number;
} {
  const byNo = new Map<string, ColaboradorCompleto>();
  for (const p of payloads) {
    const no = String(p.noEmpleado ?? "").trim().toUpperCase();
    if (!no) continue;
    byNo.set(no, p);
  }
  const unique = [...byNo.values()];
  return {
    unique,
    duplicateRowsMerged: Math.max(0, payloads.length - unique.length),
  };
}
