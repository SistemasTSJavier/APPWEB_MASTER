import {
  claveServicioAgrupada,
  servicioAgrupadoUsaZona,
  ZONA_FILTRO_SIN_SUFIJO,
} from "@/lib/servicio-agrupacion";
import { normalizarServicioCategorizacion } from "@/lib/categorizacion-servicios-calificables";

/** Valor interno para filtro "sin planta en expediente" (CAT / U-ERRE). */
export const PLANTA_FILTRO_SIN_REGISTRO = ZONA_FILTRO_SIN_SUFIJO;

export function normalizarPlantaCat(s: string): string {
  return s.trim().replace(/\s+/g, " ").toUpperCase();
}

export function servicioClaveFiltroCat(servicioLinea: string): string {
  const t = String(servicioLinea ?? "").trim();
  if (!t) return "";
  const agrupada = claveServicioAgrupada(t);
  if (servicioAgrupadoUsaZona(agrupada)) return agrupada;
  return normalizarServicioCategorizacion(t);
}

export function servicioCoincideFiltroCat(servicioLinea: string, filtroServicio: string): boolean {
  const filtro = normalizarServicioCategorizacion(filtroServicio);
  if (!filtro) return true;
  if (servicioAgrupadoUsaZona(filtro)) {
    return claveServicioAgrupada(servicioLinea) === filtro;
  }
  return normalizarServicioCategorizacion(servicioLinea) === filtro;
}

export function plantaCoincideFiltroCat(planta: string, filtroPlanta: string): boolean {
  const p = normalizarPlantaCat(filtroPlanta);
  if (!p) return true;
  if (p === PLANTA_FILTRO_SIN_REGISTRO) return !normalizarPlantaCat(planta);
  return normalizarPlantaCat(planta) === p;
}

export function servicioUsaFiltroPlanta(filtroServicio: string): boolean {
  const filtro = normalizarServicioCategorizacion(filtroServicio);
  return Boolean(filtro) && servicioAgrupadoUsaZona(filtro);
}

export function filtrarPorServicioYPlanta<T extends { servicio?: string; planta?: string }>(
  rows: T[],
  servicioFiltro: string,
  plantaFiltro = "",
): T[] {
  const srv = normalizarServicioCategorizacion(servicioFiltro);
  let out = rows;
  if (srv) {
    out = out.filter((r) => servicioCoincideFiltroCat(String(r.servicio ?? ""), srv));
    if (servicioUsaFiltroPlanta(srv) && plantaFiltro.trim()) {
      out = out.filter((r) => plantaCoincideFiltroCat(String(r.planta ?? ""), plantaFiltro));
    }
  }
  return out;
}

export function serviciosAgrupadosUnicosDesdePersonal<T extends { servicio?: string }>(rows: T[]): string[] {
  const set = new Set<string>();
  for (const r of rows) {
    const clave = servicioClaveFiltroCat(String(r.servicio ?? ""));
    if (clave) set.add(clave);
  }
  return [...set].sort((a, b) => a.localeCompare(b, "es", { numeric: true }));
}

export function plantasDisponiblesParaServicio<T extends { servicio?: string; planta?: string }>(
  rows: T[],
  servicioFiltro: string,
): { labels: string[]; haySinPlanta: boolean } {
  const srv = normalizarServicioCategorizacion(servicioFiltro);
  if (!srv || !servicioUsaFiltroPlanta(srv)) return { labels: [], haySinPlanta: false };
  const set = new Set<string>();
  let haySinPlanta = false;
  for (const r of rows) {
    if (!servicioCoincideFiltroCat(String(r.servicio ?? ""), srv)) continue;
    const p = normalizarPlantaCat(String(r.planta ?? ""));
    if (!p) haySinPlanta = true;
    else set.add(p);
  }
  return {
    labels: [...set].sort((a, b) => a.localeCompare(b, "es", { numeric: true })),
    haySinPlanta,
  };
}

export function conteoActivosPorServicioAgrupado<T extends { servicio?: string }>(
  rows: T[],
): { servicio: string; count: number }[] {
  const map = new Map<string, number>();
  for (const r of rows) {
    const key = servicioClaveFiltroCat(String(r.servicio ?? "")) || "SIN SERVICIO";
    map.set(key, (map.get(key) ?? 0) + 1);
  }
  return [...map.entries()]
    .map(([servicio, count]) => ({ servicio, count }))
    .sort((a, b) => a.servicio.localeCompare(b.servicio, "es", { numeric: true }));
}

export function conteoActivosPorPlanta<T extends { servicio?: string; planta?: string }>(
  rows: T[],
  servicioFiltro: string,
): { planta: string; count: number }[] {
  const srv = normalizarServicioCategorizacion(servicioFiltro);
  if (!srv || !servicioUsaFiltroPlanta(srv)) return [];
  const map = new Map<string, number>();
  for (const r of rows) {
    if (!servicioCoincideFiltroCat(String(r.servicio ?? ""), srv)) continue;
    const p = normalizarPlantaCat(String(r.planta ?? ""));
    const key = p || PLANTA_FILTRO_SIN_REGISTRO;
    map.set(key, (map.get(key) ?? 0) + 1);
  }
  return [...map.entries()]
    .map(([planta, count]) => ({ planta, count }))
    .sort((a, b) => {
      if (a.planta === PLANTA_FILTRO_SIN_REGISTRO) return 1;
      if (b.planta === PLANTA_FILTRO_SIN_REGISTRO) return -1;
      return a.planta.localeCompare(b.planta, "es", { numeric: true });
    });
}
