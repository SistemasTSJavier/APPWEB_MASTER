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

export function saveAttendanceGrid(
  weekStartIso: string,
  serviceCatalogId: string,
  rows: GridRow[],
  serviceNo: string,
): boolean {
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

export function loadAttendanceGrid(
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

/**
 * Carga asistencia por planta y, si no hay guardado con clave `planta:…`,
 * recupera filas de guardados antiguos por id de servicio en catálogo (mismo navegador/semana).
 */
export function loadAttendanceGridForPlanta(
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

  ingest(loadAttendanceGrid(weekStartIso, scope))

  if (rowByEmp.size === 0) return null
  return {
    version: 2,
    savedAt: latestSavedAt || new Date().toISOString(),
    rows: [...rowByEmp.values()],
  }
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
