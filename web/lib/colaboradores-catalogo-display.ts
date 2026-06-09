import type { ColaboradorCompleto } from "@/lib/colaboradores-types";
import type { CatalogoServicioItem } from "@/lib/servicios-catalogo-client";
import {
  claveServicioAgrupada,
  servicioExpedienteColaborador,
  servicioLineaColaborador,
} from "@/lib/servicio-agrupacion";

function normTxt(s: string): string {
  return s.trim().replace(/\s+/g, " ").toUpperCase();
}

export function valorCoincideConNoServicio(valor: string, noSrv: string): boolean {
  const v = valor.trim();
  const n = noSrv.trim();
  if (!v || !n) return false;
  if (normTxt(v) === normTxt(n)) return true;
  const vNum = v.replace(/\.0+$/, "");
  const nNum = n.replace(/\.0+$/, "");
  return vNum === nNum;
}

/** Normaliza N.º de servicio (Excel 937.0, ceros, etc.). */
export function canonicalNoServicioCatalogo(raw: string): string {
  let s = raw.trim().replace(/\u00a0/g, " ");
  if (/^'(.*)'$/.test(s)) s = s.slice(1, -1).trim();
  if (/^\d+\.0+$/.test(s)) s = s.replace(/\.0+$/, "");
  if (/^\d+$/.test(s)) return String(Number.parseInt(s, 10));
  return s.trim().toUpperCase();
}

export function plantaExpedienteColaborador(c: ColaboradorCompleto): string {
  return String(c.form?.planta ?? "").trim();
}

export function normPlantaCatalogo(s: string): string {
  return normTxt(s);
}

/** Puntuación línea expediente ↔ ítem catálogo; exige coincidencia de planta si ambas están definidas. */
export function scoreLineaConCatalogo(
  linea: string,
  item: CatalogoServicioItem,
  plantaHint: string,
): number {
  const cat = normTxt(item.nombre);
  if (!cat) return -1;
  let score = 0;
  if (linea === cat) score += 100;
  else {
    const kl = claveServicioAgrupada(linea);
    const kc = claveServicioAgrupada(cat);
    if (kl && kc && kl === kc) score += 75;
    else if (linea.includes(cat) || cat.includes(linea)) score += 35;
    else return -1;
  }
  const cp = normPlantaCatalogo(item.planta ?? "");
  if (plantaHint) {
    if (cp && cp === plantaHint) score += 60;
    else if (cp && cp !== plantaHint) return -1;
  }
  return score;
}

export type FindCatalogoOpts = {
  /** Planta en pantalla o expediente; filtra servicios de otra planta en catálogo. */
  plantaContexto?: string;
};

function lineasServicioExpediente(c: ColaboradorCompleto): string[] {
  const out: string[] = [];
  const push = (raw: string) => {
    const n = normTxt(raw);
    if (n && !out.includes(n)) out.push(n);
  };
  push(servicioExpedienteColaborador(c));
  push(servicioLineaColaborador(c));
  return out;
}

/** N.º de servicio capturado en Colaboradores (`form.noServicio`). */
export function noServicioExpedienteColaborador(c: ColaboradorCompleto): string {
  return canonicalNoServicioCatalogo(String(c.form?.noServicio ?? ""));
}

export function findCatalogoForColaborador(
  c: ColaboradorCompleto,
  catalogo: CatalogoServicioItem[],
  opts?: FindCatalogoOpts,
): CatalogoServicioItem | null {
  if (!catalogo.length) return null;
  const plantaHint = normPlantaCatalogo(opts?.plantaContexto ?? plantaExpedienteColaborador(c));

  const noSrv = noServicioExpedienteColaborador(c);
  if (noSrv) {
    const porNum = findCatalogoPorNumeroYPlanta(catalogo, noSrv, plantaHint || undefined);
    if (porNum) return porNum;
  }

  let best: CatalogoServicioItem | null = null;
  let bestScore = -1;
  for (const linea of lineasServicioExpediente(c)) {
    for (const item of catalogo) {
      const score = scoreLineaConCatalogo(linea, item, plantaHint);
      if (score > bestScore) {
        bestScore = score;
        best = item;
      }
    }
  }
  if (bestScore < 30) return null;
  return best;
}

/** Busca en catálogo por N.º; si hay varios, prioriza la planta indicada. */
export function findCatalogoPorNumeroYPlanta(
  catalogo: CatalogoServicioItem[],
  noSrv: string,
  planta?: string,
): CatalogoServicioItem | null {
  const n = canonicalNoServicioCatalogo(noSrv);
  if (!n) return null;
  const p = normPlantaCatalogo(planta ?? "");
  const hits = catalogo.filter((item) =>
    valorCoincideConNoServicio(item.numero_servicio ?? "", n),
  );
  if (hits.length === 0) return null;
  if (p) {
    const enPlanta = hits.filter((item) => normPlantaCatalogo(item.planta ?? "") === p);
    if (enPlanta.length === 1) return enPlanta[0]!;
    if (enPlanta.length > 1) return enPlanta[0]!;
    if (hits.length === 1) return hits[0]!;
    return null;
  }
  return hits.length === 1 ? hits[0]! : null;
}

export function findCatalogoPorNombreYPlanta(
  catalogo: CatalogoServicioItem[],
  nombre: string,
  planta?: string,
): CatalogoServicioItem | null {
  const linea = normTxt(nombre);
  if (!linea) return null;
  const plantaHint = normPlantaCatalogo(planta ?? "");
  let best: CatalogoServicioItem | null = null;
  let bestScore = -1;
  for (const item of catalogo) {
    const score = scoreLineaConCatalogo(linea, item, plantaHint);
    if (score > bestScore) {
      bestScore = score;
      best = item;
    }
  }
  if (bestScore < 30) return null;
  return best;
}

/**
 * N.º de servicio: primero lo capturado en **Colaboradores** (`form.noServicio`);
 * el catálogo Servicios solo completa si falta en expediente.
 */
export function noServicioColaborador(
  c: ColaboradorCompleto,
  catalogo?: CatalogoServicioItem[],
  opts?: FindCatalogoOpts,
): string {
  const fromExp = noServicioExpedienteColaborador(c);
  if (fromExp) return fromExp;
  const match = catalogo?.length ? findCatalogoForColaborador(c, catalogo, opts) : null;
  return (match?.numero_servicio ?? "").trim();
}

/** Nombre de servicio: primero expediente Colaboradores; catálogo solo si falta. */
export function nombreServicioCatalogoColaborador(
  c: ColaboradorCompleto,
  catalogo?: CatalogoServicioItem[],
  opts?: FindCatalogoOpts,
): string {
  const exp = normTxt(servicioExpedienteColaborador(c));
  if (exp) return exp;
  const match = catalogo?.length ? findCatalogoForColaborador(c, catalogo, opts) : null;
  if (match?.nombre?.trim()) return normTxt(match.nombre);
  return normTxt(servicioLineaColaborador(c));
}

/** Puesto o posición laboral en planta (columna POSICION). No confundir con N.º de servicio. */
export function posicionLaboralColaborador(
  c: ColaboradorCompleto,
  catalogo?: CatalogoServicioItem[],
): string {
  const candidatos = [
    String(c.form?.posicion ?? "").trim(),
    String(c.posicion ?? "").trim(),
  ];
  const noSrv = noServicioExpedienteColaborador(c);
  const noCatalogo = noSrv || noServicioColaborador(c, catalogo);
  for (const pos of candidatos) {
    if (!pos) continue;
    if (noCatalogo && valorCoincideConNoServicio(pos, noCatalogo)) continue;
    return pos;
  }
  return "";
}

/**
 * Antes el N.º de servicio a veces se guardaba en POSICION; al importar o editar `noServicio`
 * se limpia esa duplicación para que cada columna muestre su dato.
 */
export function limpiarPosicionDuplicadaDeNoServicio(
  c: ColaboradorCompleto,
  noServicioExplicito?: string,
): ColaboradorCompleto {
  const noSrv = (noServicioExplicito ?? noServicioColaborador(c)).trim();
  if (!noSrv) return c;
  const next: ColaboradorCompleto = { ...c, form: { ...c.form } };
  if (String(next.posicion ?? "").trim() && valorCoincideConNoServicio(next.posicion, noSrv)) {
    next.posicion = "";
  }
  const fp = String(next.form.posicion ?? "").trim();
  if (fp && valorCoincideConNoServicio(fp, noSrv)) {
    next.form = { ...next.form, posicion: "" };
  }
  return next;
}

export function plantaColaborador(c: ColaboradorCompleto, catalogo?: CatalogoServicioItem[]): string {
  const fromForm = plantaExpedienteColaborador(c);
  if (fromForm) return fromForm;
  const match = catalogo?.length ? findCatalogoForColaborador(c, catalogo) : null;
  return (match?.planta ?? "").trim();
}

export function catalogoPorNombre(
  catalogo: CatalogoServicioItem[],
  nombre: string,
): CatalogoServicioItem | null {
  const n = normTxt(nombre);
  if (!n) return null;
  return catalogo.find((s) => normTxt(s.nombre) === n) ?? null;
}

/** Alinea el N.º mostrado en cuadrícula con catálogo Servicios + planta en pantalla. */
export function reconcileRowServiceNo(
  row: { rowServiceNo?: string; servicioLinea?: string },
  colaborador: ColaboradorCompleto | undefined,
  catalogo: CatalogoServicioItem[],
  plantaNombre: string,
): string {
  if (colaborador) {
    const exp = noServicioExpedienteColaborador(colaborador);
    if (exp) return exp;
    const auth = noServicioColaborador(colaborador, catalogo, { plantaContexto: plantaNombre });
    if (auth) return auth;
  }
  const current = (row.rowServiceNo ?? "").trim();
  if (current) {
    const porNum = findCatalogoPorNumeroYPlanta(catalogo, current, plantaNombre);
    if (porNum?.numero_servicio?.trim()) return porNum.numero_servicio.trim();
  }
  const linea = (row.servicioLinea ?? "").trim();
  if (linea) {
    const porNom = findCatalogoPorNombreYPlanta(catalogo, linea, plantaNombre);
    if (porNom?.numero_servicio?.trim()) return porNom.numero_servicio.trim();
  }
  return current;
}
