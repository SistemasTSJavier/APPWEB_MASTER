import type { VacanteRegistro } from '@/lib/vacantes-catalog'
import { saveVacantesCatalogoDirect } from '@/lib/vacantes-catalog'
import { loadVacantesCatalogo } from './vacantesStorage'

export type VacantesRemoteMeta = {
  status: 'ok' | 'empty' | 'no_config' | 'auth' | 'forbidden' | 'error'
  message?: string
  httpStatus?: number
}

function metaFromHttpStatus(status: number, bodyText?: string): VacantesRemoteMeta {
  if (status === 503) {
    return {
      status: 'no_config',
      httpStatus: status,
      message:
        'El servidor no tiene Supabase configurado (SUPABASE_SERVICE_ROLE_KEY y NEXT_PUBLIC_SUPABASE_URL).',
    }
  }
  if (status === 401) {
    return {
      status: 'auth',
      httpStatus: status,
      message: 'Sesión expirada. Vuelva a iniciar sesión.',
    }
  }
  if (status === 403) {
    return {
      status: 'forbidden',
      httpStatus: status,
      message: 'Su rol no puede sincronizar vacantes en el servidor.',
    }
  }
  return {
    status: 'error',
    httpStatus: status,
    message: bodyText?.trim() || `Error del servidor (HTTP ${status}).`,
  }
}

/** Catálogo en Supabase (producción). */
export async function fetchVacantesCatalogRemote(): Promise<{
  items: VacanteRegistro[]
  savedAt: string | null
  meta: VacantesRemoteMeta
}> {
  try {
    const r = await fetch('/api/vacantes/catalog', {
      cache: 'no-store',
      credentials: 'same-origin',
    })
    if (!r.ok) {
      const t = await r.text()
      return { items: [], savedAt: null, meta: metaFromHttpStatus(r.status, t) }
    }
    const data = (await r.json()) as { items?: VacanteRegistro[]; savedAt?: string | null }
    const items = Array.isArray(data.items) ? data.items : []
    return {
      items,
      savedAt: data.savedAt ?? null,
      meta: items.length > 0 ? { status: 'ok' } : { status: 'empty' },
    }
  } catch (e) {
    return {
      items: [],
      savedAt: null,
      meta: {
        status: 'error',
        message: e instanceof Error ? e.message : 'Error de red al cargar vacantes.',
      },
    }
  }
}

/** Sube el catálogo completo al servidor (reemplaza producción). */
export async function pushVacantesCatalogRemote(
  items: VacanteRegistro[],
): Promise<{ ok: boolean; uploaded: number; savedAt?: string; meta?: VacantesRemoteMeta }> {
  const savedAt = new Date().toISOString()
  try {
    const r = await fetch('/api/vacantes/catalog', {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ items, savedAt }),
    })
    if (!r.ok) {
      const t = await r.text()
      return { ok: false, uploaded: 0, meta: metaFromHttpStatus(r.status, t) }
    }
    const j = (await r.json()) as { uploaded?: number; savedAt?: string }
    return {
      ok: true,
      uploaded: j.uploaded ?? items.length,
      savedAt: j.savedAt ?? savedAt,
    }
  } catch (e) {
    return {
      ok: false,
      uploaded: 0,
      meta: {
        status: 'error',
        message: e instanceof Error ? e.message : 'Error de red al subir vacantes.',
      },
    }
  }
}

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
