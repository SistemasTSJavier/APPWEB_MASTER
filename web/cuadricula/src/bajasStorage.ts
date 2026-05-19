import type { BajasRow } from './bajasMock'
import { emptyBajasShifts } from './bajasMock'

const PREFIX = 'bajas:v1'
const LATEST = `${PREFIX}:latest`

export interface BajasLatestPointer {
  weekStartIso: string
  serviceIdx: number
  savedAt: string
}

export interface StoredBajasGrid {
  version: 2
  savedAt: string
  rows: BajasRow[]
  serviceNo?: string
}

function gridKey(weekStartIso: string, serviceIdx: number): string {
  return `${PREFIX}:grid:${weekStartIso}:${serviceIdx}`
}

export function saveBajasGrid(
  weekStartIso: string,
  serviceIdx: number,
  rows: BajasRow[],
  serviceNo: string,
): boolean {
  const payload: StoredBajasGrid = {
    version: 2,
    savedAt: new Date().toISOString(),
    rows,
    serviceNo: serviceNo.trim(),
  }
  try {
    localStorage.setItem(gridKey(weekStartIso, serviceIdx), JSON.stringify(payload))
    const ptr: BajasLatestPointer = {
      weekStartIso,
      serviceIdx,
      savedAt: payload.savedAt,
    }
    localStorage.setItem(LATEST, JSON.stringify(ptr))
    return true
  } catch {
    return false
  }
}

export function loadBajasGrid(
  weekStartIso: string,
  serviceIdx: number,
): StoredBajasGrid | null {
  try {
    const raw = localStorage.getItem(gridKey(weekStartIso, serviceIdx))
    if (!raw) return null
    const parsed = JSON.parse(raw) as StoredBajasGrid
    if (!parsed || parsed.version !== 2 || !Array.isArray(parsed.rows)) return null
    return parsed
  } catch {
    return null
  }
}

export function loadBajasLatestPointer(): BajasLatestPointer | null {
  try {
    const raw = localStorage.getItem(LATEST)
    if (!raw) return null
    return JSON.parse(raw) as BajasLatestPointer
  } catch {
    return null
  }
}

export function normalizeBajasRows(rows: unknown): BajasRow[] {
  if (!Array.isArray(rows)) return []
  const out: BajasRow[] = []
  const template = emptyBajasShifts()
  for (const r of rows) {
    if (!r || typeof r !== 'object') continue
    const o = r as Record<string, unknown>
    const shiftsRaw = o.shifts
    let shifts =
      Array.isArray(shiftsRaw) && shiftsRaw.length === template.length
        ? (shiftsRaw as BajasRow['shifts'])
        : [...template]
    shifts = shifts.map((_, i) => {
      const d = (Array.isArray(shiftsRaw) && shiftsRaw[i]) || {}
      const x = d as { D?: unknown; T?: unknown; N?: unknown }
      return {
        D: typeof x.D === 'string' ? x.D : '',
        T: typeof x.T === 'string' ? x.T : '',
        N: typeof x.N === 'string' ? x.N : '',
      }
    })
    out.push({
      id: typeof o.id === 'string' ? o.id : crypto.randomUUID(),
      servicio: typeof o.servicio === 'string' ? o.servicio : '',
      noServicio: typeof o.noServicio === 'string' ? o.noServicio : '',
      planta: typeof o.planta === 'string' ? o.planta : '',
      posicion: typeof o.posicion === 'string' ? o.posicion : '',
      puesto: typeof o.puesto === 'string' ? o.puesto : '',
      fechaIngreso: typeof o.fechaIngreso === 'string' ? o.fechaIngreso : '',
      noEmpleado: typeof o.noEmpleado === 'string' ? o.noEmpleado : '',
      nombres: typeof o.nombres === 'string' ? o.nombres : '',
      fechaBaja: typeof o.fechaBaja === 'string' ? o.fechaBaja : undefined,
      shifts,
    })
  }
  return out
}
