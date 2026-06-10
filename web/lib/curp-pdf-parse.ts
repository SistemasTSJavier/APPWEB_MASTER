/** Códigos de entidad federativa en posiciones 12-13 de la CURP (RENAPO). */
const ENTIDAD_CURP: Record<string, string> = {
  AS: "AGUASCALIENTES",
  BC: "BAJA CALIFORNIA",
  BS: "BAJA CALIFORNIA SUR",
  CC: "CAMPECHE",
  CL: "COAHUILA",
  CM: "COLIMA",
  CS: "CHIAPAS",
  CH: "CHIHUAHUA",
  DF: "CIUDAD DE MEXICO",
  DG: "DURANGO",
  GT: "GUANAJUATO",
  GR: "GUERRERO",
  HG: "HIDALGO",
  JC: "JALISCO",
  MC: "ESTADO DE MEXICO",
  MN: "MICHOACAN",
  MS: "MORELOS",
  NT: "NAYARIT",
  NL: "NUEVO LEON",
  OC: "OAXACA",
  PL: "PUEBLA",
  QT: "QUERETARO",
  QR: "QUINTANA ROO",
  SP: "SAN LUIS POTOSI",
  SL: "SINALOA",
  SR: "SONORA",
  TC: "TABASCO",
  TS: "TAMAULIPAS",
  TL: "TLAXCALA",
  VZ: "VERACRUZ",
  YN: "YUCATAN",
  ZS: "ZACATECAS",
  NE: "NACIDO EN EL EXTRANJERO",
};

const CURP_RE = /[A-Z]{4}[0-9]{2}(?:0[1-9]|1[0-2])(?:0[1-9]|[12][0-9]|3[01])[HM][A-Z]{2}[A-Z0-9]{3}[0-9A-Z][0-9A-Z]/i;

const ETIQUETAS_IGNORAR_NOMBRE =
  /curp|clave|gobierno|mexico|constancia|renapo|fecha|documento|estados\s+unidos|secretar[ií]a|registro|poblaci[oó]n|certificada|verificada|folio|impre|v[aá]lida/i;

export type CurpPdfParseResult = {
  curp: string;
  nombreCompleto: string;
  fechaNacimiento?: string;
  estadoNatal?: string;
};

export function normalizarCurp(raw: string): string {
  return raw.replace(/\s/g, "").replace(/Ñ/gi, "X").toUpperCase();
}

export function esCurpValida(curp: string): boolean {
  const c = normalizarCurp(curp);
  return c.length === 18 && CURP_RE.test(c);
}

export function extraerCurpDeTexto(texto: string): string | null {
  const raw = texto.trim();
  if (!raw) return null;

  const upper = normalizarCurp(raw);
  const direct = upper.match(CURP_RE);
  if (direct) return normalizarCurp(direct[0]);

  for (const part of upper.split(/[|;,/\s]+/)) {
    if (esCurpValida(part)) return normalizarCurp(part);
  }

  return null;
}

function fechaNacimientoDesdeCurp(curp: string): string | undefined {
  const c = normalizarCurp(curp);
  if (c.length !== 18) return undefined;
  const yy = Number(c.slice(4, 6));
  const mm = c.slice(6, 8);
  const dd = c.slice(8, 10);
  if (!Number.isFinite(yy)) return undefined;
  const year = yy >= 50 ? 1900 + yy : 2000 + yy;
  const iso = `${year}-${mm}-${dd}`;
  const d = new Date(`${iso}T12:00:00`);
  if (Number.isNaN(d.getTime())) return undefined;
  return iso;
}

function estadoNatalDesdeCurp(curp: string): string | undefined {
  const c = normalizarCurp(curp);
  if (c.length !== 18) return undefined;
  return ENTIDAD_CURP[c.slice(11, 13)] ?? undefined;
}

function limpiarNombre(raw: string): string {
  return raw
    .replace(/\s+/g, " ")
    .replace(/[^A-ZÁÉÍÓÚÜÑa-záéíóúüñ' -]/g, " ")
    .trim();
}

function esLineaNombre(line: string): boolean {
  const t = limpiarNombre(line);
  if (t.length < 5 || esCurpValida(t)) return false;
  if (ETIQUETAS_IGNORAR_NOMBRE.test(t)) return false;
  if (/^\d+([./-]\d+)*$/.test(t)) return false;
  const words = t.split(/\s+/).filter(Boolean);
  if (words.length < 2) return false;
  return words.every((w) => /^[A-ZÁÉÍÓÚÜÑ][A-ZÁÉÍÓÚÜÑa-záéíóúüñ'-]*$/.test(w) || /^[A-ZÁÉÍÓÚÜÑ]{2,}$/.test(w));
}

function valorTrasEtiqueta(lineas: string[], etiqueta: RegExp): string {
  for (let i = 0; i < lineas.length; i++) {
    const line = lineas[i]!;
    if (!etiqueta.test(line)) continue;
    const enMisma = line.replace(etiqueta, "").replace(/^[\s:.-]+/, "").trim();
    if (enMisma.length >= 2 && esLineaNombre(enMisma)) return limpiarNombre(enMisma);
    for (let j = i + 1; j < Math.min(i + 4, lineas.length); j++) {
      const next = lineas[j]!;
      if (esLineaNombre(next)) return limpiarNombre(next);
    }
  }
  return "";
}

function extraerNombreCompletoDeTexto(texto: string): string | null {
  const lineas = texto
    .replace(/\r/g, "\n")
    .split(/\n+/)
    .map((l) => l.trim())
    .filter(Boolean);

  const paterno = valorTrasEtiqueta(lineas, /primer\s+apellido/i);
  const materno = valorTrasEtiqueta(lineas, /segundo\s+apellido/i);
  const nombres = valorTrasEtiqueta(lineas, /nombre(?:\(s\))?/i);
  const porPartes = [paterno, materno, nombres].filter((s) => s.length >= 2).join(" ").trim();
  if (porPartes && porPartes.split(/\s+/).length >= 2) return porPartes.toUpperCase();

  const bloqueNombre = texto.match(
    /nombre(?:\(s\))?\s*:?\s*\n?\s*([A-ZÁÉÍÓÚÜÑ][A-ZÁÉÍÓÚÜÑ\s]{4,80})/i,
  );
  if (bloqueNombre?.[1] && esLineaNombre(bloqueNombre[1])) {
    return limpiarNombre(bloqueNombre[1]).toUpperCase();
  }

  const curpIdx = lineas.findIndex((l) => extraerCurpDeTexto(l) != null);
  if (curpIdx >= 0) {
    for (const offset of [1, -1, 2, -2, 3]) {
      const candidate = lineas[curpIdx + offset];
      if (candidate && esLineaNombre(candidate)) return limpiarNombre(candidate).toUpperCase();
    }
  }

  let mejor = "";
  for (const line of lineas) {
    if (!esLineaNombre(line)) continue;
    const t = limpiarNombre(line).toUpperCase();
    if (t.length > mejor.length) mejor = t;
  }
  return mejor || null;
}

/** Interpreta el texto extraído del PDF de constancia CURP (México). */
export function parseCurpDesdePdfTexto(texto: string): CurpPdfParseResult | null {
  const curp = extraerCurpDeTexto(texto);
  if (!curp) return null;
  const nombreCompleto = extraerNombreCompletoDeTexto(texto) ?? "";
  return {
    curp,
    nombreCompleto,
    fechaNacimiento: fechaNacimientoDesdeCurp(curp),
    estadoNatal: estadoNatalDesdeCurp(curp),
  };
}

/** Extrae todo el texto legible de un PDF en el navegador. */
export async function extraerTextoDePdf(file: File): Promise<string> {
  const pdfjs = await import("pdfjs-dist");
  if (!pdfjs.GlobalWorkerOptions.workerSrc) {
    pdfjs.GlobalWorkerOptions.workerSrc = `https://cdn.jsdelivr.net/npm/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;
  }
  const buffer = await file.arrayBuffer();
  const doc = await pdfjs.getDocument({ data: buffer }).promise;
  const partes: string[] = [];
  for (let pageNum = 1; pageNum <= doc.numPages; pageNum++) {
    const page = await doc.getPage(pageNum);
    const content = await page.getTextContent();
    const pageText = content.items
      .map((item) => ("str" in item && typeof item.str === "string" ? item.str : ""))
      .join(" ");
    partes.push(pageText);
  }
  return partes.join("\n");
}

export async function parseCurpDesdePdf(file: File): Promise<CurpPdfParseResult> {
  if (!file.name.toLowerCase().endsWith(".pdf") && file.type !== "application/pdf") {
    throw new Error("Seleccione un archivo PDF de la constancia CURP.");
  }
  const texto = await extraerTextoDePdf(file);
  if (!texto.trim()) {
    throw new Error("El PDF no contiene texto legible. Use la constancia CURP descargada de gob.mx (no una imagen escaneada).");
  }
  const parsed = parseCurpDesdePdfTexto(texto);
  if (!parsed) {
    throw new Error("No se encontró una CURP válida en el PDF.");
  }
  if (!parsed.nombreCompleto.trim()) {
    throw new Error("Se leyó la CURP pero no el nombre completo. Verifique que sea la constancia oficial CURP.");
  }
  return parsed;
}
