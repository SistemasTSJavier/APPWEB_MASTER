import { useEffect, useMemo, useRef, useState, type ChangeEvent } from 'react'
import { isAttendanceDayLocked } from '../attendanceDayLock'
import {
  addDays,
  attendanceExportFilename,
  attendanceExportFilenameAllPlantas,
  buildAttendanceExportDateRangeFullText,
  buildCuadriculaExportTotalsByPlantas,
  buildCuadriculaExportTotalsSheetsForWeeks,
  type AttendanceExportAlcance,
  dateToIsoYmdLocal,
  downloadTextFile,
  formatDateEs,
  mondayOfWeek,
  mondaysInCalendarMonth,
  parseIsoYmdToLocalDate,
  type AttendanceExportPeriod,
  weekDayMetas,
} from '../attendanceExportSummary'
import {
  hasLegacyCatalogAttendanceForWeek,
  loadAttendanceGrid,
  loadAttendanceGridForPlantaWithMeta,
  loadLatestPointer,
  mergeAttendanceRowsWithStored,
  normalizeStoredRows,
  parseIsoToLocalDate,
  saveAttendanceGrid,
  summarizeLocalAttendanceEntries,
  weekStartToIso,
} from '../attendanceStorage'
import { syncAllLocalAttendanceToRemote } from '../attendanceRemote'
import { reassignFaltaSequence } from '../attendanceFaltaSequence'
import {
  isAsistenciaCode,
  isDoubleTurnoExtraCode,
  withComputedTotals,
} from '../attendanceTotals'
import {
  colaboradorToGridRow,
  colaboradoresActivosPorPlanta,
  colaboradoresActivosPorServicioCatalogo,
  gridRowServiceNo,
  listarPlantasDeColaboradores,
  plantaExpedienteColaborador,
  plantaFromStorageKey,
  plantaToStorageKey,
} from '../cuadriculaColaboradoresBridge'
import {
  mergeGridRowsForPlantaWeek,
  mergeRowForEmployeeInWeek,
} from '../attendanceSemanaColaborador'
import { useCuadriculaData } from '../CuadriculaDataContext'
import { WEEK_COLUMNS, type GridRow, type Turn } from '../mockData'
import { TOTAL_COLUMN_HELP, WEEK_TOTALS_LEGEND } from '../weekTotalsLegend'
import { ColaboradorAsistenciaResumenPanel } from '../components/ColaboradorAsistenciaResumenPanel'
import {
  applyAttendanceCsvToAllPlantasWeek,
  attendanceCodesCsvFilename,
  buildAttendanceCodesCsvAllPlantasWeek,
  buildAttendanceCodesCsvPlantaSheet,
  canonicalEmpNoForCsvMatch,
  csvDelimiterUserHint,
  csvLayoutHasPlantaColumn,
  mergeCsvShiftsIntoGridRows,
  parseAttendanceGridCodesCsv,
} from '../attendanceGridCsvImport'

const TURNS: Turn[] = ['D', 'T', 'N']

const CODE_HINTS = ['A', 'D', 'F', 'INC', 'VAC', 'PCGS', 'PSGS', 'CAP', 'DD']

function toMonthYm(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  return `${y}-${m}`
}

function lastDayOfCalendarMonth(y: number, m0: number): Date {
  return new Date(y, m0 + 1, 0)
}

function formatSavedAt(iso: string): string {
  try {
    const d = new Date(iso)
    if (Number.isNaN(d.getTime())) return iso
    return d.toLocaleString('es-MX', {
      dateStyle: 'short',
      timeStyle: 'short',
    })
  } catch {
    return iso
  }
}

function cellClass(value: string, _serviceNo: string): string {
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
  _serviceNo: string,
  locked: boolean,
  vacant: boolean,
  readOnly: boolean,
): string | undefined {
  if (readOnly) return 'Solo lectura: la captura está reservada al administrador.'
  if (locked && !vacant) return 'Día futuro: podrá capturarse cuando llegue la fecha.'
  return undefined
}

export function AttendanceView() {
  const {
    catalogo,
    colaboradores,
    loading,
    error,
    reload,
    puedeEditar,
    puedeImportarCsv,
    showMigrationTools,
  } = useCuadriculaData()
  const [rows, setRows] = useState<GridRow[]>([])
  const [plantaSeleccionada, setPlantaSeleccionada] = useState('')
  const [weekStart, setWeekStart] = useState(() => mondayOfWeek(new Date()))
  const [exportPeriod, setExportPeriod] = useState<AttendanceExportPeriod>('semana')
  const [exportAlcance, setExportAlcance] = useState<AttendanceExportAlcance>('planta')
  const [exportMonthYm, setExportMonthYm] = useState(() =>
    toMonthYm(mondayOfWeek(new Date())),
  )
  const [exportYearY, setExportYearY] = useState(() =>
    String(new Date().getFullYear()),
  )
  const [exportDesdeYmd, setExportDesdeYmd] = useState(() =>
    dateToIsoYmdLocal(mondayOfWeek(new Date())),
  )
  const [exportHastaYmd, setExportHastaYmd] = useState(() =>
    dateToIsoYmdLocal(addDays(mondayOfWeek(new Date()), 6)),
  )
  const [lastSavedAt, setLastSavedAt] = useState<string | null>(null)
  const [saveMessage, setSaveMessage] = useState<string | null>(null)
  const [legacyRecoveredHint, setLegacyRecoveredHint] = useState<string | null>(null)
  const importCsvCodesRef = useRef<HTMLInputElement>(null)
  const [importRefresh, setImportRefresh] = useState(0)
  const [enviandoProduccion, setEnviandoProduccion] = useState(false)
  const [remoteLoadHint, setRemoteLoadHint] = useState<string | null>(null)
  /** No. empleado (o id fila) para filtrar; vacío = todos. */
  const [focoColaboradorKey, setFocoColaboradorKey] = useState('')
  /** Con colaborador elegido: cuadrícula semanal editable o resumen mensual (solo lectura por semanas). */
  const [vistaColaborador, setVistaColaborador] = useState<'semana' | 'mes'>('semana')
  const [mesConsultaYm, setMesConsultaYm] = useState(() => toMonthYm(new Date()))

  const plantasOpciones = useMemo(
    () => listarPlantasDeColaboradores(colaboradores),
    [colaboradores],
  )

  const plantaStorageKey = useMemo(
    () => plantaToStorageKey(plantaSeleccionada),
    [plantaSeleccionada],
  )

  const displayRows = useMemo(() => {
    const k = focoColaboradorKey.trim()
    if (!k) return rows
    return rows.filter((r) => String(r.employeeNo ?? r.id ?? '').trim() === k)
  }, [rows, focoColaboradorKey])

  const nombreFocoColaborador = useMemo(() => {
    const k = focoColaboradorKey.trim()
    if (!k) return ''
    return rows.find((r) => String(r.employeeNo ?? r.id ?? '').trim() === k)?.name ?? k
  }, [rows, focoColaboradorKey])

  const [mesResumenFilas, setMesResumenFilas] = useState<
    { monday: Date; weekIso: string; row: GridRow | null }[]
  >([])

  useEffect(() => {
    if (
      !focoColaboradorKey.trim() ||
      vistaColaborador !== 'mes' ||
      !plantaSeleccionada.trim() ||
      !plantaStorageKey
    ) {
      setMesResumenFilas([])
      return
    }
    let cancelled = false
    const key = focoColaboradorKey.trim()
    ;(async () => {
      const filas = await Promise.all(
        mondaysInCalendarMonth(mesConsultaYm).map(async (monday) => {
          const wiso = weekStartToIso(monday)
          const row = await mergeRowForEmployeeInWeek(
            colaboradores,
            plantaSeleccionada,
            catalogo,
            wiso,
            key,
          )
          return { monday, weekIso: wiso, row }
        }),
      )
      if (!cancelled) setMesResumenFilas(filas)
    })()
    return () => {
      cancelled = true
    }
  }, [
    focoColaboradorKey,
    vistaColaborador,
    mesConsultaYm,
    plantaSeleccionada,
    plantaStorageKey,
    catalogo,
    colaboradores,
  ])

  const mostrarSoloResumenMensual =
    Boolean(focoColaboradorKey.trim()) && vistaColaborador === 'mes'

  const dayMetas = useMemo(
    () => weekDayMetas(weekStart, WEEK_COLUMNS),
    [weekStart],
  )

  const dayLocked = useMemo(
    () => dayMetas.map((m) => isAttendanceDayLocked(m.date)),
    [dayMetas],
  )

  const weekIso = useMemo(() => weekStartToIso(weekStart), [weekStart])

  const datalistCodes = useMemo(() => {
    const set = new Set<string>(CODE_HINTS)
    for (const r of displayRows) {
      const n = gridRowServiceNo(r)
      if (n) {
        const u = n.toUpperCase()
        set.add(u)
        set.add(`DD${u}`)
      }
    }
    return [...set]
  }, [displayRows])

  const weekRangeLabel = `Lun–Dom: ${formatDateEs(weekStart)} – ${formatDateEs(
    addDays(weekStart, 6),
  )}`

  useEffect(() => {
    if (!plantaSeleccionada.trim() || !plantaStorageKey) {
      setRows([])
      setLastSavedAt(null)
      return
    }
    let cancelled = false
    ;(async () => {
      const activos = colaboradoresActivosPorPlanta(colaboradores, plantaSeleccionada)
      const base = activos.map((c) => colaboradorToGridRow(c, catalogo, plantaSeleccionada))
      const { grid: stored, remote } = await loadAttendanceGridForPlantaWithMeta(
        weekIso,
        plantaStorageKey,
        activos.map((c) => c.noEmpleado),
      )
      if (cancelled) return
      if (
        remote.status === 'no_config' ||
        remote.status === 'auth' ||
        remote.status === 'forbidden' ||
        remote.status === 'error'
      ) {
        setRemoteLoadHint(remote.message ?? 'No se pudo cargar la asistencia del servidor.')
      } else {
        setRemoteLoadHint(null)
      }
      const soloPlanta = loadAttendanceGrid(weekIso, plantaStorageKey)
      let merged = base
      if (stored) {
        setLastSavedAt(stored.savedAt)
        const norm = normalizeStoredRows(stored.rows)
        merged = mergeAttendanceRowsWithStored(base, norm)
        const legacyWeek = hasLegacyCatalogAttendanceForWeek(weekIso, plantaStorageKey)
        if (legacyWeek && !soloPlanta) {
          setLegacyRecoveredHint(
            'Se recuperó asistencia guardada antes por servicio (catálogo). Pulse «Guardar toda la asistencia» para dejarla bajo esta planta.',
          )
        } else {
          setLegacyRecoveredHint(null)
        }
      } else {
        setLastSavedAt(null)
        setLegacyRecoveredHint(null)
      }
      const baseByKey = new Map(base.map((b) => [String(b.employeeNo ?? b.id ?? '').trim(), b]))
      setRows(
        merged.map((r) => {
          const k = String(r.employeeNo ?? r.id ?? '').trim()
          const br = k ? baseByKey.get(k) : undefined
          const row: GridRow = {
            ...r,
            rowServiceNo: br?.rowServiceNo ?? r.rowServiceNo,
            servicioLinea: br?.servicioLinea ?? r.servicioLinea,
          }
          return withComputedTotals(row, gridRowServiceNo(row))
        }),
      )
    })()
    return () => {
      cancelled = true
    }
  }, [plantaSeleccionada, plantaStorageKey, weekIso, colaboradores, catalogo, importRefresh])

  useEffect(() => {
    setFocoColaboradorKey('')
    setVistaColaborador('semana')
  }, [plantaSeleccionada])

  useEffect(() => {
    const k = focoColaboradorKey.trim()
    if (k && !rows.some((r) => String(r.employeeNo ?? r.id ?? '').trim() === k)) {
      setFocoColaboradorKey('')
      setVistaColaborador('semana')
    }
  }, [rows, focoColaboradorKey])

  useEffect(() => {
    if (!saveMessage) return
    const ms =
      saveMessage.startsWith('CSV:') || saveMessage.startsWith('CSV (')
        ? 12000
        : 4500
    const t = window.setTimeout(() => setSaveMessage(null), ms)
    return () => window.clearTimeout(t)
  }, [saveMessage])

  useEffect(() => {
    if (exportPeriod !== 'semana') return
    setExportDesdeYmd(dateToIsoYmdLocal(weekStart))
    setExportHastaYmd(dateToIsoYmdLocal(addDays(weekStart, 6)))
  }, [exportPeriod, weekStart])

  useEffect(() => {
    if (exportPeriod !== 'mes') return
    const [ys, ms] = exportMonthYm.split('-').map((x) => Number(x))
    const y = ys || new Date().getFullYear()
    const m0 = (ms || 1) - 1
    const from = new Date(y, m0, 1)
    const to = lastDayOfCalendarMonth(y, m0)
    setExportDesdeYmd(dateToIsoYmdLocal(from))
    setExportHastaYmd(dateToIsoYmdLocal(to))
  }, [exportPeriod, exportMonthYm])

  useEffect(() => {
    if (exportPeriod !== 'anual') return
    const y =
      Number.parseInt(exportYearY.trim(), 10) || new Date().getFullYear()
    setExportDesdeYmd(`${y}-01-01`)
    setExportHastaYmd(`${y}-12-31`)
  }, [exportPeriod, exportYearY])

  const localGuardadosResumen = useMemo(
    () =>
      showMigrationTools
        ? summarizeLocalAttendanceEntries()
        : { total: 0, weekCount: 0, plantaCount: 0, entries: [] },
    [showMigrationTools, weekIso, plantaSeleccionada, importRefresh, lastSavedAt],
  )

  async function exportResumen() {
    const nombreArchivoPlanta = plantaSeleccionada.trim() || 'asistencia'
    const restrictKeys = focoColaboradorKey.trim()
      ? [focoColaboradorKey.trim()]
      : undefined

    const desdeD = parseIsoYmdToLocalDate(exportDesdeYmd.trim())
    const hastaD = parseIsoYmdToLocalDate(exportHastaYmd.trim())
    if (!desdeD || !hastaD || desdeD > hastaD) {
      setSaveMessage(
        'Exportación: indique Desde y Hasta válidas (Desde no puede ser posterior a Hasta).',
      )
      return
    }

    if (exportAlcance === 'todas_plantas') {
      const full = await buildCuadriculaExportTotalsByPlantas({
        desdeIso: exportDesdeYmd.trim(),
        hastaIso: exportHastaYmd.trim(),
        colaboradores,
        catalogo,
        restrictEmployeeKeys: restrictKeys,
        plantaEnPantalla:
          exportPeriod === 'semana' ? plantaSeleccionada : undefined,
        rowsEnPantalla: exportPeriod === 'semana' ? displayRows : undefined,
        weekMondayEnPantalla: exportPeriod === 'semana' ? weekStart : undefined,
      })
      if (!full.trim()) {
        setSaveMessage(
          'Exportación: no hay datos de plantas en el rango indicado (revise expediente y guardados).',
        )
        return
      }
      downloadTextFile(
        attendanceExportFilenameAllPlantas(desdeD, hastaD),
        full,
      )
      setSaveMessage(
        `Exportado CSV por planta(s), ${formatDateEs(desdeD)} – ${formatDateEs(hastaD)}.`,
      )
      return
    }

    if (exportPeriod === 'semana') {
      if (!plantaSeleccionada.trim()) {
        setSaveMessage('Seleccione una planta o use alcance «Todas las plantas».')
        return
      }
      const full = buildCuadriculaExportTotalsSheetsForWeeks([
        { monday: weekStart, rows: displayRows },
      ])
      downloadTextFile(
        attendanceExportFilename(nombreArchivoPlanta, desdeD, hastaD),
        full,
      )
      return
    }

    if (!plantaSeleccionada.trim()) {
      setSaveMessage(
        'Seleccione una planta antes de exportar por mes o por año (rango Desde–Hasta).',
      )
      return
    }

    const full = await buildAttendanceExportDateRangeFullText({
      serviceNo: '',
      desdeIso: exportDesdeYmd.trim(),
      hastaIso: exportHastaYmd.trim(),
      colaboradores,
      plantaNombre: plantaSeleccionada,
      catalogo,
      restrictEmployeeKeys: restrictKeys,
    })
    downloadTextFile(
      attendanceExportFilename(nombreArchivoPlanta, desdeD, hastaD),
      full,
    )
  }

  async function descargarCsvAsistenciaSemana(todasLasPlantas: boolean) {
    if (mostrarSoloResumenMensual) {
      setSaveMessage('Use la vista semanal del colaborador para descargar o importar el CSV de códigos.')
      return
    }
    if (todasLasPlantas) {
      const body = await buildAttendanceCodesCsvAllPlantasWeek(colaboradores, catalogo, weekIso, ';')
      if (!body.trim()) {
        setSaveMessage('No hay empleados activos con planta en expediente para armar el CSV.')
        return
      }
      downloadTextFile(attendanceCodesCsvFilename('todas-plantas', weekIso), body)
      return
    }
    if (!plantaSeleccionada.trim() || !plantaStorageKey) {
      setSaveMessage('Seleccione una planta para descargar el CSV de esa planta, o use «Todas las plantas».')
      return
    }
    if (rows.length === 0) {
      setSaveMessage('No hay empleados en cuadrícula para esta planta.')
      return
    }
    const body = buildAttendanceCodesCsvPlantaSheet(rows, plantaSeleccionada, ';')
    downloadTextFile(
      attendanceCodesCsvFilename(plantaSeleccionada, weekIso),
      body,
    )
  }

  async function onImportCsvCodesChange(e: ChangeEvent<HTMLInputElement>) {
    if (!puedeImportarCsv) return
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    if (mostrarSoloResumenMensual) {
      setSaveMessage('Cambie a vista semanal del colaborador para importar códigos en la cuadrícula.')
      return
    }
    let text: string
    try {
      text = await file.text()
    } catch {
      setSaveMessage('No se pudo leer el archivo CSV.')
      return
    }
    const parsed = parseAttendanceGridCodesCsv(text)
    if (parsed.ok === false) {
      setSaveMessage(`CSV: ${parsed.error}`)
      return
    }
    const delimHint = csvDelimiterUserHint(parsed.delimiter)
    const multiPlanta = csvLayoutHasPlantaColumn(parsed.layout)

    if (multiPlanta) {
      const result = await applyAttendanceCsvToAllPlantasWeek({
        parsedRows: parsed.rows,
        colaboradores,
        catalogo,
        weekIso,
      })
      if (result.totalUpdated === 0) {
        const unk =
          result.unknownPlantas.length > 0
            ? ` Plantas en CSV sin expediente: ${result.unknownPlantas.slice(0, 8).join(', ')}${result.unknownPlantas.length > 8 ? '…' : ''}.`
            : ''
        const sinPlanta =
          (parsed.rowsSinPlanta ?? 0) > 0
            ? ` ${parsed.rowsSinPlanta} fila(s) sin valor en columna PLANTA.`
            : ''
        setSaveMessage(
          `CSV (${weekRangeLabel}, separador: ${delimHint}): no se actualizó ningún empleado.${sinPlanta}${unk}`,
        )
        return
      }
      const parts: string[] = [
        `Importación multi-planta: ${result.totalUpdated} empleado(s) en ${result.plantsSaved} planta(s), semana ${weekRangeLabel}. Separador: ${delimHint}.`,
      ]
      for (const p of result.plantas) {
        if (p.updatedCount > 0) {
          parts.push(
            `«${p.plantaNombre}»: ${p.updatedCount}/${p.gridEmployeeCount} actualizados (${p.csvRowsTotal} filas en CSV).`,
          )
        }
      }
      if (result.unknownPlantas.length > 0) {
        parts.push(
          `PLANTA en CSV sin coincidir en expediente: ${result.unknownPlantas.join(', ')}.`,
        )
      }
      if ((parsed.rowsSinPlanta ?? 0) > 0) {
        parts.push(
          `${parsed.rowsSinPlanta} fila(s) con PLANTA vacía (se intentó ubicar por NO SERVICIO en catálogo).`,
        )
      }
      const amb = result.plantas.flatMap((p) => p.ambiguousEmployeeNos)
      if (amb.length > 0) {
        parts.push(
          `Sin actualizar por varios bloques de servicio en CSV (${amb.length}): ${amb.slice(0, 8).join(', ')}${amb.length > 8 ? '…' : ''} — revise que NO SERVICIO coincida con la cuadrícula.`,
        )
      }
      setSaveMessage(parts.join(' '))
      setImportRefresh((n) => n + 1)
      if (plantaSeleccionada.trim() && result.plantas.some((p) => p.plantaNombre === plantaSeleccionada)) {
        setLastSavedAt(new Date().toISOString())
        setLegacyRecoveredHint(null)
      }
      return
    }

    if (!plantaStorageKey) {
      setSaveMessage(
        'CSV sin columna PLANTA: seleccione una planta arriba, o use formato SERVICIO, NO SERVICIO, PLANTA, POSICION… para importar todas las plantas en un solo archivo.',
      )
      return
    }

    const activosImport = colaboradoresActivosPorPlanta(colaboradores, plantaSeleccionada)
    const colaboradoresByEmp = new Map(
      activosImport.map((c) => [canonicalEmpNoForCsvMatch(c.noEmpleado), c] as const),
    )
    const {
      next,
      updatedCount,
      csvEmployeesNotInGrid,
      gridEmployeesNotInCsv,
      gridEmployeeCount,
      ambiguousEmployeeNos,
    } = mergeCsvShiftsIntoGridRows(rows, parsed.rows, {
      catalogo,
      plantaNombre: plantaSeleccionada,
      colaboradoresByEmp,
    })
    if (updatedCount === 0) {
      setSaveMessage(
        csvEmployeesNotInGrid.length > 0
          ? `CSV (planta «${plantaSeleccionada}», ${weekRangeLabel}, separador: ${delimHint}): ningún N.º de empleado coincide. En el archivo — ej.: ${csvEmployeesNotInGrid.slice(0, 8).join(', ')}${csvEmployeesNotInGrid.length > 8 ? '…' : ''}. Use columna No. empleado como texto en Excel.`
          : `CSV (planta «${plantaSeleccionada}», separador: ${delimHint}): no se actualizó ninguna fila. Revise cabecera: formato hoja (8 columnas + D/T/N×7) o compacto (5 columnas + códigos).`,
      )
      return
    }
    const ok = await saveAttendanceGrid(weekIso, plantaStorageKey, next, '')
    setRows(next)
    if (ok) {
      setLastSavedAt(new Date().toISOString())
      setLegacyRecoveredHint(null)
    }
    const parts: string[] = [
      ok
        ? `Importación (una planta): ${updatedCount} de ${gridEmployeeCount} empleado(s) actualizados — «${plantaSeleccionada}», ${weekRangeLabel}. Separador: ${delimHint}.`
        : `Importación: ${updatedCount} de ${gridEmployeeCount} en pantalla; no se pudo guardar en localStorage. Separador: ${delimHint}.`,
    ]
    if (csvEmployeesNotInGrid.length > 0) {
      parts.push(
        `En CSV pero no en esta planta (${csvEmployeesNotInGrid.length}): ${csvEmployeesNotInGrid.slice(0, 10).join(', ')}${csvEmployeesNotInGrid.length > 10 ? '…' : ''}.`,
      )
    }
    if (gridEmployeesNotInCsv.length > 0) {
      parts.push(
        `En cuadrícula sin fila en CSV (${gridEmployeesNotInCsv.length}): ${gridEmployeesNotInCsv.slice(0, 10).join(', ')}${gridEmployeesNotInCsv.length > 10 ? '…' : ''} (conservan lo que tenían).`,
      )
    }
    if (ambiguousEmployeeNos.length > 0) {
      parts.push(
        `Sin actualizar: mismo empleado en varios bloques de servicio en CSV (${ambiguousEmployeeNos.length}) — ${ambiguousEmployeeNos.slice(0, 8).join(', ')}${ambiguousEmployeeNos.length > 8 ? '…' : ''}. El N.º de servicio del CSV debe coincidir con el de la fila en cuadrícula.`,
      )
    }
    setSaveMessage(parts.join(' '))
  }

  function updateCell(
    rowId: string,
    dayIndex: number,
    turn: Turn,
    next: string,
  ) {
    if (!puedeEditar) return
    setRows((prev) =>
      prev.map((r) => {
        if (r.id !== rowId) return r
        const shiftsRaw = r.shifts.map((day, i) =>
          i === dayIndex ? { ...day, [turn]: next } : day,
        )
        const shifts = reassignFaltaSequence(shiftsRaw)
        return withComputedTotals({ ...r, shifts }, gridRowServiceNo(r))
      }),
    )
  }

  /** Semana en pantalla: todas las plantas → navegador + servidor. */
  async function guardarSemanaActualTodasPlantas(): Promise<{
    guardadas: number
    fallidas: number
  }> {
    const plantas = listarPlantasDeColaboradores(colaboradores)
    if (plantas.length === 0) {
      return { guardadas: 0, fallidas: 0 }
    }
    let guardadas = 0
    let fallidas = 0
    const plantaActualNorm = plantaSeleccionada.trim().toUpperCase()
    for (const planta of plantas) {
      const scopeKey = plantaToStorageKey(planta)
      if (!scopeKey) continue
      const esPlantaEnPantalla =
        planta.trim().toUpperCase() === plantaActualNorm && Boolean(plantaStorageKey)
      const filas = esPlantaEnPantalla
        ? rows
        : await mergeGridRowsForPlantaWeek(colaboradores, planta, catalogo, weekIso)
      const ok = await saveAttendanceGrid(weekIso, scopeKey, filas, '')
      if (ok) guardadas++
      else fallidas++
    }
    return { guardadas, fallidas }
  }

  async function guardarYEnviarTodoAlServidor() {
    if (enviandoProduccion) return
    setEnviandoProduccion(true)
    setSaveMessage(null)
    try {
      const partes: string[] = []

      if (!mostrarSoloResumenMensual) {
        const { guardadas, fallidas } = await guardarSemanaActualTodasPlantas()
        if (guardadas > 0) {
          const t = new Date().toISOString()
          if (plantaStorageKey) {
            setLastSavedAt(t)
            setLegacyRecoveredHint(null)
          }
          partes.push(
            `Semana en pantalla (${weekRangeLabel}): ${guardadas} planta(s) guardadas en este equipo y en el servidor.`,
          )
          if (plantaSeleccionada.trim()) {
            partes.push(`Incluye los cambios visibles de «${plantaSeleccionada}».`)
          }
        }
        if (fallidas > 0) {
          partes.push(`${fallidas} planta(s) de la semana actual no se pudieron guardar.`)
        }
      }

      const { entries, total, weekCount, plantaCount } = summarizeLocalAttendanceEntries()

      if (total === 0) {
        partes.push(
          'No hay bloques de asistencia en este navegador. Capture celdas y use «Guardar semana actual» o importe CSV antes de enviar a producción.',
        )
        setSaveMessage(partes.join(' '))
        return
      }

      const result = await syncAllLocalAttendanceToRemote(
        entries.map((e) => ({
          weekStartIso: e.weekStartIso,
          scopeKey: e.scopeKey,
          grid: e.grid,
          serviceNo: e.grid.serviceNo,
        })),
      )

      if (!result) {
        partes.push(
          `No se pudo enviar al servidor (${total} bloque(s) en este navegador). Revise Supabase, migración 011_cuadricula_asistencia.sql y variables en producción.`,
        )
        setSaveMessage(partes.join(' '))
        return
      }

      partes.push(
        `Enviado a producción (servidor): ${result.uploaded} de ${total} bloque(s) — ${plantaCount} planta(s) × ${weekCount} semana(s).`,
      )
      if (result.skipped > 0) {
        partes.push(`${result.skipped} ya estaban más recientes en el servidor.`)
      }
      if (result.failed > 0) {
        partes.push(`${result.failed} bloque(s) fallaron al subir.`)
      }
      partes.push('Abra la URL de producción, misma planta y semana, para comprobar.')
      setSaveMessage(partes.join(' '))
      setImportRefresh((n) => n + 1)
    } finally {
      setEnviandoProduccion(false)
    }
  }

  async function guardarTodaAsistencia() {
    if (mostrarSoloResumenMensual) {
      setSaveMessage('Cambie a vista semanal para guardar la cuadrícula.')
      return
    }
    const { guardadas, fallidas } = await guardarSemanaActualTodasPlantas()
    setImportRefresh((n) => n + 1)
    if (guardadas === 0) {
      setSaveMessage('No se pudo guardar (cuota, modo privado o datos bloqueados).')
      return
    }
    const t = new Date().toISOString()
    if (plantaStorageKey) {
      setLastSavedAt(t)
      setLegacyRecoveredHint(null)
    }
    const partes = [
      `Asistencia guardada: ${guardadas} planta(s), semana ${weekRangeLabel}.`,
    ]
    if (plantaSeleccionada.trim()) {
      partes.push(`La planta «${plantaSeleccionada}» incluye los cambios en pantalla.`)
    }
    if (fallidas > 0) {
      partes.push(`${fallidas} planta(s) no se pudieron guardar.`)
    }
    setSaveMessage(partes.join(' '))
  }

  function irAlUltimoGuardado() {
    const p = loadLatestPointer()
    if (!p?.serviceCatalogId) return
    const planta = plantaFromStorageKey(p.serviceCatalogId)
    if (planta) {
      setPlantaSeleccionada(planta)
      setWeekStart(mondayOfWeek(parseIsoToLocalDate(p.weekStartIso)))
      return
    }
    const cat = catalogo.find((c) => c.id === p.serviceCatalogId)
    setWeekStart(mondayOfWeek(parseIsoToLocalDate(p.weekStartIso)))
    if (!cat) return
    const enServicio = colaboradoresActivosPorServicioCatalogo(colaboradores, cat.nombre)
    const plantas = [
      ...new Set(enServicio.map((c) => plantaExpedienteColaborador(c)).filter(Boolean)),
    ]
    if (plantas.length === 1) {
      setPlantaSeleccionada(plantas[0]!)
    } else {
      setSaveMessage(
        `Último guardado: servicio «${cat.nombre}». Elija la planta; la asistencia se recuperará al coincidir empleados.`,
      )
    }
  }

  const latest = loadLatestPointer()
  const latestDifferent =
    latest &&
    (latest.weekStartIso !== weekIso || latest.serviceCatalogId !== plantaStorageKey)

  const latestLabel = latest
    ? plantaFromStorageKey(latest.serviceCatalogId) ||
      catalogo.find((c) => c.id === latest.serviceCatalogId)?.nombre ||
      null
    : null

  return (
    <div className="attendanceView attendanceView--wideGrid">
      <header className="topbar">
        <div className="topbar__title">
          <h1>Cuadrícula semanal</h1>
          <span className="badge">Asistencia</span>
        </div>
        {loading ? (
          <p className="hint" style={{ marginBottom: 8 }}>
            Cargando plantas y colaboradores…
          </p>
        ) : null}
        {error ? (
          <div className="hint" style={{ marginBottom: 8, color: '#b91c1c' }}>
            <strong>{error}</strong>{' '}
            <button type="button" className="btn btn--linkish" onClick={() => reload()}>
              Reintentar
            </button>
          </div>
        ) : null}
        {remoteLoadHint ? (
          <div className="topbar__remoteWarn" role="alert">
            <strong>No se cargó la asistencia del servidor:</strong> {remoteLoadHint}
          </div>
        ) : null}
        {!puedeEditar ? (
          <p className="topbar__readonlyBanner" role="status">
            <strong>Solo lectura.</strong> La captura y el guardado de asistencia están reservados al administrador.
          </p>
        ) : null}
        {showMigrationTools ? (
          <div className="topbar__produccionBanner" role="region" aria-label="Enviar asistencia a producción">
            <div className="topbar__produccionBannerText">
              <strong>Enviar a producción (Supabase)</strong>
              <p>
                En este navegador hay{' '}
                <strong>{localGuardadosResumen.total}</strong> bloque(s) guardados (
                {localGuardadosResumen.plantaCount} planta(s), {localGuardadosResumen.weekCount}{' '}
                semana(s)). El botón guarda la semana en pantalla y sube todo el historial local al servidor.
              </p>
            </div>
            <button
              type="button"
              className="btn btn--primary btn--produccion"
              onClick={() => void guardarYEnviarTodoAlServidor()}
              disabled={enviandoProduccion || loading}
            >
              {enviandoProduccion
                ? 'Guardando y enviando…'
                : 'Guardar y enviar toda la asistencia a producción'}
            </button>
          </div>
        ) : null}
        <div className="topbar__controls">
          <div className="topbar__bar">
            <div className="topbar__toolbarLeft">
              <label className="field">
                <span className="field__label">Planta</span>
                <select
                  className="select"
                  value={plantaSeleccionada}
                  onChange={(e) => setPlantaSeleccionada(e.target.value)}
                  disabled={loading}
                >
                  <option value="">Seleccione planta…</option>
                  {plantasOpciones.map((p) => (
                    <option key={p} value={p}>
                      {p}
                    </option>
                  ))}
                </select>
              </label>
              {plantasOpciones.length === 0 && !loading ? (
                <p className="field field--grow text-xs font-medium text-amber-900">
                  No hay plantas en expedientes activos. Capture <strong>Planta</strong> en Altas o importe CSV
                  (columna planta).
                </p>
              ) : null}
              <label className="field field--grow">
                <span className="field__label">Colaborador</span>
                <select
                  className="select"
                  value={focoColaboradorKey}
                  onChange={(e) => {
                    const v = e.target.value
                    setFocoColaboradorKey(v)
                    setVistaColaborador('semana')
                  }}
                  disabled={loading || !plantaSeleccionada || rows.length === 0}
                  aria-label="Filtrar por colaborador"
                >
                  <option value="">Todos</option>
                  {rows.map((r) => {
                    const v = String(r.employeeNo ?? r.id ?? '').trim()
                    if (!v) return null
                    const noSrv = gridRowServiceNo(r)
                    return (
                      <option key={r.id} value={v}>
                        {r.name} — {v}
                        {noSrv ? ` — N.º ${noSrv}` : ''}
                      </option>
                    )
                  })}
                </select>
              </label>
              {focoColaboradorKey.trim() ? (
                <>
                  <label className="field">
                    <span className="field__label">Vista del colaborador</span>
                    <select
                      className="select"
                      value={vistaColaborador}
                      onChange={(e) =>
                        setVistaColaborador(e.target.value as 'semana' | 'mes')
                      }
                      aria-label="Vista semanal o mensual"
                    >
                      <option value="semana">Semanal (cuadrícula)</option>
                      <option value="mes">Mensual (resumen)</option>
                    </select>
                  </label>
                  {vistaColaborador === 'mes' ? (
                    <label className="field">
                      <span className="field__label">Mes a consultar</span>
                      <input
                        className="input input--month"
                        type="month"
                        value={mesConsultaYm}
                        onChange={(e) => setMesConsultaYm(e.target.value)}
                        aria-label="Mes del resumen"
                      />
                    </label>
                  ) : null}
                </>
              ) : null}
              <div className="weekNav">
                <button
                  type="button"
                  className="btn"
                  disabled={mostrarSoloResumenMensual}
                  onClick={() => setWeekStart((d) => addDays(d, -7))}
                  title="Retrocede 7 días: semana de lunes a domingo"
                >
                  ← Semana anterior
                </button>
                <div className="weekNav__range">{weekRangeLabel}</div>
                <button
                  type="button"
                  className="btn"
                  disabled={mostrarSoloResumenMensual}
                  onClick={() => setWeekStart((d) => addDays(d, 7))}
                  title="Avanza 7 días: siguiente lunes a domingo"
                >
                  Semana siguiente →
                </button>
              </div>
              {puedeEditar ? (
                <div className="field field--action field--actionToolbar">
                  <span className="field__label">Semana actual</span>
                  <button
                    type="button"
                    className="btn btn--primary"
                    onClick={() => void guardarTodaAsistencia()}
                    disabled={mostrarSoloResumenMensual || loading || !plantaSeleccionada.trim()}
                    title="Guarda la semana en pantalla para todas las plantas en el servidor"
                  >
                    Guardar semana (todas las plantas)
                  </button>
                </div>
              ) : null}
            </div>

            <div className="topbar__legend">
              <table
                className="sheet sheet--legend"
                aria-label="Totales semana: códigos en cuadrícula"
              >
                <thead>
                  <tr>
                    <th colSpan={2} className="th th--block th--day th--legendBand">
                      Totales semana
                    </th>
                  </tr>
                  <tr>
                    <th className="th th--legendSub">Cód.</th>
                    <th className="th th--legendSub">Concepto</th>
                  </tr>
                </thead>
                <tbody>
                  {WEEK_TOTALS_LEGEND.map((item, idx) => (
                    <tr key={`${item.codes}-${idx}`}>
                      <td
                        className={`td td--legendCode legTone legTone--${item.variant}`}
                        title={item.detail ?? item.label}
                      >
                        {item.codes}
                      </td>
                      <td
                        className="td td--legendDesc"
                        title={item.detail ?? item.label}
                      >
                        {item.label}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        <div className="topbar__persistRow">
          {showMigrationTools ? (
            <>
              <button
                type="button"
                className="btn btn--primary btn--produccion persistRow__produccionBtn"
                onClick={() => void guardarYEnviarTodoAlServidor()}
                disabled={enviandoProduccion || loading}
              >
                {enviandoProduccion
                  ? 'Enviando a producción…'
                  : 'Guardar y enviar TODO a producción'}
              </button>
              <p className="persistRow__meta persistRow__meta--inline">
                {localGuardadosResumen.total > 0
                  ? `${localGuardadosResumen.total} bloque(s) en este navegador (${localGuardadosResumen.plantaCount} plantas, ${localGuardadosResumen.weekCount} semanas).`
                  : 'Aún no hay bloques guardados en este navegador.'}
              </p>
            </>
          ) : null}
          {lastSavedAt ? (
            <p className="persistRow__meta">
              <strong>Último guardado</strong> en esta semana/planta:{' '}
              {formatSavedAt(lastSavedAt)}. Al volver a entrar se restaura automáticamente.
            </p>
          ) : (
            <p className="persistRow__meta muted">
              Sin guardado previo para esta combinación planta + semana. Capture la cuadrícula y pulse{' '}
              <strong>Guardar</strong>.
            </p>
          )}
          {showMigrationTools && latestDifferent ? (
            <button type="button" className="btn btn--linkish" onClick={irAlUltimoGuardado}>
              Ir al último guardado globalmente (
              {latestLabel ?? 'Planta'},{' '}
              semana {latest!.weekStartIso})
            </button>
          ) : null}
          {legacyRecoveredHint ? (
            <p className="persistRow__meta" style={{ color: '#b45309' }}>
              {legacyRecoveredHint}
            </p>
          ) : null}
          {saveMessage ? <p className="persistRow__flash">{saveMessage}</p> : null}
          {puedeImportarCsv && !mostrarSoloResumenMensual ? (
            <div className="persistRow__csvBlock">
              <p className="persistRow__csvLead">
                <strong>Importación por CSV</strong> — semana en pantalla ({weekRangeLabel}). Con columna{' '}
                <strong>PLANTA</strong> y <strong>NO SERVICIO</strong> (formato SERVICIO, NO SERVICIO, PLANTA, POSICION… + D/T/N×7) un solo
                archivo actualiza <strong>todas las plantas</strong>: empareja por <strong>NO DE EMPLE</strong> y, si hay varios servicios en la
                misma planta, por <strong>NO SERVICIO</strong> de cada bloque. Si PLANTA viene vacía, se infiere del catálogo por N.º de servicio.
                Sin columna PLANTA, elija la planta arriba.
              </p>
              <div className="persistRow__csvActions">
                <button
                  type="button"
                  className="btn"
                  onClick={() => descargarCsvAsistenciaSemana(false)}
                  disabled={!plantaSeleccionada.trim() || rows.length === 0}
                  title={!plantaSeleccionada.trim() ? 'Seleccione planta' : undefined}
                >
                  Descargar CSV (planta)
                </button>
                <button
                  type="button"
                  className="btn"
                  onClick={() => descargarCsvAsistenciaSemana(true)}
                >
                  Descargar CSV (todas las plantas)
                </button>
                <input
                  ref={importCsvCodesRef}
                  type="file"
                  accept=".csv,text/csv"
                  className="persistRow__csvFile"
                  aria-label="Importar CSV de códigos de asistencia"
                  onChange={onImportCsvCodesChange}
                />
                <button
                  type="button"
                  className="btn btn--primary"
                  onClick={() => importCsvCodesRef.current?.click()}
                >
                  Importar CSV…
                </button>
              </div>
            </div>
          ) : null}
        </div>
        <div className="topbar__exportRow">
          <label className="field">
            <span className="field__label">Alcance</span>
            <select
              className="select"
              value={exportAlcance}
              onChange={(e) =>
                setExportAlcance(e.target.value as AttendanceExportAlcance)
              }
              aria-label="Alcance de exportación"
            >
              <option value="planta">Planta seleccionada</option>
              <option value="todas_plantas">Todas las plantas (por bloques)</option>
            </select>
          </label>
          <label className="field">
            <span className="field__label">Periodo</span>
            <select
              className="select"
              value={exportPeriod}
              onChange={(e) =>
                setExportPeriod(e.target.value as AttendanceExportPeriod)
              }
              aria-label="Periodo de exportación"
            >
              <option value="semana">
                Por semana (lun–dom de la cuadrícula en pantalla)
              </option>
              <option value="mes">
                Por mes (rellena Desde/Hasta; puede ajustar después)
              </option>
              <option value="anual">
                Por año (1 ene – 31 dic; puede ajustar Desde/Hasta)
              </option>
            </select>
          </label>
          {exportPeriod === 'mes' ? (
            <label className="field">
              <span className="field__label">Mes rápido</span>
              <input
                className="input input--month"
                type="month"
                value={exportMonthYm}
                onChange={(e) => setExportMonthYm(e.target.value)}
                aria-label="Mes que define Desde y Hasta"
              />
            </label>
          ) : null}
          {exportPeriod === 'anual' ? (
            <label className="field">
              <span className="field__label">Año rápido</span>
              <input
                className="input"
                type="number"
                min={2000}
                max={2100}
                step={1}
                value={exportYearY}
                onChange={(e) => setExportYearY(e.target.value)}
                aria-label="Año que define Desde y Hasta"
              />
            </label>
          ) : null}
          <label className="field">
            <span className="field__label">Desde</span>
            <input
              className="input input--date"
              type="date"
              value={exportDesdeYmd}
              onChange={(e) => setExportDesdeYmd(e.target.value)}
              disabled={exportPeriod === 'semana'}
              aria-label="Fecha inicial del export"
              title={
                exportPeriod === 'semana'
                  ? 'Lunes de la semana mostrada (cámbiela con las flechas).'
                  : undefined
              }
            />
          </label>
          <label className="field">
            <span className="field__label">Hasta</span>
            <input
              className="input input--date"
              type="date"
              value={exportHastaYmd}
              onChange={(e) => setExportHastaYmd(e.target.value)}
              disabled={exportPeriod === 'semana'}
              aria-label="Fecha final del export"
              title={
                exportPeriod === 'semana'
                  ? 'Domingo de la semana mostrada.'
                  : undefined
              }
            />
          </label>
          <div className="field field--action">
            <span className="field__label">&nbsp;</span>
            <button type="button" className="btn btn--primary" onClick={exportResumen}>
              Exportar (.csv para Excel)
            </button>
          </div>
        </div>
        <p className="hint">
          El listado de <strong>Planta</strong> sale solo de colaboradores activos (campo planta en expediente). Cada fila usa su{' '}
          <strong>N.º de servicio</strong> según <strong>Servicios</strong> (referencia por fila). Use{' '}
          <strong>Colaborador</strong> para una persona o el <strong>resumen mensual</strong>. <strong>Número</strong> o <strong>A</strong> → Asist.;{' '}
          <strong>DD</strong>+número → Extra; <strong>F</strong> → Falta; <strong>D</strong> → 1 Desc. por día (aunque esté en D+T+N); INC/VAC/PCGS/PSGS/CAP → su columna.{' '}
          {puedeEditar ? (
            <>
              Pulse <strong>Guardar semana (todas las plantas)</strong> para conservar en el servidor.{' '}
            </>
          ) : (
            <>
              <strong>Solo lectura</strong> (excepto administrador).{' '}
            </>
          )}
          <strong>Exportar cuadrícula</strong>: totales por semana/mes/año; elija <strong>Todas las plantas</strong> para un CSV con un bloque por planta.{' '}
          {puedeImportarCsv ? (
            <>
              Para capturar <strong>códigos en celdas</strong> use <strong>Descargar CSV / Importar CSV</strong> arriba. El archivo puede ser como su
              hoja de planta (SERVICIO… NOMBRE + D/T/N×7) o el formato compacto de 5 columnas + códigos; separador coma o punto y
              coma; <strong>NO DE EMPLE</strong> / No. empleado como texto en Excel.{' '}
            </>
          ) : null}
          Códigos:{' '}
          {CODE_HINTS.join(', ')}, <strong>A</strong> o número (Asist.), <strong>DD</strong>+n.º (Extra, p. ej. DD937).
        </p>
        </div>
      </header>

      <div className="sheetWrap">
        {!plantaSeleccionada ? (
          <p className="hint" style={{ padding: '1rem' }}>
            Elija una planta para listar empleados y capturar asistencia.
          </p>
        ) : rows.length === 0 ? (
          <p className="hint" style={{ padding: '1rem' }}>
            No hay colaboradores activos con planta <strong>{plantaSeleccionada}</strong> en expediente. Revise o importe el campo{' '}
            <strong>Planta</strong> en Altas / Colaboradores.
          </p>
        ) : null}
        {mostrarSoloResumenMensual ? (
          <ColaboradorAsistenciaResumenPanel
            titulo={`Resumen mensual — ${nombreFocoColaborador}`}
            subtitulo="Totales por semana (lun–dom) según datos guardados para la planta actual. Para capturar celdas use Vista del colaborador → Semanal."
            mesYm={mesConsultaYm}
            filas={mesResumenFilas}
          />
        ) : null}
        {!mostrarSoloResumenMensual ? (
        <table className="sheet" aria-label="Cuadrícula de asistencia">
          <thead>
            <tr>
              <th colSpan={7} className="th th--block th--band th--bandId">
                Identificación
              </th>
              {WEEK_COLUMNS.map((col, i) => (
                <th key={col.key} colSpan={3} className="th th--block th--day th--band">
                  {col.weekday}{' '}
                  <span className="muted">{dayMetas[i]?.dateLabel ?? ''}</span>
                </th>
              ))}
              <th colSpan={9} className="th th--block th--day th--band th--totalsHead">
                Totales semana
              </th>
            </tr>
            <tr className="theadSub">
              <th className="th th--sticky">Posición</th>
              <th className="th th--sticky">Puesto</th>
              <th className="th th--sticky">Fecha ing.</th>
              <th className="th th--sticky">No. empleado</th>
              <th className="th th--sticky th--name">Nombres</th>
              <th className="th th--sticky" title="Servicio vigente en expediente">
                Servicio
              </th>
              <th className="th th--sticky mono" title="N.º en catálogo según servicio del colaborador">
                N.º serv.
              </th>
              {WEEK_COLUMNS.map((col) =>
                TURNS.map((t) => (
                  <th key={`${col.key}-${t}`} className="th th--turn">
                    {t}
                  </th>
                )),
              )}
              <th className="th th--total" title={TOTAL_COLUMN_HELP.asist}>
                Asist.
              </th>
              <th className="th th--total" title={TOTAL_COLUMN_HELP.extra}>
                Extra
              </th>
              <th className="th th--total" title={TOTAL_COLUMN_HELP.desc}>
                Desc.
              </th>
              <th className="th th--total" title={TOTAL_COLUMN_HELP.falta}>
                Falta
              </th>
              <th className="th th--total" title={TOTAL_COLUMN_HELP.inc}>
                Inc.
              </th>
              <th className="th th--total" title={TOTAL_COLUMN_HELP.pcgs}>
                PCGS
              </th>
              <th className="th th--total" title={TOTAL_COLUMN_HELP.psgs}>
                PSGS
              </th>
              <th className="th th--total" title={TOTAL_COLUMN_HELP.vac}>
                Vac.
              </th>
              <th className="th th--total" title={TOTAL_COLUMN_HELP.cap}>
                Cap.
              </th>
            </tr>
          </thead>
          <tbody>
            {displayRows.map((row) => {
              const rowNo = gridRowServiceNo(row)
              return (
              <tr key={row.id} className="tr" data-vacant={row.vacant}>
                <td className="td td--sticky mono">{row.position}</td>
                <td className="td td--sticky">{row.role}</td>
                <td className="td td--sticky nowrap">{row.hireDate}</td>
                <td className="td td--sticky mono">{row.employeeNo ?? '—'}</td>
                <td className="td td--sticky td--name">{row.name}</td>
                <td
                  className="td td--sticky text-xs"
                  title={row.servicioLinea || undefined}
                >
                  {row.servicioLinea || '—'}
                </td>
                <td className="td td--sticky mono font-semibold">{rowNo || '—'}</td>
                {row.shifts.map((day, dayIndex) =>
                  TURNS.map((turn) => {
                    const locked = dayLocked[dayIndex] ?? false
                    const cellReadOnly = !puedeEditar
                    const disabled = row.vacant || locked || cellReadOnly
                    return (
                      <td key={`${row.id}-${dayIndex}-${turn}`} className="td td--cell">
                        <input
                          className={`${cellClass(day[turn], rowNo)}${locked && !row.vacant ? ' cell--future' : ''}${cellReadOnly ? ' cell--readonly' : ''}`}
                          value={day[turn]}
                          onChange={(e) =>
                            updateCell(row.id, dayIndex, turn, e.target.value)
                          }
                          aria-label={`${row.position} ${WEEK_COLUMNS[dayIndex]?.weekday} ${turn}`}
                          disabled={disabled}
                          readOnly={cellReadOnly && !row.vacant && !locked}
                          list={puedeEditar ? 'attendanceCodes' : undefined}
                          maxLength={12}
                          title={cellInputTitle(day[turn], rowNo, locked, row.vacant, cellReadOnly)}
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
            )})}
          </tbody>
        </table>
        ) : null}
      </div>

      <datalist id="attendanceCodes">
        {datalistCodes.map((c) => (
          <option key={c} value={c} />
        ))}
      </datalist>

      <footer className="footer">
        La semana de asistencia es de lunes a domingo; las flechas mueven 7 días. Los
        guardados son por <strong>planta + semana (lunes)</strong> en este navegador (localStorage).
        Si capturó antes por servicio, el sistema intenta recuperar esos datos al elegir planta.
      </footer>
    </div>
  )
}
