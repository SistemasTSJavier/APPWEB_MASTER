import { canonCsvHeader } from "@/lib/csv";
import type { FamiliarGuardado } from "@/lib/colaboradores-types";
import { normalizeSpanishMxText } from "@/lib/text-es-mx";

export type WideFamiliaresLayout = {
  /** Índice de columna con el número de empleado */
  noCol: number;
  /** Columnas con nombre familiar y parentesco fijo por cabecera */
  slots: { col: number; parentescoLabel: string }[];
};

/** Cabeceras canónicas válidas como N° empleado (alineadas con empleado-csv-map). */
const ENCABEZADO_CANON_NO_EMPLEADO = new Set([
  "no_de_empleado",
  "no_empleado",
  "numero_de_empleado",
  "numero_empleado",
  "clave",
]);

/** Etiqueta de parentesco desde cabecera canónica (padre→PADRE, hijo1→HIJO 1). */
function parentescoFijoPorCabeceraCanon(canon: string): string | null {
  if (ENCABEZADO_CANON_NO_EMPLEADO.has(canon)) return null;
  if (canon === "padre") return "PADRE";
  if (canon === "madre") return "MADRE";
  if (canon === "pareja") return "PAREJA";
  const m = /^hijo_?(\d+)$/.exec(canon);
  if (m) return `HIJO ${Number(m[1])}`;
  return null;
}

/** Plantilla oficial PARTE 5 (familiares en una sola fila por empleado). */
export const ENCABEZADOS_CSV_FAMILIARES_ANCHO: readonly string[] = [
  "NO DE EMPLEADO",
  "PADRE",
  "MADRE",
  "PAREJA",
  "HIJO1",
  "HIJO2",
  "HIJO3",
  "HIJO4",
];

export function parseWideFamiliaresLayout(headerRow: string[]): WideFamiliaresLayout | null {
  const canon = headerRow.map((h) => canonCsvHeader(h));
  let noCol = -1;
  for (let i = 0; i < canon.length; i++) {
    if (ENCABEZADO_CANON_NO_EMPLEADO.has(canon[i]!)) {
      noCol = i;
      break;
    }
  }
  if (noCol < 0) return null;

  const slots: WideFamiliaresLayout["slots"] = [];
  for (let col = 0; col < canon.length; col++) {
    if (col === noCol) continue;
    const p = parentescoFijoPorCabeceraCanon(canon[col]!);
    if (p) slots.push({ col, parentescoLabel: p });
  }

  return slots.length > 0 ? { noCol, slots } : null;
}

function beneficiarioCsvDefecto(): "SI" | "NO" {
  return "NO";
}

/** Una fila del CSV ancho → lista de FamiliarGuardado (solo celdas con nombre). */
export function familiaresDesdeFilaAncha(cells: string[], layout: WideFamiliaresLayout): FamiliarGuardado[] {
  const out: FamiliarGuardado[] = [];
  for (const { col, parentescoLabel } of layout.slots) {
    const raw = String(cells[col] ?? "").trim();
    if (!raw) continue;
    const nombreFamiliar = normalizeSpanishMxText(raw).toUpperCase();
    out.push({
      nombreFamiliar,
      parentesco: parentescoLabel,
      fechaNacimiento: "",
      beneficiarioBancario: beneficiarioCsvDefecto(),
    });
  }
  return out;
}

export function numeroEmpleadoDesdeFilaAncha(cells: string[], layout: WideFamiliaresLayout): string {
  return String(cells[layout.noCol] ?? "").trim().toUpperCase();
}
