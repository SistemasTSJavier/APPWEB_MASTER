import { canonicalEmpNoAttendance, empNoClaveGridRow } from '@/lib/attendance-emp-no'
import type { AttendanceLatestPointer, StoredAttendanceGrid } from './attendanceStorage'

export type RemoteAttendanceEntry = {
  weekStartIso: string
  scopeKey: string
  grid: StoredAttendanceGrid
  serviceNo?: string
  savedAt?: string
}

export type RemoteAttendanceFetchMeta = {
  status: 'ok' | 'empty' | 'no_config' | 'auth' | 'forbidden' | 'error'
  message?: string
  httpStatus?: number
}

async function parseJsonResponse<T>(r: Response): Promise<T | null> {
  if (r.status === 404 || r.status === 204) return null
  if (!r.ok) {
    const t = await r.text()
    throw new Error(t || `HTTP ${r.status}`)
  }
  const text = await r.text()
  if (!text.trim()) return null
  return JSON.parse(text) as T
}

function metaFromHttpStatus(status: number, bodyText?: string): RemoteAttendanceFetchMeta {
  if (status === 503) {
    return {
      status: 'no_config',
      httpStatus: status,
      message:
        'El servidor de producción no tiene Supabase configurado (SUPABASE_SERVICE_ROLE_KEY y NEXT_PUBLIC_SUPABASE_URL). La asistencia no se puede leer del servidor.',
    }
  }
  if (status === 401) {
    return {
      status: 'auth',
      httpStatus: status,
      message: 'Sesión expirada. Cierra sesión y vuelve a entrar para cargar la asistencia del servidor.',
    }
  }
  if (status === 403) {
    return {
      status: 'forbidden',
      httpStatus: status,
      message: 'Tu rol no puede leer asistencia en el servidor. Pide acceso a Cuadrícula (admin, rh, aux_rh, etc.).',
    }
  }
  return {
    status: 'error',
    httpStatus: status,
    message: bodyText?.trim() || `No se pudo cargar asistencia del servidor (HTTP ${status}).`,
  }
}

function normalizeScopeKey(sk: string): string {
  return sk.trim().toUpperCase()
}

function isSamePlantaScope(a: string, b: string): boolean {
  const na = normalizeScopeKey(a)
  const nb = normalizeScopeKey(b)
  return na === nb && na.startsWith('PLANTA:')
}

/** Todas las cuadrículas de una semana en servidor (incluye claves legado de catálogo). */
export async function fetchAttendanceWeekRemote(weekStartIso: string): Promise<{
  items: RemoteAttendanceEntry[]
  meta: RemoteAttendanceFetchMeta
}> {
  const params = new URLSearchParams({ weekStartIso: weekStartIso.trim() })
  try {
    const r = await fetch(`/api/asistencia?${params}`, {
      cache: 'no-store',
      credentials: 'same-origin',
    })
    if (r.status === 503) {
      return { items: [], meta: metaFromHttpStatus(503) }
    }
    if (!r.ok) {
      const t = await r.text()
      return { items: [], meta: metaFromHttpStatus(r.status, t) }
    }
    const text = await r.text()
    if (!text.trim()) {
      return { items: [], meta: { status: 'empty' } }
    }
    const data = JSON.parse(text) as
      | { items?: RemoteAttendanceEntry[] }
      | RemoteAttendanceEntry
      | null
    if (!data) {
      return { items: [], meta: { status: 'empty' } }
    }
    if ('items' in data && Array.isArray(data.items)) {
      const items = data.items.filter((it) => it?.grid?.rows?.length)
      return {
        items,
        meta: items.length > 0 ? { status: 'ok' } : { status: 'empty' },
      }
    }
    if ('grid' in data && data.grid?.rows?.length) {
      return { items: [data as RemoteAttendanceEntry], meta: { status: 'ok' } }
    }
    return { items: [], meta: { status: 'empty' } }
  } catch (e) {
    return {
      items: [],
      meta: {
        status: 'error',
        message: e instanceof Error ? e.message : 'Error de red al cargar asistencia.',
      },
    }
  }
}

/** Fusiona bloques remotos de la semana: planta actual + guardados legado por id de catálogo. */
export function combineRemoteAttendanceForPlanta(
  plantaScopeKey: string,
  employeeNos: Iterable<string>,
  items: RemoteAttendanceEntry[],
): StoredAttendanceGrid | null {
  const scope = plantaScopeKey.trim()
  if (!scope || items.length === 0) return null

  const allowed = new Set(
    [...employeeNos].map((n) => String(n).trim()).filter(Boolean),
  )

  let combined: StoredAttendanceGrid | null = null

  const ingest = (grid: StoredAttendanceGrid | null | undefined) => {
    if (!grid?.rows?.length) return
    combined = mergeStoredAttendanceGrids(combined, grid)
  }

  for (const item of items) {
    const sk = (item.scopeKey ?? '').trim()
    const grid = item.grid
    if (!sk || !grid?.rows?.length) continue

    if (isSamePlantaScope(sk, scope)) {
      ingest(grid)
      continue
    }

    if (normalizeScopeKey(sk).startsWith('PLANTA:')) continue

    let rows = grid.rows
    if (allowed.size > 0) {
      rows = rows.filter((r) => {
        const k = empNoClaveGridRow(r)
        if (!k) return false
        const allowedCanon = new Set(
          [...allowed].map((n) => canonicalEmpNoAttendance(n)).filter(Boolean),
        )
        return allowedCanon.has(k)
      })
    }
    if (rows.length === 0) continue
    ingest({ ...grid, rows })
  }

  return combined
}

/** Una cuadrícula en servidor (semana + alcance exacto). */
export async function fetchAttendanceGridRemote(
  weekStartIso: string,
  scopeKey: string,
): Promise<StoredAttendanceGrid | null> {
  const params = new URLSearchParams({
    weekStartIso: weekStartIso.trim(),
    scopeKey: scopeKey.trim(),
  })
  try {
    const r = await fetch(`/api/asistencia?${params}`, {
      cache: 'no-store',
      credentials: 'same-origin',
    })
    if (r.status === 503 || r.status === 401 || r.status === 403) return null
    const data = await parseJsonResponse<{
      grid?: StoredAttendanceGrid
      scopeKey?: string
    } | null>(r)
    if (!data || !data.grid?.rows) return null
    return data.grid
  } catch {
    return null
  }
}

export async function pushAttendanceGridRemote(
  weekStartIso: string,
  scopeKey: string,
  grid: StoredAttendanceGrid,
  serviceNo: string,
): Promise<boolean> {
  try {
    const r = await fetch('/api/asistencia', {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        weekStartIso: weekStartIso.trim(),
        scopeKey: scopeKey.trim(),
        grid,
        serviceNo: serviceNo.trim(),
      }),
    })
    if (r.status === 503) return false
    return r.ok
  } catch {
    return false
  }
}

/** Sube todo lo que haya en localStorage (migración local → Supabase). */
export async function syncAllLocalAttendanceToRemote(
  items: { weekStartIso: string; scopeKey: string; grid: StoredAttendanceGrid; serviceNo?: string }[],
): Promise<{ uploaded: number; skipped: number; failed: number } | null> {
  if (items.length === 0) return { uploaded: 0, skipped: 0, failed: 0 }
  try {
    const r = await fetch('/api/asistencia/sync', {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ items }),
    })
    if (r.status === 503) return null
    if (!r.ok) return null
    const j = (await r.json()) as {
      uploaded?: number
      skipped?: number
      failed?: number
    }
    return {
      uploaded: j.uploaded ?? 0,
      skipped: j.skipped ?? 0,
      failed: j.failed ?? 0,
    }
  } catch {
    return null
  }
}

export function mergeStoredAttendanceGrids(
  a: StoredAttendanceGrid | null,
  b: StoredAttendanceGrid | null,
): StoredAttendanceGrid | null {
  if (!a?.rows?.length) return b
  if (!b?.rows?.length) return a
  const aAt = a.savedAt ?? ''
  const bAt = b.savedAt ?? ''
  const [older, newer] = aAt >= bAt ? [b, a] : [a, b]
  const rowByKey = new Map<string, (typeof newer.rows)[0]>()
  for (const r of older.rows) {
    const k = empNoClaveGridRow(r)
    if (k) rowByKey.set(k, r)
  }
  for (const r of newer.rows) {
    const k = empNoClaveGridRow(r)
    if (k) rowByKey.set(k, r)
  }
  return {
    version: 2,
    savedAt: newer.savedAt ?? a.savedAt ?? b.savedAt,
    rows: [...rowByKey.values()],
    serviceNo: newer.serviceNo ?? older.serviceNo,
  }
}

export type { AttendanceLatestPointer }
