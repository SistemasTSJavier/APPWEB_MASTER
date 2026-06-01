import { parseCsvContent, canonCsvHeader } from "@/lib/csv";
import { resolveFieldKeyFromCanonHeader } from "@/lib/empleado-csv-map";

export type RenumeracionCsvRow = { nombre: string; noNuevo: string };

export type ParseRenumeracionCsvOk = { ok: true; rows: RenumeracionCsvRow[] };
export type ParseRenumeracionCsvErr = { ok: false; errors: string[] };
export type ParseRenumeracionCsvResult = ParseRenumeracionCsvOk | ParseRenumeracionCsvErr;

const HEADER_NUEVO = new Set([
  "no_nuevo",
  "no_empleado_nuevo",
  "numero_empleado_nuevo",
  "empleado_nuevo",
  "no_de_empleado_nuevo",
  "clave_nueva",
  "nuevo_no_empleado",
  "nuevo_numero_empleado",
  "no_de_empleado",
  "no_empleado",
  "numero_de_empleado",
  "clave",
]);

function esCabeceraNoNuevo(canon: string): boolean {
  return HEADER_NUEVO.has(canon);
}

function esCabeceraNombre(canon: string): boolean {
  if (esCabeceraNoNuevo(canon)) return false;
  const field = resolveFieldKeyFromCanonHeader(canon);
  return field === "nombreCompleto" || field === "nombres" || field === "apellidoPaterno" || field === "apellidoMaterno";
}

/**
 * CSV de renumeracion: nombre del colaborador + N° de empleado nuevo.
 * El sistema localiza el expediente por coincidencia exacta de nombre (normalizado).
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
  let colNombre = -1;
  let colNuevo = -1;
  const unknown: string[] = [];

  headerCells.forEach((raw, colIndex) => {
    if (!raw) return;
    const canon = canonCsvHeader(raw);
    if (esCabeceraNoNuevo(canon)) {
      if (colNuevo >= 0) unknown.push(`COLUMNA ${colIndex + 1}: DUPLICA NO NUEVO`);
      else colNuevo = colIndex;
      return;
    }
    if (esCabeceraNombre(canon)) {
      if (colNombre >= 0) unknown.push(`COLUMNA ${colIndex + 1}: DUPLICA NOMBRE`);
      else colNombre = colIndex;
      return;
    }
    unknown.push(`COLUMNA ${colIndex + 1}: "${raw}"`);
  });

  if (unknown.length) {
    return {
      ok: false,
      errors: [
        `ENCABEZADO(S) NO VALIDO(S): ${unknown.join("; ")}. USE nombre_completo (O nombre) Y no_nuevo.`,
      ],
    };
  }

  if (colNombre < 0 || colNuevo < 0) {
    return {
      ok: false,
      errors: [
        colNombre < 0 && colNuevo < 0
          ? "FALTAN COLUMNAS DE NOMBRE Y no_nuevo."
          : colNombre < 0
            ? "FALTA COLUMNA DE NOMBRE (EJ. nombre_completo O nombre)."
            : "FALTA COLUMNA no_nuevo (NUMERO NUEVO A ASIGNAR).",
      ],
    };
  }

  if (colNombre === colNuevo) {
    return { ok: false, errors: ["LAS DOS COLUMNAS NO PUEDEN SER LA MISMA."] };
  }

  const outRows: RenumeracionCsvRow[] = [];
  for (let r = 1; r < rows.length; r++) {
    const cells = rows[r] ?? [];
    const nombre = String(cells[colNombre] ?? "").trim();
    const noNuevo = String(cells[colNuevo] ?? "").trim().toUpperCase();
    if (!nombre && !noNuevo) continue;
    if (!nombre) {
      return { ok: false, errors: [`FILA ${r + 1}: FALTA NOMBRE DEL COLABORADOR.`] };
    }
    if (!noNuevo) {
      return { ok: false, errors: [`FILA ${r + 1}: FALTA NO NUEVO.`] };
    }
    outRows.push({ nombre, noNuevo });
  }

  if (outRows.length === 0) {
    return { ok: false, errors: ["NINGUNA FILA CON DATOS VALIDOS."] };
  }

  return { ok: true, rows: outRows };
}

export function generarPlantillaRenumeracionCsv(): string {
  return "\uFEFFnombre_completo,no_nuevo\r\nJUAN PEREZ LOPEZ,12346\r\nMARIA GARCIA SOTO,67891\r\n";
}
