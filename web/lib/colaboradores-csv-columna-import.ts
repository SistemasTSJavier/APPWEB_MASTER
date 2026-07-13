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
import { servicioLineaColaborador } from "@/lib/servicio-agrupacion";

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
        ? ` Columna no reconocida: «${sinMapear.join("», «")}». Usa SERVICIO o SERVICIO_VIGENTE (no NO_SERVICIO, que es el número de catálogo).`
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
export function listarNosCsvUnaColumna(
  csvText: string,
): { ok: true; nos: string[]; dataFieldKey: CsvFieldKey; dataHeaderLabel: string } | ColumnarCsvImportErr {
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

/**
 * Todos los expedientes en el mapa cuya clave canónica coincide
 * (cubre duplicados 06754 / 6754 creados por imports viejos).
 */
export function listarColaboradoresPorNoCanon(
  byNo: Map<string, ColaboradorCompleto>,
  noRaw: string,
): ColaboradorCompleto[] {
  const canon = canonicalEmpNoAttendance(String(noRaw ?? "").trim());
  if (!canon) return [];
  const seen = new Set<string>();
  const out: ColaboradorCompleto[] = [];
  for (const c of byNo.values()) {
    const key = String(c.noEmpleado ?? "").trim().toUpperCase();
    if (!key || seen.has(key)) continue;
    if (canonicalEmpNoAttendance(key) !== canon) continue;
    seen.add(key);
    out.push(c);
  }
  // Fallback: si el mapa no indexó bien, prueba claves directas.
  if (out.length === 0) {
    const hit = lookupColaboradorEnMapa(byNo, noRaw);
    if (hit) out.push(hit);
  }
  return out;
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

    // Actualiza TODAS las filas con el mismo N° canónico (expediente real + posibles huérfanas).
    const matches = listarColaboradoresPorNoCanon(toWrite, noRaw);
    const fromDb = matches.length > 0 ? matches : listarColaboradoresPorNoCanon(byNo, noRaw);
    if (fromDb.length === 0) {
      ignoredUnknownNo++;
      omitidosSinExpedienteSet.add(no);
      continue;
    }

    for (const prev of fromDb) {
      const writeKey = String(prev.noEmpleado ?? "").trim().toUpperCase() || no;
      const base = toWrite.get(writeKey) ?? prev;
      const merged = aplicarUnSoloCampoColaborador(base, dataFieldKey, valor);
      toWrite.set(writeKey, merged);
    }
  }

  return {
    ok: true,
    dataFieldKey,
    dataHeaderLabel,
    updated: [...toWrite.values()],
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
 * Preferencia: clave exacta BD → canónica (sin ceros).
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

export function muestraValorCampoColaborador(c: ColaboradorCompleto, fieldKey: string): string {
  if (fieldKey === "servicio" || fieldKey === "servicioFinal" || fieldKey === "ultimoServicio") {
    return servicioLineaColaborador(c);
  }
  if (fieldKey === "puesto" || fieldKey === "puestoFinal") {
    return String(c.moperActual?.puesto || c.puesto || c.form?.puesto || "").trim();
  }
  if (fieldKey === "posicion") return String(c.posicion || c.form?.posicion || "").trim();
  if (fieldKey === "imss") return String(c.nss || c.form?.imss || "").trim();
  if (fieldKey === "nombreCompleto") return String(c.nombreCompleto || "").trim();
  if (fieldKey === "noServicio") return String(c.form?.noServicio || "").trim();
  return String(c.form?.[fieldKey] ?? "").trim();
}

/**
 * Indexa por N° real de BD (`no_empleado`) y por forma canónica (CSV/Excel sin ceros).
 * Importante: **no reescribe** `noEmpleado` a la forma canónica — si no, el upsert crea otra fila
 * y Colaboradores sigue mostrando el expediente original sin cambios.
 *
 * Si existen 06754 y 6754, ambos se conservan; el alias canónico NO pisa una fila exacta.
 */
export function mapaColaboradoresPorNo(
  rows: { no_empleado?: string; data: unknown }[],
): Map<string, ColaboradorCompleto> {
  const byDb = new Map<string, ColaboradorCompleto>();
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
    byDb.set(dbNo, normalized);
  }
  const m = new Map<string, ColaboradorCompleto>(byDb);
  for (const [dbNo, normalized] of byDb) {
    const canon = canonicalEmpNoAttendance(dbNo);
    if (canon && canon !== dbNo && !m.has(canon)) {
      m.set(canon, normalized);
    }
  }
  return m;
}
