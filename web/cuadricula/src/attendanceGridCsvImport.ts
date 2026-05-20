import { canonicalEmpNoAttendance } from '@/lib/attendance-emp-no'
import type { ColaboradorCompleto } from '@/lib/colaboradores-types'
import {
  canonicalNoServicioCatalogo,
  findCatalogoPorNombreYPlanta,
  findCatalogoPorNumeroYPlanta,
  reconcileRowServiceNo,
} from '@/lib/colaboradores-catalogo-display'
import type { CatalogoServicioItem } from '@/lib/servicios-catalogo-client'
import { reassignFaltaSequence } from './attendanceFaltaSequence'
import { saveAttendanceGrid } from './attendanceStorage'
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
import { celdasIdentificacionAsistencia } from './attendanceGridColumns'
import type { GridRow } from './mockData'

/** Cabeceras estándar (8 columnas de identificación + 21 códigos). */
export const ATTENDANCE_GRID_CSV_FIXED_HEADERS = [
  'SERVICIO',
  'NO. SERVICIO',
  'PLANTA',
  'POSICION',
  'PUESTO',
  'FECHA DE INGRESO',
  'NO DE EMPLEADO',
  'NOMBRE',
] as const

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
  const c = norm.replace(/\s/g, '')
  return (
    norm === 'no. empleado' ||
    norm === 'no empleado' ||
    c === 'no.empleado' ||
    c === 'noempleado' ||
    norm === '# empleado' ||
    norm === 'no.de empleado' ||
    norm === 'no de empleado' ||
    norm.includes('no de emple') ||
    (norm.includes('no') && norm.includes('emple') && !norm.includes('servicio'))
  )
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

export function detectAttendanceCsvLayout(header: string[]): AttendanceCsvLayout | null {
  const empCol = findEmployeeColumnIndex(header)
  if (empCol < 0) return null
  const posCol = empCol - 3
  if (posCol < 0) return null
  const posNorm = normHeaderCell(header[posCol] ?? '')
  if (!matchesPosicionHeader(posNorm)) return null
  const shiftStart = empCol + 2
  if (header.length < shiftStart + 21) return null

  const plantaCol = findPlantaColumnIndex(header)

  let noServicioCol: number | undefined
  let servicioCol: number | undefined
  if (posCol >= 3) {
    const n0 = normHeaderCell(header[0] ?? '')
    const n1 = normHeaderCell(header[1] ?? '')
    const looksServicio = n0.includes('servicio') && !n0.includes('no')
    const looksNoServicio =
      (n1.includes('no') && n1.includes('servicio')) ||
      n1.replace(/\s/g, '') === 'noservicio'
    if (looksServicio && looksNoServicio) {
      noServicioCol = 1
      servicioCol = 0
    }
  }

  return { empCol, shiftStart, noServicioCol, servicioCol, plantaCol }
}

export function csvLayoutHasPlantaColumn(layout: AttendanceCsvLayout): boolean {
  return layout.plantaCol != null && layout.plantaCol >= 0
}

function shiftsFromCellsAt(cells: string[], shiftStart: number): GridRow['shifts'] {
  const shifts: GridRow['shifts'] = []
  for (let d = 0; d < 7; d++) {
    const o = shiftStart + d * 3
    shifts.push({
      D: (cells[o] ?? '').trim(),
      T: (cells[o + 1] ?? '').trim(),
      N: (cells[o + 2] ?? '').trim(),
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
  const layout = detectAttendanceCsvLayout(header)
  if (!layout) {
    return {
      ok: false,
      error:
        'No se reconoce la cabecera. Use SERVICIO, NO. SERVICIO, PLANTA, POSICION, PUESTO, FECHA DE INGRESO, NO DE EMPLEADO, NOMBRE + 21 columnas D/T/N (Lun–Dom).',
    }
  }

  const minCols = layout.shiftStart + 21
  if (header.length < minCols) {
    return {
      ok: false,
      error: `Faltan columnas: se necesitan al menos ${minCols} (empleado en columna ${layout.empCol + 1} y 21 códigos a la derecha de Nombre).`,
    }
  }

  const sh0 = normHeaderCell(header[layout.shiftStart] ?? '')
  if (firstShiftHeaderLooksWrong(sh0)) {
    return {
      ok: false,
      error:
        'La columna de códigos parece incorrecta (se encontró «Asist.»). Este archivo es el CSV de totales, no el de códigos por turno.',
    }
  }

  const multiPlanta = csvLayoutHasPlantaColumn(layout)
  const byKey = new Map<string, ParsedAttendanceGridCsvRow>()
  let rowsSinPlanta = 0

  for (let r = 1; r < table.length; r++) {
    let cells = table[r]!.map((c) => c.trim())
    while (cells.length < minCols) cells.push('')
    const empRaw = (cells[layout.empCol] ?? '').trim()
    if (!empRaw) continue

    let plantaNombre: string | undefined
    if (multiPlanta && layout.plantaCol != null) {
      const p = normPlantaCsv(cells[layout.plantaCol] ?? '')
      if (p) plantaNombre = p
      else rowsSinPlanta++
    }

    const shifts = reassignFaltaSequence(shiftsFromCellsAt(cells, layout.shiftStart))
    const empCanon = canonicalEmpNoForCsvMatch(empRaw)
    const noSrv =
      layout.noServicioCol != null
        ? String(cells[layout.noServicioCol] ?? '').trim()
        : undefined
    const noSrvCanon = noSrv ? canonicalNoServicioForCsvMatch(noSrv) : ''
    const servicioCsv =
      layout.servicioCol != null
        ? String(cells[layout.servicioCol] ?? '').trim()
        : undefined

    const mapKey = [
      multiPlanta && plantaNombre ? plantaNombre : '',
      empCanon,
      noSrvCanon,
    ]
      .filter(Boolean)
      .join('|')
    byKey.set(mapKey, {
      employeeNo: empRaw,
      shifts,
      numeroServicioCsv: noSrv || undefined,
      servicioNombreCsv: servicioCsv || undefined,
      plantaNombre,
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
 * Asistencia: si el CSV repite el mismo N.º de empleado (p. ej. otra posición/servicio),
 * se toma la fila con más códigos; no se exige coincidir NO. de servicio ni posición.
 */
export function pickCsvRowForGridRow(
  _gridRow: GridRow,
  candidates: ParsedAttendanceGridCsvRow[],
): { row: ParsedAttendanceGridCsvRow | null; ambiguous: boolean } {
  if (candidates.length === 0) return { row: null, ambiguous: false }
  if (candidates.length === 1) return { row: candidates[0]!, ambiguous: false }

  let best = candidates[0]!
  let bestScore = scoreCsvRowShifts(best)
  for (let i = 1; i < candidates.length; i++) {
    const c = candidates[i]!
    const sc = scoreCsvRowShifts(c)
    if (sc > bestScore) {
      bestScore = sc
      best = c
    }
  }
  return { row: best, ambiguous: false }
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
export function mapaColaboradoresPorNoEmpleadoCanon(
  lista: ColaboradorCompleto[],
): Map<string, ColaboradorCompleto> {
  const map = new Map<string, ColaboradorCompleto>()
  for (const c of lista) {
    const k = canonicalEmpNoForCsvMatch(c.noEmpleado)
    if (!k) continue
    const prev = map.get(k)
    if (!prev) {
      map.set(k, c)
      continue
    }
    if (colaboradorTieneBaja(prev) && !colaboradorTieneBaja(c)) map.set(k, c)
  }
  return map
}

export function mergeCsvShiftsIntoGridRows(
  gridRows: GridRow[],
  csvRows: ParsedAttendanceGridCsvRow[],
  reconcile?: MergeCsvReconcileOpts,
): {
  next: GridRow[]
  updatedCount: number
  /** Empleados en CSV sin fila en la cuadrícula (esta planta). */
  csvEmployeesNotInGrid: string[]
  /** Empleados en cuadrícula sin fila en el CSV (se dejan como estaban). */
  gridEmployeesNotInCsv: string[]
  /** Mismo empleado en varios bloques del CSV y ninguno coincide con su N.º en cuadrícula. */
  ambiguousEmployeeNos: string[]
  gridEmployeeCount: number
} {
  const csvByEmp = indexCsvRowsByEmployee(csvRows)
  const csvEmpMatched = new Set<string>()
  let updatedCount = 0
  const gridCanonKeys = new Set<string>()
  const gridEmployeesNotInCsv: string[] = []
  const ambiguousEmployeeNos: string[] = []

  const next = gridRows.map((r) => {
    const kRaw = String(r.employeeNo ?? r.id ?? '').trim()
    if (!kRaw) return r
    const canon = canonicalEmpNoForCsvMatch(kRaw)
    gridCanonKeys.add(canon)
    const candidates = csvByEmp.get(canon) ?? []
    const { row: imp, ambiguous } = pickCsvRowForGridRow(r, candidates)
    if (!imp) {
      if (candidates.length > 0 && ambiguous) ambiguousEmployeeNos.push(kRaw)
      else gridEmployeesNotInCsv.push(kRaw)
      return r
    }
    csvEmpMatched.add(canon)
    updatedCount++
    const shifts = reassignFaltaSequence(imp.shifts)
    let merged: GridRow = { ...r, shifts }
    if (reconcile) {
      const col = reconcile.colaboradoresByEmp.get(canon)
      merged.rowServiceNo = reconcileRowServiceNo(
        {
          rowServiceNo: imp.numeroServicioCsv?.trim() || r.rowServiceNo,
          servicioLinea: imp.servicioNombreCsv?.trim() || r.servicioLinea,
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
  })

  const appended: GridRow[] = []
  const csvEmployeesNotInGrid: string[] = []

  if (reconcile?.agregarFilasCsvPorEmpNo) {
    for (const [canon, candidates] of csvByEmp) {
      if (csvEmpMatched.has(canon)) continue
      const col = reconcile.colaboradoresByEmp.get(canon)
      if (!col) {
        csvEmployeesNotInGrid.push(candidates[0]!.employeeNo)
        continue
      }
      const synthetic = colaboradorToGridRow(col, reconcile.catalogo, reconcile.plantaNombre)
      const { row: imp, ambiguous } = pickCsvRowForGridRow(synthetic, candidates)
      if (!imp) {
        if (ambiguous) ambiguousEmployeeNos.push(candidates[0]!.employeeNo)
        else csvEmployeesNotInGrid.push(candidates[0]!.employeeNo)
        continue
      }
      csvEmpMatched.add(canon)
      updatedCount++
      const shifts = reassignFaltaSequence(imp.shifts)
      let row: GridRow = { ...synthetic, shifts }
      row.rowServiceNo = reconcileRowServiceNo(
        {
          rowServiceNo: imp.numeroServicioCsv?.trim() || synthetic.rowServiceNo,
          servicioLinea: imp.servicioNombreCsv?.trim() || synthetic.servicioLinea,
        },
        col,
        reconcile.catalogo,
        reconcile.plantaNombre,
      )
      appended.push(withComputedTotals(row, gridRowServiceNo(row)))
    }
  } else {
    for (const [canon, rows] of csvByEmp) {
      if (csvEmpMatched.has(canon)) continue
      csvEmployeesNotInGrid.push(rows[0]!.employeeNo)
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
    updatedCount,
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
  rowsSinPlantaCsv: number
}

function groupCsvRowsByPlanta(
  rows: ParsedAttendanceGridCsvRow[],
  catalogo: CatalogoServicioItem[],
  expedienteNorm: Map<string, string>,
  fallbackPlanta?: string,
): Map<string, ParsedAttendanceGridCsvRow[]> {
  const groups = new Map<string, ParsedAttendanceGridCsvRow[]>()
  const fallback = fallbackPlanta ? normPlantaCsv(fallbackPlanta) : ''

  for (const row of rows) {
    let p =
      resolvePlantaNormForCsvRow(row, catalogo, expedienteNorm) ??
      (fallback && expedienteNorm.has(fallback) ? fallback : '')
    if (!p) continue
    const list = groups.get(p) ?? []
    list.push(row)
    groups.set(p, list)
  }
  return groups
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

  const grouped = groupCsvRowsByPlanta(
    opts.parsedRows,
    opts.catalogo,
    expedienteNorm,
    opts.fallbackPlantaNombre?.trim(),
  )
  const plantas: PlantaCsvImportSlice[] = []
  const unknownPlantas: string[] = []
  let totalUpdated = 0
  let plantsSaved = 0

  for (const [plantaNorm, csvRows] of grouped) {
    const plantaNombre = expedienteNorm.get(plantaNorm)
    if (!plantaNombre) {
      unknownPlantas.push(plantaNorm)
      continue
    }
    const scopeKey = plantaToStorageKey(plantaNombre)
    if (!scopeKey) continue

    const base = await mergeGridRowsForPlantaWeekForCsvImport(
      opts.colaboradores,
      plantaNombre,
      opts.catalogo,
      opts.weekIso,
    )
    const colaboradoresByEmp = mapaColaboradoresPorNoEmpleadoCanon(opts.colaboradores)
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

    const saved = updatedCount > 0 && (await saveAttendanceGrid(opts.weekIso, scopeKey, next, ''))
    if (saved) plantsSaved++
    totalUpdated += updatedCount

    plantas.push({
      plantaNombre,
      updatedCount,
      gridEmployeeCount,
      csvRowsTotal: csvRows.length,
      csvEmployeesNotInGrid,
      ambiguousEmployeeNos,
      saved,
    })
  }

  plantas.sort((a, b) => a.plantaNombre.localeCompare(b.plantaNombre, 'es'))

  return {
    plantas,
    unknownPlantas,
    totalUpdated,
    plantsSaved,
    rowsSinPlantaCsv: 0,
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
  const parts: string[] = []
  for (const planta of plantas) {
    const rows = await mergeGridRowsForPlantaWeek(colaboradores, planta, catalogo, weekIso)
    if (rows.length === 0) continue
    const block = buildAttendanceCodesCsvPlantaSheet(rows, planta, delim)
    if (parts.length > 0) parts.push('')
    parts.push(block)
  }
  return parts.join('\r\n')
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
