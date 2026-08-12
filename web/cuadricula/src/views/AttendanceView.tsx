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
import { addDays, downloadTextFile, formatDateEs, mondayOfWeek, weekDayMetas } from '../attendanceExportSummary'
import { saveManyAttendanceGrids, weekStartToIso } from '../attendanceStorage'
import { reassignFaltaSequence } from '../attendanceFaltaSequence'
import { withComputedTotals } from '../attendanceTotals'
import {
  filasParaGuardarPlantaWeek,
  mergeGridRowsTodasPlantasWeek,
  splitGridRowsByPlanta,
} from '../attendanceSemanaColaborador'
import { getAttendanceWeekPrefetch } from '../attendanceWeekPrefetch'
import {
  gridRowServiceNo,
  listarPlantasCapturaAsistencia,
  normPlantaCapturaNombre,
  plantaToStorageKey,
} from '../cuadriculaColaboradoresBridge'
import { ATTENDANCE_GRID_ID_COL_COUNT, ATTENDANCE_GRID_ID_HEADERS } from '../attendanceGridColumns'
import { useCuadriculaData } from '../CuadriculaDataContext'
import { WEEK_COLUMNS, type GridRow, type Turn } from '../mockData'
import { TOTAL_COLUMN_HELP } from '../weekTotalsLegend'
import { AttendanceGridRow } from '../components/AttendanceGridRow'
import {
  buildCsvListaNumerosEmpleado,
  csvDelimiterUserHint,
  importAttendanceCsvDirectToGrid,
  parseAttendanceGridCodesCsv,
} from '../attendanceGridCsvImport'

const TURNS: Turn[] = ['D', 'T', 'N']
const CODE_HINTS = ['A', 'D', 'F', 'INC', 'VAC', 'PCGS', 'PSGS', 'CAP', 'DD']

export function AttendanceView() {
  const {
    catalogo,
    colaboradoresActivosCaptura,
    loading,
    error,
    reload,
    puedeEditar,
    puedeImportarCsv,
  } = useCuadriculaData()

  const [rows, setRows] = useState<GridRow[]>([])
  const [, startGridTransition] = useTransition()
  const [weekStart, setWeekStart] = useState(() => mondayOfWeek(new Date()))
  const [saveMessage, setSaveMessage] = useState<string | null>(null)
  const [csvImportOmitidos, setCsvImportOmitidos] = useState<string[] | null>(null)
  const importCsvRef = useRef<HTMLInputElement>(null)
  const [importRefresh, setImportRefresh] = useState(0)
  const [gridLoading, setGridLoading] = useState(false)
  const [importandoCsv, setImportandoCsv] = useState(false)
  const [guardandoSemana, setGuardandoSemana] = useState(false)
  const rowsRef = useRef<GridRow[]>([])
  rowsRef.current = rows

  const colaboradoresRef = useRef(colaboradoresActivosCaptura)
  const catalogoRef = useRef(catalogo)
  const weekLoadSeqRef = useRef(0)
  colaboradoresRef.current = colaboradoresActivosCaptura
  catalogoRef.current = catalogo

  const dayMetas = useMemo(() => weekDayMetas(weekStart, WEEK_COLUMNS), [weekStart])
  const dayLocked = useMemo(
    () => dayMetas.map((m) => isAttendanceDayLocked(m.date)),
    [dayMetas],
  )
  const weekIso = useMemo(() => weekStartToIso(weekStart), [weekStart])
  const weekRangeLabel = `Lun–Dom: ${formatDateEs(weekStart)} – ${formatDateEs(addDays(weekStart, 6))}`

  /* Al entrar: solo colaboradores activos (Colaboradores → Solo activos), todas las plantas. */
  useEffect(() => {
    if (loading) {
      setGridLoading(true)
      return
    }
    if (colaboradoresActivosCaptura.length === 0) {
      setRows([])
      setGridLoading(false)
      return
    }
    const loadSeq = ++weekLoadSeqRef.current
    let cancelled = false
    setGridLoading(true)
    ;(async () => {
      const { rows: merged } = await mergeGridRowsTodasPlantasWeek(
        colaboradoresRef.current,
        catalogoRef.current,
        weekIso,
      )
      if (cancelled || loadSeq !== weekLoadSeqRef.current) return
      setGridLoading(false)
      startGridTransition(() => setRows(merged))
    })()
    return () => {
      cancelled = true
      setGridLoading(false)
    }
  }, [weekIso, importRefresh, loading, colaboradoresActivosCaptura.length])

  useEffect(() => {
    if (!saveMessage) return
    const ms = saveMessage.startsWith('CSV') ? 12000 : 5000
    const t = window.setTimeout(() => setSaveMessage(null), ms)
    return () => window.clearTimeout(t)
  }, [saveMessage])

  async function onImportCsvChange(e: ChangeEvent<HTMLInputElement>) {
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
    setSaveMessage(null)
    const parsed = parseAttendanceGridCodesCsv(text)
    if (parsed.ok === false) {
      setSaveMessage(`CSV: ${parsed.error}`)
      return
    }

    const delimHint = csvDelimiterUserHint(parsed.delimiter)
    const stats: string[] = []
    if ((parsed.filasLeidas ?? 0) > 0) stats.push(`${parsed.filasLeidas} fila(s) leídas`)
    if ((parsed.filasSinNumeroEmpleado ?? 0) > 0) {
      stats.push(`${parsed.filasSinNumeroEmpleado} sin N.º de empleado`)
    }
    if ((parsed.filasSinCodigos ?? 0) > 0) {
      stats.push(`${parsed.filasSinCodigos} sin códigos de asistencia`)
    }
    const statsMsg = stats.length ? ` (${stats.join(', ')}).` : '.'

    setImportandoCsv(true)
    try {
      const result = await importAttendanceCsvDirectToGrid({
        parsedRows: parsed.rows,
        colaboradores: colaboradoresActivosCaptura,
        catalogo,
        weekIso,
        baseRows: rowsRef.current.length > 0 ? rowsRef.current : undefined,
      })

      if (result.totalUpdated === 0) {
        setSaveMessage(
          `CSV (${weekRangeLabel}): ningún colaborador activo coincidió con el archivo${statsMsg} Se requiere N.º de empleado + activo en Colaboradores.`,
        )
        if (result.omitidosSinRegistro.length > 0) setCsvImportOmitidos(result.omitidosSinRegistro)
        return
      }

      startGridTransition(() => setRows(result.rows))

      const parts: string[] = [
        `Importado: ${result.totalUpdated}/${result.filasCsv} colaborador(es) del CSV en ${weekRangeLabel}. Separador: ${delimHint}.`,
      ]
      if (result.plantsSaved > 0) {
        parts.push(`Guardado en ${result.plantsSaved} planta(s) afectada(s).`)
      }
      if (result.plantsSaveFailed > 0) {
        parts.push(
          `${result.plantsSaveFailed} planta(s) no se guardaron en servidor; los datos ya están en pantalla — pulse «Guardar semana».`,
        )
      }
        if (result.omitidosSinRegistro.length > 0) {
          setCsvImportOmitidos(result.omitidosSinRegistro)
          parts.push(
            `${result.omitidosSinRegistro.length} N.º del CSV sin colaborador activo en expediente (no se importaron).`,
          )
        }
      if ((parsed.filasSinNumeroEmpleado ?? 0) > 0) {
        parts.push(`${parsed.filasSinNumeroEmpleado} fila(s) ignoradas: sin N.º de empleado.`)
      }
      setSaveMessage(parts.join(' '))
    } catch (err) {
      setSaveMessage(
        err instanceof Error ? err.message : 'Error al importar el CSV. Intente de nuevo o use «Guardar semana».',
      )
    } finally {
      setImportandoCsv(false)
    }
  }

  async function guardarSemana() {
    if (!puedeEditar) return
    const plantas = listarPlantasCapturaAsistencia(colaboradoresActivosCaptura, catalogo)
    if (plantas.length === 0) {
      setSaveMessage('No hay colaboradores activos con planta en expediente.')
      return
    }

    setGuardandoSemana(true)
    setSaveMessage(null)
    try {
      const porPlanta = splitGridRowsByPlanta(rows, colaboradoresActivosCaptura, catalogo)
      const prefetch = await getAttendanceWeekPrefetch(weekIso)
      const mergeResults = await Promise.all(
        plantas.map(async (planta) => {
          const scopeKey = plantaToStorageKey(planta)
          if (!scopeKey) return null
          const norm = normPlantaCapturaNombre(planta)
          const filasPantalla = porPlanta.get(norm) ?? null
          const filas = await filasParaGuardarPlantaWeek(
            colaboradoresActivosCaptura,
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
      if (batchItems.length === 0) {
        setSaveMessage('No hay datos para guardar en esta semana.')
        return
      }
      const batch = await saveManyAttendanceGrids(weekIso, batchItems, { forceReplace: true })
      if (batch.saved === 0) {
        setSaveMessage('No se pudo guardar la semana.')
        return
      }
      const fallidas = Math.max(0, batchItems.length - batch.saved) + batch.failed
      setSaveMessage(
        fallidas > 0
          ? `Semana guardada parcialmente: ${batch.saved} planta(s), ${fallidas} con error. ${weekRangeLabel}.`
          : `Semana guardada: ${batch.saved} planta(s), ${weekRangeLabel}.`,
      )
      setImportRefresh((n) => n + 1)
    } finally {
      setGuardandoSemana(false)
    }
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

  return (
    <div className="attendanceView attendanceView--wideGrid attendanceView--captureGrid attendanceView--todasPlantas">
      <header className="topbar topbar--capture">
        <div className="topbar__title">
          <h1>Asistencia semanal</h1>
          <span className="badge">Captura</span>
        </div>

        {loading ? (
          <p className="hint" style={{ marginBottom: 8 }}>
            Cargando colaboradores activos…
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
        {!puedeEditar ? (
          <p className="topbar__readonlyBanner" role="status">
            <strong>Solo lectura.</strong> La captura requiere permiso de edición.
          </p>
        ) : null}

        <div className="topbar__controls topbar__controls--capture">
          <div className="topbar__bar captureToolbar captureToolbar--minimal">
            <div className="captureToolbar__fields">
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

              {puedeImportarCsv ? (
                <>
                  <input
                    ref={importCsvRef}
                    type="file"
                    accept=".csv,text/csv"
                    className="persistRow__csvFile"
                    aria-label="Importar CSV de asistencia masiva"
                    onChange={onImportCsvChange}
                  />
                  <button
                    type="button"
                    className="btn btn--primary btn--compact"
                    disabled={loading || gridLoading || importandoCsv}
                    onClick={() => importCsvRef.current?.click()}
                    title="Importar asistencia por N.º de empleado (columna PLANTA opcional). Los datos se muestran al instante."
                  >
                    {importandoCsv ? 'Importando…' : 'Importar asistencia'}
                  </button>
                </>
              ) : null}

              {puedeEditar ? (
                <button
                  type="button"
                  className="btn btn--primary btn--compact"
                  onClick={() => void guardarSemana()}
                  disabled={loading || gridLoading || guardandoSemana || rows.length === 0}
                  title="Guardar la semana visible de todos los colaboradores activos"
                >
                  {guardandoSemana ? 'Guardando…' : 'Guardar semana'}
                </button>
              ) : null}
            </div>
          </div>

          {(gridLoading || importandoCsv || saveMessage) ? (
            <div className="captureStatusBar" role="status">
              {gridLoading ? (
                <span className="captureStatusBar__item captureStatusBar__item--muted">
                  Cargando colaboradores activos y asistencia…
                </span>
              ) : null}
              {importandoCsv ? (
                <span className="captureStatusBar__item captureStatusBar__item--muted">
                  Importando CSV y aplicando códigos en la cuadrícula…
                </span>
              ) : null}
              {saveMessage ? (
                <span className="captureStatusBar__item captureStatusBar__item--ok">{saveMessage}</span>
              ) : null}
            </div>
          ) : null}

          {csvImportOmitidos && csvImportOmitidos.length > 0 ? (
            <div className="persistRow__csvOmitidos">
              <p className="persistRow__meta">
                <strong>{csvImportOmitidos.length}</strong> N.º de empleado no ingresados.
              </p>
              <button
                type="button"
                className="btn btn--compact"
                onClick={() =>
                  downloadTextFile(
                    `asistencia-omitidos-${weekIso}.csv`,
                    buildCsvListaNumerosEmpleado(csvImportOmitidos),
                  )
                }
              >
                Descargar lista
              </button>
            </div>
          ) : null}
        </div>
      </header>

      <div className="sheetWrap sheetWrap--capture">
        {!loading && colaboradoresActivosCaptura.length === 0 ? (
          <p className="hint" style={{ padding: '1rem' }}>
            No hay colaboradores activos. Revise la sección <strong>Colaboradores</strong>.
          </p>
        ) : null}
        {!gridLoading && rows.length > 0 ? (
          <p className="hint captureGridCount" style={{ padding: '0.25rem 1rem' }}>
            {rows.length} colaborador(es) activo(s) — {weekRangeLabel}
          </p>
        ) : null}
        {!gridLoading && rows.length > 0 ? (
          <table className="sheet sheet--captureGrid sheet--captureId8" aria-label="Cuadrícula de asistencia">
            <thead>
              <tr>
                <th colSpan={ATTENDANCE_GRID_ID_COL_COUNT} className="th th--block th--band th--bandId">
                  Identificación
                </th>
                {WEEK_COLUMNS.map((col, i) => (
                  <th key={col.key} colSpan={3} className="th th--block th--day th--band">
                    {col.weekday} <span className="muted">{dayMetas[i]?.dateLabel ?? ''}</span>
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
                <th className="th th--total" title={TOTAL_COLUMN_HELP.asist}>Asist.</th>
                <th className="th th--total" title={TOTAL_COLUMN_HELP.extra}>Extra</th>
                <th className="th th--total" title={TOTAL_COLUMN_HELP.desc}>Desc.</th>
                <th className="th th--total" title={TOTAL_COLUMN_HELP.falta}>Falta</th>
                <th className="th th--total" title={TOTAL_COLUMN_HELP.inc}>Inc.</th>
                <th className="th th--total" title={TOTAL_COLUMN_HELP.pcgs}>PCGS</th>
                <th className="th th--total" title={TOTAL_COLUMN_HELP.psgs}>PSGS</th>
                <th className="th th--total" title={TOTAL_COLUMN_HELP.vac}>Vac.</th>
                <th className="th th--total" title={TOTAL_COLUMN_HELP.cap}>Cap.</th>
              </tr>
            </thead>
            <tbody className="captureGridBody">
              {rows.map((row) => (
                <AttendanceGridRow
                  key={row.id}
                  row={row}
                  plantaFallback=""
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
        {CODE_HINTS.map((c) => (
          <option key={c} value={c} />
        ))}
      </datalist>
    </div>
  )
}
