import type { ColaboradorCompleto } from '@/lib/colaboradores-types'
import type { GridRow, Turn, WeekColumn } from './mockData'
import { WEEK_COLUMNS } from './mockData'
import type { CatalogoServicioItem } from '@/lib/servicios-catalogo-client'
import { listarPlantasDeColaboradores } from './cuadriculaColaboradoresBridge'
import { mergeGridRowsForPlantaWeek } from './attendanceSemanaColaborador'
import { weekStartToIso } from './attendanceStorage'

export type AttendanceExportAlcance = 'planta' | 'todas_plantas'

export type AttendanceExportPeriod = 'semana' | 'mes' | 'anual' | 'toda'

export function mondayOfWeek(d: Date): Date {
  const c = new Date(d)
  c.setHours(0, 0, 0, 0)
  const day = c.getDay()
  const diff = day === 0 ? -6 : 1 - day
  c.setDate(c.getDate() + diff)
  return c
}

export function addDays(d: Date, n: number): Date {
  const x = new Date(d)
  x.setDate(x.getDate() + n)
  return x
}

export function formatDateEs(d: Date): string {
  const dd = String(d.getDate()).padStart(2, '0')
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const yyyy = d.getFullYear()
  return `${dd}/${mm}/${yyyy}`
}

/** Fecha local medianoche → `YYYY-MM-DD` (inputs `type="date"`). */
export function dateToIsoYmdLocal(d: Date): string {
  const x = new Date(d.getFullYear(), d.getMonth(), d.getDate())
  const y = x.getFullYear()
  const m = String(x.getMonth() + 1).padStart(2, '0')
  const day = String(x.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

/** Parse estricto `YYYY-MM-DD` como fecha local. */
export function parseIsoYmdToLocalDate(iso: string): Date | null {
  const t = String(iso ?? '').trim()
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(t)
  if (!m) return null
  const y = Number(m[1])
  const mo = Number(m[2])
  const d = Number(m[3])
  const dt = new Date(y, mo - 1, d)
  dt.setHours(0, 0, 0, 0)
  if (dt.getFullYear() !== y || dt.getMonth() !== mo - 1 || dt.getDate() !== d) return null
  return dt
}

/** Lunes de cada semana (lun–dom) que intersecta el rango inclusive [desde, hasta]. */
export function mondaysIntersectingDateRange(desde: Date, hasta: Date): Date[] {
  const a = new Date(desde.getFullYear(), desde.getMonth(), desde.getDate())
  const b = new Date(hasta.getFullYear(), hasta.getMonth(), hasta.getDate())
  if (a > b) return []
  let wk = mondayOfWeek(a)
  const out: Date[] = []
  while (wk <= b) {
    const sun = addDays(wk, 6)
    if (sun >= a && wk <= b) out.push(new Date(wk))
    wk = addDays(wk, 7)
  }
  return out
}

export function isFaltaCode(raw: string): boolean {
  return /^F[1-9]\d*$/i.test(raw.trim())
}

export interface DayMeta {
  date: Date
  weekday: string
  dateLabel: string
}

export function weekDayMetas(
  weekStartMonday: Date,
  columns: WeekColumn[],
): DayMeta[] {
  return columns.map((col, i) => {
    const date = addDays(weekStartMonday, i)
    return {
      date,
      weekday: col.weekday,
      dateLabel: formatDateEs(date),
    }
  })
}

function lastDayOfMonth(y: number, m0: number): Date {
  return new Date(y, m0 + 1, 0)
}

/** Lunes de cada semana (lun–dom) que intersecta el mes calendario `yyyy-mm`. */
export function mondaysInCalendarMonth(ym: string): Date[] {
  const [ys, ms] = ym.split('-').map((x) => Number(x))
  const y = ys || new Date().getFullYear()
  const m0 = (ms || 1) - 1
  const monthStart = new Date(y, m0, 1)
  monthStart.setHours(0, 0, 0, 0)
  const monthEnd = new Date(y, m0 + 1, 0)
  monthEnd.setHours(0, 0, 0, 0)
  let wk = mondayOfWeek(monthStart)
  while (addDays(wk, 6) < monthStart) {
    wk = addDays(wk, 7)
  }
  const list: Date[] = []
  while (wk <= monthEnd) {
    list.push(new Date(wk))
    wk = addDays(wk, 7)
  }
  return list
}

/** Lunes de cada semana que intersecta el año calendario `year`. */
export function mondaysIntersectingCalendarYear(year: number): Date[] {
  const yearStart = new Date(year, 0, 1)
  yearStart.setHours(0, 0, 0, 0)
  const yearEnd = new Date(year, 11, 31)
  yearEnd.setHours(0, 0, 0, 0)
  let wk = mondayOfWeek(yearStart)
  while (addDays(wk, 6) < yearStart) {
    wk = addDays(wk, 7)
  }
  const list: Date[] = []
  while (wk <= yearEnd) {
    list.push(new Date(wk))
    wk = addDays(wk, 7)
  }
  return list
}

export function exportRangeLabel(
  period: AttendanceExportPeriod,
  weekStartMonday: Date,
  monthYm: string,
  yearY?: string,
): { title: string; from: Date; to: Date } {
  const weekEnd = addDays(weekStartMonday, 6)
  if (period === 'semana') {
    return {
      title: 'Semana (lunes a domingo inclusive)',
      from: weekStartMonday,
      to: weekEnd,
    }
  }
  if (period === 'mes') {
    const [ys, ms] = monthYm.split('-').map(Number)
    const y = ys ?? weekStartMonday.getFullYear()
    const m0 = (ms ?? weekStartMonday.getMonth() + 1) - 1
    const from = new Date(y, m0, 1)
    from.setHours(0, 0, 0, 0)
    const to = lastDayOfMonth(y, m0)
    to.setHours(0, 0, 0, 0)
    return { title: 'Mes calendario', from, to }
  }
  if (period === 'anual') {
    const y = Number.parseInt(String(yearY ?? '').trim(), 10)
    const yy = Number.isFinite(y) ? y : weekStartMonday.getFullYear()
    const from = new Date(yy, 0, 1)
    from.setHours(0, 0, 0, 0)
    const to = new Date(yy, 11, 31)
    to.setHours(0, 0, 0, 0)
    return { title: `Año calendario ${yy}`, from, to }
  }
  return {
    title: 'Todo el período visible en cuadrícula',
    from: weekStartMonday,
    to: weekEnd,
  }
}

function filterRowsByEmployeeKeys(rows: GridRow[], keys?: string[]): GridRow[] {
  if (!keys?.length) return rows
  const set = new Set(keys.map((k) => k.trim()).filter(Boolean))
  return rows.filter((r) => set.has(String(r.employeeNo ?? r.id ?? '').trim()))
}

function escapeCsvSemicolonCell(s: string): string {
  const v = (s ?? '')
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .replace(/\t/g, ' ')
  if (/[\n;"]/.test(v)) {
    return `"${v.replace(/"/g, '""')}"`
  }
  return v
}

function csvSemicolonLine(cells: string[]): string {
  return cells.map(escapeCsvSemicolonCell).join(';')
}

const TURNS_FALTA: Turn[] = ['D', 'T', 'N']

/** Fechas (dd/mm/aaaa) con falta numerada en la semana, sin repetir. */
function collectFaltaDatesForRow(row: GridRow, dayMetas: DayMeta[]): string {
  const seen = new Set<string>()
  const ordered: string[] = []
  for (let dayIndex = 0; dayIndex < dayMetas.length; dayIndex++) {
    const day = row.shifts[dayIndex]
    if (!day) continue
    const meta = dayMetas[dayIndex]
    for (const turn of TURNS_FALTA) {
      if (isFaltaCode(day[turn])) {
        const label = meta.dateLabel
        if (!seen.has(label)) {
          seen.add(label)
          ordered.push(label)
        }
      }
    }
  }
  return ordered.join('; ')
}

/** Tabla CSV (separador `;`) para Excel regional en español + UTF-8 BOM al descargar. */
function buildCuadriculaExportWeekTotalsCsv(
  rows: GridRow[],
  dayMetas: DayMeta[],
): string {
  const head = [
    'Posición',
    'Puesto',
    'Fecha ing.',
    'No. empleado',
    'Nombres',
    'Asist.',
    'Extra',
    'Desc.',
    'Falta',
    'Inc.',
    'PCGS',
    'PSGS',
    'Vac.',
    'Cap.',
    'Fechas faltas',
  ]
  const lines: string[] = []
  lines.push(csvSemicolonLine(head))
  for (const row of rows) {
    if (row.vacant) continue
    const t = row.totals
    const left = [
      row.position,
      row.role,
      row.hireDate,
      row.employeeNo ?? '',
      row.name,
    ]
    const nums = [
      String(t.asist),
      String(t.extra),
      String(t.desc),
      String(t.falta),
      String(t.inc),
      String(t.pcgs),
      String(t.psgs),
      String(t.vac),
      String(t.cap),
    ]
    const faltaDates = collectFaltaDatesForRow(row, dayMetas)
    lines.push(csvSemicolonLine([...left, ...nums, faltaDates]))
  }
  return lines.join('\r\n')
}

/**
 * Una tabla por semana (CSV con `;`) + columna de fechas de faltas.
 * Si hay varias semanas (mes/año), cada bloque lleva `-- Semana … --`.
 */
export function buildCuadriculaExportTotalsSheetsForWeeks(
  weeks: { monday: Date; rows: GridRow[] }[],
): string {
  const multiWeek = weeks.length > 1
  const parts: string[] = []
  for (const { monday, rows } of weeks) {
    const metas = weekDayMetas(monday, WEEK_COLUMNS)
    const block = buildCuadriculaExportWeekTotalsCsv(rows, metas)
    if (multiWeek) {
      const weekEnd = addDays(monday, 6)
      parts.push(
        `-- Semana ${formatDateEs(monday)} – ${formatDateEs(weekEnd)} --`,
        '',
        block,
        '',
      )
    } else {
      parts.push(block, '')
    }
  }
  return parts.join('\r\n').trimEnd()
}

/**
 * Exporta totales por semana para todas las semanas que cortan [desdeIso, hastaIso] (fechas inclusive).
 */
export function buildAttendanceExportDateRangeFullText(opts: {
  serviceNo: string
  desdeIso: string
  hastaIso: string
  colaboradores: ColaboradorCompleto[]
  plantaNombre: string
  catalogo: CatalogoServicioItem[]
  restrictEmployeeKeys?: string[]
}): string {
  const desde = parseIsoYmdToLocalDate(opts.desdeIso)
  const hasta = parseIsoYmdToLocalDate(opts.hastaIso)
  if (!desde || !hasta || desde > hasta) return ''
  const mondays = mondaysIntersectingDateRange(desde, hasta)
  const weeks: { monday: Date; rows: GridRow[] }[] = []
  for (const monday of mondays) {
    const wiso = weekStartToIso(monday)
    const merged = mergeGridRowsForPlantaWeek(
      opts.colaboradores,
      opts.plantaNombre,
      opts.catalogo,
      wiso,
    )
    const rowsWeek = filterRowsByEmployeeKeys(merged, opts.restrictEmployeeKeys)
    weeks.push({ monday, rows: rowsWeek })
  }
  return buildCuadriculaExportTotalsSheetsForWeeks(weeks)
}

/**
 * Mes: una tabla por semana (totales + fechas de faltas).
 */
export function buildAttendanceExportMesFullText(opts: {
  serviceNo: string
  monthYm: string
  colaboradores: ColaboradorCompleto[]
  plantaNombre: string
  catalogo: CatalogoServicioItem[]
  restrictEmployeeKeys?: string[]
}): string {
  const { monthYm, colaboradores, plantaNombre, catalogo, restrictEmployeeKeys } = opts
  const [ys, ms] = monthYm.split('-').map((x) => Number(x))
  const y = ys || new Date().getFullYear()
  const m0 = (ms || 1) - 1
  const from = new Date(y, m0, 1)
  const to = lastDayOfMonth(y, m0)
  return buildAttendanceExportDateRangeFullText({
    serviceNo: opts.serviceNo,
    desdeIso: dateToIsoYmdLocal(from),
    hastaIso: dateToIsoYmdLocal(to),
    colaboradores,
    plantaNombre,
    catalogo,
    restrictEmployeeKeys,
  })
}

/**
 * Año: una tabla por semana (totales + fechas de faltas).
 */
export function buildAttendanceExportAnualFullText(opts: {
  serviceNo: string
  yearY: string
  colaboradores: ColaboradorCompleto[]
  plantaNombre: string
  catalogo: CatalogoServicioItem[]
  restrictEmployeeKeys?: string[]
}): string {
  const y = Number.parseInt(opts.yearY.trim(), 10)
  const yy = Number.isFinite(y) ? y : new Date().getFullYear()
  return buildAttendanceExportDateRangeFullText({
    serviceNo: opts.serviceNo,
    desdeIso: `${yy}-01-01`,
    hastaIso: `${yy}-12-31`,
    colaboradores: opts.colaboradores,
    plantaNombre: opts.plantaNombre,
    catalogo: opts.catalogo,
    restrictEmployeeKeys: opts.restrictEmployeeKeys,
  })
}

export function attendanceExportFilename(
  nombreServicio: string,
  desde: Date,
  hasta: Date,
): string {
  const base =
    nombreServicio
      .trim()
      .replace(/[\\/:*?"<>|]+/g, '-')
      .replace(/\s+/g, ' ')
      .replace(/^\.+/, '')
      .slice(0, 120) || 'asistencia'
  const s = formatDateEs(desde).replace(/\//g, '-')
  const e = formatDateEs(hasta).replace(/\//g, '-')
  return `${base} ${s} a ${e}.csv`
}

export function attendanceExportFilenameAllPlantas(desde: Date, hasta: Date): string {
  const s = formatDateEs(desde).replace(/\//g, '-')
  const e = formatDateEs(hasta).replace(/\//g, '-')
  return `asistencia-todas-plantas ${s} a ${e}.csv`
}

/**
 * Totales por semana, un bloque por planta (todas las del expediente).
 * Respeta semana/mes/año vía rango Desde–Hasta.
 */
export function buildCuadriculaExportTotalsByPlantas(opts: {
  desdeIso: string
  hastaIso: string
  colaboradores: ColaboradorCompleto[]
  catalogo: CatalogoServicioItem[]
  restrictEmployeeKeys?: string[]
  /** Planta en pantalla: usa filas actuales para esa semana (export semanal). */
  plantaEnPantalla?: string
  rowsEnPantalla?: GridRow[]
  weekMondayEnPantalla?: Date
}): string {
  const desde = parseIsoYmdToLocalDate(opts.desdeIso)
  const hasta = parseIsoYmdToLocalDate(opts.hastaIso)
  if (!desde || !hasta || desde > hasta) return ''

  const plantas = listarPlantasDeColaboradores(opts.colaboradores)
  if (plantas.length === 0) return ''

  const mondays = mondaysIntersectingDateRange(desde, hasta)
  const plantaPantallaNorm = opts.plantaEnPantalla?.trim().toUpperCase() ?? ''
  const wisoPantalla = opts.weekMondayEnPantalla
    ? weekStartToIso(opts.weekMondayEnPantalla)
    : ''

  const parts: string[] = []
  for (const planta of plantas) {
    const weeks: { monday: Date; rows: GridRow[] }[] = []
    for (const monday of mondays) {
      const wiso = weekStartToIso(monday)
      const esSemanaEnPantalla =
        plantaPantallaNorm &&
        wisoPantalla &&
        planta.trim().toUpperCase() === plantaPantallaNorm &&
        wiso === wisoPantalla &&
        opts.rowsEnPantalla

      const merged = esSemanaEnPantalla
        ? opts.rowsEnPantalla!
        : mergeGridRowsForPlantaWeek(
            opts.colaboradores,
            planta,
            opts.catalogo,
            wiso,
          )
      weeks.push({
        monday,
        rows: filterRowsByEmployeeKeys(merged, opts.restrictEmployeeKeys),
      })
    }
    const block = buildCuadriculaExportTotalsSheetsForWeeks(weeks)
    if (!block.trim()) continue
    parts.push(`-- PLANTA: ${planta.trim().toUpperCase()} --`, '', block, '')
  }
  return parts.join('\r\n').trimEnd()
}

export function downloadTextFile(filename: string, content: string): void {
  const isCsv = filename.toLowerCase().endsWith('.csv')
  const body = isCsv ? `\uFEFF${content}` : content
  const blob = new Blob([body], {
    type: isCsv ? 'text/csv;charset=utf-8' : 'text/plain;charset=utf-8',
  })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}
