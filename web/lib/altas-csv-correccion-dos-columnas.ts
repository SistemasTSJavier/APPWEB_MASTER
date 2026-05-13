import { parseCsvContent, canonCsvHeader } from "@/lib/csv";
import type { CsvFieldKey } from "@/lib/empleado-csv-map";
import { resolveFieldKeyFromCanonHeader } from "@/lib/empleado-csv-map";

export type ParseCorreccionCsvDosColumnasOk = {
  ok: true;
  /** Clave interna del campo a actualizar (misma que usa `aplicarUnSoloCampoColaborador`). */
  fieldKey: CsvFieldKey;
  rows: { noEmpleado: string; valor: string }[];
};

export type ParseCorreccionCsvDosColumnasErr = { ok: false; errors: string[] };

export type ParseCorreccionCsvDosColumnasResult = ParseCorreccionCsvDosColumnasOk | ParseCorreccionCsvDosColumnasErr;

/**
 * CSV de corrección mínimo: exactamente dos columnas con encabezado reconocible.
 * Una debe ser número de empleado; la otra, cualquier campo mapeable (mismas cabeceras que el import masivo).
 */
export function parseCorreccionCsvDosColumnas(text: string): ParseCorreccionCsvDosColumnasResult {
  const stripped = text.replace(/^\uFEFF/, "").trim();
  if (!stripped) {
    return { ok: false, errors: ["ARCHIVO VACIO."] };
  }

  const rows = parseCsvContent(stripped);
  if (rows.length < 2) {
    return {
      ok: false,
      errors: ["EL CSV DEBE TENER ENCABEZADO Y AL MENOS UNA FILA DE DATOS."],
    };
  }

  const headerCells = rows[0]!.map((c) => String(c ?? "").trim());
  const unknown: string[] = [];
  const mapped: { colIndex: number; rawHeader: string; field: CsvFieldKey }[] = [];

  headerCells.forEach((raw, colIndex) => {
    if (!raw) return;
    const canon = canonCsvHeader(raw);
    const field = resolveFieldKeyFromCanonHeader(canon);
    if (!field) {
      unknown.push(`COLUMNA ${colIndex + 1}: "${raw}"`);
      return;
    }
    mapped.push({ colIndex, rawHeader: raw, field });
  });

  if (unknown.length) {
    return {
      ok: false,
      errors: [
        `ENCABEZADO(S) NO RECONOCIDO(S): ${unknown.join("; ")}. USE NOMBRES COMO EN EL CSV DE COLABORADORES (EJ. NO_DE_EMPLEADO, CURP, SERVICIO).`,
      ],
    };
  }

  if (mapped.length !== 2) {
    return {
      ok: false,
      errors: [
        mapped.length < 2
          ? "DEBE HABER EXACTAMENTE DOS COLUMNAS CON ENCABEZADO: NUMERO DE EMPLEADO Y UN SOLO CAMPO MAS."
          : `DEBE HABER SOLO DOS COLUMNAS CON ENCABEZADO; AHORA HAY ${mapped.length}. ELIMINA COLUMNAS EXTRA.`,
      ],
    };
  }

  const noCol = mapped.find((m) => m.field === "noEmpleado");
  const dataCol = mapped.find((m) => m.field !== "noEmpleado");
  if (!noCol || !dataCol) {
    return {
      ok: false,
      errors: [
        "UNA COLUMNA DEBE SER EL NUMERO DE EMPLEADO (EJ. NO_DE_EMPLEADO, CLAVE) Y LA OTRA EL CAMPO A CORREGIR (EJ. CURP, FECHA_DE_INGRESO).",
      ],
    };
  }

  const outRows: { noEmpleado: string; valor: string }[] = [];
  for (let r = 1; r < rows.length; r++) {
    const cells = rows[r] ?? [];
    const noRaw = String(cells[noCol.colIndex] ?? "").trim();
    if (!noRaw) continue;
    const valor = String(cells[dataCol.colIndex] ?? "").trim();
    outRows.push({ noEmpleado: noRaw.toUpperCase(), valor });
  }

  if (outRows.length === 0) {
    return { ok: false, errors: ["NINGUNA FILA TIENE NUMERO DE EMPLEADO."] };
  }

  return { ok: true, fieldKey: dataCol.field, rows: outRows };
}

/** Plantilla UTF-8 con BOM para Excel; el segundo encabezado es solo ejemplo (cualquier campo mapeable sirve). */
export function generarPlantillaCorreccionCsvDosColumnas(): string {
  return "\uFEFFno_de_empleado,curp\r\nEJEMPLO000,AAAA000000HDFXXX00\r\n";
}
