import { memo } from 'react'
import {
  celdasIdentificacionAsistencia,
  claseCeldaIdentificacionAsistencia,
} from '../attendanceGridColumns'
import { gridRowServiceNo } from '../cuadriculaColaboradoresBridge'
import {
  isAsistenciaCode,
  isDoubleTurnoExtraCode,
} from '../attendanceTotals'
import { WEEK_COLUMNS, type GridRow, type Turn } from '../mockData'

const TURNS: Turn[] = ['D', 'T', 'N']

function cellClass(value: string): string {
  const v = value.trim().toUpperCase()
  let cls = 'cell'
  if (!v) return cls
  if (v === 'D') cls += ' cell--rest'
  else if (v === 'F' || /^F[1-9]\d*$/i.test(v)) cls += ' cell--absence'
  else if (
    v === 'INC' ||
    v === 'VAC' ||
    v === 'PCGS' ||
    v === 'PSGS' ||
    v === 'CAP'
  )
    cls += ' cell--navy'
  else if (isDoubleTurnoExtraCode(v)) cls += ' cell--double'
  else if (isAsistenciaCode(v)) cls += ' cell--work'
  return cls
}

function cellInputTitle(
  value: string,
  locked: boolean,
  vacant: boolean,
  readOnly: boolean,
): string | undefined {
  if (readOnly) return 'Solo lectura: su rol no permite captura en cuadrícula.'
  if (locked && !vacant) return 'Día futuro: podrá capturarse cuando llegue la fecha.'
  return undefined
}

export type AttendanceGridRowProps = {
  row: GridRow
  plantaFallback: string
  dayLocked: boolean[]
  puedeEditar: boolean
  onCellChange: (rowId: string, dayIndex: number, turn: Turn, value: string) => void
}

function AttendanceGridRowInner({
  row,
  plantaFallback,
  dayLocked,
  puedeEditar,
  onCellChange,
}: AttendanceGridRowProps) {
  const rowNo = gridRowServiceNo(row)
  const idCells = celdasIdentificacionAsistencia(row, plantaFallback)

  return (
    <tr className="tr" data-vacant={row.vacant}>
      {idCells.map((val, i) => (
        <td
          key={`${row.id}-id-${i}`}
          className={claseCeldaIdentificacionAsistencia(i)}
          title={i === 0 ? row.servicioLinea || undefined : undefined}
        >
          {val}
        </td>
      ))}
      {row.shifts.map((day, dayIndex) =>
        TURNS.map((turn) => {
          const locked = dayLocked[dayIndex] ?? false
          const cellReadOnly = !puedeEditar
          const disabled = row.vacant || locked || cellReadOnly
          return (
            <td key={`${row.id}-${dayIndex}-${turn}`} className="td td--cell">
              <input
                className={`${cellClass(day[turn])}${locked && !row.vacant ? ' cell--future' : ''}${cellReadOnly ? ' cell--readonly' : ''}`}
                value={day[turn]}
                onChange={(e) => onCellChange(row.id, dayIndex, turn, e.target.value)}
                aria-label={`${row.position} ${WEEK_COLUMNS[dayIndex]?.weekday} ${turn}`}
                disabled={disabled}
                readOnly={cellReadOnly && !row.vacant && !locked}
                list={puedeEditar ? 'attendanceCodes' : undefined}
                maxLength={12}
                title={cellInputTitle(day[turn], locked, row.vacant, cellReadOnly)}
              />
            </td>
          )
        }),
      )}
      <td className="td td--total">{row.totals.asist}</td>
      <td className="td td--total">{row.totals.extra}</td>
      <td className="td td--total">{row.totals.desc}</td>
      <td className="td td--total">{row.totals.falta}</td>
      <td className="td td--total">{row.totals.inc}</td>
      <td className="td td--total">{row.totals.pcgs}</td>
      <td className="td td--total">{row.totals.psgs}</td>
      <td className="td td--total">{row.totals.vac}</td>
      <td className="td td--total">{row.totals.cap}</td>
    </tr>
  )
}

export const AttendanceGridRow = memo(AttendanceGridRowInner)
