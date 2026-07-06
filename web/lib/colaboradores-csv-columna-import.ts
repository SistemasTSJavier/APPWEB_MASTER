/**
 * CSV con exactamente dos columnas reconocidas: N° de empleado + una columna de dato (ej. ESTADO CIVIL).
 * Filas cuyo N° no exista en expedientes se ignoran.
 */
import { canonicalEmpNoAttendance } from "@/lib/attendance-emp-no";
import { parseCsvContent } from "@/lib/csv";
import { normalizeToCompleto } from "@/lib/colaboradores-normalize";
import type { ColaboradorCompleto } from "@/lib/colaboradores-types";
import {
  aplicarSnapDesdePick,
  formDeltaDesdePick,
  mergeFormPreserve,
} from "@/lib/altas-import-partes";
import { buildHeaderFieldIndex, rowToFieldMap, type CsvFieldKey } from "@/lib/empleado-csv-map";
import { limpiarPosicionDuplicadaDeNoServicio } from "@/lib/colaboradores-catalogo-display";
import { alinearColaboradorTrasImportColumnaPuesto, alinearColaboradorTrasImportColumnaServicio } from "@/lib/servicio-agrupacion";

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
        `NO SE DETECTO COLUMNA DE DATOS. Ademas del N° empleado debe haber UNA columna reconocida (ej. NO. SERVICIO, CURP, PLANTA).${extra}`,
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
};

export type ColumnarCsvImportErr = { ok: false; message: string };

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
        "SOLO SE DETECTO UNA COLUMNA. Guarda el CSV con dos columnas (empleado + dato). En Excel (España) el separador suele ser punto y coma (;).",
    };
  }
  const headerRow = rows[0]!.map((c) => String(c ?? "").trim());
  const head = analizarCabecerasCsvUnaColumna(headerRow);
  if (!head.ok) return head;

  const { fieldIndex, dataFieldKey, dataHeaderLabel } = head;
  const toWrite = new Map<string, ColaboradorCompleto>();
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
    const prev = toWrite.get(no) ?? byNo.get(no);
    if (!prev) {
      ignoredUnknownNo++;
      omitidosSinExpedienteSet.add(no);
      continue;
    }

    if (picked[dataFieldKey] === undefined || String(picked[dataFieldKey] ?? "").trim() === "") {
      skippedEmptyRow++;
      continue;
    }

    const delta = formDeltaDesdePick(picked);
    let merged: ColaboradorCompleto = { ...prev, noEmpleado: no, form: mergeFormPreserve(prev.form, delta) };
    merged = aplicarSnapDesdePick(merged, picked);
    merged = { ...merged, noEmpleado: no, form: { ...merged.form, noEmpleado1: no } };

    if (dataFieldKey === "servicio" || dataFieldKey === "servicioFinal" || dataFieldKey === "ultimoServicio") {
      const valorServicio =
        dataFieldKey === "servicio"
          ? g(picked, "servicio")
          : dataFieldKey === "servicioFinal"
            ? g(picked, "servicioFinal")
            : g(picked, "ultimoServicio");
      if (valorServicio) {
        merged = alinearColaboradorTrasImportColumnaServicio(merged, valorServicio);
      }
    }
    if (dataFieldKey === "puesto") {
      const valorPuesto = g(picked, "puesto");
      if (valorPuesto) {
        merged = alinearColaboradorTrasImportColumnaPuesto(merged, valorPuesto);
      }
    }
    if (dataFieldKey === "noServicio") {
      merged = limpiarPosicionDuplicadaDeNoServicio(merged, g(picked, "noServicio"));
    }

    toWrite.set(no, merged);
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
  };
}

export function mapaColaboradoresPorNo(
  rows: { no_empleado?: string; data: unknown }[],
): Map<string, ColaboradorCompleto> {
  const m = new Map<string, ColaboradorCompleto>();
  for (const row of rows) {
    const c = normalizeToCompleto(row.data);
    if (!c) continue;
    const key = canonicalEmpNoAttendance(String(row.no_empleado ?? c.noEmpleado));
    if (!key) continue;
    m.set(key, {
      ...c,
      noEmpleado: key,
      form: { ...c.form, noEmpleado1: key },
    });
  }
  return m;
}
