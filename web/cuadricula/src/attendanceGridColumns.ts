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
  'NO DE EMPLEADO',
  'NOMBRE',
] as const

export const ATTENDANCE_GRID_ID_COL_COUNT = ATTENDANCE_GRID_ID_HEADERS.length

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
