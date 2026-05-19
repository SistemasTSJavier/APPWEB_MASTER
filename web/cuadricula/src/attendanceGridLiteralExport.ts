import type { WeekColumn } from './mockData'
import type { GridRow } from './mockData'
import {
  ATTENDANCE_GRID_ID_HEADERS,
  celdasIdentificacionAsistencia,
} from './attendanceGridColumns'
import { sortGridRowsByPosicion, sortGridRowsByServicioYPosicion } from './attendanceGridSort'

const TURNS = ['D', 'T', 'N'] as const

function escapeCsvDelimCell(delim: ';' | ',', s: string): string {
  const v = String(s ?? '')
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .replace(/\t/g, ' ')
  if (/["\n]/.test(v) || v.includes(delim)) {
    return `"${v.replace(/"/g, '""')}"`
  }
  return v
}

function shiftHeaderLabels(columns: WeekColumn[]): string[] {
  const out: string[] = []
  for (let i = 0; i < columns.length; i++) {
    const day = columns[i]?.weekday ?? `D${i + 1}`
    for (const t of TURNS) {
      out.push(`${day} ${t}`)
    }
  }
  return out
}

export type AttendanceLiteralExportOpts = {
  delim?: ';' | ','
  plantaFallback?: string
  sortTodos?: boolean
}

/**
 * CSV con las mismas columnas y datos que la tabla en pantalla (identificación + turnos + totales).
 */
export function buildAttendanceGridLiteralCsv(
  gridRows: GridRow[],
  weekColumns: WeekColumn[],
  opts: AttendanceLiteralExportOpts = {},
): string {
  const delim = opts.delim ?? ';'
  const plantaFallback = opts.plantaFallback ?? ''
  const sorted = opts.sortTodos
    ? sortGridRowsByServicioYPosicion(gridRows)
    : sortGridRowsByPosicion(gridRows)

  const totalHeaders = [
    'Asist.',
    'Extra',
    'Desc.',
    'Falta',
    'Inc.',
    'PCGS',
    'PSGS',
    'Vac.',
    'Cap.',
  ]

  const headers = [
    ...ATTENDANCE_GRID_ID_HEADERS,
    ...shiftHeaderLabels(weekColumns),
    ...totalHeaders,
  ]
  const lines: string[] = [headers.map((h) => escapeCsvDelimCell(delim, h)).join(delim)]

  for (const row of sorted) {
    const cells: string[] = [...celdasIdentificacionAsistencia(row, plantaFallback)]
    for (const day of row.shifts) {
      cells.push(day.D, day.T, day.N)
    }
    cells.push(
      String(row.totals.asist),
      String(row.totals.extra),
      String(row.totals.desc),
      String(row.totals.falta),
      String(row.totals.inc),
      String(row.totals.pcgs),
      String(row.totals.psgs),
      String(row.totals.vac),
      String(row.totals.cap),
    )
    lines.push(cells.map((c) => escapeCsvDelimCell(delim, c)).join(delim))
  }

  return lines.join('\r\n')
}

export function attendanceLiteralCsvFilename(
  scopeLabel: string,
  weekStartIso: string,
): string {
  const base =
    scopeLabel
      .trim()
      .replace(/[\\/:*?"<>|]+/g, '-')
      .replace(/\s+/g, ' ')
      .slice(0, 80) || 'asistencia'
  const wk = weekStartIso.trim().replace(/[^\d-]/g, '')
  return `asistencia-tabla-${base}-${wk || 'semana'}.csv`
}
