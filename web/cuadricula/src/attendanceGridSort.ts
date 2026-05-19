import type { GridRow } from './mockData'

function normPosicion(p: string): string {
  const t = p.trim().toUpperCase()
  return t === '—' || t === '-' ? '' : t
}

function compareEmployeeNo(a: GridRow, b: GridRow): number {
  const ea = String(a.employeeNo ?? a.id ?? '').trim()
  const eb = String(b.employeeNo ?? b.id ?? '').trim()
  if (!ea && !eb) return 0
  if (!ea) return 1
  if (!eb) return -1
  return ea.localeCompare(eb, 'es', { numeric: true })
}

/** Orden de filas como en cuadrícula: posición (natural), vacantes al final del mismo bloque, luego N.º empleado. */
export function compareGridRowsByPosicion(a: GridRow, b: GridRow): number {
  const pa = normPosicion(a.position)
  const pb = normPosicion(b.position)
  if (!pa && !pb) return compareEmployeeNo(a, b)
  if (!pa) return 1
  if (!pb) return -1
  const c = pa.localeCompare(pb, 'es', { numeric: true })
  if (c !== 0) return c
  if (a.vacant !== b.vacant) return a.vacant ? 1 : -1
  return compareEmployeeNo(a, b)
}

/** Vista «todos»: servicio, luego posición. */
export function compareGridRowsByServicioYPosicion(a: GridRow, b: GridRow): number {
  const sa = (a.servicioLinea ?? '').trim().toUpperCase()
  const sb = (b.servicioLinea ?? '').trim().toUpperCase()
  const cs = sa.localeCompare(sb, 'es', { numeric: true })
  if (cs !== 0) return cs
  const pa = (a.plantaLinea ?? '').trim().toUpperCase()
  const pb = (b.plantaLinea ?? '').trim().toUpperCase()
  const cp = pa.localeCompare(pb, 'es', { numeric: true })
  if (cp !== 0) return cp
  return compareGridRowsByPosicion(a, b)
}

export function sortGridRowsByPosicion(rows: GridRow[]): GridRow[] {
  return [...rows].sort(compareGridRowsByPosicion)
}

export function sortGridRowsByServicioYPosicion(rows: GridRow[]): GridRow[] {
  return [...rows].sort(compareGridRowsByServicioYPosicion)
}
