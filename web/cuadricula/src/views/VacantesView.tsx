import { useCallback, useEffect, useMemo, useRef, useState, type ChangeEvent, type FormEvent } from 'react'
import { downloadTextFile } from '../attendanceExportSummary'
import { ATTENDANCE_GRID_ID_HEADERS } from '../attendanceGridColumns'
import { useCuadriculaData } from '../CuadriculaDataContext'
import {
  colaboradorActivoOcupaSlot,
  decodeSlotKey,
  encodeSlotKey,
  listarPlantasParaVacantes,
  listarPosicionesLibresParaVacante,
  listarServiciosCatalogoPorPlanta,
  resolverDatosSlot,
  slotFromVacanteRegistro,
} from '../vacantesPosicionSlots'
import { persistirVacantesCatalogoEnServidor } from '@/lib/vacantes-catalog-flujo'
import {
  VACANTES_CATALOG_UPDATED_EVENT,
  addVacanteToCatalog,
  loadVacantesCatalogo,
  posicionBloqueadaEnPlanta,
  removeVacanteFromCatalog,
  updateVacanteInCatalog,
  type VacanteRegistro,
} from '../vacantesStorage'
import {
  VACANTES_CSV_HEADERS,
  buildVacantesCsvExport,
  buildVacantesCsvTemplate,
  importVacantesCsvToCatalog,
} from '../vacantesCsvImport'
import {
  fetchVacantesCatalogRemote,
  pullVacantesCatalogFromRemoteToLocal,
  syncLocalVacantesCatalogToRemote,
} from '../vacantesRemote'
import { saveVacantesCatalogoDirect } from '@/lib/vacantes-catalog'
import {
  identificadorServicioVacante,
  normalizarVacantesCatalogo,
} from '@/lib/vacantes-servicio'

const SERVICIO_MANUAL_KEY = '__manual__'
const SERVICIO_SEP = '\u001e'

function encodeServicioCatalogKey(servicioLinea: string, rowServiceNo: string): string {
  return `${rowServiceNo}${SERVICIO_SEP}${servicioLinea}`
}

function decodeServicioCatalogKey(raw: string): { servicioLinea: string; rowServiceNo: string } | null {
  if (!raw || raw === SERVICIO_MANUAL_KEY) return null
  const i = raw.indexOf(SERVICIO_SEP)
  if (i < 0) return null
  return {
    rowServiceNo: raw.slice(0, i).trim(),
    servicioLinea: raw.slice(i + 1).trim(),
  }
}

export function VacantesView() {
  const { colaboradores, catalogo, loading, error, reload, puedeEditar } = useCuadriculaData()
  const [catalogoVacantes, setCatalogoVacantes] = useState<VacanteRegistro[]>([])
  const [modoAlta, setModoAlta] = useState<'slot' | 'manual'>('slot')
  const [editandoId, setEditandoId] = useState<string | null>(null)
  const [plantaForm, setPlantaForm] = useState('')
  const [slotFormKey, setSlotFormKey] = useState('')
  const [servicioFormKey, setServicioFormKey] = useState('')
  const [servicioLineaManual, setServicioLineaManual] = useState('')
  const [rowServiceNoManual, setRowServiceNoManual] = useState('')
  const [posicionManual, setPosicionManual] = useState('')
  const [puesto, setPuesto] = useState('')
  const [notas, setNotas] = useState('')
  const [mensaje, setMensaje] = useState<string | null>(null)
  const [filtroPlantaLista, setFiltroPlantaLista] = useState('')
  const [filtroServicioLista, setFiltroServicioLista] = useState('')
  const [syncBusy, setSyncBusy] = useState(false)
  const [csvReemplazarCatalogo, setCsvReemplazarCatalogo] = useState(false)
  const importCsvRef = useRef<HTMLInputElement>(null)

  const recargarCatalogo = useCallback(() => {
    const raw = loadVacantesCatalogo()
    const norm = normalizarVacantesCatalogo(raw, catalogo)
    if (JSON.stringify(raw) !== JSON.stringify(norm)) {
      saveVacantesCatalogoDirect(norm)
    }
    setCatalogoVacantes(norm)
  }, [catalogo])

  useEffect(() => {
    recargarCatalogo()
    const onUpdate = () => recargarCatalogo()
    window.addEventListener(VACANTES_CATALOG_UPDATED_EVENT, onUpdate)
    return () => window.removeEventListener(VACANTES_CATALOG_UPDATED_EVENT, onUpdate)
  }, [recargarCatalogo])

  useEffect(() => {
    let cancelled = false
    void (async () => {
      const local = loadVacantesCatalogo()
      if (local.length > 0) return
      const remote = await fetchVacantesCatalogRemote()
      if (cancelled || remote.meta.status !== 'ok' || remote.items.length === 0) return
      if (saveVacantesCatalogoDirect(remote.items)) recargarCatalogo()
    })()
    return () => {
      cancelled = true
    }
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

  const serviciosPlantaForm = useMemo(
    () => listarServiciosCatalogoPorPlanta(catalogo, plantaForm),
    [catalogo, plantaForm],
  )

  const editandoVacante = useMemo(
    () => (editandoId ? catalogoVacantes.find((v) => v.id === editandoId) ?? null : null),
    [editandoId, catalogoVacantes],
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
    if (editandoId) return
    setSlotFormKey('')
    setServicioFormKey('')
    setServicioLineaManual('')
    setRowServiceNoManual('')
    setPosicionManual('')
    setPuesto('')
    setNotas('')
  }, [plantaForm, editandoId])

  function limpiarFormulario() {
    setEditandoId(null)
    setSlotFormKey('')
    setServicioFormKey('')
    setServicioLineaManual('')
    setRowServiceNoManual('')
    setPosicionManual('')
    setPuesto('')
    setNotas('')
  }

  function resolverServicioFormulario(): { servicioLinea: string; rowServiceNo: string } | null {
    if (servicioFormKey === SERVICIO_MANUAL_KEY) {
      const servicioLinea = servicioLineaManual.trim()
      const rowServiceNo = rowServiceNoManual.trim()
      if (!servicioLinea && !rowServiceNo) return null
      return { servicioLinea, rowServiceNo }
    }
    const dec = decodeServicioCatalogKey(servicioFormKey)
    if (dec) return dec
    const hit = serviciosPlantaForm.find(
      (s) => encodeServicioCatalogKey(s.servicioLinea, s.rowServiceNo) === servicioFormKey,
    )
    if (hit) return { servicioLinea: hit.servicioLinea, rowServiceNo: hit.rowServiceNo }
    return null
  }

  function payloadDesdeFormulario(): {
    planta: string
    posicion: string
    puesto?: string
    servicioLinea?: string
    rowServiceNo?: string
    notas?: string
  } | null {
    if (!plantaForm.trim()) return null
    if (modoAlta === 'slot' && !editandoId) {
      const slot = decodeSlotKey(slotFormKey)
      if (!slot) return null
      const datos = resolverDatosSlot(slot, colaboradores, catalogo)
      return {
        planta: datos.planta,
        posicion: datos.posicion,
        puesto: puesto.trim() || datos.puestoSugerido || undefined,
        servicioLinea: datos.servicioLinea,
        rowServiceNo: datos.rowServiceNo,
        notas: notas.trim() || undefined,
      }
    }
    const posicion = posicionManual.trim()
    if (!posicion) return null
    const svc = resolverServicioFormulario()
    if (!svc) return null
    return {
      planta: plantaForm.trim(),
      posicion,
      puesto: puesto.trim() || undefined,
      servicioLinea: svc.servicioLinea,
      rowServiceNo: svc.rowServiceNo,
      notas: notas.trim() || undefined,
    }
  }

  function iniciarEdicion(v: VacanteRegistro) {
    setEditandoId(v.id)
    setModoAlta('manual')
    setPlantaForm(v.planta)
    setPosicionManual(v.posicion)
    setPuesto(v.puesto ?? '')
    setNotas(v.notas ?? '')
    setSlotFormKey('')
    const linea = (v.servicioLinea ?? '').trim()
    const no = (v.rowServiceNo ?? '').trim()
    const serviciosPlanta = listarServiciosCatalogoPorPlanta(catalogo, v.planta)
    const catalogHit = serviciosPlanta.find(
      (s) => s.servicioLinea === linea && s.rowServiceNo === no,
    )
    if (catalogHit) {
      setServicioFormKey(encodeServicioCatalogKey(catalogHit.servicioLinea, catalogHit.rowServiceNo))
      setServicioLineaManual('')
      setRowServiceNoManual('')
    } else if (linea || no) {
      setServicioFormKey(SERVICIO_MANUAL_KEY)
      setServicioLineaManual(linea)
      setRowServiceNoManual(no)
    } else {
      setServicioFormKey('')
      setServicioLineaManual('')
      setRowServiceNoManual('')
    }
    setMensaje(null)
  }

  const serviciosEnCatalogo = useMemo(() => {
    const map = new Map<string, string>()
    for (const v of catalogoVacantes) {
      const id = identificadorServicioVacante(v)
      if (!id || map.has(id)) continue
      const nom = (v.servicioLinea ?? '').trim() || '—'
      const no = (v.rowServiceNo ?? '').trim()
      map.set(id, no ? `${nom} (N.º ${no})` : nom)
    }
    return [...map.entries()]
      .sort((a, b) => a[1].localeCompare(b[1], 'es', { numeric: true }))
      .map(([id, label]) => ({ id, label }))
  }, [catalogoVacantes])

  const filasLista = useMemo(() => {
    let rows = catalogoVacantes
    const p = filtroPlantaLista.trim().toUpperCase()
    if (p) rows = rows.filter((v) => v.planta === p)
    const sid = filtroServicioLista.trim()
    if (sid) rows = rows.filter((v) => identificadorServicioVacante(v) === sid)
    return rows
  }, [catalogoVacantes, filtroPlantaLista, filtroServicioLista])

  function slotOcupadoPorActivo(v: VacanteRegistro): boolean {
    const slot = slotFromVacanteRegistro(v)
    for (const c of colaboradores) {
      if (colaboradorActivoOcupaSlot(c, slot, catalogo)) return true
    }
    return false
  }

  function onGuardarFormulario(e: FormEvent) {
    e.preventDefault()
    setMensaje(null)
    if (!puedeEditar) return

    const payload = payloadDesdeFormulario()
    if (!payload) {
      setMensaje(
        editandoId
          ? 'Complete planta, posición y servicio (nombre y/o N.º de servicio).'
          : modoAlta === 'slot'
            ? 'Seleccione planta y una posición libre del listado.'
            : 'Complete planta, posición y servicio.',
      )
      return
    }

    if (editandoId) {
      const v = updateVacanteInCatalog(editandoId, payload, catalogo)
      if (!v) {
        setMensaje(
          'No se pudo actualizar (vacante duplicada en ese servicio/posición o datos inválidos).',
        )
        return
      }
      limpiarFormulario()
      setMensaje(
        `Vacante actualizada: «${v.posicion}» — ${v.servicioLinea ?? '—'} (N.º ${v.rowServiceNo || '—'}) en «${v.planta}».`,
      )
      recargarCatalogo()
      return
    }

    const bloqueo = posicionBloqueadaEnPlanta(
      payload.planta,
      payload.posicion,
      colaboradores,
      catalogo,
      catalogoVacantes,
      {
        servicioLinea: payload.servicioLinea,
        rowServiceNo: payload.rowServiceNo,
      },
    )
    if (bloqueo.bloqueada) {
      setMensaje(bloqueo.motivo ?? 'Esa posición no está disponible.')
      return
    }

    const v = addVacanteToCatalog(payload, catalogo)
    if (!v) {
      setMensaje('No se pudo guardar (vacante duplicada en ese servicio o almacenamiento bloqueado).')
      return
    }
    limpiarFormulario()
    setMensaje(
      `Vacante «${v.posicion}» — ${v.servicioLinea} (N.º ${v.rowServiceNo || '—'}) en «${v.planta}».`,
    )
    recargarCatalogo()
  }

  function descargarPlantillaCsv() {
    downloadTextFile('vacantes-plantilla.csv', buildVacantesCsvTemplate())
  }

  function exportarCatalogoCsv() {
    downloadTextFile('vacantes-catalogo.csv', buildVacantesCsvExport(filasLista))
  }

  async function onImportCsvChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file || !puedeEditar) return
    setMensaje(null)
    try {
      const text = await file.text()
      const r = importVacantesCsvToCatalog(text, colaboradores, catalogo, {
        reemplazarCatalogo: csvReemplazarCatalogo,
      })
      recargarCatalogo()
      let syncAviso = ''
      if (r.agregadas > 0 || r.actualizadas > 0) {
        const sync = await persistirVacantesCatalogoEnServidor()
        if (!sync.ok) syncAviso = ` ${sync.aviso ?? 'No sincronizado a producción.'}`
      }
      const partes = [
        r.agregadas > 0 ? `${r.agregadas} nueva(s)` : null,
        r.actualizadas > 0 ? `${r.actualizadas} actualizada(s)` : null,
        r.omitidas > 0 ? `${r.omitidas} sin cambio` : null,
        r.bloqueadas > 0 ? `${r.bloqueadas} no importada(s) (colaborador ACTIVO en posición)` : null,
      ].filter(Boolean)
      const resumen = partes.length ? partes.join(', ') : 'Sin filas importadas'
      if (r.errores.length > 0) {
        setMensaje(
          `${resumen}.${syncAviso} Avisos:\n${r.errores.slice(0, 12).join('\n')}${r.errores.length > 12 ? `\n… y ${r.errores.length - 12} más` : ''}`,
        )
      } else {
        setMensaje(`Importación CSV: ${resumen}.${syncAviso}`)
      }
    } catch {
      setMensaje('No se pudo leer el archivo CSV.')
    }
  }

  async function subirVacantesAProduccion() {
    if (!puedeEditar || syncBusy) return
    setSyncBusy(true)
    setMensaje(null)
    try {
      const r = await syncLocalVacantesCatalogToRemote()
      setMensaje(r.message)
      if (r.ok) recargarCatalogo()
    } finally {
      setSyncBusy(false)
    }
  }

  async function descargarVacantesDesdeProduccion() {
    if (!puedeEditar || syncBusy) return
    setSyncBusy(true)
    setMensaje(null)
    try {
      const r = await pullVacantesCatalogFromRemoteToLocal()
      setMensaje(r.message)
      if (r.ok) recargarCatalogo()
    } finally {
      setSyncBusy(false)
    }
  }

  function onQuitar(v: VacanteRegistro) {
    if (!puedeEditar) return
    const ok = window.confirm(
      `¿Eliminar vacante?\n\nPLANTA: ${v.planta}\nPOSICIÓN: ${v.posicion}\nSERVICIO: ${v.servicioLinea ?? '—'} (N.º ${v.rowServiceNo ?? '—'})`,
    )
    if (!ok) return
    if (editandoId === v.id) limpiarFormulario()
    if (!removeVacanteFromCatalog(v.id)) {
      setMensaje('No se pudo quitar la vacante.')
      return
    }
    setMensaje('Vacante eliminada del catálogo.')
    recargarCatalogo()
  }

  return (
    <div className="attendanceView vacantesView">
      <header className="topbar vacantesView__topbar">
        <div className="topbar__titleRow">
          <h1 className="topbar__title">Vacantes</h1>
          <p className="topbar__subtitle">
            Registre una a una o <strong>importe un CSV</strong> con{' '}
            {VACANTES_CSV_HEADERS.join(', ')}. Solo se bloquea una fila si hay un colaborador{' '}
            <strong>activo</strong> (sin fecha de baja) en esa posición. Quien ya tiene baja no impide importar la vacante.
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
                <span className="field__label">Planta (listado)</span>
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
              <label className="field">
                <span className="field__label">Servicio (listado)</span>
                <select
                  className="select"
                  value={filtroServicioLista}
                  onChange={(e) => setFiltroServicioLista(e.target.value)}
                  disabled={loading || serviciosEnCatalogo.length === 0}
                >
                  <option value="">Todos los servicios</option>
                  {serviciosEnCatalogo.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.label}
                    </option>
                  ))}
                </select>
              </label>
              {puedeEditar ? (
                <div className="field field--action">
                  <span className="field__label">Producción (Supabase)</span>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      className="btn btn--primary"
                      onClick={() => void subirVacantesAProduccion()}
                      disabled={loading || syncBusy || catalogoVacantes.length === 0}
                      title="Sube el catálogo de este navegador a la base de datos compartida"
                    >
                      {syncBusy ? 'Sincronizando…' : 'Subir vacantes locales → producción'}
                    </button>
                    <button
                      type="button"
                      className="btn"
                      onClick={() => void descargarVacantesDesdeProduccion()}
                      disabled={loading || syncBusy}
                      title="Reemplaza el catálogo local con el de producción"
                    >
                      Cargar desde producción
                    </button>
                  </div>
                  <p className="mt-1 max-w-xl text-[11px] leading-snug text-slate-600">
                    Local: {catalogoVacantes.length} vacante(s). Use «Subir» después de registrar o importar CSV en este
                    equipo. Requiere migración <strong>012_cuadricula_vacantes_catalog</strong> en Supabase.
                  </p>
                </div>
              ) : null}
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
                  <label className="mt-2 flex max-w-xl cursor-pointer items-start gap-2 text-[11px] font-medium leading-snug text-slate-700">
                    <input
                      type="checkbox"
                      className="mt-0.5"
                      checked={csvReemplazarCatalogo}
                      onChange={(e) => setCsvReemplazarCatalogo(e.target.checked)}
                    />
                    <span>
                      <strong>Reemplazar catálogo completo</strong> con este CSV (borra vacantes anteriores en este
                      navegador). Si no marca, solo agrega o actualiza filas del archivo.
                    </span>
                  </label>
                </div>
              ) : null}
            </div>
          </div>
        </div>

        {puedeEditar ? (
          <form className="card mb-4 space-y-3" onSubmit={onGuardarFormulario}>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-sm font-bold uppercase text-slate-900">
                {editandoId ? 'Editar vacante' : 'Agregar vacante'}
              </h2>
              {editandoId ? (
                <button type="button" className="btn btn--linkish" onClick={limpiarFormulario}>
                  Cancelar edición
                </button>
              ) : null}
            </div>

            {!editandoId ? (
              <fieldset className="flex flex-wrap gap-4 border-0 p-0">
                <legend className="sr-only">Modo de alta</legend>
                <label className="flex cursor-pointer items-center gap-2 text-xs font-semibold uppercase text-slate-700">
                  <input
                    type="radio"
                    name="modo-alta-vacante"
                    checked={modoAlta === 'slot'}
                    onChange={() => setModoAlta('slot')}
                  />
                  Desde posición libre (expedientes)
                </label>
                <label className="flex cursor-pointer items-center gap-2 text-xs font-semibold uppercase text-slate-700">
                  <input
                    type="radio"
                    name="modo-alta-vacante"
                    checked={modoAlta === 'manual'}
                    onChange={() => setModoAlta('manual')}
                  />
                  Captura manual (servicio + posición)
                </label>
              </fieldset>
            ) : null}

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

              {modoAlta === 'slot' && !editandoId ? (
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
                          ? 'Sin posiciones libres — use captura manual'
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
              ) : (
                <>
                  <label className="field sm:col-span-2">
                    <span className="field__label">Servicio (catálogo) *</span>
                    <select
                      className="select"
                      required
                      value={servicioFormKey}
                      onChange={(e) => setServicioFormKey(e.target.value)}
                      disabled={loading || !plantaForm}
                    >
                      <option value="">
                        {!plantaForm ? 'Primero planta…' : 'Seleccione servicio…'}
                      </option>
                      {serviciosPlantaForm.map((s) => {
                        const key = encodeServicioCatalogKey(s.servicioLinea, s.rowServiceNo)
                        return (
                          <option key={key} value={key}>
                            {s.label}
                          </option>
                        )
                      })}
                      <option value={SERVICIO_MANUAL_KEY}>Otro — capturar nombre y N.º</option>
                    </select>
                  </label>
                  {servicioFormKey === SERVICIO_MANUAL_KEY ? (
                    <>
                      <label className="field">
                        <span className="field__label">Nombre servicio</span>
                        <input
                          className="input"
                          value={servicioLineaManual}
                          onChange={(e) => setServicioLineaManual(e.target.value)}
                          placeholder="Ej. ADMINISTRACIÓN"
                        />
                      </label>
                      <label className="field">
                        <span className="field__label">N.º servicio</span>
                        <input
                          className="input"
                          value={rowServiceNoManual}
                          onChange={(e) => setRowServiceNoManual(e.target.value)}
                          placeholder="Ej. 12"
                        />
                      </label>
                    </>
                  ) : null}
                  <label className="field">
                    <span className="field__label">Posición *</span>
                    <input
                      className="input mono"
                      required
                      value={posicionManual}
                      onChange={(e) => setPosicionManual(e.target.value)}
                      placeholder="Ej. 3"
                      disabled={loading || !plantaForm}
                    />
                  </label>
                </>
              )}

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

            {modoAlta === 'slot' && !editandoId && datosAuto ? (
              <div
                className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-800"
                aria-live="polite"
              >
                <strong>Automático:</strong> SERVICIO {datosAuto.servicioLinea || '—'} · NO. SERVICIO{' '}
                {datosAuto.rowServiceNo || '—'} · PLANTA {datosAuto.planta} · POSICIÓN {datosAuto.posicion}
                {datosAuto.puestoSugerido ? ` · PUESTO ${datosAuto.puestoSugerido}` : ''}
              </div>
            ) : null}

            {modoAlta === 'slot' && !editandoId && plantaForm && posicionesLibres.length === 0 ? (
              <p className="text-xs font-medium text-amber-900">
                No hay posiciones libres detectadas en expedientes. Use <strong>captura manual</strong> o importe CSV.
              </p>
            ) : null}

            <div className="flex flex-wrap gap-2">
              <button
                type="submit"
                className="btn btn--primary"
                disabled={
                  loading ||
                  !plantaForm ||
                  (editandoId
                    ? !posicionManual.trim()
                    : modoAlta === 'slot'
                      ? !slotFormKey
                      : !posicionManual.trim() || !servicioFormKey)
                }
              >
                {editandoId ? 'Guardar cambios' : 'Agregar vacante'}
              </button>
              {editandoVacante ? (
                <span className="self-center text-xs text-slate-600">
                  Editando: {editandoVacante.posicion} · {editandoVacante.servicioLinea ?? '—'}
                </span>
              ) : null}
            </div>
          </form>
        ) : (
          <p className="topbar__readonlyBanner" role="status">
            <strong>Solo lectura.</strong> No puede registrar ni quitar vacantes.
          </p>
        )}

        {mensaje ? <p className="persistRow__flash">{mensaje}</p> : null}

        <p className="hint">
          CSV: {VACANTES_CSV_HEADERS.join('; ')} (separador ; , o tab). SERVICIO y NO. SERVICIO deben coincidir
          con el catálogo en esa planta (sin adivinar entre Administración y Comercial). Asistencia usa:{' '}
          {ATTENDANCE_GRID_ID_HEADERS.slice(0, 8).join(' · ')}.
        </p>
      </header>

      <div className="sheetWrap vacantesView__sheetWrap">
        <p className="vacantesView__count hint">
          Mostrando <strong>{filasLista.length}</strong> vacante(s)
          {catalogoVacantes.length !== filasLista.length
            ? ` de ${catalogoVacantes.length} en catálogo (filtros activos)`
            : ''}
          . Desplácese en la tabla para ver todas.
        </p>
        {filasLista.length === 0 ? (
          <p className="hint" style={{ padding: '1rem' }}>
            {filtroPlantaLista || filtroServicioLista
              ? `No hay vacantes con los filtros actuales${filtroPlantaLista ? ` (planta «${filtroPlantaLista}»)` : ''}${filtroServicioLista ? ' (servicio seleccionado)' : ''}.`
              : 'No hay vacantes en el catálogo.'}
          </p>
        ) : (
          <table className="sheet vacantesView__sheet" aria-label="Catálogo de vacantes">
            <thead className="vacantesView__thead">
              <tr>
                <th className="th">SERVICIO</th>
                <th className="th mono">NO. SERVICIO</th>
                <th className="th">PLANTA</th>
                <th className="th">POSICION</th>
                <th className="th">PUESTO</th>
                <th className="th">NOTAS</th>
                <th className="th">ESTADO</th>
                {puedeEditar ? <th className="th">Acciones</th> : null}
              </tr>
            </thead>
            <tbody>
              {filasLista.map((v) => {
                const ocupada = slotOcupadoPorActivo(v)
                return (
                  <tr key={v.id} className="tr" data-vacant="true">
                    <td className="td">{v.servicioLinea ?? '—'}</td>
                    <td className="td mono">{v.rowServiceNo ?? '—'}</td>
                    <td className="td">{v.planta}</td>
                    <td className="td mono font-semibold">{v.posicion}</td>
                    <td className="td">{v.puesto ?? '—'}</td>
                    <td className="td text-xs">{v.notas ?? '—'}</td>
                    <td className="td text-xs">
                      {ocupada ? (
                        <span className="vacantesView__badge vacantesView__badge--ocupada">Activo en posición</span>
                      ) : (
                        <span className="vacantesView__badge vacantesView__badge--libre">Libre</span>
                      )}
                    </td>
                    {puedeEditar ? (
                      <td className="td">
                        <div className="flex flex-wrap items-center gap-2">
                          <button
                            type="button"
                            className="btn btn--linkish"
                            onClick={() => iniciarEdicion(v)}
                            disabled={editandoId === v.id}
                          >
                            {editandoId === v.id ? 'Editando…' : 'Editar'}
                          </button>
                          <button type="button" className="btn btn--linkish text-red-800" onClick={() => onQuitar(v)}>
                            Eliminar
                          </button>
                        </div>
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