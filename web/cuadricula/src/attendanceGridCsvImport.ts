import { canonicalEmpNoAttendance, empNoClaveGridRow } from '@/lib/attendance-emp-no'
import { normalizarCeldaCsvNumerica } from '@/lib/csv'
import type { ColaboradorCompleto } from '@/lib/colaboradores-types'
import {
  canonicalNoServicioCatalogo,
  findCatalogoPorNombreYPlanta,
  findCatalogoPorNumeroYPlanta,
  plantaColaborador,
  reconcileRowServiceNo,
} from '@/lib/colaboradores-catalogo-display'
import type { CatalogoServicioItem } from '@/lib/servicios-catalogo-client'
import { elegirValorIdentificacionAsistencia } from './attendanceGridColumns'
import { reassignFaltaSequence } from './attendanceFaltaSequence'
import { reconciliarServicioVacante } from '@/lib/vacantes-servicio'
import { saveManyAttendanceGrids } from './attendanceStorage'
import { withComputedTotals } from './attendanceTotals'
import { colaboradorTieneBaja } from '@/lib/colaboradores-baja'
import {
  colaboradorPertenecePlantaAsistencia,
  colaboradorToGridRow,
  listarPlantasCapturaAsistencia,
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
import { emptyShifts, WEEK_COLUMNS, ZERO_TOTALS, type GridRow } from './mockData'

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

/** Mínimo para plantilla compacta exportada (8 id + 21 códigos). */
const MIN_COLS_COMPACT = 5 + 21
/** Mínimo para Excel espaciado: N.º + nombre + al menos un código. */
const MIN_COLS_SPARSE = 3

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

function scoreDelimiterOnLines(lines: string[], d: CsvDelimiter): number {
  const sample = lines.slice(0, Math.min(12, lines.length))
  if (sample.length === 0) return 0
  let score = 0
  const colCounts: number[] = []
  for (const ln of sample) {
    const row = splitCsvDelimitedLine(ln, d)
    colCounts.push(row.length)
    score += row.length
    for (let c = 0; c < Math.min(4, row.length); c++) {
      const canon = canonicalEmpNoForCsvMatch(normalizarCeldaCsvNumerica(row[c] ?? ''))
      if (canon && /^\d{3,10}$/.test(canon)) score += 18
    }
    for (const cell of row) {
      if (cellLooksLikeAttendanceCode(cell)) score += 4
    }
  }
  const avgCols = colCounts.reduce((a, b) => a + b, 0) / colCounts.length
  const variance =
    colCounts.reduce((acc, n) => acc + Math.abs(n - avgCols), 0) / colCounts.length
  if (variance <= 2) score += 12
  if (avgCols >= MIN_COLS_COMPACT) score += 10
  else if (avgCols >= MIN_COLS_SPARSE) score += 6
  if (d === ';') score += 4
  return score
}

function pickDelimiter(lines: string[]): CsvDelimiter {
  const candidates: CsvDelimiter[] = [';', ',', '\t']
  let best: { d: CsvDelimiter; score: number } = { d: ';', score: -1 }
  for (const d of candidates) {
    const score = scoreDelimiterOnLines(lines, d)
    if (score > best.score) best = { d, score }
  }
  return best.d
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

export type FilterCsvRowsForPlantaOpts = {
  colaboradores?: ColaboradorCompleto[]
  catalogo?: CatalogoServicioItem[]
  expedientePlantas?: string[]
}

/**
 * Importación en una sola planta: conserva filas de la planta seleccionada.
 * Solo omite filas con columna PLANTA explícita y distinta a la planta en pantalla.
 */
export function filterCsvRowsForPlantaNombre(
  rows: ParsedAttendanceGridCsvRow[],
  plantaNombre: string,
  opts?: FilterCsvRowsForPlantaOpts,
): { rows: ParsedAttendanceGridCsvRow[]; omittedOtherPlanta: number } {
  const plantaNorm = normPlantaCsv(plantaNombre)
  if (!plantaNorm) return { rows, omittedOtherPlanta: 0 }

  const plantasExp =
    opts?.expedientePlantas?.length
      ? opts.expedientePlantas
      : opts?.colaboradores?.length
        ? listarPlantasCapturaAsistencia(opts.colaboradores, opts.catalogo ?? [])
        : []
  const expedienteNorm = new Map(plantasExp.map((p) => [normPlantaCsv(p), p]))

  const filtered: ParsedAttendanceGridCsvRow[] = []
  let omittedOtherPlanta = 0

  for (const row of rows) {
    const rowPlantaNorm = row.plantaNombre?.trim()
      ? normPlantaCsv(row.plantaNombre)
      : opts?.catalogo && expedienteNorm.size > 0
        ? resolvePlantaNormForCsvRow(row, opts.catalogo, expedienteNorm)
        : null

    if (rowPlantaNorm && rowPlantaNorm !== plantaNorm) {
      omittedOtherPlanta++
      continue
    }

    filtered.push(row)
  }

  return { rows: filtered, omittedOtherPlanta }
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

const ATTENDANCE_KNOWN_CODES = new Set(['A', 'D', 'F', 'INC', 'VAC', 'PCGS', 'PSGS', 'CAP'])

function looksLikeEmpNoCell(raw: string): boolean {
  const canon = canonicalEmpNoForCsvMatch(normalizarCeldaCsvNumerica(raw))
  return Boolean(canon && /^\d{3,10}$/.test(canon))
}

function looksLikeNombreCell(raw: string): boolean {
  const v = String(raw ?? '').trim()
  if (!v || v.length < 2) return false
  if (looksLikeEmpNoCell(v)) return false
  if (/\s/.test(v) && /[A-ZÁÉÍÓÚÑa-záéíóúñ]/.test(v)) return true
  if (v.length >= 4 && /^[A-ZÁÉÍÓÚÑ]+$/.test(v) && !ATTENDANCE_KNOWN_CODES.has(v)) return true
  if (/[0-9]/.test(v)) return false
  return v.length >= 5 && /[A-ZÁÉÍÓÚÑa-záéíóúñ]/.test(v)
}

function isAttendanceCodeToken(v: string): boolean {
  if (!v) return false
  if (/^\d+$/.test(v)) return true
  if (/^DD/i.test(v)) return true
  if (ATTENDANCE_KNOWN_CODES.has(v)) return true
  if (/^F[1-9]\d*$/i.test(v)) return true
  if (/^[A-Z]{1,3}$/.test(v)) return true
  return false
}

/** Alineado con `attendanceTotals` (números, A, DD*, faltas, descanso, etc.). */
function cellLooksLikeAttendanceCode(raw: string): boolean {
  const v = normalizeShiftCode(raw)
  if (!v) return false
  if (looksLikeNombreCell(v)) return false
  return isAttendanceCodeToken(v)
}

function scoreParsedShifts(shifts: GridRow['shifts']): number {
  let n = 0
  for (const day of shifts) {
    if (day.D?.trim()) n++
    if (day.T?.trim()) n++
    if (day.N?.trim()) n++
  }
  return n
}

/** Códigos en orden (columnas vacías entre días) → 7 días; si hay 21, D/T/N consecutivos. */
function shiftsFromCollectedCodes(codes: string[]): GridRow['shifts'] {
  const shifts: GridRow['shifts'] = []
  for (let d = 0; d < 7; d++) shifts.push({ D: '', T: '', N: '' })
  if (codes.length >= 21) {
    for (let d = 0; d < 7; d++) {
      shifts[d] = {
        D: codes[d * 3] ?? '',
        T: codes[d * 3 + 1] ?? '',
        N: codes[d * 3 + 2] ?? '',
      }
    }
    return shifts
  }
  for (let d = 0; d < 7 && d < codes.length; d++) {
    shifts[d] = { D: codes[d] ?? '', T: '', N: '' }
  }
  return shifts
}

function skipColsForShiftExtract(
  layout: AttendanceCsvLayout,
  empCol: number,
  nombreCol: number,
): Set<number> {
  const skip = new Set<number>([empCol])
  if (nombreCol >= 0) skip.add(nombreCol)
  if (layout.plantaCol != null) skip.add(layout.plantaCol)
  if (layout.noServicioCol != null) skip.add(layout.noServicioCol)
  if (layout.servicioCol != null) skip.add(layout.servicioCol)
  return skip
}

function inferNombreColForRow(cells: string[], empCol: number): number {
  const tryCol = empCol + 1
  if (tryCol < cells.length && looksLikeNombreCell(cells[tryCol] ?? '')) return tryCol
  if (empCol > 0 && looksLikeNombreCell(cells[empCol - 1] ?? '')) return empCol - 1
  return -1
}

/** Por fila: detecta N.º en columna del layout o en las primeras celdas. */
function resolveEmpNoFromRow(
  cells: string[],
  layout: AttendanceCsvLayout,
): { empRaw: string; empCol: number; nombreCol: number } {
  const primary = normalizarCeldaCsvNumerica(cells[layout.empCol] ?? '')
  if (looksLikeEmpNoCell(primary)) {
    return {
      empRaw: primary,
      empCol: layout.empCol,
      nombreCol: inferNombreColForRow(cells, layout.empCol),
    }
  }

  const skip = new Set<number>()
  if (layout.plantaCol != null) skip.add(layout.plantaCol)
  if (layout.noServicioCol != null) skip.add(layout.noServicioCol)
  if (layout.servicioCol != null) skip.add(layout.servicioCol)

  for (let c = 0; c < Math.min(6, cells.length); c++) {
    if (skip.has(c)) continue
    const raw = normalizarCeldaCsvNumerica(cells[c] ?? '')
    if (!looksLikeEmpNoCell(raw)) continue
    return {
      empRaw: raw,
      empCol: c,
      nombreCol: inferNombreColForRow(cells, c),
    }
  }

  return { empRaw: '', empCol: layout.empCol, nombreCol: -1 }
}

/** Por fila: bloque D/T/N consecutivo o códigos espaciados (Excel con columnas vacías). */
function shiftsFromRowByEmpNo(
  cells: string[],
  layout: AttendanceCsvLayout,
  nombreCol: number,
  empCol: number = layout.empCol,
  preferDense = false,
): GridRow['shifts'] {
  const denseStart =
    nombreCol >= 0 ? nombreCol + 1 : Math.max(layout.shiftStart, empCol + 1)
  const dense =
    denseStart + 21 <= cells.length
      ? shiftsFromCellsAt(cells, denseStart)
      : shiftsFromCellsAt(cells, layout.shiftStart)
  const denseScore = scoreParsedShifts(dense)

  const skip = skipColsForShiftExtract(layout, empCol, nombreCol)
  const codesStart = nombreCol >= 0 ? nombreCol + 1 : empCol + 1
  const codes: string[] = []
  for (let c = codesStart; c < cells.length; c++) {
    if (skip.has(c)) continue
    const v = normalizeShiftCode(cells[c] ?? '')
    if (cellLooksLikeAttendanceCode(v)) codes.push(v)
  }
  const flexible = shiftsFromCollectedCodes(codes)
  const flexScore = scoreParsedShifts(flexible)
  /* Cabecera D/T/N confirmada: en empate gana el bloque fijo (posición de día exacta). */
  if (preferDense) return flexScore > denseScore ? flexible : dense
  return flexScore >= denseScore ? flexible : dense
}

function parseCsvAttendanceRow(
  cells: string[],
  layout: AttendanceCsvLayout,
  preferDense = false,
): {
  empCanon: string
  empCol: number
  nombreCol: number
  shifts: GridRow['shifts']
  numeroServicioCsv?: string
  servicioNombreCsv?: string
  plantaNombre?: string
} | null {
  const { empRaw, empCol, nombreCol } = resolveEmpNoFromRow(cells, layout)
  if (!empRaw) return null
  const empCanon = canonicalEmpNoForCsvMatch(empRaw)
  if (!empCanon) return null

  let plantaNombre: string | undefined
  if (layout.plantaCol != null) {
    const p = normPlantaCsv(cells[layout.plantaCol] ?? '')
    if (p) plantaNombre = p
  }

  const shifts = reassignFaltaSequence(
    shiftsFromRowByEmpNo(cells, layout, nombreCol, empCol, preferDense),
  )
  const noSrv =
    layout.noServicioCol != null
      ? String(cells[layout.noServicioCol] ?? '').trim()
      : undefined
  const servicioCsv =
    layout.servicioCol != null
      ? String(cells[layout.servicioCol] ?? '').trim()
      : undefined

  return {
    empCanon,
    empCol,
    nombreCol,
    shifts,
    numeroServicioCsv: noSrv || undefined,
    servicioNombreCsv: servicioCsv || undefined,
    plantaNombre,
  }
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
function inferEmpColFromDataRows(
  table: string[][],
  fromRow: number,
  excludeCols?: ReadonlySet<number>,
): number {
  const end = Math.min(fromRow + 60, table.length)
  const rowCount = end - fromRow
  if (rowCount < 1) return -1

  const colStats = new Map<number, { hits: number; unique: Set<string> }>()
  for (let r = fromRow; r < end; r++) {
    const cells = table[r] ?? []
    for (let c = 0; c < cells.length; c++) {
      if (excludeCols?.has(c)) continue
      const raw = normalizarCeldaCsvNumerica(String(cells[c] ?? ''))
      const canon = canonicalEmpNoForCsvMatch(raw)
      if (!canon || !/^\d{3,10}$/.test(canon)) continue
      let st = colStats.get(c)
      if (!st) {
        st = { hits: 0, unique: new Set<string>() }
        colStats.set(c, st)
      }
      st.hits++
      st.unique.add(canon)
    }
  }

  const minHits = Math.max(1, Math.floor(rowCount * 0.2))
  let bestCol = -1
  let bestScore = -1
  for (const [col, st] of colStats) {
    if (excludeCols?.has(col)) continue
    if (st.hits < minHits) continue
    const uniqRatio = st.unique.size / st.hits
    let score = st.unique.size * 20 + st.hits
    if (col === 0) score += 25
    if (uniqRatio >= 0.75) score += 80
    if (uniqRatio < 0.35) score = Math.floor(score * 0.25)
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
  const sampleEnd = Math.min(fromRow + 20, table.length)
  let bestDenseStart = -1
  let bestDenseScore = 0
  for (let start = empCol + 1; start <= Math.max(empCol + 1, maxCol - 21); start++) {
    let score = 0
    for (let r = fromRow; r < sampleEnd; r++) {
      for (let d = 0; d < 7; d++) {
        for (let t = 0; t < 3; t++) {
          const v = table[r]?.[start + d * 3 + t] ?? ''
          if (cellLooksLikeAttendanceCode(v)) score++
        }
      }
    }
    if (score > bestDenseScore) {
      bestDenseScore = score
      bestDenseStart = start
    }
  }

  let bestSparseStart = empCol + 1
  let bestSparseScore = 0
  for (let start = empCol + 1; start < maxCol; start++) {
    let score = 0
    for (let r = fromRow; r < sampleEnd; r++) {
      const cells = table[r] ?? []
      for (let c = start; c < cells.length; c++) {
        if (cellLooksLikeAttendanceCode(cells[c] ?? '')) score++
      }
    }
    if (score > bestSparseScore) {
      bestSparseScore = score
      bestSparseStart = start
    }
  }

  if (bestDenseScore >= 5 && bestDenseStart >= 0) return bestDenseStart
  if (bestSparseScore >= 3) return bestSparseStart
  const h = table[0]?.map(normHeaderCell) ?? []
  const afterEmp = h[empCol + 1] ?? ''
  if (matchesNombresHeader(afterEmp)) return empCol + 2
  const nomDataCol = inferNombreColFromData(table, empCol, fromRow)
  if (nomDataCol === empCol + 1) return empCol + 2
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

  const { servicioCol, noServicioCol } = findServicioColsInHeader(header)
  const excludeEmpInferCols = new Set<number>()
  if (noServicioCol != null) excludeEmpInferCols.add(noServicioCol)
  if (servicioCol != null) excludeEmpInferCols.add(servicioCol)

  if (empCol < 0 && table && table.length >= 1) {
    for (const start of [0, 1]) {
      if (start >= table.length) continue
      const inferred = inferEmpColFromDataRows(table, start, excludeEmpInferCols)
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
  if (maxCols <= empCol) return null

  return buildLayoutFromEmpAndShift(header, empCol, shiftStart)
}

/** Primera fila de datos (0 si no hay fila de encabezados reconocible). */
export function attendanceCsvDataStartRow(layout: AttendanceCsvLayout, table: string[][]): number {
  if (table.length < 1) return 0
  if (table.length === 1) return 0
  const header = table[0]!.map((c) => String(c ?? '').trim())
  if (headerRowLooksLikeAttendance(header)) return 1
  const { servicioCol, noServicioCol } = findServicioColsInHeader(header)
  const excludeEmpInferCols = new Set<number>()
  if (noServicioCol != null) excludeEmpInferCols.add(noServicioCol)
  if (servicioCol != null) excludeEmpInferCols.add(servicioCol)
  const inferred = inferEmpColFromDataRows(table, 0, excludeEmpInferCols)
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
      /** Filas de datos leídas (con o sin cabecera). */
      filasLeidas?: number
      /** Filas con N.º pero sin códigos reconocibles. */
      filasSinCodigos?: number
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

  const delim = pickDelimiter(contentLines)
  const table = contentLines.map((ln) => splitCsvDelimitedLine(ln, delim))

  const header = table[0]!.map((c) => c.trim())
  const layout = detectAttendanceCsvLayout(header, table)
  if (!layout) {
    return {
      ok: false,
      error:
        'No se detectó la columna NO. DE EMPLEADO (o CLAVE). Use N.º empleado + nombre + códigos de asistencia (21 columnas D/T/N o un código por día con columnas vacías).',
    }
  }

  const dataStartRow = attendanceCsvDataStartRow(layout, table)
  const maxCols = Math.max(...table.map((r) => r.length), header.length)
  if (maxCols <= layout.shiftStart) {
    return {
      ok: false,
      error: `Faltan columnas de asistencia después del N.º empleado (columna ${layout.empCol + 1}).`,
    }
  }

  let headerConfirmaDtn = false
  if (dataStartRow === 1) {
    const sh0 = normHeaderCell(header[layout.shiftStart] ?? '')
    if (firstShiftHeaderLooksWrong(sh0)) {
      return {
        ok: false,
        error:
          'La columna de códigos parece incorrecta (se encontró «Asist.»). Este archivo es el CSV de totales, no el de códigos por turno.',
      }
    }
    /* Cabecera tipo «D;T;N;D;T;N…» o «Lun-D;Lun-T…»: layout de 21 columnas confirmado. */
    headerConfirmaDtn =
      sh0 === 'd' || /^(lun|mar|mie|jue|vie|sab|dom)/.test(sh0)
  }

  const multiPlanta = csvLayoutHasPlantaColumn(layout)
  const byKey = new Map<string, ParsedAttendanceGridCsvRow>()
  let rowsSinPlanta = 0
  let filasLeidas = 0
  let filasSinCodigos = 0

  for (let r = dataStartRow; r < table.length; r++) {
    let cells = table[r]!.map((c) => c.trim())
    while (cells.length < maxCols) cells.push('')
    if (!cells.some((c) => c.trim())) continue

    filasLeidas++
    const parsed = parseCsvAttendanceRow(cells, layout, headerConfirmaDtn)
    if (!parsed) continue

    if (multiPlanta && layout.plantaCol != null && !parsed.plantaNombre) {
      rowsSinPlanta++
    }
    if (scoreParsedShifts(parsed.shifts) === 0) {
      filasSinCodigos++
      continue
    }

    byKey.set(parsed.empCanon, {
      employeeNo: parsed.empCanon,
      shifts: parsed.shifts,
      numeroServicioCsv: parsed.numeroServicioCsv,
      servicioNombreCsv: parsed.servicioNombreCsv,
      plantaNombre: parsed.plantaNombre,
    })
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
    filasLeidas,
    filasSinCodigos,
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
 * Varias filas CSV del mismo N.º → gana la **última** fila del archivo (reimportación reemplaza la semana).
 */
export function mergeParsedRowsForEmployee(
  rows: ParsedAttendanceGridCsvRow[],
): ParsedAttendanceGridCsvRow | null {
  if (rows.length === 0) return null
  const last = rows[rows.length - 1]!
  const canon = canonicalEmpNoForCsvMatch(last.employeeNo) || last.employeeNo.trim()
  const shifts = reassignFaltaSequence(
    last.shifts.map((d) => ({ D: d.D ?? '', T: d.T ?? '', N: d.N ?? '' })),
  )
  return {
    employeeNo: canon,
    shifts,
    numeroServicioCsv: last.numeroServicioCsv,
    servicioNombreCsv: last.servicioNombreCsv,
    plantaNombre: last.plantaNombre,
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
    const plantaNorm = normPlantaCsv(
      imp.plantaNombre?.trim() || reconcile.plantaNombre || gridRow.plantaLinea || '',
    )
    const svc = reconciliarServicioVacante(
      {
        planta: plantaNorm,
        servicioLinea: imp.servicioNombreCsv?.trim() || gridRow.servicioLinea,
        rowServiceNo: imp.numeroServicioCsv?.trim() || gridRow.rowServiceNo,
      },
      reconcile.catalogo,
    )
    merged.rowServiceNo = reconcileRowServiceNo(
      {
        rowServiceNo: svc.rowServiceNo,
        servicioLinea: svc.servicioLinea,
      },
      col,
      reconcile.catalogo,
      reconcile.plantaNombre,
    )
    merged.servicioLinea = elegirValorIdentificacionAsistencia(
      svc.servicioLinea,
      gridRow.servicioLinea,
    )
    if (plantaNorm) merged.plantaLinea = plantaNorm
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
  /**
   * Reimportación: los N.º en CSV sustituyen por completo la semana guardada (no mezclan con celdas previas).
   * Por defecto true en importación.
   */
  reemplazarSemanaDesdeCsv?: boolean
  /** Importación en una planta elegida: no descartar por planta distinta en expediente. */
  omitirFiltroPlantaExpediente?: boolean
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
  const reemplazarSemana = reconcile?.reemplazarSemanaDesdeCsv !== false
  const updatedEmpleados = new Set<string>()
  let updatedRowCount = 0
  const gridCanonKeys = new Set<string>()
  const gridEmployeesNotInCsv: string[] = []
  const ambiguousEmployeeNos: string[] = []
  const csvEmployeesNotInGrid: string[] = []
  const updatedByRowId = new Map<string, GridRow>()
  const existingRowIds = new Set(gridRows.map((r) => r.id))
  const appended: GridRow[] = []

  const gridByEmp = new Map<string, GridRow[]>()
  for (const r of gridRows) {
    const canon = empNoClaveGridRow(r) || canonicalEmpNoForCsvMatch(String(r.employeeNo ?? r.id ?? ''))
    if (!canon) continue
    gridCanonKeys.add(canon)
    const list = gridByEmp.get(canon) ?? []
    list.push(r)
    gridByEmp.set(canon, list)
  }

  for (const canon of gridCanonKeys) {
    if (!csvByEmp.has(canon)) {
      const sample = gridByEmp.get(canon)?.[0]
      gridEmployeesNotInCsv.push(sample?.employeeNo ?? canon)
    }
  }

  for (const [canon, imp] of csvByEmp) {
    if (scoreCsvRowShifts(imp) === 0) continue

    let targets = gridByEmp.get(canon) ?? []
    if (targets.length === 0 && reconcile?.agregarFilasCsvPorEmpNo) {
      const col = reconcile.colaboradoresByEmp.get(canon)
      if (!col) {
        csvEmployeesNotInGrid.push(imp.employeeNo)
        continue
      }
      if (
        !reconcile.omitirFiltroPlantaExpediente &&
        !colaboradorPertenecePlantaAsistencia(col, reconcile.plantaNombre)
      ) {
        csvEmployeesNotInGrid.push(imp.employeeNo)
        continue
      }
      targets = [colaboradorToGridRow(col, reconcile.catalogo, reconcile.plantaNombre)]
      gridCanonKeys.add(canon)
    } else if (targets.length === 0) {
      csvEmployeesNotInGrid.push(imp.employeeNo)
      continue
    }

    updatedEmpleados.add(canon)
    for (const r of targets) {
      updatedRowCount++
      const rowBase = reemplazarSemana
        ? {
            ...r,
            shifts: emptyShifts(WEEK_COLUMNS.length),
            totals: { ...ZERO_TOTALS },
          }
        : r
      const applied = applyCsvAttendanceToGridRow(rowBase, imp, reconcile)
      updatedByRowId.set(r.id, applied)
      if (!existingRowIds.has(r.id)) appended.push(applied)
    }
  }

  const next = gridRows.map((r) => updatedByRowId.get(r.id) ?? r)
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
  /** Cuadrícula resultante de la planta (para pintar en pantalla sin esperar relectura). */
  rows: GridRow[]
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
  colaboradoresByEmp?: Map<string, ColaboradorCompleto>,
): { groups: Map<string, ParsedAttendanceGridCsvRow[]>; rowsSinPlanta: number } {
  const groups = new Map<string, ParsedAttendanceGridCsvRow[]>()
  const fallback = fallbackPlanta ? normPlantaCsv(fallbackPlanta) : ''
  let rowsSinPlanta = 0

  for (const row of rows) {
    let p = resolvePlantaNormForCsvRow(row, catalogo, expedienteNorm)
    /* PLANTA vacía o sin coincidir: la planta real sale del expediente del empleado. */
    if ((!p || !expedienteNorm.has(p)) && colaboradoresByEmp) {
      const canon = canonicalEmpNoForCsvMatch(row.employeeNo)
      const col = canon ? colaboradoresByEmp.get(canon) : undefined
      if (col) {
        const exp = normPlantaCsv(plantaColaborador(col, catalogo))
        if (exp && expedienteNorm.has(exp)) p = exp
      }
    }
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
  /* Misma lista de plantas que la cuadrícula (expediente + catálogo de servicios). */
  const plantasExpediente = listarPlantasCapturaAsistencia(opts.colaboradores, opts.catalogo)
  const expedienteNorm = new Map(plantasExpediente.map((p) => [normPlantaCsv(p), p]))

  const colaboradoresByEmpEarly = mapaColaboradoresPorNoEmpleadoCanon(opts.colaboradores)
  const { groups: grouped, rowsSinPlanta: rowsSinPlantaCsv } = groupCsvRowsByPlanta(
    opts.parsedRows,
    opts.catalogo,
    expedienteNorm,
    opts.fallbackPlantaNombre?.trim(),
    colaboradoresByEmpEarly,
  )
  const plantas: PlantaCsvImportSlice[] = []
  const unknownPlantas: string[] = []
  const omitidosSinRegistroSet = new Set<string>()
  let totalUpdated = 0
  let plantsSaved = 0
  let plantsSaveFailed = 0

  const { getAttendanceWeekPrefetch } = await import('./attendanceWeekPrefetch')
  const prefetch = await getAttendanceWeekPrefetch(opts.weekIso)
  const colaboradoresByEmp = colaboradoresByEmpEarly

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

      const numerosEmpleadoEnCsv = new Set(
        csvRows.map((row) => canonicalEmpNoForCsvMatch(row.employeeNo)).filter(Boolean),
      )
      const base = await mergeGridRowsForPlantaWeekForCsvImport(
        opts.colaboradores,
        plantaNombre,
        opts.catalogo,
        opts.weekIso,
        prefetch,
        { numerosEmpleadoEnCsv, reemplazarEmpNos: numerosEmpleadoEnCsv },
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
        reemplazarSemanaDesdeCsv: true,
        omitirFiltroPlantaExpediente: true,
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
      rows: slice.next,
    })
  }

  if (toPersist.length > 0) {
    const batch = await saveManyAttendanceGrids(
      opts.weekIso,
      toPersist.map((s) => ({ scopeKey: s.scopeKey, rows: s.next, serviceNo: '' })),
      { forceReplace: true },
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
  const plantas = listarPlantasCapturaAsistencia(colaboradores, catalogo)
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
