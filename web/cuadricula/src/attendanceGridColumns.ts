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

/** Vacío o marcador de celda sin dato en cuadrícula. */
export function valorIdentificacionAsistenciaVacio(v: string | undefined | null): boolean {
  const t = String(v ?? '').trim()
  return !t || t === '—' || t === '-'
}

/** Elige el primer valor útil (expediente, catálogo o guardado). */
export function elegirValorIdentificacionAsistencia(
  ...candidatos: (string | undefined | null)[]
): string {
  for (const c of candidatos) {
    const t = String(c ?? '').trim()
    if (!valorIdentificacionAsistenciaVacio(t)) return t
  }
  return ''
}

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
  const servicio = elegirValorIdentificacionAsistencia(row.servicioLinea).toUpperCase()
  const noSrv = elegirValorIdentificacionAsistencia(gridRowServiceNo(row))
  const posicion = elegirValorIdentificacionAsistencia(row.position).toUpperCase()
  const puesto = elegirValorIdentificacionAsistencia(row.role).toUpperCase()
  const ingreso = elegirValorIdentificacionAsistencia(row.hireDate).toUpperCase()
  const nombre = elegirValorIdentificacionAsistencia(row.name).toUpperCase()
  return [
    servicio || '—',
    noSrv || '—',
    plantaCeldaFila(row, plantaFallback),
    posicion || '—',
    puesto || '—',
    ingreso || '—',
    row.vacant ? '' : String(row.employeeNo ?? '').trim(),
    row.vacant ? 'VACANTE' : nombre || '—',
  ]
}
