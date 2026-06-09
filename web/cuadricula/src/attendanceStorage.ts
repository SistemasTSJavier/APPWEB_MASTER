import type { GridRow } from './mockData'
import { WEEK_COLUMNS, emptyShifts } from './mockData'
import { canonicalEmpNoAttendance, empNoClaveGridRow, indexGridRowsByEmpNo } from '@/lib/attendance-emp-no'
import {
  combineRemoteAttendanceForPlanta,
  mergeStoredAttendanceGrids,
  pushAttendanceGridRemote,
} from './attendanceRemote'
import { reassignFaltaSequence } from './attendanceFaltaSequence'
import { withComputedTotals } from './attendanceTotals'

export { canonicalEmpNoAttendance, empNoClaveGridRow }
import { gridRowServiceNo } from './cuadriculaColaboradoresBridge'

const PREFIX = 'attendance:v2'
const LATEST = `${PREFIX}:latest`

export interface AttendanceLatestPointer {
  weekStartIso: string
  /** Alcance del guardado: `planta:NOMBRE` (asistencia) o id legado de catálogo. */
  serviceCatalogId: string
  savedAt: string
}

export interface StoredAttendanceGrid {
  version: 1 | 2
  savedAt: string
  rows: GridRow[]
  /** Desde v2; ausente en guardados antiguos. */
  serviceNo?: string
}

export function weekStartToIso(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function safeCatalogIdSegment(id: string): string {
  return (id || '_none').trim().replace(/:/g, '_')
}

export function gridStorageKey(weekStartIso: string, serviceCatalogId: string): string {
  return `${PREFIX}:grid:${weekStartIso}:${safeCatalogIdSegment(serviceCatalogId)}`
}

/**
 * Combina expediente (posición/servicio actuales) con celdas guardadas.
 * La coincidencia es solo por N.º de empleado, no por posición en cuadrícula.
 */
export function mergeAttendanceRowsWithStored(base: GridRow[], storedRows: GridRow[]): GridRow[] {
  const byKey = indexGridRowsByEmpNo(storedRows)
  return base.map((br) => {
    const k = empNoClaveGridRow(br)
    const s = k ? byKey.get(k) : undefined
    if (!s?.shifts || s.shifts.length !== br.shifts.length) return br
    return {
      ...br,
      shifts: s.shifts,
      employeeNo: br.employeeNo ?? s.employeeNo ?? k,
      id: br.id,
    }
  })
}

function scopeKeyFromStorageSegment(segment: string): string {
  if (segment.startsWith('planta_')) return `planta:${segment.slice(7)}`
  return segment.replace(/_/g, ':')
}

/** Todas las cuadrículas guardadas en este navegador (para subir a Supabase). */
export function listAllLocalAttendanceEntries(): {
  weekStartIso: string
  scopeKey: string
  grid: StoredAttendanceGrid
}[] {
  const prefix = `${PREFIX}:grid:`
  const out: {
    weekStartIso: string
    scopeKey: string
    grid: StoredAttendanceGrid
  }[] = []
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i)
      if (!k?.startsWith(prefix)) continue
      const tail = k.slice(prefix.length)
      const sep = tail.indexOf(':')
      if (sep < 0) continue
      const weekStartIso = tail.slice(0, sep)
      const segment = tail.slice(sep + 1)
      const scopeKey = scopeKeyFromStorageSegment(segment)
      const grid = loadAttendanceGridByScopeSegment(weekStartIso, segment)
      if (grid?.rows?.length) {
        out.push({ weekStartIso, scopeKey, grid })
      }
    }
  } catch {
    /* private mode */
  }
  return out
}

export function summarizeLocalAttendanceEntries(): {
  total: number
  weekCount: number
  plantaCount: number
  entries: ReturnType<typeof listAllLocalAttendanceEntries>
} {
  const entries = listAllLocalAttendanceEntries()
  const weeks = new Set<string>()
  const plantas = new Set<string>()
  for (const e of entries) {
    weeks.add(e.weekStartIso)
    plantas.add(e.scopeKey)
  }
  return {
    total: entries.length,
    weekCount: weeks.size,
    plantaCount: plantas.size,
    entries,
  }
}

function saveAttendanceGridLocal(
  weekStartIso: string,
  serviceCatalogId: string,
  payload: StoredAttendanceGrid,
): boolean {
  const id = serviceCatalogId.trim()
  if (!id) return false
  const key = gridStorageKey(weekStartIso, id)
  try {
    localStorage.setItem(key, JSON.stringify(payload))
    const ptr: AttendanceLatestPointer = {
      weekStartIso,
      serviceCatalogId: id,
      savedAt: payload.savedAt,
    }
    localStorage.setItem(LATEST, JSON.stringify(ptr))
    return true
  } catch {
    return false
  }
}

function buildAttendanceGridPayload(
  rows: GridRow[],
  serviceNo: string,
  savedAt: string,
): StoredAttendanceGrid {
  const sn = serviceNo.trim()
  return {
    version: 2,
    savedAt,
    rows: rows.map((r) => {
      const no = gridRowServiceNo(r) || sn
      return withComputedTotals(r, no)
    }),
    serviceNo: sn,
  }
}

export async function saveAttendanceGrid(
  weekStartIso: string,
  serviceCatalogId: string,
  rows: GridRow[],
  serviceNo: string,
  opts?: { savedAt?: string; forceReplace?: boolean },
): Promise<boolean> {
  const id = serviceCatalogId.trim()
  if (!id) return false
  const payload = buildAttendanceGridPayload(rows, serviceNo, opts?.savedAt ?? new Date().toISOString())
  const localOk = saveAttendanceGridLocal(weekStartIso, id, payload)
  invalidateAttendanceStorageWeekCache(weekStartIso)
  const { invalidateAttendanceWeekPrefetch } = await import('./attendanceWeekPrefetch')
  invalidateAttendanceWeekPrefetch(weekStartIso)
  const remoteOk = await pushAttendanceGridRemote(weekStartIso, id, payload, serviceNo, {
    forceReplace: opts?.forceReplace,
  })
  return remoteOk || localOk
}

const SYNC_BATCH_SIZE = 6

/**
 * Guarda varias plantas de la misma semana. El servidor es la fuente de verdad:
 * SIEMPRE se sube cada planta por lotes, aunque la copia local falle (cuota llena,
 * modo privado). La copia en localStorage es solo un respaldo.
 */
export async function saveManyAttendanceGrids(
  weekStartIso: string,
  items: { scopeKey: string; rows: GridRow[]; serviceNo?: string }[],
  opts?: { forceReplace?: boolean },
): Promise<{ saved: number; failed: number }> {
  if (items.length === 0) return { saved: 0, failed: 0 }

  const { syncAllLocalAttendanceToRemote } = await import('./attendanceRemote')
  const baseMs = Date.now()
  const entries: {
    weekStartIso: string
    scopeKey: string
    grid: StoredAttendanceGrid
    serviceNo?: string
    localOk: boolean
  }[] = []

  for (let i = 0; i < items.length; i++) {
    const { scopeKey, rows, serviceNo = '' } = items[i]!
    const id = scopeKey.trim()
    if (!id || rows.length === 0) continue
    const savedAt = new Date(baseMs + i).toISOString()
    const payload = buildAttendanceGridPayload(rows, serviceNo, savedAt)
    const localOk = saveAttendanceGridLocal(weekStartIso, id, payload)
    entries.push({ weekStartIso, scopeKey: id, grid: payload, serviceNo, localOk })
  }

  invalidateAttendanceStorageWeekCache(weekStartIso)
  const { invalidateAttendanceWeekPrefetch } = await import('./attendanceWeekPrefetch')
  invalidateAttendanceWeekPrefetch(weekStartIso)

  if (entries.length === 0) {
    return { saved: 0, failed: items.length }
  }

  let saved = 0
  let failed = 0

  for (let i = 0; i < entries.length; i += SYNC_BATCH_SIZE) {
    const chunk = entries.slice(i, i + SYNC_BATCH_SIZE)
    const localOkCount = chunk.filter((e) => e.localOk).length
    const res = await syncAllLocalAttendanceToRemote(
      chunk.map(({ localOk: _omit, ...rest }) => rest),
      { forceReplace: opts?.forceReplace },
    )
    if (!res) {
      /* Servidor inaccesible: la copia local cuenta como guardado. */
      saved += localOkCount
      failed += chunk.length - localOkCount
      continue
    }
    const remoteOk = (res.uploaded ?? 0) + (res.skipped ?? 0)
    const remoteFailed = res.failed ?? 0
    const rescatadasPorLocal = Math.min(remoteFailed, localOkCount)
    saved += remoteOk + rescatadasPorLocal
    failed += Math.max(0, remoteFailed - rescatadasPorLocal)
  }

  return { saved, failed }
}

export function loadAttendanceGridLocal(
  weekStartIso: string,
  serviceCatalogId: string,
): StoredAttendanceGrid | null {
  const id = serviceCatalogId.trim()
  if (!id) return null
  try {
    const raw = localStorage.getItem(gridStorageKey(weekStartIso, id))
    if (!raw) return null
    const parsed = JSON.parse(raw) as StoredAttendanceGrid
    if (!parsed || !Array.isArray(parsed.rows)) return null
    if (parsed.version !== 1 && parsed.version !== 2) return null
    return parsed
  } catch {
    return null
  }
}

/** @deprecated Use loadAttendanceGrid */
export function loadAttendanceGrid(
  weekStartIso: string,
  serviceCatalogId: string,
): StoredAttendanceGrid | null {
  return loadAttendanceGridLocal(weekStartIso, serviceCatalogId)
}

export async function loadAttendanceGridAsync(
  weekStartIso: string,
  serviceCatalogId: string,
): Promise<StoredAttendanceGrid | null> {
  const id = serviceCatalogId.trim()
  if (!id) return null
  const local = loadAttendanceGridLocal(weekStartIso, id)
  try {
    const { fetchAttendanceGridRemote, mergeStoredAttendanceGrids, pushAttendanceGridRemote } =
      await import('./attendanceRemote')
    const remote = await fetchAttendanceGridRemote(weekStartIso, id)
    const merged = mergeStoredAttendanceGrids(remote, local)
    if (local?.rows?.length && !remote) {
      void pushAttendanceGridRemote(weekStartIso, id, local, local.serviceNo ?? '')
    }
    return merged
  } catch {
    return local
  }
}

function loadAttendanceGridByScopeSegment(
  weekStartIso: string,
  scopeSegment: string,
): StoredAttendanceGrid | null {
  try {
    const raw = localStorage.getItem(`${PREFIX}:grid:${weekStartIso}:${scopeSegment}`)
    if (!raw) return null
    const parsed = JSON.parse(raw) as StoredAttendanceGrid
    if (!parsed || !Array.isArray(parsed.rows)) return null
    if (parsed.version !== 1 && parsed.version !== 2) return null
    return parsed
  } catch {
    return null
  }
}

const weekScopeSegmentsCache = new Map<string, string[]>()

/** Segmentos de alcance en localStorage para un lunes (ej. `planta_FOO` o uuid de catálogo). */
export function listAttendanceScopeSegmentsForWeek(weekStartIso: string): string[] {
  const key = weekStartIso.trim()
  const cached = weekScopeSegmentsCache.get(key)
  if (cached) return cached
  const prefix = `${PREFIX}:grid:${key}:`
  const out: string[] = []
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i)
      if (k?.startsWith(prefix)) out.push(k.slice(prefix.length))
    }
  } catch {
    /* quota / private mode */
  }
  weekScopeSegmentsCache.set(key, out)
  return out
}

export function invalidateAttendanceStorageWeekCache(weekStartIso?: string): void {
  if (weekStartIso?.trim()) weekScopeSegmentsCache.delete(weekStartIso.trim())
  else weekScopeSegmentsCache.clear()
}

export function hasLegacyCatalogAttendanceForWeek(
  weekStartIso: string,
  plantaStorageKey: string,
): boolean {
  const plantaSeg = safeCatalogIdSegment(plantaStorageKey)
  return listAttendanceScopeSegmentsForWeek(weekStartIso).some(
    (seg) => seg !== plantaSeg && !seg.startsWith('planta_'),
  )
}

function buildAllowedEmpCanonSet(employeeNos: Iterable<string>): Set<string> | null {
  const allowed = [...employeeNos].map((n) => canonicalEmpNoAttendance(n)).filter(Boolean)
  if (allowed.length === 0) return null
  return new Set(allowed)
}

function ingestRowsIntoEmpMap(
  stored: StoredAttendanceGrid | null,
  rowByEmp: Map<string, GridRow>,
  allowedCanon: Set<string> | null,
  latestRef: { at: string },
): void {
  if (!stored?.rows?.length) return
  if (stored.savedAt && stored.savedAt > latestRef.at) latestRef.at = stored.savedAt
  const norm = normalizeStoredRows(stored.rows, stored.serviceNo)
  for (const r of norm) {
    const k = empNoClaveGridRow(r)
    if (!k) continue
    if (allowedCanon && !allowedCanon.has(k)) continue
    rowByEmp.set(k, r)
  }
}

function loadAttendanceGridForPlantaLocal(
  weekStartIso: string,
  plantaStorageKey: string,
  employeeNos: Iterable<string>,
): StoredAttendanceGrid | null {
  const scope = plantaStorageKey.trim()
  if (!scope) return null

  const allowedCanon = buildAllowedEmpCanonSet(employeeNos)
  const plantaSeg = safeCatalogIdSegment(scope)
  const rowByEmp = new Map<string, GridRow>()
  const latestRef = { at: '' }

  const direct = loadAttendanceGridLocal(weekStartIso, scope)
  ingestRowsIntoEmpMap(direct, rowByEmp, allowedCanon, latestRef)

  if (rowByEmp.size === 0) {
    for (const seg of listAttendanceScopeSegmentsForWeek(weekStartIso)) {
      if (seg === plantaSeg) continue
      if (seg.startsWith('planta_')) continue
      ingestRowsIntoEmpMap(
        loadAttendanceGridByScopeSegment(weekStartIso, seg),
        rowByEmp,
        allowedCanon,
        latestRef,
      )
    }
  }

  if (rowByEmp.size === 0) return null
  return {
    version: 2,
    savedAt: latestRef.at || new Date().toISOString(),
    rows: [...rowByEmp.values()],
  }
}

function samePlantaStorageScope(a: string, b: string): boolean {
  const na = a.trim().toUpperCase()
  const nb = b.trim().toUpperCase()
  return na === nb && na.startsWith('PLANTA:')
}

/** Fusión local + remoto sin HTTP (usa prefetch de semana). */
export function mergeStoredGridsForPlanta(
  weekStartIso: string,
  plantaStorageKey: string,
  employeeNos: Iterable<string>,
  prefetchedWeek: AttendanceWeekPrefetch,
): StoredAttendanceGrid | null {
  const scope = plantaStorageKey.trim()
  if (!scope) return null
  const local = loadAttendanceGridForPlantaLocal(weekStartIso, scope, employeeNos)
  const remote = combineRemoteAttendanceForPlanta(scope, employeeNos, prefetchedWeek.items)
  return mergeStoredAttendanceGrids(remote, local)
}

/** Igual que mergeStoredGridsForPlanta; sube a servidor si solo hay copia local. */
export function resolveMergedStoredGridForPlanta(
  weekStartIso: string,
  plantaStorageKey: string,
  employeeNos: Iterable<string>,
  prefetchedWeek: AttendanceWeekPrefetch,
): StoredAttendanceGrid | null {
  const scope = plantaStorageKey.trim()
  if (!scope) return null
  const local = loadAttendanceGridForPlantaLocal(weekStartIso, scope, employeeNos)
  const remote = combineRemoteAttendanceForPlanta(scope, employeeNos, prefetchedWeek.items)
  const merged = mergeStoredAttendanceGrids(remote, local)
  const hasRemote = prefetchedWeek.items.some((item) => {
    const sk = (item.scopeKey ?? '').trim()
    return sk && item.grid?.rows?.length && samePlantaStorageScope(sk, scope)
  })
  if (local?.rows?.length && !hasRemote) {
    void pushAttendanceGridRemote(weekStartIso, scope, local, local.serviceNo ?? '')
  }
  return merged
}

export type AttendancePlantaLoadResult = {
  grid: StoredAttendanceGrid | null
  remote: import('./attendanceRemote').RemoteAttendanceFetchMeta
}

/** Semana ya descargada del servidor (una sola petición para todas las plantas). */
export type AttendanceWeekPrefetch = {
  items: import('./attendanceRemote').RemoteAttendanceEntry[]
  meta: import('./attendanceRemote').RemoteAttendanceFetchMeta
}

/** Carga local + servidor (toda la semana remota: planta + claves legado de catálogo). */
export async function loadAttendanceGridForPlantaWithMeta(
  weekStartIso: string,
  plantaStorageKey: string,
  employeeNos: Iterable<string>,
  prefetchedWeek?: AttendanceWeekPrefetch | null,
): Promise<AttendancePlantaLoadResult> {
  const scope = plantaStorageKey.trim()
  if (!scope) {
    return { grid: null, remote: { status: 'empty' } }
  }
  let meta: import('./attendanceRemote').RemoteAttendanceFetchMeta
  let merged: StoredAttendanceGrid | null

  if (prefetchedWeek) {
    meta = prefetchedWeek.meta
    merged = resolveMergedStoredGridForPlanta(
      weekStartIso,
      scope,
      employeeNos,
      prefetchedWeek,
    )
  } else {
    const { getAttendanceWeekPrefetch } = await import('./attendanceWeekPrefetch')
    const fetched = await getAttendanceWeekPrefetch(weekStartIso)
    meta = fetched.meta
    const local = loadAttendanceGridForPlantaLocal(weekStartIso, scope, employeeNos)
    const remote = combineRemoteAttendanceForPlanta(scope, employeeNos, fetched.items)
    merged = mergeStoredAttendanceGrids(remote, local)
    if (local?.rows?.length && !remote) {
      void pushAttendanceGridRemote(weekStartIso, scope, local, local.serviceNo ?? '')
    }
  }

  const hasData = Boolean(merged?.rows?.length)
  const remoteStatus =
    meta.status === 'ok' || meta.status === 'empty'
      ? hasData
        ? { status: 'ok' as const }
        : meta
      : meta

  return { grid: merged, remote: remoteStatus }
}

/** Carga local + servidor (producción comparte Supabase). */
export async function loadAttendanceGridForPlanta(
  weekStartIso: string,
  plantaStorageKey: string,
  employeeNos: Iterable<string>,
  prefetchedWeek?: AttendanceWeekPrefetch | null,
): Promise<StoredAttendanceGrid | null> {
  const { grid } = await loadAttendanceGridForPlantaWithMeta(
    weekStartIso,
    plantaStorageKey,
    employeeNos,
    prefetchedWeek,
  )
  return grid
}

export function loadLatestPointer(): AttendanceLatestPointer | null {
  try {
    const raw = localStorage.getItem(LATEST)
    if (!raw) return null
    const p = JSON.parse(raw) as Partial<AttendanceLatestPointer> & { serviceIdx?: number }
    if (
      p &&
      typeof p.weekStartIso === 'string' &&
      typeof p.savedAt === 'string' &&
      typeof p.serviceCatalogId === 'string' &&
      p.serviceCatalogId.trim()
    ) {
      return {
        weekStartIso: p.weekStartIso,
        serviceCatalogId: p.serviceCatalogId.trim(),
        savedAt: p.savedAt,
      }
    }
    return null
  } catch {
    return null
  }
}

/** Asegura 7 días de turnos y totales coherentes. */
export function normalizeStoredRows(
  rows: unknown,
  serviceNoForTotals?: string,
): GridRow[] {
  if (!Array.isArray(rows)) return []
  const out: GridRow[] = []
  for (const r of rows) {
    if (!r || typeof r !== 'object') continue
    const o = r as Record<string, unknown>
    const shiftsRaw = o.shifts
    let shifts =
      Array.isArray(shiftsRaw) && shiftsRaw.length === WEEK_COLUMNS.length
        ? (shiftsRaw as GridRow['shifts'])
        : emptyShifts(WEEK_COLUMNS.length)
    shifts = shifts.map((day) => ({
      D: typeof day?.D === 'string' ? day.D : '',
      T: typeof day?.T === 'string' ? day.T : '',
      N: typeof day?.N === 'string' ? day.N : '',
    }))
    shifts = reassignFaltaSequence(shifts)
    let employeeNo: string | null =
      typeof o.employeeNo === 'string' && o.employeeNo.trim() ? o.employeeNo.trim() : null
    if (!employeeNo && typeof o.id === 'string') {
      const fromId = canonicalEmpNoAttendance(o.id)
      if (fromId) employeeNo = fromId
    }
    const rowId =
      typeof o.id === 'string' && o.id.trim()
        ? o.id.trim()
        : employeeNo ?? crypto.randomUUID()
    const base: GridRow = {
      id: rowId,
      position: typeof o.position === 'string' ? o.position : '',
      role: typeof o.role === 'string' ? o.role : '',
      hireDate: typeof o.hireDate === 'string' ? o.hireDate : '',
      employeeNo,
      name: typeof o.name === 'string' ? o.name : '',
      rowServiceNo: typeof o.rowServiceNo === 'string' ? o.rowServiceNo : undefined,
      servicioLinea: typeof o.servicioLinea === 'string' ? o.servicioLinea : undefined,
      plantaLinea: typeof o.plantaLinea === 'string' ? o.plantaLinea : undefined,
      vacant: Boolean(o.vacant),
      estatus:
        o.estatus === 'BAJA' || o.estatus === 'ACTIVO' ? o.estatus : undefined,
      fechaBaja: typeof o.fechaBaja === 'string' ? o.fechaBaja : undefined,
      shifts,
      totals: {
        asist: 0,
        extra: 0,
        desc: 0,
        falta: 0,
        inc: 0,
        pcgs: 0,
        psgs: 0,
        vac: 0,
        cap: 0,
      },
    }
    out.push(withComputedTotals(base, serviceNoForTotals))
  }
  return out
}

/** Interpreta YYYY-MM-DD como fecha local (medianoche). */
export function parseIsoToLocalDate(iso: string): Date {
  const [ys, ms, ds] = iso.split('-').map((x) => Number(x))
  const y = ys || 1970
  const m0 = (ms || 1) - 1
  const d = ds || 1
  const dt = new Date(y, m0, d)
  dt.setHours(0, 0, 0, 0)
  return dt
}
