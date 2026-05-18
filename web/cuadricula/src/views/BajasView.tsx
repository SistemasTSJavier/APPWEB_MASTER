import { useEffect, useMemo, useState } from 'react'
import { buildBajasHistoryExportText } from '../bajasExportSummary'
import type { BajasRow } from '../bajasMock'
import {
  addDays,
  downloadTextFile,
  formatDateEs,
  mondayOfWeek,
  weekDayMetas,
  type AttendanceExportPeriod,
} from '../attendanceExportSummary'
import {
  colaboradorConBajaToBajasRow,
  colaboradoresConBajaPorServicioCatalogo,
} from '../cuadriculaColaboradoresBridge'
import { useCuadriculaData } from '../CuadriculaDataContext'
import { isAsistenciaCode, isDoubleTurnoExtraCode } from '../attendanceTotals'
import { WEEK_COLUMNS, type Turn } from '../mockData'
import { WEEK_TOTALS_LEGEND } from '../weekTotalsLegend'

const TURNS: Turn[] = ['D', 'T', 'N']

function toMonthYm(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  return `${y}-${m}`
}

/** Misma lógica visual que asistencia. */
function bajasCellClass(value: string, _noServicioFila: string): string {
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

export function BajasView() {
  const { catalogo, colaboradores, loading, error, reload } = useCuadriculaData()
  const [rows, setRows] = useState<BajasRow[]>([])
  const [serviceCatalogId, setServiceCatalogId] = useState('')
  const [weekStart, setWeekStart] = useState(() => mondayOfWeek(new Date()))
  const [exportPeriod, setExportPeriod] = useState<AttendanceExportPeriod>('semana')
  const [exportMonthYm, setExportMonthYm] = useState(() =>
    toMonthYm(mondayOfWeek(new Date())),
  )
  const [serviceNo, setServiceNo] = useState('')

  const selectedCatalog = useMemo(
    () => catalogo.find((c) => c.id === serviceCatalogId),
    [catalogo, serviceCatalogId],
  )

  const dayMetas = useMemo(
    () => weekDayMetas(weekStart, WEEK_COLUMNS),
    [weekStart],
  )

  const weekRangeLabel = `Lun–Dom: ${formatDateEs(weekStart)} – ${formatDateEs(
    addDays(weekStart, 6),
  )}`

  useEffect(() => {
    if (!serviceCatalogId || !selectedCatalog) {
      setRows([])
      setServiceNo('')
      return
    }
    const nombreCat = selectedCatalog.nombre
    const no = (selectedCatalog.numero_servicio ?? '').trim()
    setServiceNo(no)
    const bajas = colaboradoresConBajaPorServicioCatalogo(colaboradores, nombreCat).map((c) =>
      colaboradorConBajaToBajasRow(c, nombreCat, no),
    )
    setRows(bajas)
  }, [serviceCatalogId, selectedCatalog, colaboradores])

  useEffect(() => {
    const n = serviceNo.trim()
    setRows((prev) => prev.map((r) => ({ ...r, noServicio: n })))
  }, [serviceNo])

  function exportHistorial() {
    const serviceLabel = selectedCatalog?.nombre ?? 'Servicio'
    const text = buildBajasHistoryExportText({
      serviceLabel,
      serviceNo,
      period: exportPeriod,
      weekStartMonday: weekStart,
      monthYm: exportMonthYm,
      rows,
      dayMetas,
      weekdayLabels: WEEK_COLUMNS.map((c) => c.weekday),
    })
    const stamp = formatDateEs(weekStart).replace(/\//g, '-')
    downloadTextFile(`historial-bajas-${stamp}.txt`, text)
  }

  return (
    <div className="bajasView">
      <header className="topbar">
        <div className="topbar__title">
          <h1>Bajas — historial de asistencia</h1>
          <span className="badge">Resumen</span>
        </div>
        {loading ? (
          <p className="hint" style={{ marginBottom: 8 }}>
            Cargando catálogo y colaboradores…
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
        <div className="topbar__controls">
          <div className="topbar__bar">
            <div className="topbar__toolbarLeft">
              <label className="field">
                <span className="field__label">Servicio (catálogo)</span>
                <select
                  className="select"
                  value={serviceCatalogId}
                  onChange={(e) => setServiceCatalogId(e.target.value)}
                  disabled={loading}
                >
                  <option value="">Seleccione servicio…</option>
                  {catalogo.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.nombre}
                    </option>
                  ))}
                </select>
              </label>
              <label className="field field--serviceNo">
                <span className="field__label">No. servicio</span>
                <input
                  className="input input--serviceNo"
                  type="text"
                  autoComplete="off"
                  placeholder="—"
                  title="Proviene del catálogo; referencia para colorear celdas."
                  value={serviceNo}
                  onChange={(e) => setServiceNo(e.target.value)}
                  maxLength={32}
                  aria-label="Número de servicio"
                />
              </label>
              <div className="weekNav">
                <button
                  type="button"
                  className="btn"
                  onClick={() => setWeekStart((d) => addDays(d, -7))}
                  title="Semana anterior (lun–dom)"
                >
                  ← Semana anterior
                </button>
                <div className="weekNav__range">{weekRangeLabel}</div>
                <button
                  type="button"
                  className="btn"
                  onClick={() => setWeekStart((d) => addDays(d, 7))}
                  title="Semana siguiente (lun–dom)"
                >
                  Semana siguiente →
                </button>
              </div>
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
          <div className="topbar__exportRow">
            <label className="field">
              <span className="field__label">Resumen a exportar</span>
              <select
                className="select"
                value={exportPeriod}
                onChange={(e) =>
                  setExportPeriod(e.target.value as AttendanceExportPeriod)
                }
                aria-label="Periodo del resumen"
              >
                <option value="semana">
                  Semana (lunes a domingo; cada flecha = ±7 días)
                </option>
                <option value="mes">Mes calendario</option>
                <option value="toda">Todo el período visible (7 días en pantalla)</option>
              </select>
            </label>
            {exportPeriod === 'mes' ? (
              <label className="field">
                <span className="field__label">Mes</span>
                <input
                  className="input input--month"
                  type="month"
                  value={exportMonthYm}
                  onChange={(e) => setExportMonthYm(e.target.value)}
                />
              </label>
            ) : null}
            <div className="field field--action">
              <span className="field__label">&nbsp;</span>
              <button type="button" className="btn btn--primary" onClick={exportHistorial}>
                Exportar resumen + detalle
              </button>
            </div>
          </div>
          <p className="hint">
            Personal con <strong>baja</strong> en expediente y línea de servicio alineada al servicio del catálogo. Las celdas de la semana
            son plantilla (sin historial remoto aún); el color de número inválido usa el <strong>No. servicio</strong> de cada fila.
          </p>
        </div>
      </header>

      <div className="sheetWrap">
        {!serviceCatalogId ? (
          <p className="hint" style={{ padding: '1rem' }}>
            Elija un servicio para listar bajas vinculadas a ese servicio.
          </p>
        ) : rows.length === 0 ? (
          <p className="hint" style={{ padding: '1rem' }}>
            No hay colaboradores dados de baja que coincidan con <strong>{selectedCatalog?.nombre}</strong>.
          </p>
        ) : null}
        <table className="sheet sheet--bajas" aria-label="Historial de asistencia en bajas">
          <thead>
            <tr>
              <th colSpan={8} className="th th--block th--band th--bandId">
                Datos del empleado
              </th>
              {WEEK_COLUMNS.map((col, i) => (
                <th key={col.key} colSpan={3} className="th th--block th--day th--band">
                  {col.weekday}{' '}
                  <span className="muted">{dayMetas[i]?.dateLabel ?? ''}</span>
                </th>
              ))}
            </tr>
            <tr className="theadSub">
              <th className="th th--sticky">Servicio</th>
              <th className="th th--sticky">No. servicio</th>
              <th className="th th--sticky">Planta</th>
              <th className="th th--sticky">Posición</th>
              <th className="th th--sticky">Puesto</th>
              <th className="th th--sticky">Fecha de ingreso</th>
              <th className="th th--sticky">No. de empleado</th>
              <th className="th th--sticky th--name">Nombre(s)</th>
              {WEEK_COLUMNS.map((col) =>
                TURNS.map((t) => (
                  <th key={`${col.key}-${t}`} className="th th--turn">
                    {t}
                  </th>
                )),
              )}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id}>
                <td className="td td--sticky">{row.servicio}</td>
                <td className="td td--sticky mono">{row.noServicio}</td>
                <td className="td td--sticky">{row.planta}</td>
                <td className="td td--sticky mono">{row.posicion}</td>
                <td className="td td--sticky">{row.puesto}</td>
                <td className="td td--sticky nowrap">{row.fechaIngreso}</td>
                <td className="td td--sticky mono">{row.noEmpleado}</td>
                <td className="td td--sticky td--name">{row.nombres}</td>
                {row.shifts.map((day, dayIndex) =>
                  TURNS.map((turn) => (
                    <td key={`${row.id}-${dayIndex}-${turn}`} className="td td--cell">
                      <input
                        className={bajasCellClass(day[turn], row.noServicio)}
                        value={day[turn]}
                        readOnly
                        tabIndex={-1}
                        aria-label={`${row.nombres} ${WEEK_COLUMNS[dayIndex]?.weekday} ${turn}`}
                        title="Solo lectura: historial de asistencia."
                      />
                    </td>
                  )),
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <footer className="footer">
        Listado alineado con expedientes y catálogo de servicios; export y semana como en asistencia.
      </footer>
    </div>
  )
}
