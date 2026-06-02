import type { ColaboradorCompleto } from '@/lib/colaboradores-types'
import { posicionLaboralColaborador } from '@/lib/colaboradores-catalogo-display'
import { colaboradorTieneBaja } from '@/lib/colaboradores-baja'
import { coincideColaboradorPlantaExpediente } from './cuadriculaColaboradoresBridge'
import { normPosicionKey } from '@/lib/vacantes-slot'
import {
  colaboradorActivoOcupaSlot,
  slotFromVacanteRegistro,
  slotVacanteKey,
  type SlotVacante,
} from './vacantesPosicionSlots'
import type { CatalogoServicioItem } from '@/lib/servicios-catalogo-client'
import {
  VACANTES_CATALOG_UPDATED_EVENT,
  addVacanteRegistro,
  loadVacantesCatalogo,
  removeVacanteFromCatalog,
  saveVacantesCatalogoDirect,
  updateVacanteRegistro,
  type VacanteRegistro,
  type VacanteRegistroPatch,
} from '@/lib/vacantes-catalog'

export {
  VACANTES_CATALOG_UPDATED_EVENT,
  loadVacantesCatalogo,
  removeVacanteFromCatalog,
  saveVacantesCatalogoDirect,
  type VacanteRegistro,
}

let vacantesCatalogCache: VacanteRegistro[] | null = null
let vacantesPorPlantaCache = new Map<string, VacanteRegistro[]>()

function vacantesCatalogSnapshot(): VacanteRegistro[] {
  if (!vacantesCatalogCache) vacantesCatalogCache = loadVacantesCatalogo()
  return vacantesCatalogCache
}

export function invalidateVacantesCatalogCache(): void {
  vacantesCatalogCache = null
  vacantesPorPlantaCache.clear()
}

if (typeof window !== 'undefined') {
  window.addEventListener(VACANTES_CATALOG_UPDATED_EVENT, invalidateVacantesCatalogCache)
}

function saveVacantesCatalogo(items: VacanteRegistro[]): boolean {
  const ok = saveVacantesCatalogoDirect(items)
  if (ok) invalidateVacantesCatalogCache()
  return ok
}

export function listVacantesPorPlanta(planta: string): VacanteRegistro[] {
  const p = planta.trim().toUpperCase()
  if (!p) return []
  const hit = vacantesPorPlantaCache.get(p)
  if (hit) return hit
  const list = vacantesCatalogSnapshot().filter((v) => v.planta === p)
  vacantesPorPlantaCache.set(p, list)
  return list
}

export function colaboradorOcupaPosicionEnPlanta(
  c: ColaboradorCompleto,
  planta: string,
  posicion: string,
): boolean {
  if (colaboradorTieneBaja(c)) return false
  if (!coincideColaboradorPlantaExpediente(c, planta)) return false
  return normPosicionKey(posicionLaboralColaborador(c)) === normPosicionKey(posicion)
}

/** Hay colaborador activo o vacante en catálogo con mismo servicio + posición en la planta. */
export function posicionBloqueadaEnPlanta(
  planta: string,
  posicion: string,
  colaboradores: ColaboradorCompleto[],
  catalogoServicios: CatalogoServicioItem[] = [],
  catalogoVacantes = loadVacantesCatalogo(),
  opts?: { servicioLinea?: string; rowServiceNo?: string },
): { bloqueada: boolean; motivo?: string } {
  const pk = normPosicionKey(posicion)
  if (!pk) return { bloqueada: true, motivo: 'Indique una posición válida.' }
  const p = planta.trim().toUpperCase()
  const slot: SlotVacante = {
    planta: p,
    posicion: posicion.trim().toUpperCase(),
    servicioLinea: (opts?.servicioLinea ?? '').trim().toUpperCase(),
    rowServiceNo: (opts?.rowServiceNo ?? '').trim(),
  }
  const key = slotVacanteKey(slot)
  for (const c of colaboradores) {
    if (colaboradorActivoOcupaSlot(c, slot, catalogoServicios)) {
      return {
        bloqueada: true,
        motivo: `Ya hay colaborador activo (${c.noEmpleado}) en esa posición y servicio.`,
      }
    }
  }
  const dup = catalogoVacantes.find((v) => slotVacanteKey(slotFromVacanteRegistro(v)) === key)
  if (dup) {
    return { bloqueada: true, motivo: 'Esa vacante ya está registrada en el catálogo.' }
  }
  return { bloqueada: false }
}

export function addVacanteToCatalog(
  entry: {
    planta: string
    posicion: string
    puesto?: string
    servicioLinea?: string
    rowServiceNo?: string
    notas?: string
  },
  catalogo: CatalogoServicioItem[] = [],
): VacanteRegistro | null {
  return addVacanteRegistro(entry, catalogo)
}

export function updateVacanteInCatalog(
  id: string,
  patch: VacanteRegistroPatch,
  catalogo: CatalogoServicioItem[] = [],
): VacanteRegistro | null {
  return updateVacanteRegistro(id, patch, catalogo)
}

export type { VacanteRegistroPatch }
