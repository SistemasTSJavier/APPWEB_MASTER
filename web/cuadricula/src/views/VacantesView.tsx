import { useCallback, useEffect, useMemo, useRef, useState, type ChangeEvent, type FormEvent } from 'react'
import { downloadTextFile } from '../attendanceExportSummary'
import { ATTENDANCE_GRID_ID_HEADERS } from '../attendanceGridColumns'
import { useCuadriculaData } from '../CuadriculaDataContext'
import {
  colaboradorCoincideSlot,
  decodeSlotKey,
  encodeSlotKey,
  listarPlantasParaVacantes,
  listarPosicionesLibresParaVacante,
  resolverDatosSlot,
  slotFromVacanteRegistro,
} from '../vacantesPosicionSlots'
import {
  VACANTES_CATALOG_UPDATED_EVENT,
  addVacanteToCatalog,
  loadVacantesCatalogo,
  removeVacanteFromCatalog,
  type VacanteRegistro,
} from '../vacantesStorage'
import { colaboradorTieneBaja } from '@/lib/colaboradores-baja'
import {
  VACANTES_CSV_HEADERS,
  buildVacantesCsvExport,
  buildVacantesCsvTemplate,
  importVacantesCsvToCatalog,
} from '../vacantesCsvImport'

export function VacantesView() {
  const { colaboradores, catalogo, loading, error, reload, puedeEditar } = useCuadriculaData()
  const [catalogoVacantes, setCatalogoVacantes] = useState<VacanteRegistro[]>([])
  const [plantaForm, setPlantaForm] = useState('')
  const [slotFormKey, setSlotFormKey] = useState('')
  const [puesto, setPuesto] = useState('')
  const [notas, setNotas] = useState('')
  const [mensaje, setMensaje] = useState<string | null>(null)
  const [filtroPlantaLista, setFiltroPlantaLista] = useState('')
  const importCsvRef = useRef<HTMLInputElement>(null)

  const recargarCatalogo = useCallback(() => {
    setCatalogoVacantes(loadVacantesCatalogo())
  }, [])

  useEffect(() => {
    recargarCatalogo()
    const onUpdate = () => recargarCatalogo()
    window.addEventListener(VACANTES_CATALOG_UPDATED_EVENT, onUpdate)
    return () => window.removeEventListener(VACANTES_CATALOG_UPDATED_EVENT, onUpdate)
  }, [recargarCatalogo])

  const plantasOpciones = useMemo(
    () => listarPlantasParaVacantes(colaboradores, catalogo),
    [colaboradores, catalogo],
  )

  const posicionesLibres = useMemo(
    () =>
      listarPosicionesLibresParaVacante(
        plantaForm,
        colaboradores,
        catalogo,
        catalogoVacantes,
      ),
    [plantaForm, colaboradores, catalogo, catalogoVacantes],
  )

  const slotSeleccionado = useMemo(() => decodeSlotKey(slotFormKey), [slotFormKey])

  const datosAuto = useMemo(() => {
    if (!slotSeleccionado) return null
    return resolverDatosSlot(slotSeleccionado, colaboradores, catalogo)
  }, [slotSeleccionado, colaboradores, catalogo])

  useEffect(() => {
    if (!slotFormKey) return
    const slot = posicionesLibres.find((s) => encodeSlotKey(s) === slotFormKey)
    if (slot?.puestoSugerido && !puesto.trim()) {
      setPuesto(slot.puestoSugerido)
    }
  }, [slotFormKey, posicionesLibres, puesto])

  useEffect(() => {
    setSlotFormKey('')
    setPuesto('')
    setNotas('')
  }, [plantaForm])

  const filasLista = useMemo(() => {
    const p = filtroPlantaLista.trim().toUpperCase()
    if (!p) return catalogoVacantes
    return catalogoVacantes.filter((v) => v.planta === p)
  }, [catalogoVacantes, filtroPlantaLista])

  function slotOcupadoPorActivo(v: VacanteRegistro): boolean {
    const slot = slotFromVacanteRegistro(v)
    for (const c of colaboradores) {
      if (colaboradorTieneBaja(c)) continue
      if (colaboradorCoincideSlot(c, slot, catalogo)) return true
    }
    return false
  }

  function onAgregar(e: FormEvent) {
    e.preventDefault()
    setMensaje(null)
    if (!puedeEditar) return
    if (!plantaForm.trim()) {
      setMensaje('Seleccione una planta.')
      return
    }
    const slot = decodeSlotKey(slotFormKey)
    if (!slot) {
      setMensaje('Seleccione posición y servicio (cada servicio tiene su propia secuencia).')
      return
    }
    const datos = resolverDatosSlot(slot, colaboradores, catalogo)
    const v = addVacanteToCatalog({
      planta: datos.planta,
      posicion: datos.posicion,
      puesto: puesto.trim() || datos.puestoSugerido || undefined,
      servicioLinea: datos.servicioLinea,
      rowServiceNo: datos.rowServiceNo,
      notas,
    })
    if (!v) {
      setMensaje('No se pudo guardar (vacante duplicada en ese servicio o almacenamiento bloqueado).')
      return
    }
    setSlotFormKey('')
    setPuesto('')
    setNotas('')
    setMensaje(
      `Vacante «${v.posicion}» — ${v.servicioLinea} (N.º ${v.rowServiceNo || '—'}) en «${v.planta}».`,
    )
    recargarCatalogo()
  }

  function descargarPlantillaCsv() {
    downloadTextFile('vacantes-plantilla.csv', buildVacantesCsvTemplate())
  }

  function exportarCatalogoCsv() {
    const rows = filtroPlantaLista.trim()
      ? catalogoVacantes.filter((v) => v.planta === filtroPlantaLista.trim().toUpperCase())
      : catalogoVacantes
    downloadTextFile('vacantes-catalogo.csv', buildVacantesCsvExport(rows))
  }

  async function onImportCsvChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file || !puedeEditar) return
    setMensaje(null)
    try {
      const text = await file.text()
      const r = importVacantesCsvToCatalog(text, colaboradores, catalogo)
      recargarCatalogo()
      const partes = [
        r.agregadas > 0 ? `${r.agregadas} nueva(s)` : null,
        r.actualizadas > 0 ? `${r.actualizadas} actualizada(s)` : null,
        r.omitidas > 0 ? `${r.omitidas} sin cambio` : null,
        r.bloqueadas > 0 ? `${r.bloqueadas} bloqueada(s) (ocupadas)` : null,
      ].filter(Boolean)
      const resumen = partes.length ? partes.join(', ') : 'Sin filas importadas'
      if (r.errores.length > 0) {
        setMensaje(
          `${resumen}. Avisos:\n${r.errores.slice(0, 8).join('\n')}${r.errores.length > 8 ? `\n… y ${r.errores.length - 8} más` : ''}`,
        )
      } else {
        setMensaje(`Importación CSV: ${resumen}.`)
      }
    } catch {
      setMensaje('No se pudo leer el archivo CSV.')
    }
  }

  function onQuitar(id: string) {
    if (!puedeEditar) return
    if (!removeVacanteFromCatalog(id)) {
      setMensaje('No se pudo quitar la vacante.')
      return
    }
    setMensaje('Vacante eliminada del catálogo.')
    recargarCatalogo()
  }

  return (
    <div className="attendance">
      <header className="topbar">
        <div className="topbar__titleRow">
          <h1 className="topbar__title">Vacantes</h1>
          <p className="topbar__subtitle">
            Registre una a una o <strong>importe un CSV</strong> con{' '}
            {VACANTES_CSV_HEADERS.join(', ')}. Cada servicio tiene su propia secuencia de posiciones.
          </p>
        </div>

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
                <span className="field__label">Filtrar listado</span>
                <select
                  className="select"
                  value={filtroPlantaLista}
                  onChange={(e) => setFiltroPlantaLista(e.target.value)}
                  disabled={loading}
                >
                  <option value="">Todas las plantas</option>
                  {plantasOpciones.map((p) => (
                    <option key={p} value={p}>
                      {p}
                    </option>
                  ))}
                </select>
              </label>
              {puedeEditar ? (
                <div className="field field--action">
                  <span className="field__label">CSV</span>
                  <div className="flex flex-wrap gap-2">
                    <button type="button" className="btn" onClick={descargarPlantillaCsv}>
                      Plantilla CSV
                    </button>
                    <button
                      type="button"
                      className="btn"
                      onClick={exportarCatalogoCsv}
                      disabled={catalogoVacantes.length === 0}
                    >
                      Exportar catálogo
                    </button>
                    <input
                      ref={importCsvRef}
                      type="file"
                      accept=".csv,text/csv"
                      className="persistRow__csvFile"
                      aria-label="Importar vacantes desde CSV"
                      onChange={onImportCsvChange}
                    />
                    <button
                      type="button"
                      className="btn btn--primary"
                      onClick={() => importCsvRef.current?.click()}
                      disabled={loading}
                    >
                      Importar CSV…
                    </button>
                  </div>
                </div>
              ) : null}
            </div>
          </div>
        </div>

        {puedeEditar ? (
          <form className="card mb-4 space-y-3" onSubmit={onAgregar}>
            <h2 className="text-sm font-bold uppercase text-slate-900">Registrar vacante</h2>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              <label className="field">
                <span className="field__label">Planta *</span>
                <select
                  className="select"
                  required
                  value={plantaForm}
                  onChange={(e) => setPlantaForm(e.target.value)}
                  disabled={loading}
                >
                  <option value="">Seleccione…</option>
                  {plantasOpciones.map((p) => (
                    <option key={p} value={p}>
                      {p}
                    </option>
                  ))}
                </select>
              </label>
              <label className="field sm:col-span-2">
                <span className="field__label">Posición libre (servicio + posición) *</span>
                <select
                  className="select"
                  required
                  value={slotFormKey}
                  onChange={(e) => setSlotFormKey(e.target.value)}
                  disabled={loading || !plantaForm || posicionesLibres.length === 0}
                >
                  <option value="">
                    {!plantaForm
                      ? 'Primero planta…'
                      : posicionesLibres.length === 0
                        ? 'Sin posiciones libres'
                        : 'Seleccione…'}
                  </option>
                  {posicionesLibres.map((s) => (
                    <option key={encodeSlotKey(s)} value={encodeSlotKey(s)}>
                      {s.posicion} — {s.servicioLinea}
                      {s.rowServiceNo ? ` (N.º ${s.rowServiceNo})` : ''}
                    </option>
                  ))}
                </select>
              </label>
              <label className="field">
                <span className="field__label">Puesto</span>
                <input
                  className="input"
                  value={puesto}
                  onChange={(e) => setPuesto(e.target.value)}
                  placeholder={datosAuto?.puestoSugerido || 'Opcional'}
                />
              </label>
              <label className="field field--grow sm:col-span-2 lg:col-span-3">
                <span className="field__label">Notas</span>
                <input
                  className="input"
                  value={notas}
                  onChange={(e) => setNotas(e.target.value)}
                  placeholder="Opcional"
                />
              </label>
            </div>

            {datosAuto ? (
              <div
                className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-800"
                aria-live="polite"
              >
                <strong>Automático:</strong> SERVICIO {datosAuto.servicioLinea} · PLANTA {datosAuto.planta} · N.º
                SERVICIO {datosAuto.rowServiceNo || '—'} · POSICIÓN {datosAuto.posicion}
              </div>
            ) : null}

            {plantaForm && posicionesLibres.length === 0 ? (
              <p className="text-xs font-medium text-amber-900">
                No hay posiciones libres en esta planta para ningún servicio (ocupadas o ya en vacantes). Revise
                expedientes con <strong>POSICION</strong> y servicio asignado.
              </p>
            ) : null}

            <button
              type="submit"
              className="btn btn--primary"
              disabled={loading || !plantaForm || !slotFormKey}
            >
              Agregar vacante
            </button>
          </form>
        ) : (
          <p className="topbar__readonlyBanner" role="status">
            <strong>Solo lectura.</strong> No puede registrar ni quitar vacantes.
          </p>
        )}

        {mensaje ? <p className="persistRow__flash">{mensaje}</p> : null}

        <p className="hint">
          CSV: {VACANTES_CSV_HEADERS.join('; ')} (separador ; , o tab). Coincide con catálogo Servicios por N.º y
          planta. Columnas en Asistencia: {ATTENDANCE_GRID_ID_HEADERS.slice(0, 8).join(' · ')}.
        </p>
      </header>

      <div className="sheetWrap">
        {filasLista.length === 0 ? (
          <p className="hint" style={{ padding: '1rem' }}>
            {filtroPlantaLista
              ? `No hay vacantes registradas para «${filtroPlantaLista}».`
              : 'No hay vacantes en el catálogo.'}
          </p>
        ) : (
          <table className="sheet" aria-label="Catálogo de vacantes">
            <thead>
              <tr>
                <th className="th th--sticky">SERVICIO</th>
                <th className="th th--sticky mono">NO. SERVICIO</th>
                <th className="th th--sticky">PLANTA</th>
                <th className="th th--sticky">POSICION</th>
                <th className="th th--sticky">PUESTO</th>
                <th className="th th--sticky">NOTAS</th>
                {puedeEditar ? <th className="th th--sticky"> </th> : null}
              </tr>
            </thead>
            <tbody>
              {filasLista.map((v) => {
                const ocupada = slotOcupadoPorActivo(v)
                return (
                  <tr key={v.id} className="tr" data-vacant="true">
                    <td className="td td--sticky">{v.servicioLinea ?? '—'}</td>
                    <td className="td td--sticky mono">{v.rowServiceNo ?? '—'}</td>
                    <td className="td td--sticky">{v.planta}</td>
                    <td className="td td--sticky mono font-semibold">{v.posicion}</td>
                    <td className="td td--sticky">{v.puesto ?? '—'}</td>
                    <td className="td td--sticky text-xs">{v.notas ?? '—'}</td>
                    {puedeEditar ? (
                      <td className="td td--sticky">
                        <button type="button" className="btn btn--linkish" onClick={() => onQuitar(v.id)}>
                          Quitar
                        </button>
                        {ocupada ? (
                          <span className="muted" style={{ marginLeft: '0.5rem', fontSize: '0.7rem' }}>
                            (colaborador en posición)
                          </span>
                        ) : null}
                      </td>
                    ) : null}
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}