import type { BajasRow } from './bajasMock'
import type { Turn } from './mockData'
import {
  type AttendanceExportPeriod,
  type DayMeta,
  exportRangeLabel,
  formatDateEs,
  isFaltaCode,
} from './attendanceExportSummary'

const TURNS: Turn[] = ['D', 'T', 'N']

function atMidnight(d: Date): number {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime()
}

function dateInRange(d: Date, from: Date, to: Date): boolean {
  const t = atMidnight(d)
  return t >= atMidnight(from) && t <= atMidnight(to)
}

function bajasDetailLines(
  rows: BajasRow[],
  dayMetas: DayMeta[],
  weekdayLabels: string[],
): string[] {
  const lines: string[] = []
  lines.push('DETALLE DE CELDAS (historial en pantalla)')
  lines.push('')
  if (rows.length === 0) {
    lines.push('No hay personas en baja para listar.')
    return lines
  }
  for (const row of rows) {
    lines.push(
      `— ${row.nombres}  (No. empleado: ${row.noEmpleado}, n.º servicio fila: ${row.noServicio})`,
    )
    let any = false
    dayMetas.forEach((meta, dayIndex) => {
      const day = row.shifts[dayIndex]
      if (!day) return
      const wday = weekdayLabels[dayIndex] ?? meta.weekday
      for (const turn of TURNS) {
        const raw = day[turn].trim()
        if (!raw) continue
        any = true
        lines.push(`    • ${meta.dateLabel} (${wday}) turno ${turn}: ${raw}`)
      }
    })
    if (!any) lines.push('    (sin códigos en la semana mostrada)')
    lines.push('')
  }
  return lines
}

export function buildBajasHistoryExportText(opts: {
  serviceLabel: string
  serviceLabels?: string[]
  serviceNo?: string
  fechaBajaDesde?: string
  fechaBajaHasta?: string
  period: AttendanceExportPeriod
  weekStartMonday: Date
  monthYm: string
  rows: BajasRow[]
  dayMetas: DayMeta[]
  weekdayLabels: string[]
}): string {
  const {
    serviceLabel,
    serviceLabels,
    serviceNo,
    fechaBajaDesde,
    fechaBajaHasta,
    period,
    weekStartMonday,
    monthYm,
    rows,
    dayMetas,
    weekdayLabels,
  } = opts
  const { title, from, to } = exportRangeLabel(period, weekStartMonday, monthYm)

  const lines: string[] = []
  lines.push('HISTORIAL DE ASISTENCIA — PERSONAL EN BAJA')
  lines.push(`Generado: ${formatDateEs(new Date())}`)
  if (serviceLabels && serviceLabels.length > 1) {
    lines.push(`Servicios (filtro): ${serviceLabels.join(' · ')}`)
  } else {
    lines.push(`Servicio (filtro): ${serviceLabel}`)
  }
  if (serviceNo?.trim()) lines.push(`No. de servicio (filtro): ${serviceNo.trim()}`)
  if (fechaBajaDesde?.trim() || fechaBajaHasta?.trim()) {
    const d = fechaBajaDesde?.trim() || '—'
    const h = fechaBajaHasta?.trim() || '—'
    lines.push(`Fecha de baja (filtro): ${d} a ${h}`)
  }
  lines.push(`Periodo del resumen: ${title}`)
  lines.push(`Rango considerado: ${formatDateEs(from)} – ${formatDateEs(to)}`)
  if (period === 'mes') {
    lines.push(
      'Nota: la tabla muestra una semana; las faltas listadas son la intersección con el mes elegido.',
    )
  }
  lines.push('')
  lines.push('Solo lectura / resumen: refleja el historial de asistencia cargado (cuadrícula por planta).')
  lines.push('')

  if (rows.length === 0) {
    lines.push('No hay registros de baja en pantalla para esta combinación.')
    return lines.join('\n')
  }

  let anyFalta = false
  for (const row of rows) {
    lines.push('—')
    const fb = row.fechaBaja?.trim()
    const fbTxt = fb && fb !== '—' ? `, fecha baja: ${fb}` : ''
    lines.push(
      `${row.nombres}  (No. empleado: ${row.noEmpleado}, servicio: ${row.servicio}${fbTxt})`,
    )
    const faltas: { dateStr: string; weekday: string; turn: Turn; code: string }[] = []
    dayMetas.forEach((meta, dayIndex) => {
      if (!dateInRange(meta.date, from, to)) return
      const day = row.shifts[dayIndex]
      if (!day) return
      const wday = weekdayLabels[dayIndex] ?? meta.weekday
      for (const turn of TURNS) {
        const v = day[turn].trim()
        if (isFaltaCode(v)) {
          faltas.push({
            dateStr: meta.dateLabel,
            weekday: wday,
            turn,
            code: v.toUpperCase(),
          })
        }
      }
    })
    if (faltas.length > 0) anyFalta = true
    if (faltas.length === 0) {
      lines.push('  Sin faltas (F…) en el periodo seleccionado.')
    } else {
      lines.push(`  Faltas (${faltas.length} registro(s) de turno):`)
      for (const f of faltas) {
        lines.push(
          `    • ${f.dateStr} (${f.weekday}) — turno ${f.turn}: ${f.code}`,
        )
      }
    }
    lines.push('')
  }

  if (!anyFalta) {
    lines.push('Resumen global: ninguna falta (F…) en el periodo seleccionado.')
    lines.push('')
  }

  lines.push('='.repeat(56))
  lines.push('')
  lines.push(...bajasDetailLines(rows, dayMetas, weekdayLabels))

  return lines.join('\n')
}
