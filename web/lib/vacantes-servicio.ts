import {
  canonicalNoServicioCatalogo,
  normPlantaCatalogo,
  valorCoincideConNoServicio,
} from "@/lib/colaboradores-catalogo-display";
import type { CatalogoServicioItem } from "@/lib/servicios-catalogo-client";
import { claveServicioAgrupada } from "@/lib/servicio-agrupacion";
import type { VacanteRegistro } from "@/lib/vacantes-catalog";

function normTxt(s: string): string {
  return s.trim().replace(/\s+/g, " ").toUpperCase();
}

export function normServicioLineaVacante(s: string): string {
  const t = normTxt(s);
  return t === "—" || t === "-" ? "" : t;
}

/** Variantes CAT / U-ERRE; el resto (p. ej. ADMINISTRACIÓN vs COMERCIAL) exige coincidencia exacta. */
export function serviciosLineaCoincidenVacante(a: string, b: string): boolean {
  const na = normServicioLineaVacante(a);
  const nb = normServicioLineaVacante(b);
  if (!na || !nb) return !na && !nb;
  if (na === nb) return true;
  const ka = claveServicioAgrupada(na);
  const kb = claveServicioAgrupada(nb);
  return Boolean(ka && kb && ka === kb);
}

/**
 * Identificador de servicio en slot de vacante: N.º + nombre cuando existan ambos,
 * para no mezclar servicios distintos (Administración ≠ Comercial).
 */
export function identificadorServicioVacante(slot: {
  rowServiceNo?: string;
  servicioLinea?: string;
}): string {
  const no = canonicalNoServicioCatalogo(slot.rowServiceNo ?? "");
  const linea = normServicioLineaVacante(slot.servicioLinea ?? "");
  if (no && linea) return `NO:${no}|NOM:${linea}`;
  if (no) return `NO:${no}`;
  if (linea) return `NOM:${linea}`;
  return "";
}

/** Catálogo por N.º en planta; si hay varios nombres distintos, no adivinar. */
export function findCatalogoPorNumeroEstrictoPlanta(
  catalogo: CatalogoServicioItem[],
  noSrv: string,
  planta: string,
): CatalogoServicioItem | null {
  const n = canonicalNoServicioCatalogo(noSrv);
  const p = normPlantaCatalogo(planta);
  if (!n) return null;
  const hits = catalogo.filter((item) =>
    valorCoincideConNoServicio(item.numero_servicio ?? "", n),
  );
  if (hits.length === 0) return null;
  const enPlanta = p
    ? hits.filter((item) => normPlantaCatalogo(item.planta ?? "") === p)
    : hits;
  const pool = enPlanta.length > 0 ? enPlanta : hits;
  if (pool.length === 0) return null;
  const nombres = new Set(pool.map((item) => normTxt(item.nombre ?? "")).filter(Boolean));
  if (nombres.size > 1) return null;
  return pool[0] ?? null;
}

/** Nombre de servicio exacto (misma planta). */
export function findCatalogoPorNombreExactoPlanta(
  catalogo: CatalogoServicioItem[],
  nombre: string,
  planta: string,
): CatalogoServicioItem | null {
  const linea = normServicioLineaVacante(nombre);
  const p = normPlantaCatalogo(planta);
  if (!linea) return null;
  const hits = catalogo.filter((item) => normTxt(item.nombre ?? "") === linea);
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

export type ServicioVacanteReconciliado = {
  servicioLinea: string;
  rowServiceNo: string;
};

/**
 * Alinea SERVICIO y NO. SERVICIO con catálogo por planta sin mezclar líneas parecidas.
 * Prioriza los valores capturados; el catálogo solo completa o corrige si es unívoco.
 */
export function reconciliarServicioVacante(
  entrada: {
    planta: string;
    servicioLinea?: string;
    rowServiceNo?: string;
  },
  catalogo: CatalogoServicioItem[],
): ServicioVacanteReconciliado {
  const planta = normPlantaCatalogo(entrada.planta);
  let linea = normServicioLineaVacante(entrada.servicioLinea ?? "");
  let no = canonicalNoServicioCatalogo(entrada.rowServiceNo ?? "");

  const porNum = no ? findCatalogoPorNumeroEstrictoPlanta(catalogo, no, planta) : null;
  const porNom = linea ? findCatalogoPorNombreExactoPlanta(catalogo, linea, planta) : null;

  if (porNum && porNom) {
    const nomNum = normTxt(porNum.nombre ?? "");
    const nomCat = normTxt(porNom.nombre ?? "");
    if (nomNum && nomCat && nomNum !== nomCat) {
      return { servicioLinea: linea, rowServiceNo: no };
    }
    linea = normTxt(porNum.nombre ?? linea);
    no = canonicalNoServicioCatalogo(porNum.numero_servicio ?? no);
    return { servicioLinea: linea, rowServiceNo: no };
  }

  if (porNum) {
    linea = normTxt(porNum.nombre ?? linea);
    no = canonicalNoServicioCatalogo(porNum.numero_servicio ?? no);
    return { servicioLinea: linea, rowServiceNo: no };
  }

  if (porNom) {
    linea = normTxt(porNom.nombre ?? linea);
    if (porNom.numero_servicio?.trim()) {
      no = canonicalNoServicioCatalogo(porNom.numero_servicio);
    }
    return { servicioLinea: linea, rowServiceNo: no };
  }

  return { servicioLinea: linea, rowServiceNo: no };
}

/** Normaliza un registro de vacante (import, baja, carga). */
export function normalizarVacanteRegistro(
  v: VacanteRegistro,
  catalogo: CatalogoServicioItem[],
): VacanteRegistro {
  const { servicioLinea, rowServiceNo } = reconciliarServicioVacante(
    {
      planta: v.planta,
      servicioLinea: v.servicioLinea,
      rowServiceNo: v.rowServiceNo,
    },
    catalogo,
  );
  return {
    ...v,
    planta: normPlantaCatalogo(v.planta),
    posicion: v.posicion.trim().toUpperCase(),
    servicioLinea: servicioLinea || undefined,
    rowServiceNo: rowServiceNo || undefined,
    puesto: v.puesto?.trim().toUpperCase() || undefined,
  };
}

export function normalizarVacantesCatalogo(
  items: VacanteRegistro[],
  catalogo: CatalogoServicioItem[],
): VacanteRegistro[] {
  const byKey = new Map<string, VacanteRegistro>();
  for (const raw of items) {
    const v = normalizarVacanteRegistro(raw, catalogo);
    if (!v.planta || !v.posicion) continue;
    const sk = `${v.planta}\u001f${identificadorServicioVacante(v)}\u001f${v.posicion}`;
    const prev = byKey.get(sk);
    if (!prev || (v.updatedAt ?? "") >= (prev.updatedAt ?? "")) {
      byKey.set(sk, v);
    }
  }
  return [...byKey.values()].sort((a, b) => {
    const cs = (a.servicioLinea ?? "").localeCompare(b.servicioLinea ?? "", "es", { numeric: true });
    if (cs !== 0) return cs;
    const cn = (a.rowServiceNo ?? "").localeCompare(b.rowServiceNo ?? "", "es", { numeric: true });
    if (cn !== 0) return cn;
    const cp = a.planta.localeCompare(b.planta, "es", { numeric: true });
    if (cp !== 0) return cp;
    return a.posicion.localeCompare(b.posicion, "es", { numeric: true });
  });
}
