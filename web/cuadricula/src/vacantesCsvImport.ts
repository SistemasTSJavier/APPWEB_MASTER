import type { ColaboradorCompleto } from "@/lib/colaboradores-types";
import {
  canonicalNoServicioCatalogo,
  findCatalogoPorNombreYPlanta,
  findCatalogoPorNumeroYPlanta,
  normPlantaCatalogo,
} from "@/lib/colaboradores-catalogo-display";
import type { CatalogoServicioItem } from "@/lib/servicios-catalogo-client";
import { normPosicionKey, slotFromVacanteRegistro, slotVacanteKey, type SlotVacante } from "@/lib/vacantes-slot";
import {
  loadVacantesCatalogo,
  saveVacantesCatalogoDirect,
  type VacanteRegistro,
} from "@/lib/vacantes-catalog";
import { colaboradorCoincideSlot } from "./vacantesPosicionSlots";
import { splitCsvDelimitedLine, type CsvDelimiter } from "./attendanceGridCsvImport";

export const VACANTES_CSV_HEADERS = [
  "SERVICIO",
  "NO. SERVICIO",
  "PLANTA",
  "POSICION",
  "PUESTO",
] as const;

const MIN_COLS = 4;

function stripDiacritics(s: string): string {
  return s.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

function normHeaderCell(s: string): string {
  return stripDiacritics(s).trim().toLowerCase().replace(/\s+/g, " ");
}

function normServicio(s: string): string {
  return s.trim().replace(/\s+/g, " ").toUpperCase();
}

function pickDelimiter(firstLine: string): CsvDelimiter {
  const candidates: CsvDelimiter[] = [";", ",", "\t"];
  const scored = candidates.map((d) => ({
    d,
    n: splitCsvDelimitedLine(firstLine, d).length,
  }));
  const ok = scored.filter((x) => x.n >= MIN_COLS);
  if (ok.length > 0) {
    const semi = ok.find((x) => x.d === ";");
    if (semi) return ";";
    const tab = ok.find((x) => x.d === "\t");
    if (tab) return "\t";
    return ",";
  }
  return scored.reduce((a, b) => (a.n >= b.n ? a : b)).d;
}

function matchesServicioHeader(norm: string): boolean {
  return norm.includes("servicio") && !norm.includes("no");
}

function matchesNoServicioHeader(norm: string): boolean {
  return norm.includes("servicio") && norm.includes("no");
}

function matchesPlantaHeader(norm: string): boolean {
  return norm.includes("planta");
}

function matchesPosicionHeader(norm: string): boolean {
  return norm.includes("posicion");
}

function matchesPuestoHeader(norm: string): boolean {
  return norm.includes("puesto");
}

function matchesNotasHeader(norm: string): boolean {
  return norm.includes("nota");
}

export type VacanteCsvFila = {
  lineNo: number;
  servicioLinea: string;
  rowServiceNo: string;
  planta: string;
  posicion: string;
  puesto?: string;
  notas?: string;
};

export type VacantesCsvLayout = {
  servicioCol: number;
  noServicioCol: number;
  plantaCol: number;
  posicionCol: number;
  puestoCol: number;
  notasCol: number;
};

export function detectVacantesCsvLayout(header: string[]): VacantesCsvLayout | null {
  const h = header.map(normHeaderCell);
  let servicioCol = -1;
  let noServicioCol = -1;
  let plantaCol = -1;
  let posicionCol = -1;
  let puestoCol = -1;
  let notasCol = -1;

  for (let i = 0; i < h.length; i++) {
    const cell = h[i]!;
    if (matchesNoServicioHeader(cell)) noServicioCol = i;
    else if (matchesServicioHeader(cell)) servicioCol = i;
    else if (matchesPlantaHeader(cell)) plantaCol = i;
    else if (matchesPosicionHeader(cell)) posicionCol = i;
    else if (matchesPuestoHeader(cell)) puestoCol = i;
    else if (matchesNotasHeader(cell)) notasCol = i;
  }

  if (plantaCol < 0 || posicionCol < 0) return null;
  if (servicioCol < 0 && noServicioCol < 0) return null;

  return {
    servicioCol,
    noServicioCol,
    plantaCol,
    posicionCol,
    puestoCol,
    notasCol,
  };
}

export function buildVacantesCsvTemplate(): string {
  return `${VACANTES_CSV_HEADERS.join(";")}\r\n`;
}

export function buildVacantesCsvExport(rows: VacanteRegistro[]): string {
  const header = VACANTES_CSV_HEADERS.join(";");
  const body = rows.map((v) =>
    [
      v.servicioLinea ?? "",
      v.rowServiceNo ?? "",
      v.planta,
      v.posicion,
      v.puesto ?? "",
    ]
      .map((c) => {
        const s = String(c);
        if (s.includes(";") || s.includes('"') || s.includes("\n")) {
          return `"${s.replace(/"/g, '""')}"`;
        }
        return s;
      })
      .join(";"),
  );
  return [header, ...body].join("\r\n");
}

export type VacantesCsvParseResult = {
  delim: CsvDelimiter;
  filas: VacanteCsvFila[];
  errores: string[];
};

export function parseVacantesCsv(text: string): VacantesCsvParseResult {
  const errores: string[] = [];
  const raw = text.replace(/^\uFEFF/, "").trim();
  if (!raw) {
    return { delim: ";", filas: [], errores: ["El archivo está vacío."] };
  }

  const lines = raw.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (lines.length === 0) {
    return { delim: ";", filas: [], errores: ["Sin filas de datos."] };
  }

  const delim = pickDelimiter(lines[0]!);
  const headerCells = splitCsvDelimitedLine(lines[0]!, delim);
  const layout = detectVacantesCsvLayout(headerCells);
  if (!layout) {
    return {
      delim,
      filas: [],
      errores: [
        `Cabecera no reconocida. Use: ${VACANTES_CSV_HEADERS.join(", ")} (separador ${delim === ";" ? ";" : delim === "," ? "," : "tab"}).`,
      ],
    };
  }

  const filas: VacanteCsvFila[] = [];
  for (let li = 1; li < lines.length; li++) {
    const lineNo = li + 1;
    const cells = splitCsvDelimitedLine(lines[li]!, delim);
    const planta = normPlantaCatalogo(cells[layout.plantaCol] ?? "");
    const posicion = String(cells[layout.posicionCol] ?? "").trim().toUpperCase();
    const servicioLinea =
      layout.servicioCol >= 0 ? normServicio(cells[layout.servicioCol] ?? "") : "";
    const rowServiceNo =
      layout.noServicioCol >= 0
        ? canonicalNoServicioCatalogo(cells[layout.noServicioCol] ?? "")
        : "";
    const puestoRaw =
      layout.puestoCol >= 0 ? String(cells[layout.puestoCol] ?? "").trim().toUpperCase() : "";
    const notasRaw =
      layout.notasCol >= 0 ? String(cells[layout.notasCol] ?? "").trim() : "";

    if (!planta && !posicion && !servicioLinea && !rowServiceNo) continue;

    if (!planta || !posicion) {
      errores.push(`Línea ${lineNo}: faltan PLANTA o POSICION.`);
      continue;
    }
    if (!servicioLinea && !rowServiceNo) {
      errores.push(`Línea ${lineNo}: indique SERVICIO o NO. SERVICIO.`);
      continue;
    }
    if (!normPosicionKey(posicion)) {
      errores.push(`Línea ${lineNo}: POSICION no válida.`);
      continue;
    }

    filas.push({
      lineNo,
      servicioLinea: servicioLinea || "—",
      rowServiceNo,
      planta,
      posicion,
      puesto: puestoRaw || undefined,
      notas: notasRaw || undefined,
    });
  }

  return { delim, filas, errores };
}

function reconcileConCatalogo(
  fila: VacanteCsvFila,
  catalogo: CatalogoServicioItem[],
): VacanteCsvFila {
  let servicioLinea = fila.servicioLinea === "—" ? "" : fila.servicioLinea;
  let rowServiceNo = fila.rowServiceNo;

  if (rowServiceNo) {
    const porNum = findCatalogoPorNumeroYPlanta(catalogo, rowServiceNo, fila.planta);
    if (porNum) {
      servicioLinea = normServicio(porNum.nombre ?? servicioLinea);
      rowServiceNo = (porNum.numero_servicio ?? rowServiceNo).trim();
    }
  }
  if (servicioLinea) {
    const porNom = findCatalogoPorNombreYPlanta(catalogo, servicioLinea, fila.planta);
    if (porNom) {
      servicioLinea = normServicio(porNom.nombre ?? servicioLinea);
      if (!rowServiceNo && porNom.numero_servicio?.trim()) {
        rowServiceNo = canonicalNoServicioCatalogo(porNom.numero_servicio);
      }
    }
  }

  return {
    ...fila,
    servicioLinea: servicioLinea || "—",
    rowServiceNo,
  };
}

export type VacantesCsvImportResult = {
  agregadas: number;
  actualizadas: number;
  omitidas: number;
  bloqueadas: number;
  errores: string[];
};

export function importVacantesCsvToCatalog(
  text: string,
  colaboradores: ColaboradorCompleto[],
  catalogo: CatalogoServicioItem[],
): VacantesCsvImportResult {
  const parsed = parseVacantesCsv(text);
  const errores = [...parsed.errores];
  if (parsed.filas.length === 0 && errores.length === 0) {
    errores.push("No hay filas válidas para importar.");
  }

  const all = loadVacantesCatalogo();
  const byKey = new Map<string, VacanteRegistro>();
  for (const v of all) {
    byKey.set(slotVacanteKey(slotFromVacanteRegistro(v)), v);
  }

  let agregadas = 0;
  let actualizadas = 0;
  let omitidas = 0;
  let bloqueadas = 0;

  for (const raw of parsed.filas) {
    const fila = reconcileConCatalogo(raw, catalogo);
    const slot: SlotVacante = {
      planta: fila.planta,
      posicion: fila.posicion,
      servicioLinea: fila.servicioLinea,
      rowServiceNo: fila.rowServiceNo,
    };

    let ocupada = false;
    for (const c of colaboradores) {
      if (colaboradorCoincideSlot(c, slot, catalogo)) {
        ocupada = true;
        break;
      }
    }
    if (ocupada) {
      bloqueadas++;
      errores.push(
        `Línea ${fila.lineNo}: colaborador activo en ${fila.posicion} (${fila.servicioLinea}, N.º ${fila.rowServiceNo || "—"}).`,
      );
      continue;
    }

    const key = slotVacanteKey(slot);
    const existente = byKey.get(key);
    if (existente) {
      const puestoNuevo = fila.puesto ?? existente.puesto;
      const notasNuevas = fila.notas ?? existente.notas;
      if (
        puestoNuevo !== existente.puesto ||
        notasNuevas !== existente.notas ||
        fila.servicioLinea !== (existente.servicioLinea ?? "") ||
        fila.rowServiceNo !== (existente.rowServiceNo ?? "")
      ) {
        byKey.set(key, {
          ...existente,
          servicioLinea: fila.servicioLinea,
          rowServiceNo: fila.rowServiceNo || undefined,
          puesto: puestoNuevo,
          notas: notasNuevas,
          updatedAt: new Date().toISOString(),
        });
        actualizadas++;
      } else {
        omitidas++;
      }
      continue;
    }

    const scope = fila.planta.replace(/\s+/g, "_");
    const noPart = fila.rowServiceNo.replace(/\s+/g, "_") || "srv";
    const registro: VacanteRegistro = {
      id: `vacant:planta_${scope}:${noPart}:${fila.posicion}`,
      planta: fila.planta,
      posicion: fila.posicion,
      servicioLinea: fila.servicioLinea,
      rowServiceNo: fila.rowServiceNo || undefined,
      puesto: fila.puesto,
      notas: fila.notas,
      updatedAt: new Date().toISOString(),
    };
    byKey.set(key, registro);
    agregadas++;
  }

  if (agregadas > 0 || actualizadas > 0) {
    const sorted = [...byKey.values()].sort((a, b) => {
      const cp = a.planta.localeCompare(b.planta, "es", { numeric: true });
      if (cp !== 0) return cp;
      const cs = (a.servicioLinea ?? "").localeCompare(b.servicioLinea ?? "", "es", { numeric: true });
      if (cs !== 0) return cs;
      return a.posicion.localeCompare(b.posicion, "es", { numeric: true });
    });
    if (!saveVacantesCatalogoDirect(sorted)) {
      errores.push("No se pudo guardar en el navegador (almacenamiento bloqueado o lleno).");
      return { agregadas: 0, actualizadas: 0, omitidas, bloqueadas, errores };
    }
  }

  return { agregadas, actualizadas, omitidas, bloqueadas, errores };
}
