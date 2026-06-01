import { parseCsvContent, canonCsvHeader } from "@/lib/csv";

export type RenumeracionCsvRow = { noActual: string; noNuevo: string };

export type ParseRenumeracionCsvOk = { ok: true; rows: RenumeracionCsvRow[] };
export type ParseRenumeracionCsvErr = { ok: false; errors: string[] };
export type ParseRenumeracionCsvResult = ParseRenumeracionCsvOk | ParseRenumeracionCsvErr;

const HEADER_ACTUAL = new Set([
  "no_actual",
  "no_empleado_actual",
  "numero_empleado_actual",
  "empleado_actual",
  "no_de_empleado_actual",
  "clave_actual",
]);

const HEADER_NUEVO = new Set([
  "no_nuevo",
  "no_empleado_nuevo",
  "numero_empleado_nuevo",
  "empleado_nuevo",
  "no_de_empleado_nuevo",
  "clave_nueva",
  "nuevo_no_empleado",
  "nuevo_numero_empleado",
]);

function resolveHeaderKind(canon: string): "actual" | "nuevo" | null {
  if (HEADER_ACTUAL.has(canon)) return "actual";
  if (HEADER_NUEVO.has(canon)) return "nuevo";
  return null;
}

/**
 * CSV de renumeracion: exactamente dos columnas — N° actual (en el sistema) y N° nuevo.
 */
export function parseRenumeracionCsv(text: string): ParseRenumeracionCsvResult {
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
  let colActual = -1;
  let colNuevo = -1;
  const unknown: string[] = [];

  headerCells.forEach((raw, colIndex) => {
    if (!raw) return;
    const canon = canonCsvHeader(raw);
    const kind = resolveHeaderKind(canon);
    if (!kind) {
      unknown.push(`COLUMNA ${colIndex + 1}: "${raw}"`);
      return;
    }
    if (kind === "actual") {
      if (colActual >= 0) unknown.push(`COLUMNA ${colIndex + 1}: DUPLICA NO ACTUAL`);
      else colActual = colIndex;
    } else {
      if (colNuevo >= 0) unknown.push(`COLUMNA ${colIndex + 1}: DUPLICA NO NUEVO`);
      else colNuevo = colIndex;
    }
  });

  if (unknown.length) {
    return {
      ok: false,
      errors: [
        `ENCABEZADO(S) NO VALIDO(S): ${unknown.join("; ")}. USE no_actual Y no_nuevo (O no_empleado_actual / no_empleado_nuevo).`,
      ],
    };
  }

  if (colActual < 0 || colNuevo < 0) {
    return {
      ok: false,
      errors: [
        colActual < 0 && colNuevo < 0
          ? "FALTAN COLUMNAS no_actual Y no_nuevo."
          : colActual < 0
            ? "FALTA COLUMNA no_actual (NUMERO ACTUAL EN EL SISTEMA)."
            : "FALTA COLUMNA no_nuevo (NUMERO NUEVO A ASIGNAR).",
      ],
    };
  }

  if (colActual === colNuevo) {
    return { ok: false, errors: ["LAS DOS COLUMNAS NO PUEDEN SER LA MISMA."] };
  }

  const outRows: RenumeracionCsvRow[] = [];
  for (let r = 1; r < rows.length; r++) {
    const cells = rows[r] ?? [];
    const noActual = String(cells[colActual] ?? "").trim().toUpperCase();
    const noNuevo = String(cells[colNuevo] ?? "").trim().toUpperCase();
    if (!noActual && !noNuevo) continue;
    if (!noActual) {
      return { ok: false, errors: [`FILA ${r + 1}: FALTA NO ACTUAL.`] };
    }
    if (!noNuevo) {
      return { ok: false, errors: [`FILA ${r + 1}: FALTA NO NUEVO.`] };
    }
    outRows.push({ noActual, noNuevo });
  }

  if (outRows.length === 0) {
    return { ok: false, errors: ["NINGUNA FILA CON DATOS VALIDOS."] };
  }

  return { ok: true, rows: outRows };
}

export function generarPlantillaRenumeracionCsv(): string {
  return "\uFEFFno_actual,no_nuevo\r\n12345,12346\r\n67890,67891\r\n";
}
