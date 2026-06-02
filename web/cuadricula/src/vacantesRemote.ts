import { saveVacantesCatalogoDirect } from '@/lib/vacantes-catalog'
import {
  fetchVacantesCatalogRemote,
  pushVacantesCatalogRemote,
  type VacantesCatalogRemoteMeta,
} from '@/lib/vacantes-catalog-remote'
import { loadVacantesCatalogo } from './vacantesStorage'

export type VacantesRemoteMeta = VacantesCatalogRemoteMeta

export { fetchVacantesCatalogRemote, pushVacantesCatalogRemote }

/** Lee localStorage y lo publica en Supabase. */
export async function syncLocalVacantesCatalogToRemote(): Promise<{
  ok: boolean
  uploaded: number
  message: string
}> {
  const local = loadVacantesCatalogo()
  if (local.length === 0) {
    return {
      ok: false,
      uploaded: 0,
      message: 'No hay vacantes en este navegador (localStorage vacío).',
    }
  }
  const result = await pushVacantesCatalogRemote(local)
  if (!result.ok) {
    return {
      ok: false,
      uploaded: 0,
      message: result.meta?.message ?? 'No se pudo subir el catálogo al servidor.',
    }
  }
  return {
    ok: true,
    uploaded: result.uploaded,
    message: `Catálogo subido a producción: ${result.uploaded} vacante(s).`,
  }
}

/** Descarga producción y sobrescribe el catálogo local del navegador. */
export async function pullVacantesCatalogFromRemoteToLocal(): Promise<{
  ok: boolean
  count: number
  message: string
}> {
  const { items, meta } = await fetchVacantesCatalogRemote()
  if (meta.status === 'no_config') {
    return { ok: false, count: 0, message: meta.message ?? 'Supabase no configurado.' }
  }
  if (meta.status === 'auth' || meta.status === 'forbidden') {
    return { ok: false, count: 0, message: meta.message ?? 'No autorizado.' }
  }
  if (meta.status === 'error') {
    return { ok: false, count: 0, message: meta.message ?? 'Error al cargar.' }
  }
  if (items.length === 0) {
    return { ok: false, count: 0, message: 'En producción no hay vacantes guardadas aún.' }
  }
  const saved = saveVacantesCatalogoDirect(items)
  if (!saved) {
    return { ok: false, count: 0, message: 'No se pudo guardar en localStorage de este navegador.' }
  }
  return {
    ok: true,
    count: items.length,
    message: `Catálogo descargado: ${items.length} vacante(s) en este navegador.`,
  }
}
