import {
  elegirMejorCoincidenciaPorNombre,
  findColaboradoresPorNombreExacto,
  normalizarNombreParaCoincidencia,
} from "@/lib/altas-coincidencia-nombre";
import { calcularSiguienteNoEmpleado } from "@/lib/altas-form-catalogo";
import type { ColaboradorCompleto } from "@/lib/colaboradores-types";
import type { CsvFieldKey } from "@/lib/empleado-csv-map";

export type ColaboradoresImportIndexes = {
  byNo: Map<string, ColaboradorCompleto>;
  /** Nombre normalizado → expedientes en BD con ese nombre. */
  byNombre: Map<string, ColaboradorCompleto[]>;
};

export type ColaboradorImportIdentidadResuelta = {
  noEmpleado: string;
  /** Expediente previo en BD (para mezclar si aplica). */
  existing: ColaboradorCompleto | null;
  matchedBy: "nombre_bd" | "nombre_lote" | "no_csv" | "curp" | "imss" | "rfc" | "auto_numerico";
  /** Aviso no fatal (se muestra en resumen del import). */
  aviso?: string;
};

const MIN_NOMBRE_NORM = 8;

function normalizeNo(no: string | undefined | null): string {
  return String(no ?? "").trim().toUpperCase();
}

function g(m: Partial<Record<CsvFieldKey, string>>, k: CsvFieldKey): string {
  return (m[k] ?? "").trim();
}

export function buildColaboradoresImportIndexes(list: ColaboradorCompleto[]): ColaboradoresImportIndexes {
  const byNo = new Map<string, ColaboradorCompleto>();
  const byNombre = new Map<string, ColaboradorCompleto[]>();

  for (const c of list) {
    const no = normalizeNo(c.noEmpleado);
    if (no) byNo.set(no, c);
    const norm = normalizarNombreParaCoincidencia(c.nombreCompleto ?? "");
    if (norm.length >= MIN_NOMBRE_NORM) {
      const bucket = byNombre.get(norm) ?? [];
      bucket.push(c);
      byNombre.set(norm, bucket);
    }
  }

  return { byNo, byNombre };
}

/** Siguiente N° numerico libre (expedientes en BD + filas ya asignadas en el mismo CSV). */
export class AutoNoEmpleadoImportMasivo {
  private next: number;

  constructor(existing: ColaboradorCompleto[], yaAsignadosEnLote: ColaboradorCompleto[] = []) {
    const base = calcularSiguienteNoEmpleado([...existing, ...yaAsignadosEnLote]);
    const n = Number.parseInt(base, 10);
    this.next = Number.isFinite(n) && n > 0 ? n : 1;
  }

  tomar(): string {
    const candidato = String(this.next);
    this.next += 1;
    return candidato;
  }
}

function noAlternativoDesdeIdentidad(fieldMap: Partial<Record<CsvFieldKey, string>>): {
  no: string;
  matchedBy: ColaboradorImportIdentidadResuelta["matchedBy"];
} | null {
  const curp = g(fieldMap, "curp").replace(/\s/g, "").toUpperCase();
  if (curp.length >= 10) return { no: curp, matchedBy: "curp" };

  const imss = g(fieldMap, "imss").replace(/\D/g, "");
  if (imss.length >= 8) return { no: imss, matchedBy: "imss" };

  const rfc = g(fieldMap, "rfc").replace(/\s/g, "").toUpperCase();
  if (rfc.length >= 10) return { no: rfc, matchedBy: "rfc" };

  return null;
}

/**
 * Prioridad: nombre completo → N° ya usado en el mismo CSV → N° del CSV → CURP/IMSS/RFC → N° auto.
 */
export function resolverIdentidadFilaImportMasivo(args: {
  nombreCompleto: string;
  noCsv: string;
  fieldMap: Partial<Record<CsvFieldKey, string>>;
  indexes: ColaboradoresImportIndexes;
  /** Nombre normalizado → N° asignado antes en este archivo. */
  loteByNombre: Map<string, string>;
  autoNo: AutoNoEmpleadoImportMasivo;
  rowLabel: number;
}): ColaboradorImportIdentidadResuelta | null {
  const { nombreCompleto, noCsv, fieldMap, indexes, loteByNombre, autoNo, rowLabel } = args;
  const nombreNorm = normalizarNombreParaCoincidencia(nombreCompleto);
  const noFromCsv = normalizeNo(noCsv);

  if (nombreNorm.length >= MIN_NOMBRE_NORM) {
    const enLote = loteByNombre.get(nombreNorm);
    if (enLote) {
      const existing = indexes.byNo.get(enLote) ?? null;
      return {
        noEmpleado: enLote,
        existing,
        matchedBy: "nombre_lote",
        aviso:
          noFromCsv && noFromCsv !== enLote
            ? `FILA ${rowLabel}: MISMO NOMBRE EN CSV; SE REUTILIZA N° ${enLote}${noFromCsv ? ` (CSV TRAIA ${noFromCsv})` : ""}.`
            : undefined,
      };
    }

    const matches = indexes.byNombre.get(nombreNorm) ?? findColaboradoresPorNombreExacto(
      [...indexes.byNo.values()],
      nombreCompleto,
    );
    if (matches.length > 0) {
      const pick = elegirMejorCoincidenciaPorNombre(matches, noFromCsv) ?? matches[0]!;
      const no = normalizeNo(pick.noEmpleado);
      return {
        noEmpleado: no,
        existing: pick,
        matchedBy: "nombre_bd",
        aviso:
          noFromCsv && noFromCsv !== no
            ? `FILA ${rowLabel}: COINCIDENCIA POR NOMBRE; SE USO N° ${no} (CSV TRAIA ${noFromCsv}).`
            : matches.length > 1
              ? `FILA ${rowLabel}: VARIOS EXPEDIENTES CON EL MISMO NOMBRE; SE TOMO N° ${no}.`
              : undefined,
      };
    }
  }

  if (noFromCsv) {
    return {
      noEmpleado: noFromCsv,
      existing: indexes.byNo.get(noFromCsv) ?? null,
      matchedBy: "no_csv",
    };
  }

  const alt = noAlternativoDesdeIdentidad(fieldMap);
  if (alt) {
    const no = normalizeNo(alt.no);
    return {
      noEmpleado: no,
      existing: indexes.byNo.get(no) ?? null,
      matchedBy: alt.matchedBy,
      aviso: `FILA ${rowLabel}: SIN N° EN CSV; SE USO ${alt.matchedBy.toUpperCase()} COMO CLAVE (${no}).`,
    };
  }

  if (nombreNorm.length >= 4) {
    const no = autoNo.tomar();
    return {
      noEmpleado: no,
      existing: null,
      matchedBy: "auto_numerico",
      aviso: `FILA ${rowLabel}: SIN N° NI CLAVE; SE ASIGNO N° AUTO ${no} POR NOMBRE.`,
    };
  }

  return null;
}

export { MIN_NOMBRE_NORM, normalizarNombreParaCoincidencia };
