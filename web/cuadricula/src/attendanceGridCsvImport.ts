import { canonicalEmpNoAttendance } from '@/lib/attendance-emp-no'
import { normalizarCeldaCsvNumerica } from '@/lib/csv'
import type { ColaboradorCompleto } from '@/lib/colaboradores-types'
import {
  canonicalNoServicioCatalogo,
  findCatalogoPorNombreYPlanta,
  findCatalogoPorNumeroYPlanta,
  reconcileRowServiceNo,
} from '@/lib/colaboradores-catalogo-display'
import type { CatalogoServicioItem } from '@/lib/servicios-catalogo-client'
import { reassignFaltaSequence } from './attendanceFaltaSequence'
import { saveManyAttendanceGrids } from './attendanceStorage'
import { withComputedTotals } from './attendanceTotals'
import { colaboradorTieneBaja } from '@/lib/colaboradores-baja'
import {
  colaboradorToGridRow,
  listarPlantasDeColaboradores,
  gridRowServiceNo,
  plantaToStorageKey,
} from './cuadriculaColaboradoresBridge'
import { enrichGridRowsEstatus } from './attendancePlantaMerge'
import {
  mergeGridRowsForPlantaWeek,
  mergeGridRowsForPlantaWeekForCsvImport,
} from './attendanceSemanaColaborador'
import { sortGridRowsByPosicion } from './attendanceGridSort'
import {
  ATTENDANCE_GRID_ID_HEADERS,
  celdasIdentificacionAsistencia,
} from './attendanceGridColumns'
import type { GridRow } from './mockData'

/** Cabeceras estándar (8 columnas de identificación + 21 códigos). */
export const ATTENDANCE_GRID_CSV_FIXED_HEADERS: readonly string[] = ATTENDANCE_GRID_ID_HEADERS

/** Alias: mismas cabeceras que la cuadrícula en pantalla. */
export const ATTENDANCE_GRID_CSV_PLANTA_SHEET_HEADERS = ATTENDANCE_GRID_CSV_FIXED_HEADERS

/** Columnas D-T-N repetidas 7 veces (Lun…Dom), para plantilla compacta. */
export const ATTENDANCE_GRID_CSV_SHIFT_HEADERS_EXAMPLE: string[] = (() => {
  const days = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom']
  const turns = ['D', 'T', 'N'] as const
  const out: string[] = []
  for (const d of days) {
    for (const t of turns) out.push(`${d}-${t}`)
  }
  return out
})()

/** Cabeceras solo D / T / N × 7 (como en Excel del usuario). */
export const ATTENDANCE_GRID_CSV_SHIFT_HEADERS_DTN: string[] = (() => {
  const out: string[] = []
  for (let i = 0; i < 7; i++) out.push('D', 'T', 'N')
  return out
})()

const MIN_COLS_COMPACT = 5 + 21

export type CsvDelimiter = ';' | ',' | '\t'

function stripDiacritics(s: string): string {
  return s.normalize('NFD').replace(/[\u0300-\u036f]/g, '')
}

function normHeaderCell(s: string): string {
  return stripDiacritics(s)
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ')
}

/**
 * Iguala números de empleado entre archivo y cuadrícula (ceros a la izquierda, Excel 12345.0, texto forzado con apóstrofe).
 */
export function canonicalEmpNoForCsvMatch(raw: string): string {
  return canonicalEmpNoAttendance(raw)
}

/** @deprecated Use canonicalNoServicioCatalogo */
export const canonicalNoServicioForCsvMatch = canonicalNoServicioCatalogo

export function noServicioCsvMatches(a: string, b: string): boolean {
  const ca = canonicalNoServicioCatalogo(a)
  const cb = canonicalNoServicioCatalogo(b)
  if (!ca || !cb) return false
  return ca === cb
}

function normServicioNombreCsv(s: string): string {
  return s.trim().replace(/\s+/g, ' ').toUpperCase()
}

/** Una línea CSV con separador variable (`;`, `,` o tab) respetando comillas `"`. */
export function splitCsvDelimitedLine(line: string, delim: CsvDelimiter): string[] {
  const out: string[] = []
  let cur = ''
  let i = 0
  let inQuotes = false
  while (i < line.length) {
    const c = line[i]!
    if (inQuotes) {
      if (c === '"') {
        if (line[i + 1] === '"') {
          cur += '"'
          i += 2
          continue
        }
        inQuotes = false
        i++
        continue
      }
      cur += c
      i++
      continue
    }
    if (c === '"') {
      inQuotes = true
      i++
      continue
    }
    if (c === delim) {
      out.push(cur)
      cur = ''
      i++
      continue
    }
    cur += c
    i++
  }
  out.push(cur)
  return out
}

/** @deprecated Prefer splitCsvDelimitedLine(..., ';'). */
export function splitCsvSemicolonLine(line: string): string[] {
  return splitCsvDelimitedLine(line, ';')
}

function delimLabel(d: CsvDelimiter): string {
  if (d === '\t') return 'tabulador'
  return d === ';' ? 'punto y coma' : 'coma'
}

/** Texto para mensajes al usuario. */
export function csvDelimiterUserHint(d: CsvDelimiter): string {
  return delimLabel(d)
}

function pickDelimiter(firstLine: string): CsvDelimiter {
  const candidates: CsvDelimiter[] = [';', ',', '\t']
  const scored = candidates.map((d) => ({
    d,
    n: splitCsvDelimitedLine(firstLine, d).length,
  }))
  const ok = scored.filter((x) => x.n >= MIN_COLS_COMPACT)
  if (ok.length > 0) {
    const semi = ok.find((x) => x.d === ';')
    if (semi) return ';'
    const tab = ok.find((x) => x.d === '\t')
    if (tab) return '\t'
    return ','
  }
  return scored.reduce((a, b) => (a.n >= b.n ? a : b)).d
}

function matchesEmpleadoHeader(norm: string): boolean {
  const c = norm.replace(/\s/g, '').replace(/_/g, '')
  return (
    norm === 'no. empleado' ||
    norm === 'no empleado' ||
    norm === 'no. de empleado' ||
    c === 'no.empleado' ||
    c === 'no.deempleado' ||
    c === 'noempleado' ||
    c === 'nodeempleado' ||
    norm === '# empleado' ||
    norm === 'no.de empleado' ||
    norm === 'no de empleado' ||
    norm === 'clave' ||
    c === 'clave' ||
    norm.includes('no de emple') ||
    (norm.includes('no') && norm.includes('emple') && !norm.includes('servicio'))
  )
}

function matchesNombresHeader(norm: string): boolean {
  return norm === 'nombres' || norm === 'nombre' || norm.includes('nombre')
}

function matchesPosicionHeader(norm: string): boolean {
  return norm.includes('posicion')
}

function matchesPlantaHeader(norm: string): boolean {
  return norm.includes('planta') && !norm.includes('servicio')
}

/** Normaliza nombre de planta (igual que expediente / catálogo). */
export function normPlantaCsv(s: string): string {
  return s.trim().replace(/\s+/g, ' ').toUpperCase()
}

function findPlantaColumnIndex(header: string[]): number {
  const h = header.map(normHeaderCell)
  for (let i = 0; i < h.length; i++) {
    if (matchesPlantaHeader(h[i]!)) return i
  }
  return -1
}

/** Índice de la columna «No. empleado» (o equivalente). */
function findEmployeeColumnIndex(header: string[]): number {
  const h = header.map(normHeaderCell)
  for (let i = 0; i < h.length; i++) {
    if (matchesEmpleadoHeader(h[i]!)) return i
  }
  return -1
}

function findServicioColsInHeader(header: string[]): {
  servicioCol?: number
  noServicioCol?: number
} {
  const h = header.map(normHeaderCell)
  let servicioCol: number | undefined
  let noServicioCol: number | undefined
  for (let i = 0; i < h.length; i++) {
    const n = h[i]!
    const compact = n.replace(/\s/g, '')
    if (
      !servicioCol &&
      n.includes('servicio') &&
      !n.includes('no') &&
      !n.includes('planta') &&
      !n.includes('posicion')
    ) {
      servicioCol = i
    }
    if (
      !noServicioCol &&
      ((n.includes('no') && n.includes('servicio')) ||
        compact === 'noservicio' ||
        compact === 'no_servicio' ||
        compact === 'no.deservicio')
    ) {
      noServicioCol = i
    }
  }
  return { servicioCol, noServicioCol }
}

/** Fusiona turnos: gana el código no vacío (útil si el CSV repite el mismo N° en varias filas). */
export function mergeShiftsPreferNonEmpty(
  a: GridRow['shifts'],
  b: GridRow['shifts'],
): GridRow['shifts'] {
  const out: GridRow['shifts'] = []
  for (let d = 0; d < 7; d++) {
    const da = a[d] ?? { D: '', T: '', N: '' }
    const db = b[d] ?? { D: '', T: '', N: '' }
    out.push({
      D: (db.D ?? '').trim() || (da.D ?? '').trim(),
      T: (db.T ?? '').trim() || (da.T ?? '').trim(),
      N: (db.N ?? '').trim() || (da.N ?? '').trim(),
    })
  }
  return reassignFaltaSequence(out)
}

/**
 * Importación en una sola planta en pantalla: no filtra por columna PLANTA del CSV.
 * La asistencia se aplica solo por N.º de empleado (evita omitir filas como 7803 cuando el CSV trae otra planta en celdas).
 */
export function filterCsvRowsForPlantaNombre(
  rows: ParsedAttendanceGridCsvRow[],
  _plantaNombre: string,
): { rows: ParsedAttendanceGridCsvRow[]; omittedOtherPlanta: number } {
  return { rows, omittedOtherPlanta: 0 }
}

export interface AttendanceCsvLayout {
  /** Columna No. empleado. */
  empCol: number
  /** Primera columna de los 21 códigos (después de Nombre). */
  shiftStart: number
  /** Columna «NO SERVICIO» (formato hoja planta); opcional. */
  noServicioCol?: number
  /** Columna SERVICIO (nombre en catálogo); opcional. */
  servicioCol?: number
  /** Columna PLANTA (importación multi-planta en un solo CSV). */
  plantaCol?: number
}

function normalizeShiftCode(raw: string): string {
  const t = String(raw ?? '').trim()
  if (!t) return ''
  return t.toUpperCase()
}

const ATTENDANCE_CODE_CELL = /^[A-Z]{1,6}(\d{0,2})?$/

function cellLooksLikeAttendanceCode(raw: string): boolean {
  const v = normalizeShiftCode(raw)
  if (!v) return false
  return ATTENDANCE_CODE_CELL.test(v)
}

function headerRowLooksLikeAttendance(header: string[]): boolean {
  return findEmployeeColumnIndex(header) >= 0
}

function findNombresColumnIndex(header: string[]): number {
  const h = header.map(normHeaderCell)
  for (let i = 0; i < h.length; i++) {
    if (matchesNombresHeader(h[i]!)) return i
  }
  return -1
}

/** Columna con N.º de empleado (no N.º de servicio repetido en todas las filas, p. ej. 944). */
function inferEmpColFromDataRows(table: string[][], fromRow: number): number {
  const end = Math.min(fromRow + 60, table.length)
  const rowCount = end - fromRow
  if (rowCount < 1) return -1

  const colStats = new Map<number, { hits: number; unique: Set<string> }>()
  for (let r = fromRow; r < end; r++) {
    const cells = table[r] ?? []
    for (let c = 0; c < cells.length; c++) {
      const raw = normalizarCeldaCsvNumerica(String(cells[c] ?? ''))
      const canon = canonicalEmpNoForCsvMatch(raw)
      if (!canon || !/^\d{3,10}$/.test(canon)) continue
      let st = colStats.get(c)
      if (!st) {
        st = { hits: 0, unique: new Set() }
        colStats.set(c, st)
      }
      st.hits++
      st.unique.add(canon)
    }
  }

  let bestCol = -1
  let bestScore = -1
  for (const [col, st] of colStats) {
    if (st.hits < Math.max(2, Math.floor(rowCount * 0.4))) continue
    const uniqRatio = st.unique.size / st.hits
    let score = st.unique.size * 20 + st.hits
    if (uniqRatio >= 0.75) score += 80
    if (uniqRatio < 0.35) score = Math.floor(score * 0.15)
    if (score > bestScore) {
      bestScore = score
      bestCol = col
    }
  }
  return bestCol
}

function inferNombreColFromData(table: string[][], empCol: number, fromRow: number): number {
  const end = Math.min(fromRow + 15, table.length)
  for (const tryCol of [empCol + 1, empCol - 1]) {
    if (tryCol < 0 || tryCol === empCol) continue
    let nameLike = 0
    for (let r = fromRow; r < end; r++) {
      const v = String(table[r]?.[tryCol] ?? '').trim()
      if (!v) continue
      if (cellLooksLikeAttendanceCode(v)) continue
      if (/[A-ZÁÉÍÓÚÑ]/i.test(v) && v.length >= 4) nameLike++
    }
    if (nameLike >= 2) return tryCol
  }
  return -1
}

function inferShiftStartFromData(table: string[][], empCol: number, fromRow: number): number {
  const maxCol = Math.max(...table.map((r) => r.length), 0)
  let bestStart = -1
  let bestScore = 0
  for (let start = empCol + 1; start <= maxCol - 21; start++) {
    let score = 0
    const end = Math.min(fromRow + 20, table.length)
    for (let r = fromRow; r < end; r++) {
      for (let d = 0; d < 7; d++) {
        for (let t = 0; t < 3; t++) {
          const v = table[r]?.[start + d * 3 + t] ?? ''
          if (cellLooksLikeAttendanceCode(v)) score++
        }
      }
    }
    if (score > bestScore) {
      bestScore = score
      bestStart = start
    }
  }
  if (bestScore >= 5 && bestStart >= 0) return bestStart
  const h = table[0]?.map(normHeaderCell) ?? []
  const afterEmp = h[empCol + 1] ?? ''
  if (matchesNombresHeader(afterEmp)) return empCol + 2
  return empCol + 1
}

function buildLayoutFromEmpAndShift(
  header: string[],
  empCol: number,
  shiftStart: number,
): AttendanceCsvLayout {
  const h = header.map(normHeaderCell)
  const plantaCol = findPlantaColumnIndex(header)
  let { servicioCol, noServicioCol } = findServicioColsInHeader(header)
  const posColStrict = empCol - 3
  if (posColStrict >= 0 && matchesPosicionHeader(h[posColStrict]!)) {
    const n0 = h[0] ?? ''
    const n1 = h[1] ?? ''
    const looksServicio = n0.includes('servicio') && !n0.includes('no')
    const looksNoServicio =
      (n1.includes('no') && n1.includes('servicio')) || n1.replace(/\s/g, '') === 'noservicio'
    if (looksServicio && looksNoServicio) {
      noServicioCol = 1
      servicioCol = 0
    }
  }
  return {
    empCol,
    shiftStart,
    noServicioCol,
    servicioCol,
    plantaCol: plantaCol >= 0 ? plantaCol : undefined,
  }
}

export function detectAttendanceCsvLayout(
  header: string[],
  table?: string[][],
): AttendanceCsvLayout | null {
  const h = header.map(normHeaderCell)
  let empCol = findEmployeeColumnIndex(header)
  let dataStartRow = 1

  const nomHeaderCol = findNombresColumnIndex(header)
  if (nomHeaderCol > 0 && empCol < 0) {
    empCol = nomHeaderCol - 1
  }
  if (empCol >= 0 && nomHeaderCol === empCol + 1) {
    /* cabecera estándar: … NO. EMPLEADO, NOMBRES, códigos */
  }

  if (empCol < 0 && table && table.length >= 1) {
    for (const start of [0, 1]) {
      if (start >= table.length) continue
      const inferred = inferEmpColFromDataRows(table, start)
      if (inferred >= 0) {
        empCol = inferred
        dataStartRow = start
        break
      }
    }
  }
  if (empCol < 0) return null

  let shiftStart: number
  if (table && table.length > dataStartRow) {
    shiftStart = inferShiftStartFromData(table, empCol, dataStartRow)
    const nomDataCol = inferNombreColFromData(table, empCol, dataStartRow)
    if (nomDataCol === empCol + 1 && shiftStart <= nomDataCol) {
      shiftStart = nomDataCol + 1
    }
  } else {
    const afterEmp = h[empCol + 1] ?? ''
    shiftStart = matchesNombresHeader(afterEmp) ? empCol + 2 : empCol + 1
  }

  const maxCols = Math.max(header.length, ...(table ?? []).map((r) => r.length))
  if (maxCols < shiftStart + 21) return null

  return buildLayoutFromEmpAndShift(header, empCol, shiftStart)
}

/** Primera fila de datos (0 si no hay fila de encabezados reconocible). */
export function attendanceCsvDataStartRow(layout: AttendanceCsvLayout, table: string[][]): number {
  if (table.length < 2) return 1
  const header = table[0]!.map((c) => String(c ?? '').trim())
  if (headerRowLooksLikeAttendance(header)) return 1
  const inferred = inferEmpColFromDataRows(table, 0)
  if (inferred >= 0 && inferred === layout.empCol) return 0
  return 1
}

export function csvLayoutHasPlantaColumn(layout: AttendanceCsvLayout): boolean {
  return layout.plantaCol != null && layout.plantaCol >= 0
}

/** 7 días × turnos D, T, N (columnas consecutivas en el CSV). */
function shiftsFromCellsAt(cells: string[], shiftStart: number): GridRow['shifts'] {
  const shifts: GridRow['shifts'] = []
  for (let d = 0; d < 7; d++) {
    const o = shiftStart + d * 3
    shifts.push({
      D: normalizeShiftCode(cells[o] ?? ''),
      T: normalizeShiftCode(cells[o + 1] ?? ''),
      N: normalizeShiftCode(cells[o + 2] ?? ''),
    })
  }
  return shifts
}

export interface ParsedAttendanceGridCsvRow {
  employeeNo: string
  shifts: GridRow['shifts']
  /** Si el CSV trae «NO SERVICIO», se puede aplicar a la fila al importar. */
  numeroServicioCsv?: string
  /** Columna SERVICIO (nombre catálogo). */
  servicioNombreCsv?: string
  /** Columna PLANTA del CSV (formato hoja multi-planta). */
  plantaNombre?: string
}

function firstShiftHeaderLooksWrong(norm: string): boolean {
  return norm.startsWith('asist')
}

export function parseAttendanceGridCodesCsv(text: string):
  | {
      ok: true
      rows: ParsedAttendanceGridCsvRow[]
      delimiter: CsvDelimiter
      layout: AttendanceCsvLayout
      rowsSinPlanta?: number
    }
  | { ok: false; error: string } {
  const raw = text.replace(/^\uFEFF/, '')
  const rawLines = raw.split(/\r?\n/)
  const contentLines: string[] = []
  for (const line of rawLines) {
    const trimmedEnd = line.trimEnd()
    if (!trimmedEnd.trim()) continue
    if (trimmedEnd.trimStart().startsWith('--')) continue
    contentLines.push(trimmedEnd)
  }
  if (contentLines.length < 2) {
    return { ok: false, error: 'El archivo no tiene cabecera y filas de datos.' }
  }

  const delim = pickDelimiter(contentLines[0]!)
  const table = contentLines.map((ln) => splitCsvDelimitedLine(ln, delim))

  const header = table[0]!.map((c) => c.trim())
  const layout = detectAttendanceCsvLayout(header, table)
  if (!layout) {
    return {
      ok: false,
      error:
        'No se detectó la columna NO. DE EMPLEADO (o CLAVE) ni 21 códigos D/T/N. Puede exportar desde la cuadrícula o usar cabecera con NO. DE EMPLEADO + 7 días × D/T/N. Servicio y planta pueden ir vacíos.',
    }
  }

  const dataStartRow = attendanceCsvDataStartRow(layout, table)
  const minCols = layout.shiftStart + 21
  const maxCols = Math.max(...table.map((r) => r.length), header.length)
  if (maxCols < minCols) {
    return {
      ok: false,
      error: `Faltan columnas de asistencia: se necesitan al menos ${minCols} (N° empleado en columna ${layout.empCol + 1} y 21 códigos D/T/N).`,
    }
  }

  if (dataStartRow === 1) {
    const sh0 = normHeaderCell(header[layout.shiftStart] ?? '')
    if (firstShiftHeaderLooksWrong(sh0)) {
      return {
        ok: false,
        error:
          'La columna de códigos parece incorrecta (se encontró «Asist.»). Este archivo es el CSV de totales, no el de códigos por turno.',
      }
    }
  }

  const multiPlanta = csvLayoutHasPlantaColumn(layout)
  const byKey = new Map<string, ParsedAttendanceGridCsvRow>()
  let rowsSinPlanta = 0

  for (let r = dataStartRow; r < table.length; r++) {
    let cells = table[r]!.map((c) => c.trim())
    while (cells.length < minCols) cells.push('')
    const empRaw = normalizarCeldaCsvNumerica(cells[layout.empCol] ?? '')
    if (!empRaw) continue

    let plantaNombre: string | undefined
    if (layout.plantaCol != null) {
      const p = normPlantaCsv(cells[layout.plantaCol] ?? '')
      if (p) plantaNombre = p
      else if (multiPlanta) rowsSinPlanta++
    }

    const shifts = reassignFaltaSequence(shiftsFromCellsAt(cells, layout.shiftStart))
    const empCanon = canonicalEmpNoForCsvMatch(empRaw)
    const noSrv =
      layout.noServicioCol != null
        ? String(cells[layout.noServicioCol] ?? '').trim()
        : undefined
    const servicioCsv =
      layout.servicioCol != null
        ? String(cells[layout.servicioCol] ?? '').trim()
        : undefined

    if (!empCanon) continue

    const nextRow: ParsedAttendanceGridCsvRow = {
      employeeNo: empCanon,
      shifts,
      numeroServicioCsv: noSrv || undefined,
      servicioNombreCsv: servicioCsv || undefined,
      plantaNombre,
    }
    const prev = byKey.get(empCanon)
    if (prev) {
      nextRow.shifts = mergeShiftsPreferNonEmpty(prev.shifts, shifts)
      if (!nextRow.numeroServicioCsv) nextRow.numeroServicioCsv = prev.numeroServicioCsv
      if (!nextRow.servicioNombreCsv) nextRow.servicioNombreCsv = prev.servicioNombreCsv
      if (!nextRow.plantaNombre) nextRow.plantaNombre = prev.plantaNombre
    }
    byKey.set(empCanon, nextRow)
  }

  if (byKey.size === 0) {
    const hintPlanta =
      multiPlanta && rowsSinPlanta > 0
        ? ' Revise que la columna PLANTA tenga valor en cada fila.'
        : ''
    return {
      ok: false,
      error:
        `No hay filas con número de empleado reconocible.${hintPlanta} En Excel use formato texto en No. de empleado.`,
    }
  }

  return {
    ok: true,
    rows: [...byKey.values()],
    delimiter: delim,
    layout,
    rowsSinPlanta: multiPlanta ? rowsSinPlanta : undefined,
  }
}

function indexCsvRowsByEmployee(
  csvRows: ParsedAttendanceGridCsvRow[],
): Map<string, ParsedAttendanceGridCsvRow[]> {
  const byEmp = new Map<string, ParsedAttendanceGridCsvRow[]>()
  for (const row of csvRows) {
    const k = canonicalEmpNoForCsvMatch(row.employeeNo)
    const list = byEmp.get(k) ?? []
    list.push(row)
    byEmp.set(k, list)
  }
  return byEmp
}

/** Cuenta celdas con código en la semana importada. */
function scoreCsvRowShifts(row: ParsedAttendanceGridCsvRow): number {
  let n = 0
  for (const day of row.shifts) {
    if (day.D?.trim()) n++
    if (day.T?.trim()) n++
    if (day.N?.trim()) n++
  }
  return n
}

/**
 * Varias filas CSV del mismo N.º → una sola semana (día × turno), fusionando códigos no vacíos.
 */
export function mergeParsedRowsForEmployee(
  rows: ParsedAttendanceGridCsvRow[],
): ParsedAttendanceGridCsvRow | null {
  if (rows.length === 0) return null
  let meta = rows[0]!
  let mergedShifts = rows[0]!.shifts.map((d) => ({ ...d }))
  for (let i = 1; i < rows.length; i++) {
    const r = rows[i]!
    mergedShifts = mergeShiftsPreferNonEmpty(mergedShifts, r.shifts)
    if (scoreCsvRowShifts(r) > scoreCsvRowShifts(meta)) meta = r
  }
  const canon = canonicalEmpNoForCsvMatch(meta.employeeNo) || meta.employeeNo
  return {
    employeeNo: canon,
    shifts: reassignFaltaSequence(mergedShifts),
    numeroServicioCsv: meta.numeroServicioCsv,
    servicioNombreCsv: meta.servicioNombreCsv,
    plantaNombre: meta.plantaNombre,
  }
}

/** Índice N.º empleado (canónico) → asistencia semanal lista para aplicar a la cuadrícula. */
export function buildCsvAttendanceIndexByEmpNo(
  csvRows: ParsedAttendanceGridCsvRow[],
): Map<string, ParsedAttendanceGridCsvRow> {
  const grouped = indexCsvRowsByEmployee(csvRows)
  const out = new Map<string, ParsedAttendanceGridCsvRow>()
  for (const [canon, list] of grouped) {
    const merged = mergeParsedRowsForEmployee(list)
    if (merged) out.set(canon, merged)
  }
  return out
}

/** @deprecated La cuadrícula empareja solo por N.º; use mergeParsedRowsForEmployee. */
export function pickCsvRowForGridRow(
  _gridRow: GridRow,
  candidates: ParsedAttendanceGridCsvRow[],
): { row: ParsedAttendanceGridCsvRow | null; ambiguous: boolean } {
  return { row: mergeParsedRowsForEmployee(candidates), ambiguous: false }
}

function applyCsvAttendanceToGridRow(
  gridRow: GridRow,
  imp: ParsedAttendanceGridCsvRow,
  reconcile: MergeCsvReconcileOpts | undefined,
): GridRow {
  const canon = canonicalEmpNoForCsvMatch(String(gridRow.employeeNo ?? gridRow.id ?? ''))
  const shifts = reassignFaltaSequence(imp.shifts)
  let merged: GridRow = { ...gridRow, shifts, employeeNo: gridRow.employeeNo || imp.employeeNo }
  if (reconcile) {
    const col = reconcile.colaboradoresByEmp.get(canon)
    merged.rowServiceNo = reconcileRowServiceNo(
      {
        rowServiceNo: imp.numeroServicioCsv?.trim() || gridRow.rowServiceNo,
        servicioLinea: imp.servicioNombreCsv?.trim() || gridRow.servicioLinea,
      },
      col,
      reconcile.catalogo,
      reconcile.plantaNombre,
    )
  } else {
    const srvCsv = imp.numeroServicioCsv?.trim()
    if (srvCsv) merged = { ...merged, rowServiceNo: srvCsv }
  }
  return withComputedTotals(merged, gridRowServiceNo(merged))
}

export type MergeCsvReconcileOpts = {
  catalogo: CatalogoServicioItem[]
  plantaNombre: string
  /** Expediente por N.º de empleado (canónico); incluye bajas para historial en importación. */
  colaboradoresByEmp: Map<string, ColaboradorCompleto>
  /** Si true, filas del CSV sin fila en cuadrícula se crean por N.º de empleado (activos y bajas). */
  agregarFilasCsvPorEmpNo?: boolean
  /** Lista completa para estatus/fecha de baja en filas añadidas. */
  todosColaboradores?: ColaboradorCompleto[]
}

/** Mapa N.º empleado → colaborador; duplicados: prioriza activo sobre baja. */
function clavesNoEmpleadoExpediente(c: ColaboradorCompleto): string[] {
  const keys = new Set<string>()
  for (const raw of [c.noEmpleado, String(c.form?.noEmpleado1 ?? "")]) {
    const k = canonicalEmpNoForCsvMatch(raw)
    if (k) keys.add(k)
  }
  return [...keys]
}

export function mapaColaboradoresPorNoEmpleadoCanon(
  lista: ColaboradorCompleto[],
): Map<string, ColaboradorCompleto> {
  const map = new Map<string, ColaboradorCompleto>()
  for (const c of lista) {
    for (const k of clavesNoEmpleadoExpediente(c)) {
      const prev = map.get(k)
      if (!prev) {
        map.set(k, c)
        continue
      }
      if (colaboradorTieneBaja(prev) && !colaboradorTieneBaja(c)) map.set(k, c)
    }
  }
  return map
}

export function mergeCsvShiftsIntoGridRows(
  gridRows: GridRow[],
  csvRows: ParsedAttendanceGridCsvRow[],
  reconcile?: MergeCsvReconcileOpts,
): {
  next: GridRow[]
  /** Colaboradores distintos (N.º) con asistencia aplicada desde el CSV. */
  updatedCount: number
  /** Filas de cuadrícula actualizadas (puede ser > updatedCount si el mismo N.º tiene varias filas). */
  updatedRowCount: number
  /** Empleados en CSV sin fila en la cuadrícula (esta planta). */
  csvEmployeesNotInGrid: string[]
  /** Empleados en cuadrícula sin fila en el CSV (se dejan como estaban). */
  gridEmployeesNotInCsv: string[]
  /** Reservado; emparejamiento solo por N.º (siempre vacío). */
  ambiguousEmployeeNos: string[]
  gridEmployeeCount: number
} {
  const csvByEmp = buildCsvAttendanceIndexByEmpNo(csvRows)
  const csvEmpMatched = new Set<string>()
  const updatedEmpleados = new Set<string>()
  let updatedRowCount = 0
  const gridCanonKeys = new Set<string>()
  const gridEmployeesNotInCsv: string[] = []
  const gridSinCsvCanon = new Set<string>()
  const ambiguousEmployeeNos: string[] = []

  const next = gridRows.map((r) => {
    const kRaw = String(r.employeeNo ?? r.id ?? '').trim()
    if (!kRaw) return r
    const canon = canonicalEmpNoForCsvMatch(kRaw)
    if (!canon) return r
    gridCanonKeys.add(canon)
    const imp = csvByEmp.get(canon)
    if (!imp) {
      if (!gridSinCsvCanon.has(canon)) {
        gridSinCsvCanon.add(canon)
        gridEmployeesNotInCsv.push(kRaw)
      }
      return r
    }
    csvEmpMatched.add(canon)
    updatedEmpleados.add(canon)
    updatedRowCount++
    return applyCsvAttendanceToGridRow(r, imp, reconcile)
  })

  const appended: GridRow[] = []
  const csvEmployeesNotInGrid: string[] = []

  if (reconcile?.agregarFilasCsvPorEmpNo) {
    for (const [canon, imp] of csvByEmp) {
      if (csvEmpMatched.has(canon)) continue
      const col = reconcile.colaboradoresByEmp.get(canon)
      if (!col) {
        csvEmployeesNotInGrid.push(imp.employeeNo)
        continue
      }
      const synthetic = colaboradorToGridRow(col, reconcile.catalogo, reconcile.plantaNombre)
      csvEmpMatched.add(canon)
      updatedEmpleados.add(canon)
      updatedRowCount++
      appended.push(applyCsvAttendanceToGridRow(synthetic, imp, reconcile))
    }
  } else {
    for (const [canon, imp] of csvByEmp) {
      if (csvEmpMatched.has(canon)) continue
      csvEmployeesNotInGrid.push(imp.employeeNo)
    }
  }

  const allRows = appended.length > 0 ? [...next, ...appended] : next
  const finalRows =
    reconcile && appended.length > 0
      ? enrichGridRowsEstatus(
          allRows,
          reconcile.todosColaboradores ?? [...reconcile.colaboradoresByEmp.values()],
        )
      : allRows

  return {
    next: finalRows,
    updatedCount: updatedEmpleados.size,
    updatedRowCount,
    csvEmployeesNotInGrid,
    gridEmployeesNotInCsv,
    ambiguousEmployeeNos,
    gridEmployeeCount: gridCanonKeys.size + appended.length,
  }
}

/** Resuelve planta de expediente a partir de PLANTA en CSV y/o catálogo (N.º o nombre de servicio). */
export function resolvePlantaNormForCsvRow(
  row: ParsedAttendanceGridCsvRow,
  catalogo: CatalogoServicioItem[],
  expedienteNorm: Map<string, string>,
): string | null {
  const fromCol = row.plantaNombre ? normPlantaCsv(row.plantaNombre) : ''
  if (fromCol && expedienteNorm.has(fromCol)) return fromCol

  const no = row.numeroServicioCsv?.trim()
  if (no) {
    for (const pNorm of expedienteNorm.keys()) {
      const cat = findCatalogoPorNumeroYPlanta(catalogo, no, pNorm)
      if (cat?.planta && expedienteNorm.has(normPlantaCsv(cat.planta))) {
        return normPlantaCsv(cat.planta)
      }
    }
    const cat = findCatalogoPorNumeroYPlanta(catalogo, no)
    const cp = cat?.planta ? normPlantaCsv(cat.planta) : ''
    if (cp && expedienteNorm.has(cp)) return cp
  }

  const svc = row.servicioNombreCsv?.trim()
  if (svc) {
    for (const pNorm of expedienteNorm.keys()) {
      const cat = findCatalogoPorNombreYPlanta(catalogo, svc, pNorm)
      if (cat?.planta && expedienteNorm.has(normPlantaCsv(cat.planta))) {
        return normPlantaCsv(cat.planta)
      }
    }
    const cat = findCatalogoPorNombreYPlanta(catalogo, svc)
    const cp = cat?.planta ? normPlantaCsv(cat.planta) : ''
    if (cp && expedienteNorm.has(cp)) return cp
  }

  if (fromCol) return fromCol
  return null
}

export interface PlantaCsvImportSlice {
  plantaNombre: string
  updatedCount: number
  gridEmployeeCount: number
  csvRowsTotal: number
  csvEmployeesNotInGrid: string[]
  ambiguousEmployeeNos: string[]
  saved: boolean
}

export interface AllPlantasCsvImportResult {
  plantas: PlantaCsvImportSlice[]
  /** PLANTA en CSV sin empleados activos con esa planta en expediente. */
  unknownPlantas: string[]
  totalUpdated: number
  plantsSaved: number
  /** Plantas con cambios que no se pudieron persistir (servidor o almacenamiento local). */
  plantsSaveFailed: number
  rowsSinPlantaCsv: number
  /** N° de empleado en CSV que no se pudieron aplicar (sin expediente o planta distinta). */
  omitidosSinRegistro: string[]
}

/** CSV de una columna con N° omitidos (para descargar tras importar). */
export function buildCsvListaNumerosEmpleado(numeros: string[], header = 'no_de_empleado'): string {
  const uniq = [...new Set(numeros.map((n) => String(n).trim()).filter(Boolean))].sort((a, b) =>
    a.localeCompare(b, 'es', { numeric: true }),
  )
  return `\uFEFF${header}\n${uniq.join('\n')}\n`
}

function groupCsvRowsByPlanta(
  rows: ParsedAttendanceGridCsvRow[],
  catalogo: CatalogoServicioItem[],
  expedienteNorm: Map<string, string>,
  fallbackPlanta?: string,
): { groups: Map<string, ParsedAttendanceGridCsvRow[]>; rowsSinPlanta: number } {
  const groups = new Map<string, ParsedAttendanceGridCsvRow[]>()
  const fallback = fallbackPlanta ? normPlantaCsv(fallbackPlanta) : ''
  let rowsSinPlanta = 0

  for (const row of rows) {
    let p = resolvePlantaNormForCsvRow(row, catalogo, expedienteNorm)
    if (!p && fallback && expedienteNorm.has(fallback)) p = fallback
    if (!p && fallback) p = fallback
    if (!p) {
      rowsSinPlanta++
      continue
    }
    const list = groups.get(p) ?? []
    list.push(row)
    groups.set(p, list)
  }
  return { groups, rowsSinPlanta }
}

/**
 * Importa la misma semana (`weekIso`) para cada planta presente en el CSV (columna PLANTA).
 * Si el CSV no trae PLANTA, use `fallbackPlantaNombre` (una sola planta).
 */
export async function applyAttendanceCsvToAllPlantasWeek(opts: {
  parsedRows: ParsedAttendanceGridCsvRow[]
  colaboradores: ColaboradorCompleto[]
  catalogo: CatalogoServicioItem[]
  weekIso: string
  fallbackPlantaNombre?: string
}): Promise<AllPlantasCsvImportResult> {
  const plantasExpediente = listarPlantasDeColaboradores(opts.colaboradores)
  const expedienteNorm = new Map(plantasExpediente.map((p) => [normPlantaCsv(p), p]))

  const { groups: grouped, rowsSinPlanta: rowsSinPlantaCsv } = groupCsvRowsByPlanta(
    opts.parsedRows,
    opts.catalogo,
    expedienteNorm,
    opts.fallbackPlantaNombre?.trim(),
  )
  const plantas: PlantaCsvImportSlice[] = []
  const unknownPlantas: string[] = []
  const omitidosSinRegistroSet = new Set<string>()
  let totalUpdated = 0
  let plantsSaved = 0
  let plantsSaveFailed = 0

  const { getAttendanceWeekPrefetch } = await import('./attendanceWeekPrefetch')
  const prefetch = await getAttendanceWeekPrefetch(opts.weekIso)
  const colaboradoresByEmp = mapaColaboradoresPorNoEmpleadoCanon(opts.colaboradores)

  type MergeOk = {
    kind: 'ok'
    plantaNombre: string
    scopeKey: string
    next: GridRow[]
    updatedCount: number
    gridEmployeeCount: number
    csvRowsTotal: number
    csvEmployeesNotInGrid: string[]
    ambiguousEmployeeNos: string[]
  }

  const merged: Array<
    | { kind: 'unknown'; plantaNorm: string }
    | MergeOk
    | null
  > = await Promise.all(
    [...grouped.entries()].map(async ([plantaNorm, csvRows]) => {
      const plantaNombre = expedienteNorm.get(plantaNorm)
      if (!plantaNombre) {
        return { kind: 'unknown' as const, plantaNorm }
      }
      const scopeKey = plantaToStorageKey(plantaNombre)
      if (!scopeKey) return null

      const base = await mergeGridRowsForPlantaWeekForCsvImport(
        opts.colaboradores,
        plantaNombre,
        opts.catalogo,
        opts.weekIso,
        prefetch,
      )
      const {
        next,
        updatedCount,
        csvEmployeesNotInGrid,
        gridEmployeeCount,
        ambiguousEmployeeNos,
      } = mergeCsvShiftsIntoGridRows(base, csvRows, {
        catalogo: opts.catalogo,
        plantaNombre,
        colaboradoresByEmp,
        agregarFilasCsvPorEmpNo: true,
        todosColaboradores: opts.colaboradores,
      })

      return {
        kind: 'ok' as const,
        plantaNombre,
        scopeKey,
        next,
        updatedCount,
        gridEmployeeCount,
        csvRowsTotal: csvRows.length,
        csvEmployeesNotInGrid,
        ambiguousEmployeeNos,
      }
    }),
  )

  const toPersist: MergeOk[] = []
  for (const slice of merged) {
    if (!slice) continue
    if (slice.kind === 'unknown') {
      unknownPlantas.push(slice.plantaNorm)
      continue
    }
    if (slice.updatedCount > 0) {
      toPersist.push(slice)
    }
    totalUpdated += slice.updatedCount
    for (const no of slice.csvEmployeesNotInGrid) omitidosSinRegistroSet.add(no)
    plantas.push({
      plantaNombre: slice.plantaNombre,
      updatedCount: slice.updatedCount,
      gridEmployeeCount: slice.gridEmployeeCount,
      csvRowsTotal: slice.csvRowsTotal,
      csvEmployeesNotInGrid: slice.csvEmployeesNotInGrid,
      ambiguousEmployeeNos: slice.ambiguousEmployeeNos,
      saved: false,
    })
  }

  if (toPersist.length > 0) {
    const batch = await saveManyAttendanceGrids(
      opts.weekIso,
      toPersist.map((s) => ({ scopeKey: s.scopeKey, rows: s.next, serviceNo: '' })),
    )
    const allOk = batch.failed === 0 && batch.saved >= toPersist.length
    plantsSaved = allOk ? toPersist.length : Math.min(batch.saved, toPersist.length)
    plantsSaveFailed = Math.max(0, toPersist.length - plantsSaved)
    for (const p of plantas) {
      if (p.updatedCount > 0) p.saved = allOk
    }
  }

  plantas.sort((a, b) => a.plantaNombre.localeCompare(b.plantaNombre, 'es'))

  return {
    plantas,
    unknownPlantas,
    totalUpdated,
    plantsSaved,
    plantsSaveFailed,
    rowsSinPlantaCsv,
    omitidosSinRegistro: [...omitidosSinRegistroSet].sort((a, b) =>
      a.localeCompare(b, 'es', { numeric: true }),
    ),
  }
}

/** Un CSV con todas las plantas (misma semana), formato hoja SERVICIO… + D/T/N. */
export async function buildAttendanceCodesCsvAllPlantasWeek(
  colaboradores: ColaboradorCompleto[],
  catalogo: CatalogoServicioItem[],
  weekIso: string,
  delim: ';' | ',' = ';',
): Promise<string> {
  const plantas = listarPlantasDeColaboradores(colaboradores)
  const { getAttendanceWeekPrefetch } = await import('./attendanceWeekPrefetch')
  const prefetch = await getAttendanceWeekPrefetch(weekIso)
  const blocks = await Promise.all(
    plantas.map(async (planta) => {
      const rows = await mergeGridRowsForPlantaWeek(
        colaboradores,
        planta,
        catalogo,
        weekIso,
        prefetch,
      )
      if (rows.length === 0) return ''
      return buildAttendanceCodesCsvPlantaSheet(rows, planta, delim)
    }),
  )
  return blocks.filter(Boolean).join('\r\n\r\n')
}

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

/** CSV compacto (5 + Lun-D…), separador `;` o `,`. */
export function buildAttendanceCodesCsvExport(
  gridRows: GridRow[],
  delim: ';' | ',' = ';',
): string {
  const headers = [
    ...ATTENDANCE_GRID_CSV_FIXED_HEADERS,
    ...ATTENDANCE_GRID_CSV_SHIFT_HEADERS_EXAMPLE,
  ]
  const lines: string[] = [
    headers.map((h) => escapeCsvDelimCell(delim, h)).join(delim),
  ]
  for (const row of gridRows) {
    if (row.vacant) continue
    const cells: string[] = [...celdasIdentificacionAsistencia(row)]
    for (const day of row.shifts) {
      cells.push(day.D, day.T, day.N)
    }
    lines.push(cells.map((c) => escapeCsvDelimCell(delim, c)).join(delim))
  }
  return lines.join('\r\n')
}

/**
 * CSV como hoja de planta: SERVICIO, NO SERVICIO, PLANTA, … + cabeceras D,T,N × 7.
 * `plantaNombre` rellena PLANTA; SERVICIO usa línea de servicio del expediente o la misma planta.
 */
export function buildAttendanceCodesCsvPlantaSheet(
  gridRows: GridRow[],
  plantaNombre: string,
  delim: ';' | ',' = ';',
): string {
  const planta = plantaNombre.trim().toUpperCase()
  const headers = [
    ...ATTENDANCE_GRID_CSV_PLANTA_SHEET_HEADERS,
    ...ATTENDANCE_GRID_CSV_SHIFT_HEADERS_DTN,
  ]
  const lines: string[] = [
    headers.map((h) => escapeCsvDelimCell(delim, h)).join(delim),
  ]
  const dataRows = sortGridRowsByPosicion(gridRows)

  for (const row of dataRows) {
    const cells: string[] = [...celdasIdentificacionAsistencia(row, planta)]
    for (const day of row.shifts) {
      cells.push(day.D, day.T, day.N)
    }
    lines.push(cells.map((c) => escapeCsvDelimCell(delim, c)).join(delim))
  }
  return lines.join('\r\n')
}

export function attendanceCodesCsvFilename(plantaNombre: string, weekStartIso: string): string {
  const base =
    plantaNombre
      .trim()
      .replace(/[\\/:*?"<>|]+/g, '-')
      .replace(/\s+/g, ' ')
      .replace(/^\.+/, '')
      .slice(0, 80) || 'planta'
  const wk = weekStartIso.trim().replace(/[^\d-]/g, '')
  return `asistencia-codigos-${base}-${wk || 'semana'}.csv`
}
