import type { GridRow } from './mockData'
import { gridRowServiceNo } from './cuadriculaColaboradoresBridge'

/** Columnas de identificación (orden fijo en pantalla y exportación). */
export const ATTENDANCE_GRID_ID_HEADERS = [
  'SERVICIO',
  'NO. SERVICIO',
  'PLANTA',
  'POSICION',
  'PUESTO',
  'FECHA DE INGRESO',
  'NO. DE EMPLEADO',
  'NOMBRES',
] as const

export const ATTENDANCE_GRID_ID_COL_COUNT = ATTENDANCE_GRID_ID_HEADERS.length

/** Clases por columna de identificación (índice 0–7). */
export function claseCeldaIdentificacionAsistencia(index: number): string {
  const base = 'td td--sticky'
  switch (index) {
    case 0:
      return `${base} td--servicio text-xs`
    case 1:
      return `${base} mono td--noServicio`
    case 2:
      return `${base} mono td--planta`
    case 5:
      return `${base} nowrap td--fechaIngreso`
    case 6:
      return `${base} mono td--noEmpleado`
    case 7:
      return `${base} td--name`
    default:
      return base
  }
}

export function plantaCeldaFila(row: GridRow, plantaFallback = ''): string {
  const p = (row.plantaLinea ?? plantaFallback).trim().toUpperCase()
  return p || '—'
}

/** Valores de las 8 columnas de identificación, en el mismo orden que ATTENDANCE_GRID_ID_HEADERS. */
export function celdasIdentificacionAsistencia(
  row: GridRow,
  plantaFallback = '',
): string[] {
  return [
    (row.servicioLinea ?? '').trim().toUpperCase() || '—',
    gridRowServiceNo(row) || '—',
    plantaCeldaFila(row, plantaFallback),
    row.position,
    row.role,
    row.hireDate,
    row.vacant ? '' : String(row.employeeNo ?? ''),
    row.vacant ? 'VACANTE' : row.name,
  ]
}
