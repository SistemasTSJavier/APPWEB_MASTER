import { foldSpanishForAsciiKeys } from "@/lib/text-es-mx";

function countDelimsOutsideQuotes(line: string, delim: string): number {
  let n = 0;
  let inQ = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i]!;
    if (c === '"') {
      if (line[i + 1] === '"') {
        i++;
        continue;
      }
      inQ = !inQ;
      continue;
    }
    if (!inQ && c === delim) n++;
  }
  return n;
}

/** Primera línea no vacía: el delimitador con más ocurrencias (Excel MX suele usar `;`). */
export function detectCsvDelimiter(text: string): string {
  const firstLine =
    text
      .replace(/^\uFEFF/, "")
      .split(/\r\n|\n|\r/)
      .find((l) => l.trim()) ?? "";
  const semi = countDelimsOutsideQuotes(firstLine, ";");
  const comma = countDelimsOutsideQuotes(firstLine, ",");
  const tab = countDelimsOutsideQuotes(firstLine, "\t");
  if (semi > comma && semi >= tab && semi > 0) return ";";
  if (tab > comma && tab > semi && tab > 0) return "\t";
  return ",";
}

function parseCsvWithDelimiter(text: string, delimiter: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let i = 0;
  let inQ = false;
  while (i < text.length) {
    const c = text[i]!;
    if (inQ) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          cell += '"';
          i += 2;
          continue;
        }
        inQ = false;
        i++;
        continue;
      }
      cell += c;
      i++;
      continue;
    }
    if (c === '"') {
      inQ = true;
      i++;
      continue;
    }
    if (c === delimiter) {
      row.push(cell);
      cell = "";
      i++;
      continue;
    }
    if (c === "\n" || c === "\r") {
      if (c === "\r" && text[i + 1] === "\n") i++;
      row.push(cell);
      cell = "";
      if (row.some((x) => String(x ?? "").trim() !== "")) rows.push(row);
      row = [];
      i++;
      continue;
    }
    cell += c;
    i++;
  }
  row.push(cell);
  if (row.some((x) => String(x ?? "").trim() !== "")) rows.push(row);
  return rows;
}

/** Parser CSV mínimo (comillas dobles, delimitador auto en la 1.ª línea, saltos \n / \r\n). */
export function parseCsvContent(text: string): string[][] {
  const delim = detectCsvDelimiter(text);
  return parseCsvWithDelimiter(text, delim);
}

/** Normaliza celdas numéricas exportadas por Excel (p. ej. `903.0`, `1006.0`). */
export function normalizarCeldaCsvNumerica(raw: string): string {
  let t = String(raw ?? "").trim();
  if (!t) return "";
  if (/^\d+\.0+$/.test(t)) return t.replace(/\.0+$/, "");
  const asNum = Number(t);
  if (Number.isFinite(asNum) && Number.isInteger(asNum) && /^-?\d+(\.\d+)?([eE][+-]?\d+)?$/.test(t)) {
    return String(asNum);
  }
  return t;
}

/** Encabezado CSV → clave `snake_case`: español (México), conserva **ñ**, quita tildes en vocales. */
export function canonCsvHeader(h: string): string {
  return foldSpanishForAsciiKeys(h)
    .replace(/[^a-z0-9ñ]+/g, "_")
    .replace(/^_|_$/g, "");
}
