import type { ColaboradorCompleto } from '@/lib/colaboradores-types'
import { posicionLaboralColaborador } from '@/lib/colaboradores-catalogo-display'
import { colaboradorTieneBaja } from '@/lib/colaboradores-baja'
import { coincideColaboradorPlantaExpediente } from './cuadriculaColaboradoresBridge'
import { normPosicionKey } from '@/lib/vacantes-slot'
import {
  colaboradorCoincideSlot,
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
  type VacanteRegistro,
} from '@/lib/vacantes-catalog'

export {
  VACANTES_CATALOG_UPDATED_EVENT,
  loadVacantesCatalogo,
  removeVacanteFromCatalog,
  saveVacantesCatalogoDirect,
  type VacanteRegistro,
}

function saveVacantesCatalogo(items: VacanteRegistro[]): boolean {
  return saveVacantesCatalogoDirect(items)
}

export function listVacantesPorPlanta(planta: string): VacanteRegistro[] {
  const p = planta.trim().toUpperCase()
  if (!p) return []
  return loadVacantesCatalogo().filter((v) => v.planta === p)
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
    if (colaboradorTieneBaja(c)) continue
    if (colaboradorCoincideSlot(c, slot, catalogoServicios)) {
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
  patch: Partial<Pick<VacanteRegistro, 'puesto' | 'servicioLinea' | 'rowServiceNo' | 'notas'>>,
): boolean {
  const all = loadVacantesCatalogo()
  let found = false
  const next = all.map((v) => {
    if (v.id !== id) return v
    found = true
    return {
      ...v,
      puesto: patch.puesto !== undefined ? patch.puesto.trim().toUpperCase() || undefined : v.puesto,
      servicioLinea:
        patch.servicioLinea !== undefined
          ? patch.servicioLinea.trim().toUpperCase() || undefined
          : v.servicioLinea,
      rowServiceNo:
        patch.rowServiceNo !== undefined ? patch.rowServiceNo.trim() || undefined : v.rowServiceNo,
      notas: patch.notas !== undefined ? patch.notas.trim() || undefined : v.notas,
      updatedAt: new Date().toISOString(),
    }
  })
  if (!found) return false
  return saveVacantesCatalogo(next)
}
