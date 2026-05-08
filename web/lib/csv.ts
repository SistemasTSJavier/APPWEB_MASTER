import { foldSpanishForAsciiKeys } from "@/lib/text-es-mx";

/** Parser CSV mínimo (comillas dobles, comas, saltos de línea \n / \r\n). */
export function parseCsvContent(text: string): string[][] {
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
    if (c === ",") {
      row.push(cell);
      cell = "";
      i++;
      continue;
    }
    if (c === "\n" || c === "\r") {
      if (c === "\r" && text[i + 1] === "\n") i++;
      row.push(cell);
      cell = "";
      if (row.some((x) => x.trim() !== "")) rows.push(row);
      row = [];
      i++;
      continue;
    }
    cell += c;
    i++;
  }
  row.push(cell);
  if (row.some((x) => x.trim() !== "")) rows.push(row);
  return rows;
}

/** Encabezado CSV → clave `snake_case`: español (México), conserva **ñ**, quita tildes en vocales. */
export function canonCsvHeader(h: string): string {
  return foldSpanishForAsciiKeys(h)
    .replace(/[^a-z0-9ñ]+/g, "_")
    .replace(/^_|_$/g, "");
}
