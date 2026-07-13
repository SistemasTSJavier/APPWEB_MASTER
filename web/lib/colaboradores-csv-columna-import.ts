/**
 * CSV con exactamente dos columnas reconocidas: N° de empleado + una columna de dato (ej. SERVICIO, CURP).
 * Pensado para corrección masiva (100–miles de filas): aplica el campo con alineación de snapshots
 * (servicio/puesto/moper) y no respeta la omisión del import masivo de altas.
 */
import { canonicalEmpNoAttendance } from "@/lib/attendance-emp-no";
import { parseCsvContent } from "@/lib/csv";
import { normalizeToCompleto } from "@/lib/colaboradores-normalize";
import type { ColaboradorCompleto } from "@/lib/colaboradores-types";
import { aplicarUnSoloCampoColaborador } from "@/lib/altas-un-campo";
import { buildHeaderFieldIndex, rowToFieldMap, type CsvFieldKey } from "@/lib/empleado-csv-map";

function g(p: Partial<Record<CsvFieldKey, string>>, k: CsvFieldKey): string {
  return (p[k] ?? "").trim();
}

export type CabecerasUnaColumnaOk = {
  ok: true;
  fieldIndex: Map<number, CsvFieldKey>;
  dataFieldKey: CsvFieldKey;
  dataHeaderLabel: string;
};

export type CabecerasUnaColumnaErr = { ok: false; message: string };

export function analizarCabecerasCsvUnaColumna(headerRow: string[]): CabecerasUnaColumnaOk | CabecerasUnaColumnaErr {
  const headers = headerRow.map((c) => String(c ?? "").trim());
  const fieldIndex = buildHeaderFieldIndex(headers);
  let noCol = -1;
  const dataCols: Array<{ col: number; key: CsvFieldKey }> = [];
  fieldIndex.forEach((key, col) => {
    if (key === "noEmpleado") noCol = col;
    else dataCols.push({ col, key });
  });
  if (noCol < 0) {
    return {
      ok: false,
      message:
        "NO SE DETECTO COLUMNA DE NUMERO DE EMPLEADO. Usa una cabecera como NO_EMPLEADO, NO DE EMPLEADO O CLAVE.",
    };
  }
  if (dataCols.length === 0) {
    const sinMapear = headers
      .map((h, i) => ({ h, i }))
      .filter(({ h, i }) => h.trim() && !fieldIndex.has(i))
      .map(({ h }) => h);
    const extra =
      sinMapear.length > 0
        ? ` Columna no reconocida: «${sinMapear.join("», «")}». N.º servicio: NO_SERVICIO o NO. SERVICIO. POSICION es otro campo (puesto en planta).`
        : "";
    return {
      ok: false,
      message:
        `NO SE DETECTO COLUMNA DE DATOS. Ademas del N° empleado debe haber UNA columna reconocida (ej. SERVICIO, CURP, PLANTA).${extra}`,
    };
  }
  if (dataCols.length > 1) {
    const labels = dataCols.map((d) => `${d.key} (${headers[d.col] ?? ""})`).join(", ");
    return {
      ok: false,
      message: `HAY ${dataCols.length} COLUMNAS DE DATOS (${labels}). Deja solo una columna ademas del numero de empleado.`,
    };
  }
  const dc = dataCols[0]!;
  return {
    ok: true,
    fieldIndex,
    dataFieldKey: dc.key,
    dataHeaderLabel: headers[dc.col] ?? dc.key,
  };
}

export type ColumnarCsvImportOk = {
  ok: true;
  dataFieldKey: CsvFieldKey;
  dataHeaderLabel: string;
  /** Expedientes a persistir (ultima fila del CSV gana si hay N° duplicado). */
  updated: ColaboradorCompleto[];
  ignoredUnknownNo: number;
  /** N° de empleado del CSV sin expediente en el sistema (unicos, ordenados). */
  omitidosSinExpediente: string[];
  skippedEmptyRow: number;
  errors: Array<{ row: number; message: string }>;
  /** N° únicos pedidos en el CSV (para carga selectiva en servidor). */
  nosSolicitados: string[];
};

export type ColumnarCsvImportErr = { ok: false; message: string };

/** Extrae N° de empleado del CSV de 2 columnas sin cargar expedientes (para fetch selectivo). */
export function listarNosCsvUnaColumna(csvText: string): { ok: true; nos: string[]; dataFieldKey: CsvFieldKey; dataHeaderLabel: string } | ColumnarCsvImportErr {
  const stripped = csvText.replace(/^\uFEFF/, "");
  const rows = parseCsvContent(stripped);
  if (rows.length < 2) {
    return { ok: false, message: "EL CSV DEBE TENER ENCABEZADOS Y AL MENOS UNA FILA DE DATOS." };
  }
  const colCount = Math.max(...rows.map((r) => r.length), 0);
  if (colCount < 2) {
    return {
      ok: false,
      message:
        "SOLO SE DETECTO UNA COLUMNA. Guarda el CSV con dos columnas (empleado + dato). En Excel (Mexico) el separador suele ser punto y coma (;).",
    };
  }
  const headerRow = rows[0]!.map((c) => String(c ?? "").trim());
  const head = analizarCabecerasCsvUnaColumna(headerRow);
  if (!head.ok) return head;

  const { fieldIndex } = head;
  const nos = new Set<string>();
  for (let r = 1; r < rows.length; r++) {
    const cells = rows[r] ?? [];
    if (!cells.some((c) => String(c ?? "").trim() !== "")) continue;
    const picked = rowToFieldMap(cells, fieldIndex);
    const no = canonicalEmpNoAttendance(g(picked, "noEmpleado"));
    if (no) nos.add(no);
  }
  return {
    ok: true,
    nos: [...nos],
    dataFieldKey: head.dataFieldKey,
    dataHeaderLabel: head.dataHeaderLabel,
  };
}

export function procesarCsvActualizacionUnaColumna(
  csvText: string,
  byNo: Map<string, ColaboradorCompleto>,
): ColumnarCsvImportOk | ColumnarCsvImportErr {
  const stripped = csvText.replace(/^\uFEFF/, "");
  const rows = parseCsvContent(stripped);
  if (rows.length < 2) {
    return { ok: false, message: "EL CSV DEBE TENER ENCABEZADOS Y AL MENOS UNA FILA DE DATOS." };
  }
  const colCount = Math.max(...rows.map((r) => r.length), 0);
  if (colCount < 2) {
    return {
      ok: false,
      message:
        "SOLO SE DETECTO UNA COLUMNA. Guarda el CSV con dos columnas (empleado + dato). En Excel (Mexico) el separador suele ser punto y coma (;).",
    };
  }
  const headerRow = rows[0]!.map((c) => String(c ?? "").trim());
  const head = analizarCabecerasCsvUnaColumna(headerRow);
  if (!head.ok) return head;

  const { fieldIndex, dataFieldKey, dataHeaderLabel } = head;
  const toWrite = new Map<string, ColaboradorCompleto>();
  const nosSolicitados = new Set<string>();
  let ignoredUnknownNo = 0;
  const omitidosSinExpedienteSet = new Set<string>();
  let skippedEmptyRow = 0;
  const errors: Array<{ row: number; message: string }> = [];

  for (let r = 1; r < rows.length; r++) {
    const cells = rows[r] ?? [];
    if (!cells.some((c) => String(c ?? "").trim() !== "")) {
      skippedEmptyRow++;
      continue;
    }
    const picked = rowToFieldMap(cells, fieldIndex);
    const noRaw = g(picked, "noEmpleado");
    if (!noRaw) {
      errors.push({ row: r + 1, message: "FILA SIN NUMERO DE EMPLEADO." });
      continue;
    }
    const no = canonicalEmpNoAttendance(noRaw);
    if (!no) {
      errors.push({ row: r + 1, message: "NUMERO DE EMPLEADO INVALIDO." });
      continue;
    }
    nosSolicitados.add(no);

    const valor = String(picked[dataFieldKey] ?? "").trim();
    if (!valor) {
      skippedEmptyRow++;
      continue;
    }

    // Clave de escritura = no_empleado real en BD (puede llevar ceros); lookup acepta CSV canónico.
    const prev = lookupColaboradorEnMapa(toWrite, noRaw) ?? lookupColaboradorEnMapa(byNo, noRaw);
    if (!prev) {
      ignoredUnknownNo++;
      omitidosSinExpedienteSet.add(no);
      continue;
    }

    const writeKey = String(prev.noEmpleado ?? "").trim().toUpperCase() || no;
    // Corrección intencional de UN campo: siempre aplica (servicio/puesto/moper incluidos).
    const merged = aplicarUnSoloCampoColaborador(prev, dataFieldKey, valor);
    toWrite.set(writeKey, merged);
    if (no !== writeKey) toWrite.set(no, merged);
  }

  return {
    ok: true,
    dataFieldKey,
    dataHeaderLabel,
    // Deduplica si se indexó por clave BD + canónica.
    updated: [...new Map([...toWrite.values()].map((c) => [c.noEmpleado, c])).values()],
    ignoredUnknownNo,
    omitidosSinExpediente: [...omitidosSinExpedienteSet].sort((a, b) =>
      a.localeCompare(b, "es", { numeric: true }),
    ),
    skippedEmptyRow,
    errors,
    nosSolicitados: [...nosSolicitados],
  };
}

/**
 * Busca expediente por N° tal como viene en CSV / Excel.
 * Prueba clave canónica (sin ceros) y cruda (con ceros / mayúsculas).
 */
export function lookupColaboradorEnMapa(
  byNo: Map<string, ColaboradorCompleto>,
  noRaw: string,
): ColaboradorCompleto | undefined {
  const raw = String(noRaw ?? "").trim();
  if (!raw) return undefined;
  const upper = raw.toUpperCase();
  const canon = canonicalEmpNoAttendance(raw);
  return (
    byNo.get(upper) ??
    (canon ? byNo.get(canon) : undefined) ??
    (canon && canon !== upper ? byNo.get(canon.toUpperCase()) : undefined)
  );
}

/**
 * Indexa por N° real de BD (`no_empleado`) y por forma canónica (CSV/Excel sin ceros).
 * Importante: **no reescribe** `noEmpleado` a la forma canónica — si no, el upsert crea otra fila
 * y Colaboradores sigue mostrando el expediente original sin cambios.
 */
export function mapaColaboradoresPorNo(
  rows: { no_empleado?: string; data: unknown }[],
): Map<string, ColaboradorCompleto> {
  const m = new Map<string, ColaboradorCompleto>();
  for (const row of rows) {
    const c = normalizeToCompleto(row.data);
    if (!c) continue;
    const dbNo = String(row.no_empleado ?? c.noEmpleado ?? "").trim().toUpperCase();
    if (!dbNo) continue;
    const normalized: ColaboradorCompleto = {
      ...c,
      noEmpleado: dbNo,
      form: { ...c.form, noEmpleado1: dbNo },
    };
    m.set(dbNo, normalized);
    const canon = canonicalEmpNoAttendance(dbNo);
    if (canon && canon !== dbNo) m.set(canon, normalized);
  }
  return m;
}
