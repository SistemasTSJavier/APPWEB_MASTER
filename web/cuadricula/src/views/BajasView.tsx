import { useCallback, useEffect, useMemo, useState } from 'react'
import { colaboradorCoincideRangoFechaBaja } from '@/lib/colaboradores-baja'
import { buildBajasHistoryExportText } from '../bajasExportSummary'
import type { BajasRow } from '../bajasMock'
import { loadBajasRowsMultiServicio } from '../bajasAttendance'
import {
  addDays,
  downloadTextFile,
  formatDateEs,
  mondayOfWeek,
  weekDayMetas,
  type AttendanceExportPeriod,
} from '../attendanceExportSummary'
import { colaboradoresConBajaPorServicioCatalogo } from '../cuadriculaColaboradoresBridge'
import { canFilterBajasCuadriculaPorFechaBaja } from '../cuadriculaPermissions'
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
  const { catalogo, colaboradores, loading, error, reload, appRole } = useCuadriculaData()
  const [rows, setRows] = useState<BajasRow[]>([])
  const [asistenciaLoading, setAsistenciaLoading] = useState(false)
  const [selectedServiceIds, setSelectedServiceIds] = useState<string[]>([])
  const [weekStart, setWeekStart] = useState(() => mondayOfWeek(new Date()))
  const [exportPeriod, setExportPeriod] = useState<AttendanceExportPeriod>('semana')
  const [exportMonthYm, setExportMonthYm] = useState(() =>
    toMonthYm(mondayOfWeek(new Date())),
  )
  const [fechaBajaDesde, setFechaBajaDesde] = useState('')
  const [fechaBajaHasta, setFechaBajaHasta] = useState('')

  const puedeFiltrarFechaBaja = canFilterBajasCuadriculaPorFechaBaja(appRole)

  const selectedCatalogs = useMemo(
    () => catalogo.filter((c) => selectedServiceIds.includes(c.id)),
    [catalogo, selectedServiceIds],
  )

  const dayMetas = useMemo(
    () => weekDayMetas(weekStart, WEEK_COLUMNS),
    [weekStart],
  )

  const weekRangeLabel = `Lun–Dom: ${formatDateEs(weekStart)} – ${formatDateEs(
    addDays(weekStart, 6),
  )}`

  const toggleServiceId = useCallback((id: string) => {
    setSelectedServiceIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    )
  }, [])

  const selectAllServices = useCallback(() => {
    setSelectedServiceIds(catalogo.map((c) => c.id))
  }, [catalogo])

  const clearServices = useCallback(() => {
    setSelectedServiceIds([])
  }, [])

  useEffect(() => {
    if (selectedCatalogs.length === 0) {
      setRows([])
      setAsistenciaLoading(false)
      return
    }

    const grupos = selectedCatalogs
      .map((cat) => {
        let bajas = colaboradoresConBajaPorServicioCatalogo(colaboradores, cat.nombre)
        if (puedeFiltrarFechaBaja && (fechaBajaDesde.trim() || fechaBajaHasta.trim())) {
          bajas = bajas.filter((c) =>
            colaboradorCoincideRangoFechaBaja(c, fechaBajaDesde, fechaBajaHasta),
          )
        }
        return {
          bajas,
          catalogNombre: cat.nombre,
          noServicio: (cat.numero_servicio ?? '').trim(),
        }
      })
      .filter((g) => g.bajas.length > 0)

    if (grupos.length === 0) {
      setRows([])
      setAsistenciaLoading(false)
      return
    }

    let cancelled = false
    setAsistenciaLoading(true)
    void loadBajasRowsMultiServicio(grupos, weekStart).then((loaded) => {
      if (!cancelled) {
        setRows(loaded)
        setAsistenciaLoading(false)
      }
    })
    return () => {
      cancelled = true
    }
  }, [
    selectedCatalogs,
    colaboradores,
    weekStart,
    fechaBajaDesde,
    fechaBajaHasta,
    puedeFiltrarFechaBaja,
  ])

  const serviceLabels = selectedCatalogs.map((c) => c.nombre)
  const serviceLabelResumen =
    serviceLabels.length === 0
      ? 'Servicio'
      : serviceLabels.length === 1
        ? serviceLabels[0]!
        : `${serviceLabels.length} servicios`

  function exportHistorial() {
    const text = buildBajasHistoryExportText({
      serviceLabel: serviceLabelResumen,
      serviceLabels: serviceLabels.length > 1 ? serviceLabels : undefined,
      period: exportPeriod,
      weekStartMonday: weekStart,
      monthYm: exportMonthYm,
      rows,
      dayMetas,
      weekdayLabels: WEEK_COLUMNS.map((c) => c.weekday),
      fechaBajaDesde: puedeFiltrarFechaBaja ? fechaBajaDesde : undefined,
      fechaBajaHasta: puedeFiltrarFechaBaja ? fechaBajaHasta : undefined,
    })
    const stamp = formatDateEs(weekStart).replace(/\//g, '-')
    downloadTextFile(`historial-bajas-${stamp}.txt`, text)
  }

  const idColCount = puedeFiltrarFechaBaja ? 9 : 8

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
            <div className="topbar__toolbarLeft topbar__toolbarLeft--bajasFilters">
              <div className="field field--serviceMulti">
                <span className="field__label">Servicios (catálogo)</span>
                <div className="bajasServiceFilter">
                  <div className="bajasServiceFilter__actions">
                    <button
                      type="button"
                      className="btn btn--sm"
                      onClick={selectAllServices}
                      disabled={loading || catalogo.length === 0}
                    >
                      Todos
                    </button>
                    <button
                      type="button"
                      className="btn btn--sm"
                      onClick={clearServices}
                      disabled={loading || selectedServiceIds.length === 0}
                    >
                      Ninguno
                    </button>
                  </div>
                  <div
                    className="bajasServiceFilter__list"
                    role="group"
                    aria-label="Selección de servicios"
                  >
                    {catalogo.map((s) => (
                      <label key={s.id} className="bajasServiceFilter__item">
                        <input
                          type="checkbox"
                          checked={selectedServiceIds.includes(s.id)}
                          onChange={() => toggleServiceId(s.id)}
                          disabled={loading}
                        />
                        <span>{s.nombre}</span>
                      </label>
                    ))}
                  </div>
                </div>
                {selectedServiceIds.length > 0 ? (
                  <p className="hint bajasServiceFilter__count">
                    {selectedServiceIds.length} servicio(s) seleccionado(s)
                  </p>
                ) : (
                  <p className="hint bajasServiceFilter__count">
                    Marque uno o más servicios para ver el historial.
                  </p>
                )}
              </div>

              {puedeFiltrarFechaBaja ? (
                <div className="bajasFechaBajaFilters">
                  <label className="field">
                    <span className="field__label">Fecha de baja desde</span>
                    <input
                      className="input"
                      type="date"
                      value={fechaBajaDesde}
                      onChange={(e) => setFechaBajaDesde(e.target.value)}
                      aria-label="Fecha de baja desde"
                    />
                  </label>
                  <label className="field">
                    <span className="field__label">Fecha de baja hasta</span>
                    <input
                      className="input"
                      type="date"
                      value={fechaBajaHasta}
                      onChange={(e) => setFechaBajaHasta(e.target.value)}
                      aria-label="Fecha de baja hasta"
                    />
                  </label>
                </div>
              ) : null}

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
            Personal con <strong>baja</strong> en expediente y línea de servicio alineada al catálogo
            seleccionado. Las celdas muestran el <strong>historial de asistencia</strong> de la semana
            (misma fuente que la cuadrícula por planta).
            {puedeFiltrarFechaBaja
              ? ' Puede acotar por rango de fecha de baja (Gerente RH / Administrador).'
              : null}{' '}
            {asistenciaLoading ? 'Cargando asistencia…' : null}
          </p>
        </div>
      </header>

      <div className="sheetWrap">
        {selectedServiceIds.length === 0 ? (
          <p className="hint" style={{ padding: '1rem' }}>
            Seleccione uno o más servicios del catálogo para listar bajas e historial de asistencia.
          </p>
        ) : rows.length === 0 && !asistenciaLoading ? (
          <p className="hint" style={{ padding: '1rem' }}>
            No hay colaboradores dados de baja que coincidan con los filtros (
            <strong>{serviceLabelResumen}</strong>
            {puedeFiltrarFechaBaja && (fechaBajaDesde || fechaBajaHasta)
              ? `, fecha de baja ${fechaBajaDesde || '…'} – ${fechaBajaHasta || '…'}`
              : null}
            ).
          </p>
        ) : null}
        <table
          className={`sheet sheet--bajas${puedeFiltrarFechaBaja ? ' sheet--bajasConFecha' : ''}`}
          aria-label="Historial de asistencia en bajas"
        >
          <thead>
            <tr>
              <th colSpan={idColCount} className="th th--block th--band th--bandId">
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
              {puedeFiltrarFechaBaja ? (
                <th className="th th--sticky">Fecha de baja</th>
              ) : null}
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
              <tr key={`${row.id}-${row.servicio}-${row.noServicio}`}>
                <td className="td td--sticky">{row.servicio}</td>
                <td className="td td--sticky mono">{row.noServicio}</td>
                <td className="td td--sticky">{row.planta}</td>
                <td className="td td--sticky mono">{row.posicion}</td>
                <td className="td td--sticky">{row.puesto}</td>
                <td className="td td--sticky nowrap">{row.fechaIngreso}</td>
                {puedeFiltrarFechaBaja ? (
                  <td className="td td--sticky nowrap">{row.fechaBaja ?? '—'}</td>
                ) : null}
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
                        title={
                          day[turn].trim()
                            ? `Asistencia registrada: ${day[turn]}`
                            : 'Sin registro de asistencia en esta semana.'
                        }
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
        Historial de solo lectura desde asistencia guardada; seleccione servicios, navegue la semana y
        exporte el resumen cuando lo necesite.
      </footer>
    </div>
  )
}
