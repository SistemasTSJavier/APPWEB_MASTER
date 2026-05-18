import type { GridRow } from './mockData'
import { WEEK_COLUMNS, emptyShifts } from './mockData'
import { reassignFaltaSequence } from './attendanceFaltaSequence'
import { withComputedTotals } from './attendanceTotals'
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

/** Combina filas del expediente con celdas guardadas en localStorage (misma semana / planta o alcance). */
export function mergeAttendanceRowsWithStored(base: GridRow[], storedRows: GridRow[]): GridRow[] {
  const byKey = new Map<string, GridRow>()
  for (const r of storedRows) {
    const k = String(r.employeeNo ?? r.id ?? '').trim()
    if (k) byKey.set(k, r)
  }
  return base.map((br) => {
    const k = String(br.employeeNo ?? br.id ?? '').trim()
    const s = k ? byKey.get(k) : undefined
    if (!s?.shifts || s.shifts.length !== br.shifts.length) return br
    return { ...br, shifts: s.shifts }
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

export async function saveAttendanceGrid(
  weekStartIso: string,
  serviceCatalogId: string,
  rows: GridRow[],
  serviceNo: string,
): Promise<boolean> {
  const id = serviceCatalogId.trim()
  if (!id) return false
  const payload: StoredAttendanceGrid = {
    version: 2,
    savedAt: new Date().toISOString(),
    rows: rows.map((r) => {
      const no = gridRowServiceNo(r) || serviceNo.trim()
      return withComputedTotals(r, no)
    }),
    serviceNo: serviceNo.trim(),
  }
  const localOk = saveAttendanceGridLocal(weekStartIso, id, payload)
  const { pushAttendanceGridRemote } = await import('./attendanceRemote')
  await pushAttendanceGridRemote(weekStartIso, id, payload, serviceNo)
  return localOk
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

/** Segmentos de alcance en localStorage para un lunes (ej. `planta_FOO` o uuid de catálogo). */
export function listAttendanceScopeSegmentsForWeek(weekStartIso: string): string[] {
  const prefix = `${PREFIX}:grid:${weekStartIso}:`
  const out: string[] = []
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i)
      if (k?.startsWith(prefix)) out.push(k.slice(prefix.length))
    }
  } catch {
    /* quota / private mode */
  }
  return out
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

function loadAttendanceGridForPlantaLocal(
  weekStartIso: string,
  plantaStorageKey: string,
  employeeNos: Iterable<string>,
): StoredAttendanceGrid | null {
  const scope = plantaStorageKey.trim()
  if (!scope) return null

  const allowed = new Set(
    [...employeeNos].map((n) => String(n).trim()).filter(Boolean),
  )
  const plantaSeg = safeCatalogIdSegment(scope)
  const segments = listAttendanceScopeSegmentsForWeek(weekStartIso)
  const rowByEmp = new Map<string, GridRow>()
  let latestSavedAt = ''

  const ingest = (stored: StoredAttendanceGrid | null) => {
    if (!stored?.rows?.length) return
    if (stored.savedAt && stored.savedAt > latestSavedAt) latestSavedAt = stored.savedAt
    const norm = normalizeStoredRows(stored.rows, stored.serviceNo)
    for (const r of norm) {
      const k = String(r.employeeNo ?? r.id ?? '').trim()
      if (!k) continue
      if (allowed.size > 0 && !allowed.has(k)) continue
      rowByEmp.set(k, r)
    }
  }

  for (const seg of segments) {
    if (seg === plantaSeg) continue
    if (seg.startsWith('planta_')) continue
    ingest(loadAttendanceGridByScopeSegment(weekStartIso, seg))
  }

  ingest(loadAttendanceGridLocal(weekStartIso, scope))

  if (rowByEmp.size === 0) return null
  return {
    version: 2,
    savedAt: latestSavedAt || new Date().toISOString(),
    rows: [...rowByEmp.values()],
  }
}

export type AttendancePlantaLoadResult = {
  grid: StoredAttendanceGrid | null
  remote: import('./attendanceRemote').RemoteAttendanceFetchMeta
}

/** Carga local + servidor (toda la semana remota: planta + claves legado de catálogo). */
export async function loadAttendanceGridForPlantaWithMeta(
  weekStartIso: string,
  plantaStorageKey: string,
  employeeNos: Iterable<string>,
): Promise<AttendancePlantaLoadResult> {
  const scope = plantaStorageKey.trim()
  if (!scope) {
    return { grid: null, remote: { status: 'empty' } }
  }
  const local = loadAttendanceGridForPlantaLocal(weekStartIso, scope, employeeNos)
  const {
    fetchAttendanceWeekRemote,
    combineRemoteAttendanceForPlanta,
    mergeStoredAttendanceGrids,
    pushAttendanceGridRemote,
  } = await import('./attendanceRemote')

  const { items, meta } = await fetchAttendanceWeekRemote(weekStartIso)
  const remote = combineRemoteAttendanceForPlanta(scope, employeeNos, items)
  const merged = mergeStoredAttendanceGrids(remote, local)

  if (local?.rows?.length && !remote) {
    void pushAttendanceGridRemote(weekStartIso, scope, local, local.serviceNo ?? '')
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
): Promise<StoredAttendanceGrid | null> {
  const { grid } = await loadAttendanceGridForPlantaWithMeta(
    weekStartIso,
    plantaStorageKey,
    employeeNos,
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
    const base: GridRow = {
      id: typeof o.id === 'string' ? o.id : crypto.randomUUID(),
      position: typeof o.position === 'string' ? o.position : '',
      role: typeof o.role === 'string' ? o.role : '',
      hireDate: typeof o.hireDate === 'string' ? o.hireDate : '',
      employeeNo: typeof o.employeeNo === 'string' ? o.employeeNo : null,
      name: typeof o.name === 'string' ? o.name : '',
      vacant: Boolean(o.vacant),
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
