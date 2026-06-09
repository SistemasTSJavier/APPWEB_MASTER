import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useTransition,
  type ChangeEvent,
} from 'react'
import { isAttendanceDayLocked } from '../attendanceDayLock'
import {
  addDays,
  attendanceExportFilename,
  attendanceExportFilenameAllPlantas,
  buildAttendanceExportDateRangeFullText,
  buildCuadriculaExportTotalsByPlantas,
  type AttendanceExportAlcance,
  dateToIsoYmdLocal,
  downloadTextFile,
  formatDateEs,
  mondayOfWeek,
  parseIsoYmdToLocalDate,
  type AttendanceExportPeriod,
  weekDayMetas,
} from '../attendanceExportSummary'
import {
  empNoClaveGridRow,
  hasLegacyCatalogAttendanceForWeek,
  loadAttendanceGrid,
  loadLatestPointer,
  parseIsoToLocalDate,
  saveAttendanceGrid,
  saveManyAttendanceGrids,
  weekStartToIso,
} from '../attendanceStorage'
import { getAttendanceWeekPrefetch } from '../attendanceWeekPrefetch'
import { reassignFaltaSequence } from '../attendanceFaltaSequence'
import { withComputedTotals } from '../attendanceTotals'
import {
  colaboradoresActivosPorServicioCatalogo,
  gridRowServiceNo,
  listarPlantasCapturaAsistencia,
  normPlantaCapturaNombre,
  plantaExpedienteColaborador,
  plantaFromStorageKey,
  plantaToStorageKey,
} from '../cuadriculaColaboradoresBridge'
import {
  filasParaGuardarPlantaWeek,
  mergeGridRowsForPlantaWeek,
  mergeGridRowsForPlantaWeekForCsvImport,
  mergeGridRowsTodasPlantasWeek,
  splitGridRowsByPlanta,
} from '../attendanceSemanaColaborador'
import {
  ATTENDANCE_GRID_ID_COL_COUNT,
  ATTENDANCE_GRID_ID_HEADERS,
} from '../attendanceGridColumns'
import {
  attendanceLiteralCsvFilename,
  buildAttendanceGridLiteralCsv,
} from '../attendanceGridLiteralExport'
import { useCuadriculaData } from '../CuadriculaDataContext'
import { WEEK_COLUMNS, type GridRow, type Turn } from '../mockData'
import { TOTAL_COLUMN_HELP, WEEK_TOTALS_LEGEND } from '../weekTotalsLegend'
import { AttendanceGridRow } from '../components/AttendanceGridRow'
import {
  applyAttendanceCsvToAllPlantasWeek,
  attendanceCodesCsvFilename,
  buildAttendanceCodesCsvAllPlantasWeek,
  buildAttendanceCodesCsvPlantaSheet,
  buildCsvListaNumerosEmpleado,
  canonicalEmpNoForCsvMatch,
  csvDelimiterUserHint,
  csvLayoutHasPlantaColumn,
  filterCsvRowsForPlantaNombre,
  mapaColaboradoresPorNoEmpleadoCanon,
  mergeCsvShiftsIntoGridRows,
  parseAttendanceGridCodesCsv,
} from '../attendanceGridCsvImport'

const TURNS: Turn[] = ['D', 'T', 'N']

const CODE_HINTS = ['A', 'D', 'F', 'INC', 'VAC', 'PCGS', 'PSGS', 'CAP', 'DD']

/** Valor del selector de planta: cuadrícula unificada para captura manual. */
export const PLANTA_ASISTENCIA_TODAS = '__TODAS_PLANTAS__'

function esPlantaAsistenciaTodas(planta: string): boolean {
  return planta === PLANTA_ASISTENCIA_TODAS
}

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

export function AttendanceView() {
  const {
    catalogo,
    colaboradores,
    loading,
    error,
    reload,
    puedeEditar,
    puedeImportarCsv,
  } = useCuadriculaData()
  const [rows, setRows] = useState<GridRow[]>([])
  const [, startGridTransition] = useTransition()
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
  const [csvImportOmitidos, setCsvImportOmitidos] = useState<string[] | null>(null)
  const [legacyRecoveredHint, setLegacyRecoveredHint] = useState<string | null>(null)
  const importCsvCodesRef = useRef<HTMLInputElement>(null)
  const [importRefresh, setImportRefresh] = useState(0)
  const [remoteLoadHint, setRemoteLoadHint] = useState<string | null>(null)
  const [gridLoading, setGridLoading] = useState(false)
  const [guardandoSemana, setGuardandoSemana] = useState(false)

  const colaboradoresRef = useRef(colaboradores)
  const catalogoRef = useRef(catalogo)
  const weekLoadSeqRef = useRef(0)
  colaboradoresRef.current = colaboradores
  catalogoRef.current = catalogo

  const plantasOpciones = useMemo(
    () => listarPlantasCapturaAsistencia(colaboradores, catalogo),
    [colaboradores, catalogo],
  )

  const esVistaTodasPlantas = esPlantaAsistenciaTodas(plantaSeleccionada)

  const plantaStorageKey = useMemo(() => {
    if (esVistaTodasPlantas) return ''
    return plantaToStorageKey(plantaSeleccionada)
  }, [plantaSeleccionada, esVistaTodasPlantas])

  const dayMetas = useMemo(
    () => weekDayMetas(weekStart, WEEK_COLUMNS),
    [weekStart],
  )

  const dayLocked = useMemo(
    () => dayMetas.map((m) => isAttendanceDayLocked(m.date)),
    [dayMetas],
  )

  const weekIso = useMemo(() => weekStartToIso(weekStart), [weekStart])

  const datalistCodes = CODE_HINTS

  const weekRangeLabel = `Lun–Dom: ${formatDateEs(weekStart)} – ${formatDateEs(
    addDays(weekStart, 6),
  )}`

  useEffect(() => {
    if (!plantaSeleccionada.trim()) {
      setRows([])
      setLastSavedAt(null)
      return
    }
    if (loading || colaboradores.length === 0) {
      setGridLoading(true)
      return
    }
    const loadSeq = ++weekLoadSeqRef.current
    if (esVistaTodasPlantas) {
      let cancelled = false
      setGridLoading(true)
      ;(async () => {
        const { rows: merged, remote, lastSavedAt } = await mergeGridRowsTodasPlantasWeek(
          colaboradoresRef.current,
          catalogoRef.current,
          weekIso,
        )
        if (cancelled || loadSeq !== weekLoadSeqRef.current) return
        setGridLoading(false)
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
        setLastSavedAt(lastSavedAt)
        setLegacyRecoveredHint(null)
        startGridTransition(() => setRows(merged))
      })()
      return () => {
        cancelled = true
        setGridLoading(false)
      }
    }
    if (!plantaStorageKey) {
      setRows([])
      setLastSavedAt(null)
      return
    }
    let cancelled = false
    setGridLoading(true)
    ;(async () => {
      const prefetch = await getAttendanceWeekPrefetch(weekIso)
      const merged = await mergeGridRowsForPlantaWeek(
        colaboradoresRef.current,
        plantaSeleccionada,
        catalogoRef.current,
        weekIso,
        prefetch,
      )
      if (cancelled || loadSeq !== weekLoadSeqRef.current) return
      setGridLoading(false)
      const remote = prefetch.meta
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
      setLastSavedAt(soloPlanta?.savedAt ?? null)
      const legacyWeek = hasLegacyCatalogAttendanceForWeek(weekIso, plantaStorageKey)
      if (legacyWeek && !soloPlanta) {
        setLegacyRecoveredHint(
          'Se recuperó asistencia guardada antes por servicio (catálogo). Pulse «Guardar todas las plantas» para dejarla bajo esta planta.',
        )
      } else {
        setLegacyRecoveredHint(null)
      }
      startGridTransition(() => setRows(merged))
    })()
    return () => {
      cancelled = true
      setGridLoading(false)
    }
  }, [
    plantaSeleccionada,
    plantaStorageKey,
    esVistaTodasPlantas,
    weekIso,
    importRefresh,
    loading,
    colaboradores.length,
  ])

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

  async function exportResumen() {
    const nombreArchivoPlanta = esVistaTodasPlantas
      ? 'todas-plantas'
      : plantaSeleccionada.trim() || 'asistencia'
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
        plantaEnPantalla:
          exportPeriod === 'semana' && !esVistaTodasPlantas
            ? plantaSeleccionada
            : undefined,
        rowsEnPantalla: exportPeriod === 'semana' ? rows : undefined,
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
      const plantaFb = esVistaTodasPlantas ? '' : plantaSeleccionada
      const full = buildAttendanceGridLiteralCsv(rows, WEEK_COLUMNS, {
        delim: ';',
        plantaFallback: plantaFb,
        sortTodos: esVistaTodasPlantas,
      })
      downloadTextFile(
        attendanceLiteralCsvFilename(nombreArchivoPlanta, weekIso),
        full,
      )
      setSaveMessage('Exportada cuadrícula de la semana (mismas columnas que en pantalla).')
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
    })
    downloadTextFile(
      attendanceExportFilename(nombreArchivoPlanta, desdeD, hastaD),
      full,
    )
  }

  async function descargarCsvAsistenciaSemana(todasLasPlantas: boolean) {
    if (todasLasPlantas) {
      const body = await buildAttendanceCodesCsvAllPlantasWeek(colaboradores, catalogo, weekIso, ';')
      if (!body.trim()) {
        setSaveMessage('No hay empleados activos con planta en expediente para armar el CSV.')
        return
      }
      downloadTextFile(attendanceCodesCsvFilename('todas-plantas', weekIso), body)
      return
    }
    if (esVistaTodasPlantas) {
      setSaveMessage(
        'En vista «Todas las plantas», use «Descargar CSV (todas las plantas)» o exporte desde la cuadrícula en pantalla.',
      )
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
    let text: string
    try {
      text = await file.text()
    } catch {
      setSaveMessage('No se pudo leer el archivo CSV.')
      return
    }
    setCsvImportOmitidos(null)
    const parsed = parseAttendanceGridCodesCsv(text)
    if (parsed.ok === false) {
      setSaveMessage(`CSV: ${parsed.error}`)
      return
    }
    const delimHint = csvDelimiterUserHint(parsed.delimiter)
    const sinNumeroMsg =
      (parsed.filasSinNumeroEmpleado ?? 0) > 0
        ? `${parsed.filasSinNumeroEmpleado} fila(s) no se ingresaron: no se detectó N.º de empleado. Revise la columna NO. DE EMPLEADO (como texto en Excel).`
        : ''
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
          `CSV (${weekRangeLabel}, separador: ${delimHint}): no se actualizó ningún empleado.${sinPlanta}${unk}${sinNumeroMsg ? ` ${sinNumeroMsg}` : ''}`,
        )
        return
      }
      const parts: string[] = [
        `Importación multi-planta: ${result.totalUpdated} empleado(s), semana ${weekRangeLabel}. Guardado en servidor/local: ${result.plantsSaved} planta(s). Separador: ${delimHint}.`,
      ]
      if (result.plantsSaveFailed > 0) {
        parts.push(
          `${result.plantsSaveFailed} planta(s) con cambios NO se pudieron guardar (reintente «Guardar todas las plantas» o importe de nuevo).`,
        )
      }
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
      if (result.rowsSinPlantaCsv > 0) {
        parts.push(
          `${result.rowsSinPlantaCsv} fila(s) del CSV no se asignaron a ninguna planta (revise columna PLANTA o NO. SERVICIO).`,
        )
      } else if ((parsed.rowsSinPlanta ?? 0) > 0) {
        parts.push(
          `${parsed.rowsSinPlanta} fila(s) con PLANTA vacía (se intentó ubicar por NO SERVICIO en catálogo).`,
        )
      }
      if (result.omitidosSinRegistro.length > 0) {
        setCsvImportOmitidos(result.omitidosSinRegistro)
        parts.push(
          `${result.omitidosSinRegistro.length} N° en CSV no se ingresaron (no se detectó en expediente o planta distinta). Descargue la lista debajo.`,
        )
      }
      if (sinNumeroMsg) parts.push(sinNumeroMsg)
      setSaveMessage(parts.join(' '))

      /* Pinta lo importado de inmediato: la cuadrícula en pantalla refleja el CSV
         sin depender del ciclo guardar→releer. */
      const slicesConCambios = result.plantas.filter(
        (p) => p.updatedCount > 0 && p.rows.length > 0,
      )
      const sliceSeleccionada = !esVistaTodasPlantas
        ? slicesConCambios.find((p) => p.plantaNombre === plantaSeleccionada)
        : undefined
      if (sliceSeleccionada) {
        const filas = sliceSeleccionada.rows
        startGridTransition(() => setRows(filas))
        setLastSavedAt(new Date().toISOString())
        setLegacyRecoveredHint(null)
      } else if (esVistaTodasPlantas && slicesConCambios.length > 0) {
        const porEmp = new Map<string, GridRow>()
        for (const p of slicesConCambios) {
          for (const r of p.rows) {
            const k = empNoClaveGridRow(r)
            if (k) porEmp.set(k, r)
          }
        }
        startGridTransition(() =>
          setRows((prev) => {
            const vistos = new Set<string>()
            const next = prev.map((r) => {
              const k = empNoClaveGridRow(r)
              if (k && porEmp.has(k)) {
                vistos.add(k)
                return porEmp.get(k)!
              }
              return r
            })
            for (const [k, r] of porEmp) {
              if (!vistos.has(k)) next.push(r)
            }
            return next
          }),
        )
        setLastSavedAt(new Date().toISOString())
        setLegacyRecoveredHint(null)
      } else {
        /* La planta visible no venía en el CSV: recarga normal desde almacenamiento. */
        setImportRefresh((n) => n + 1)
      }
      return
    }

    if (!plantaStorageKey) {
      setSaveMessage(
        esVistaTodasPlantas
          ? 'En vista «Todas las plantas», use un CSV con columna PLANTA (formato hoja de 8 columnas + D/T/N×7).'
          : 'CSV sin columna PLANTA: seleccione una planta arriba, o use formato SERVICIO, NO SERVICIO, PLANTA, POSICION… para importar todas las plantas en un solo archivo.',
      )
      return
    }

    const { rows: csvRowsPlanta, omittedOtherPlanta } = filterCsvRowsForPlantaNombre(
      parsed.rows,
      plantaSeleccionada,
      {
        colaboradores,
        catalogo,
        expedientePlantas: plantasOpciones,
      },
    )

    const numerosEmpleadoEnCsv = new Set(
      csvRowsPlanta
        .map((row) => canonicalEmpNoForCsvMatch(row.employeeNo))
        .filter(Boolean),
    )

    const prefetchImport = await getAttendanceWeekPrefetch(weekIso)
    const baseImport = await mergeGridRowsForPlantaWeekForCsvImport(
      colaboradores,
      plantaSeleccionada,
      catalogo,
      weekIso,
      prefetchImport,
      { numerosEmpleadoEnCsv, reemplazarEmpNos: numerosEmpleadoEnCsv },
    )
    const colaboradoresByEmp = mapaColaboradoresPorNoEmpleadoCanon(colaboradores)
    const {
      next,
      updatedCount,
      csvEmployeesNotInGrid,
      gridEmployeesNotInCsv,
      gridEmployeeCount,
      ambiguousEmployeeNos,
    } = mergeCsvShiftsIntoGridRows(baseImport, csvRowsPlanta, {
      catalogo,
      plantaNombre: plantaSeleccionada,
      colaboradoresByEmp,
      agregarFilasCsvPorEmpNo: true,
      todosColaboradores: colaboradores,
      reemplazarSemanaDesdeCsv: true,
      omitirFiltroPlantaExpediente: true,
    })
    if (updatedCount === 0) {
      const ejemplos =
        csvEmployeesNotInGrid.length > 0
          ? ` N.º no ingresados — ej.: ${csvEmployeesNotInGrid.slice(0, 8).join(', ')}${csvEmployeesNotInGrid.length > 8 ? '…' : ''}.`
          : ''
      setSaveMessage(
        csvEmployeesNotInGrid.length > 0
          ? `CSV (planta «${plantaSeleccionada}», ${weekRangeLabel}): no se ingresó ningún empleado.${ejemplos} No se detectó coincidencia por N.º de empleado. Use columna NO. DE EMPLEADO como texto en Excel.${sinNumeroMsg ? ` ${sinNumeroMsg}` : ''}`
          : `CSV (planta «${plantaSeleccionada}», separador: ${delimHint}): no se actualizó ninguna fila. Revise cabecera: formato hoja (8 columnas + D/T/N×7) o compacto (5 columnas + códigos).${sinNumeroMsg ? ` ${sinNumeroMsg}` : ''}`,
      )
      if (csvEmployeesNotInGrid.length > 0) setCsvImportOmitidos(csvEmployeesNotInGrid)
      return
    }
    const savedAt = new Date().toISOString()
    const ok = await saveAttendanceGrid(weekIso, plantaStorageKey, next, '', {
      savedAt,
      forceReplace: true,
    })
    startGridTransition(() => setRows(next))
    if (ok) {
      setLastSavedAt(savedAt)
      setLegacyRecoveredHint(null)
    }
    const filasCsv = parsed.filasLeidas ?? parsed.rows.length
    const empleadosCsv = parsed.rows.length
    const parts: string[] = [
      ok
        ? `Importación (una planta): ${updatedCount} de ${gridEmployeeCount} empleado(s) actualizados — «${plantaSeleccionada}», ${weekRangeLabel}. CSV: ${empleadosCsv} N.º con asistencia (${filasCsv} fila(s) leídas). Separador: ${delimHint}.`
        : `Importación: ${updatedCount} de ${gridEmployeeCount} en pantalla; no se pudo guardar. CSV: ${empleadosCsv} N.º (${filasCsv} filas). Separador: ${delimHint}.`,
    ]
    if ((parsed.filasSinCodigos ?? 0) > 0) {
      parts.push(
        `${parsed.filasSinCodigos} fila(s) con N.º de empleado pero sin códigos reconocibles (revise columnas de asistencia).`,
      )
    }
    if (omittedOtherPlanta > 0) {
      parts.push(
        `${omittedOtherPlanta} fila(s) omitidas (planta distinta a «${plantaSeleccionada}» o empleado de otra planta).`,
      )
    }
    if (csvEmployeesNotInGrid.length > 0) {
      parts.push(
        `No se ingresaron (${csvEmployeesNotInGrid.length} N.º no detectados en esta planta): ${csvEmployeesNotInGrid.slice(0, 10).join(', ')}${csvEmployeesNotInGrid.length > 10 ? '…' : ''}.`,
      )
    }
    if (sinNumeroMsg) parts.push(sinNumeroMsg)
    if (gridEmployeesNotInCsv.length > 0) {
      parts.push(
        `En cuadrícula sin fila en CSV (${gridEmployeesNotInCsv.length}): ${gridEmployeesNotInCsv.slice(0, 10).join(', ')}${gridEmployeesNotInCsv.length > 10 ? '…' : ''} (conservan la semana anterior).`,
      )
    }
    if (csvEmployeesNotInGrid.length > 0) {
      setCsvImportOmitidos(csvEmployeesNotInGrid)
    }
    setSaveMessage(parts.join(' '))
  }

  const updateCell = useCallback(
    (rowId: string, dayIndex: number, turn: Turn, next: string) => {
      if (!puedeEditar) return
      setRows((prev) => {
        const idx = prev.findIndex((r) => r.id === rowId)
        if (idx < 0) return prev
        const r = prev[idx]!
        const shiftsRaw = r.shifts.map((day, i) =>
          i === dayIndex ? { ...day, [turn]: next } : day,
        )
        const shifts = reassignFaltaSequence(shiftsRaw)
        const updated = withComputedTotals({ ...r, shifts }, gridRowServiceNo(r))
        if (updated === r) return prev
        const nextRows = prev.slice()
        nextRows[idx] = updated
        return nextRows
      })
    },
    [puedeEditar],
  )

  /** Semana en pantalla: todas las plantas → navegador + servidor. */
  async function guardarSemanaActualTodasPlantas(): Promise<{
    guardadas: number
    fallidas: number
  }> {
    const plantas = listarPlantasCapturaAsistencia(colaboradores, catalogo)
    if (plantas.length === 0) {
      return { guardadas: 0, fallidas: 0 }
    }
    let guardadas = 0
    let fallidas = 0
    const porPlantaEnPantalla = esVistaTodasPlantas ? splitGridRowsByPlanta(rows) : null
    const plantaActualNorm = esVistaTodasPlantas
      ? ''
      : normPlantaCapturaNombre(plantaSeleccionada)
    const prefetch = await getAttendanceWeekPrefetch(weekIso)
    const mergeResults = await Promise.all(
      plantas.map(async (planta) => {
        const scopeKey = plantaToStorageKey(planta)
        if (!scopeKey) return null
        const norm = normPlantaCapturaNombre(planta)
        let filasPantalla: GridRow[] | null = null
        if (porPlantaEnPantalla) {
          filasPantalla = porPlantaEnPantalla.get(norm) ?? null
        } else if (norm === plantaActualNorm && plantaStorageKey) {
          filasPantalla = rows
        }
        /* Unión pantalla + guardado: nunca borra lo importado que la vista no muestra. */
        const filas = await filasParaGuardarPlantaWeek(
          colaboradores,
          planta,
          catalogo,
          weekIso,
          prefetch,
          filasPantalla,
        )
        return filas.length > 0 ? { scopeKey, rows: filas } : null
      }),
    )
    const batchItems = mergeResults.filter(
      (item): item is { scopeKey: string; rows: GridRow[] } => item != null,
    )
    if (batchItems.length > 0) {
      /* forceReplace: el lote ya es la unión pantalla + guardado, no pierde nada. */
      const batch = await saveManyAttendanceGrids(weekIso, batchItems, { forceReplace: true })
      guardadas = batch.saved
      fallidas = Math.max(0, batchItems.length - batch.saved) + batch.failed
    }
    return { guardadas, fallidas }
  }

  async function guardarSemanaVisible() {
    if (!plantaSeleccionada.trim() || plantasOpciones.length === 0) {
      setSaveMessage('Seleccione una planta para guardar la semana.')
      return
    }
    setGuardandoSemana(true)
    setSaveMessage(null)
    const t = new Date().toISOString()
    try {
      if (esVistaTodasPlantas) {
        const { guardadas, fallidas } = await guardarSemanaActualTodasPlantas()
        if (guardadas === 0) {
          setSaveMessage('No se pudo guardar (cuota, modo privado o datos bloqueados).')
          return
        }
        setLastSavedAt(t)
        setLegacyRecoveredHint(null)
        const partes = [
          `Semana guardada: ${guardadas} planta(s), ${weekRangeLabel}.`,
        ]
        if (fallidas > 0) partes.push(`${fallidas} planta(s) no se pudieron guardar.`)
        setSaveMessage(partes.join(' '))
        return
      }
      if (!plantaStorageKey) return
      const prefetch = await getAttendanceWeekPrefetch(weekIso)
      const filas = await filasParaGuardarPlantaWeek(
        colaboradores,
        plantaSeleccionada,
        catalogo,
        weekIso,
        prefetch,
        rows,
      )
      const ok = await saveAttendanceGrid(weekIso, plantaStorageKey, filas, '', {
        savedAt: t,
        forceReplace: true,
      })
      if (!ok) {
        setSaveMessage('No se pudo guardar la semana (revise conexión o almacenamiento).')
        return
      }
      setLastSavedAt(t)
      setLegacyRecoveredHint(null)
      setSaveMessage(
        `Semana guardada — «${plantaSeleccionada}», ${weekRangeLabel} (${filas.length} empleado(s)).`,
      )
    } finally {
      setGuardandoSemana(false)
    }
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

  const latest = useMemo(
    () => loadLatestPointer(),
    [lastSavedAt, importRefresh],
  )
  const latestDifferent =
    latest &&
    (latest.weekStartIso !== weekIso || latest.serviceCatalogId !== plantaStorageKey)

  const latestLabel = latest
    ? plantaFromStorageKey(latest.serviceCatalogId) ||
      catalogo.find((c) => c.id === latest.serviceCatalogId)?.nombre ||
      null
    : null

  return (
    <div
      className={`attendanceView attendanceView--wideGrid attendanceView--captureGrid${esVistaTodasPlantas ? ' attendanceView--todasPlantas' : ''}`}
    >
      <header className="topbar topbar--capture">
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
            <strong>Solo lectura.</strong> La captura y el guardado de asistencia requieren rol de administrador o editor de cuadrícula.
          </p>
        ) : null}
        <div className="topbar__controls topbar__controls--capture">
          <div className="topbar__bar captureToolbar">
            <div className="captureToolbar__fields">
              <label className="field field--compact">
                <span className="field__label">Planta</span>
                <select
                  className="select select--compact"
                  value={plantaSeleccionada}
                  onChange={(e) => setPlantaSeleccionada(e.target.value)}
                  disabled={loading}
                >
                  <option value="">Seleccione planta…</option>
                  {plantasOpciones.length > 0 ? (
                    <option value={PLANTA_ASISTENCIA_TODAS}>Todas las plantas</option>
                  ) : null}
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
              <div className="weekNav weekNav--compact">
                <button
                  type="button"
                  className="btn btn--compact"
                  onClick={() => setWeekStart((d) => addDays(d, -7))}
                  title="Semana anterior"
                >
                  ←
                </button>
                <div className="weekNav__range weekNav__range--compact">{weekRangeLabel}</div>
                <button
                  type="button"
                  className="btn btn--compact"
                  onClick={() => setWeekStart((d) => addDays(d, 7))}
                  title="Semana siguiente"
                >
                  →
                </button>
              </div>
              {puedeEditar ? (
                <div className="field field--compact field--action field--actionToolbar">
                  <span className="field__label">Guardar</span>
                  <button
                    type="button"
                    className="btn btn--primary btn--compact"
                    onClick={() => void guardarSemanaVisible()}
                    disabled={loading || guardandoSemana || !plantaSeleccionada.trim()}
                    title={
                      esVistaTodasPlantas
                        ? 'Guarda la semana visible de todas las plantas'
                        : 'Guarda la semana visible de la planta seleccionada'
                    }
                  >
                    {guardandoSemana
                      ? 'Guardando…'
                      : esVistaTodasPlantas
                        ? 'Guardar semana (todas)'
                        : 'Guardar semana'}
                  </button>
                </div>
              ) : null}
            </div>
          </div>

          {(gridLoading || lastSavedAt || saveMessage || latestDifferent || legacyRecoveredHint) ? (
            <div className="captureStatusBar" role="status">
              {gridLoading ? (
                <span className="captureStatusBar__item captureStatusBar__item--muted">
                  Cargando cuadrícula…
                </span>
              ) : null}
              {lastSavedAt ? (
                <span className="captureStatusBar__item">
                  <strong>Guardado:</strong> {formatSavedAt(lastSavedAt)}
                </span>
              ) : (
                <span className="captureStatusBar__item captureStatusBar__item--muted">
                  Sin guardado para esta planta y semana
                </span>
              )}
              {latestDifferent ? (
                <button type="button" className="btn btn--linkish btn--linkishCompact" onClick={irAlUltimoGuardado}>
                  Ir al último guardado
                </button>
              ) : null}
              {legacyRecoveredHint ? (
                <span className="captureStatusBar__item captureStatusBar__item--warn">{legacyRecoveredHint}</span>
              ) : null}
              {saveMessage ? <span className="captureStatusBar__item captureStatusBar__item--ok">{saveMessage}</span> : null}
            </div>
          ) : null}

          <details className="attPanel">
            <summary className="attPanel__summary">Leyenda — totales semana</summary>
            <div className="attPanel__body attPanel__body--legend">
              <div className="topbar__legend topbar__legend--panel">
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
          </details>

          <details className="attPanel">
            <summary className="attPanel__summary">Importar y exportar CSV</summary>
            <div className="attPanel__body">
          {puedeImportarCsv ? (
            <div className="persistRow__csvBlock">
              <p className="persistRow__csvLead">
                <strong>Importación por CSV</strong> — semana en pantalla ({weekRangeLabel}). Se detecta la columna{' '}
                <strong>NO. DE EMPLEADO</strong> (o CLAVE) y se cargan los códigos <strong>día por día</strong> (Lun–Dom) y{' '}
                <strong>turno por turno</strong> (D, T, N). Mismo formato de hoja (8 columnas + D/T/N×7) u otras columnas extra; el emparejamiento es{' '}
                <strong>solo por N.º de empleado</strong>. SERVICIO, N.º SERVICIO, PLANTA y POSICIÓN de cada fila salen del expediente en <strong>Colaboradores</strong> (el catálogo Servicios solo completa si falta algún dato). En importación de una planta se omiten filas con PLANTA distinta en el CSV o empleados de otra planta en expediente.
                Con columna <strong>PLANTA</strong> en el CSV un archivo puede actualizar todas las plantas. Incluye colaboradores en <strong>baja</strong> al importar.
              </p>
              <div className="persistRow__csvActions">
                <button
                  type="button"
                  className="btn"
                  onClick={() => descargarCsvAsistenciaSemana(false)}
                  disabled={
                    !plantaSeleccionada.trim() || rows.length === 0 || esVistaTodasPlantas
                  }
                  title={
                    esVistaTodasPlantas
                      ? 'En vista Todas las plantas use el botón de todas las plantas'
                      : !plantaSeleccionada.trim()
                        ? 'Seleccione planta'
                        : undefined
                  }
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
              {csvImportOmitidos && csvImportOmitidos.length > 0 ? (
                <div className="persistRow__csvOmitidos">
                  <p className="persistRow__meta">
                    <strong>{csvImportOmitidos.length}</strong> N° de empleado omitidos (no registrados en esta
                    importación).
                  </p>
                  <button
                    type="button"
                    className="btn"
                    onClick={() =>
                      downloadTextFile(
                        `asistencia-omitidos-${weekIso}.csv`,
                        buildCsvListaNumerosEmpleado(csvImportOmitidos),
                      )
                    }
                  >
                    Descargar N° omitidos
                  </button>
                  <pre className="persistRow__csvOmitidosList" aria-label="Números omitidos">
                    {csvImportOmitidos.slice(0, 40).join('\n')}
                    {csvImportOmitidos.length > 40
                      ? `\n… (+${csvImportOmitidos.length - 40} más; use Descargar)`
                      : ''}
                  </pre>
                </div>
              ) : null}
            </div>
          ) : (
            <p className="persistRow__meta muted">La importación CSV requiere permiso de edición.</p>
          )}
            <div className="topbar__exportRow topbar__exportRow--panel">
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
            </div>
          </details>

          <details className="attPanel">
            <summary className="attPanel__summary">Ayuda y códigos de captura</summary>
            <div className="attPanel__body">
        <p className="hint attPanel__hint">
          Elija <strong>planta</strong> y <strong>semana</strong>, capture o importe códigos, y pulse <strong>Guardar semana</strong>.
          Para consultar el historial de una persona use el módulo <strong>Consulta de asistencia</strong>.
          Columnas: identificación + semana (D/T/N) + totales. La importación ubica cada fila por <strong>N.º de empleado</strong>;
          si no se detecta, verá un mensaje con los N.º omitidos. Códigos:{' '}
          {CODE_HINTS.join(', ')}, <strong>A</strong> o número (Asist.), <strong>DD</strong>+n.º (Extra).
        </p>
            </div>
          </details>
        </div>
      </header>

      <div className="sheetWrap sheetWrap--capture">
        {!plantaSeleccionada ? (
          <p className="hint" style={{ padding: '1rem' }}>
            Elija una planta o <strong>Todas las plantas</strong> para listar empleados y capturar asistencia manual.
          </p>
        ) : rows.length === 0 ? (
          <p className="hint" style={{ padding: '1rem' }}>
            {esVistaTodasPlantas ? (
              <>
                No hay colaboradores activos con planta en expediente. Revise o importe el campo{' '}
                <strong>Planta</strong> en Altas / Colaboradores.
              </>
            ) : (
              <>
                No hay colaboradores activos con planta <strong>{plantaSeleccionada}</strong> en expediente. Revise o importe el campo{' '}
                <strong>Planta</strong> en Altas / Colaboradores.
              </>
            )}
          </p>
        ) : null}
        {gridLoading ? (
          <p className="hint captureGridLoading" style={{ padding: '0.5rem 1rem' }}>
            Cargando asistencia de la semana…
          </p>
        ) : null}
        {!gridLoading && rows.length > 0 ? (
        <p className="hint captureGridCount" style={{ padding: '0.25rem 1rem' }}>
          {rows.length} empleado(s) — semana {weekRangeLabel}
          {esVistaTodasPlantas ? ' (todas las plantas)' : ` — ${plantaSeleccionada}`}
        </p>
        ) : null}
        {!gridLoading ? (
        <table
          className="sheet sheet--captureGrid sheet--captureId8"
          aria-label="Cuadrícula de asistencia"
        >
          <thead>
            <tr>
              <th
                colSpan={ATTENDANCE_GRID_ID_COL_COUNT}
                className="th th--block th--band th--bandId"
              >
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
              {ATTENDANCE_GRID_ID_HEADERS.map((label) => (
                <th key={label} className="th th--sticky th--idHead" title={label}>
                  {label}
                </th>
              ))}
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
          <tbody className="captureGridBody">
            {rows.map((row) => (
              <AttendanceGridRow
                key={row.id}
                row={row}
                plantaFallback={esVistaTodasPlantas ? '' : plantaSeleccionada}
                dayLocked={dayLocked}
                puedeEditar={puedeEditar}
                onCellChange={updateCell}
              />
            ))}
          </tbody>
        </table>
        ) : null}
      </div>

      <datalist id="attendanceCodes">
        {datalistCodes.map((c) => (
          <option key={c} value={c} />
        ))}
      </datalist>

      <footer className="footer footer--captureHidden" aria-hidden="true" />
    </div>
  )
}
