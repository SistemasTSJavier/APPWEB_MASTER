import { canonCsvHeader, parseCsvContent } from "@/lib/csv";

export function normNombreServicioCatalogo(s: string): string {
  return s.trim().replace(/\s+/g, " ").toUpperCase();
}

/** Normaliza planta igual que nombre de servicio (mayúsculas, espacios). */
export function normPlantaCatalogo(raw: string | null | undefined): string | null {
  const t = normNombreServicioCatalogo(String(raw ?? ""));
  return t ? t : null;
}

/** Si la primera fila parece encabezado, las filas de datos empiezan en índice 1. */
export function detectServiciosCsvSkipHeaderRow(rows: string[][]): number {
  const r = rows[0];
  if (!r || r.length < 2) return 0;
  const c0 = canonCsvHeader(String(r[0] ?? ""));
  const c1 = canonCsvHeader(String(r[1] ?? ""));
  const c2 = r.length >= 3 ? canonCsvHeader(String(r[2] ?? "")) : "";

  const looksNombre =
    c0 === "nombre" ||
    c0 === "servicio" ||
    c0.includes("nombre") ||
    (c0.includes("servicio") && !c0.includes("numero"));
  const looksNumero =
    c1.includes("numero") ||
    c1.includes("no_servicio") ||
    c1.includes("n_servicio") ||
    c1 === "no" ||
    (c1.includes("no") && c1.includes("servicio"));
  const looksPlanta =
    c2.includes("planta") ||
    c2.includes("sitio") ||
    c2.includes("ubicacion") ||
    c2.includes("zona");

  if (!looksNombre || !looksNumero) return 0;

  if (r.length >= 3) {
    if (looksPlanta || c2 === "") return 1;
    return 0;
  }

  return 1;
}

/**
 * Filas de datos:
 * - **2 columnas**: nombre; N.º (opcional en archivo por fila). Sin 2.ª columna en fila → no actualiza catálogo existente (solo alta nueva sin número si no existe).
 * - **3+ columnas**: nombre; N.º; planta. Actualiza N.º y planta del servicio por nombre (vacío en CSV = borrar valor).
 */
export type ServicioImportCatalogoRow = {
  nombre: string;
  numeroTexto?: string | null;
  plantaTexto?: string | null;
};

/** @deprecated Usar ServicioImportCatalogoRow */
export type ServicioImportDosColumnasRow = ServicioImportCatalogoRow;

export function parseServiciosCatalogoCsvDosColumnas(csvText: string): ServicioImportCatalogoRow[] {
  const rows = parseCsvContent(csvText);
  const start = detectServiciosCsvSkipHeaderRow(rows);
  const out: ServicioImportCatalogoRow[] = [];
  for (let i = start; i < rows.length; i++) {
    const r = rows[i]!;
    if (!r.length) continue;
    const nombre = normNombreServicioCatalogo(String(r[0] ?? ""));
    if (!nombre) continue;

    if (r.length >= 3) {
      const t = String(r[1] ?? "").trim();
      const p = String(r[2] ?? "").trim();
      out.push({
        nombre,
        numeroTexto: t === "" ? null : t,
        plantaTexto: p === "" ? null : p,
      });
      continue;
    }

    if (r.length >= 2) {
      const t = String(r[1] ?? "").trim();
      out.push({ nombre, numeroTexto: t === "" ? null : t });
      continue;
    }

    out.push({ nombre });
  }
  return out;
}
