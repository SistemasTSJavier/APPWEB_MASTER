import { useState, useEffect, useCallback } from 'react'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import { useAuth } from '../context/AuthContext'
import { API } from '../api'

interface RegistroCompleto {
  id: number
  folio: string | null
  oficial_nombre: string | null
  curp: string | null
  fecha_ingreso: string | null
  fecha_inicio_efectiva: string | null
  servicio_actual_nombre: string | null
  servicio_nuevo_nombre: string | null
  puesto_actual_nombre: string | null
  puesto_nuevo_nombre: string | null
  sueldo_actual: number | null
  sueldo_nuevo: number | null
  motivo: string | null
  creado_por: string | null
  solicitado_por: string | null
  fecha_llenado: string | null
  fecha_registro: string | null
  firma_conformidad_at: string | null
  firma_rh_at: string | null
  firma_gerente_at: string | null
  firma_control_at: string | null
  [key: string]: unknown
}

export interface ResumenRegistros {
  pendientes: number
  aprobados: number
  registrosPendientes: { id: number; folio: string | null; oficial_nombre: string | null; fecha_hora: string | null }[]
  registrosAprobados: { id: number; folio: string | null; oficial_nombre: string | null; fecha_hora: string | null }[]
}

interface PanelLateralProps {
  registroIdActual: number | null
  onSeleccionarRegistro: (id: number) => void
  onNuevoRegistro: () => void
  refreshTrigger?: number
}

const FIRMAS_PREVIEW = [
  { key: 'conformidad', label: 'Firma de conformidad', colAt: 'firma_conformidad_at' },
  { key: 'rh', label: 'Gerente RH', colAt: 'firma_rh_at' },
  { key: 'gerente', label: 'Gerente de Operaciones', colAt: 'firma_gerente_at' },
  { key: 'control', label: 'Centro de Control', colAt: 'firma_control_at' },
] as const

const EMAILS_PUEDEN_CANCELAR = ['sistemas@tacticalsupport.com.mx', 'gterh@tacticalsupport.com.mx']

export function PanelLateral({ registroIdActual, onSeleccionarRegistro, onNuevoRegistro, refreshTrigger = 0 }: PanelLateralProps) {
  const { authHeaders, user } = useAuth()
  const [resumen, setResumen] = useState<ResumenRegistros | null>(null)
  const [cargando, setCargando] = useState(true)
  const [errorApi, setErrorApi] = useState<string | null>(null)
  const [previewRegistro, setPreviewRegistro] = useState<RegistroCompleto | null>(null)
  const [cargandoPreview, setCargandoPreview] = useState(false)
  const [menuAbiertoId, setMenuAbiertoId] = useState<number | null>(null)
  const [cancelandoId, setCancelandoId] = useState<number | null>(null)

  const puedeCancelar = !!user?.email && EMAILS_PUEDEN_CANCELAR.includes(user.email.trim().toLowerCase())

  const abrirPreview = useCallback((id: number, e: React.MouseEvent) => {
    e.stopPropagation()
    setCargandoPreview(true)
    setPreviewRegistro(null)
    fetch(`${API}/api/moper/${id}`, { headers: authHeaders() })
      .then((r) => r.json())
      .then((data) => setPreviewRegistro(data))
      .catch(() => setPreviewRegistro(null))
      .finally(() => setCargandoPreview(false))
  }, [authHeaders])

  const cancelarRegistro = useCallback((id: number, e: React.MouseEvent) => {
    e.stopPropagation()
    if (!puedeCancelar) return
    setMenuAbiertoId(null)
    setCancelandoId(id)
    fetch(`${API}/api/moper/${id}/cancelar`, {
      method: 'PATCH',
      headers: authHeaders(),
    })
      .then((r) => r.json().then((d) => ({ ok: r.ok, data: d })))
      .then(({ ok, data }) => {
        if (ok) cargar()
        else setErrorApi(data.error || 'Error al cancelar')
      })
      .catch(() => setErrorApi('Error de conexión'))
      .finally(() => setCancelandoId(null))
  }, [authHeaders, puedeCancelar])

  const cargar = () => {
    setCargando(true)
    setErrorApi(null)
    fetch(`${API}/api/moper`, { headers: authHeaders() })
      .then((r) => r.json().then((d) => ({ ok: r.ok, data: d })))
      .then(({ ok, data }) => {
        if (ok) setResumen(data)
        else {
          setResumen(null)
          setErrorApi(data.detail ? `${data.error || 'Error'}: ${data.detail}` : (data.error || 'Error al cargar'))
        }
      })
      .catch(() => {
        setResumen(null)
        setErrorApi('Error de conexión')
      })
      .finally(() => setCargando(false))
  }

  useEffect(() => {
    cargar()
    let id: ReturnType<typeof setInterval> | null = null
    const tick = () => {
      if (document.hidden) return
      cargar()
    }
    const onVisibility = () => {
      if (id) clearInterval(id)
      id = null
      if (!document.hidden) {
        cargar()
        id = setInterval(tick, 20_000)
      }
    }
    if (!document.hidden) id = setInterval(tick, 20_000)
    document.addEventListener('visibilitychange', onVisibility)
    return () => {
      document.removeEventListener('visibilitychange', onVisibility)
      if (id) clearInterval(id)
    }
  }, [])

  useEffect(() => {
    if (refreshTrigger > 0) cargar()
  }, [refreshTrigger])

  useEffect(() => {
    if (menuAbiertoId == null) return
    const cerrar = () => setMenuAbiertoId(null)
    document.addEventListener('click', cerrar)
    return () => document.removeEventListener('click', cerrar)
  }, [menuAbiertoId])

  const pendientes = resumen?.pendientes ?? 0
  const aprobados = resumen?.aprobados ?? 0
  const listPend = resumen?.registrosPendientes ?? []
  const listAprob = resumen?.registrosAprobados ?? []

  return (
    <aside className="w-full md:w-72 shrink-0 border-b-2 md:border-b-0 md:border-r-2 border-oxford-200 bg-oxford-50/50 flex flex-col max-h-[40vh] md:max-h-none overflow-hidden">
      <div className="p-2 sm:p-3 border-b border-oxford-200 shrink-0">
        <button
          type="button"
          onClick={onNuevoRegistro}
          className="w-full py-3 px-3 min-h-[44px] bg-black text-white rounded text-sm font-medium hover:bg-oxford-800 touch-manipulation"
        >
          Nuevo registro
        </button>
      </div>

      {cargando ? (
        <div className="p-3 text-sm text-oxford-500">Cargando...</div>
      ) : errorApi ? (
        <div className="p-3 text-sm text-red-600 bg-red-50 border border-red-200 rounded">
          {errorApi}
        </div>
      ) : (
        <>
          {/* Aprobaciones pendientes */}
          <div className="p-3 border-b border-oxford-200">
            <div className="flex items-center justify-between gap-2 mb-2">
              <span className="text-sm font-bold text-oxford-800">Aprobaciones pendientes</span>
              {pendientes > 0 && (
                <span className="flex items-center justify-center min-w-[1.25rem] h-5 px-1.5 rounded-full bg-amber-500 text-white text-xs font-bold">
                  {pendientes}
                </span>
              )}
            </div>
            {pendientes === 0 ? (
              <p className="text-xs text-oxford-500">Ninguna</p>
            ) : (
              <ul className="space-y-1 max-h-40 overflow-y-auto">
                {listPend.map((r) => (
                  <li key={r.id} className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => onSeleccionarRegistro(r.id)}
                      className={`flex-1 min-w-0 text-left text-xs py-1.5 px-2 rounded border truncate block ${
                        registroIdActual === r.id
                          ? 'bg-oxford-200 border-oxford-400 font-medium'
                          : 'bg-white border-oxford-200 hover:bg-oxford-100'
                      }`}
                      title={`${r.oficial_nombre || 'Sin nombre'} – ${r.folio || 'Sin folio'}`}
                    >
                      <span className="font-mono text-oxford-600">{r.folio || `#${r.id}`}</span>
                      <span className="ml-1 truncate">{r.oficial_nombre || '—'}</span>
                    </button>
                    <button
                      type="button"
                      onClick={(e) => abrirPreview(r.id, e)}
                      className="shrink-0 py-1 px-1.5 text-xs border border-oxford-300 rounded text-oxford-600 hover:bg-oxford-100"
                      title="Vista previa completa"
                    >
                      Ver
                    </button>
                    {puedeCancelar && (
                      <div className="relative shrink-0">
                        <button
                          type="button"
                          onClick={(e) => { e.stopPropagation(); setMenuAbiertoId(menuAbiertoId === r.id ? null : r.id) }}
                          className="py-1 px-1.5 text-xs border border-oxford-300 rounded text-oxford-600 hover:bg-oxford-100"
                          title="Más opciones"
                          disabled={cancelandoId === r.id}
                        >
                          ⋮
                        </button>
                        {menuAbiertoId === r.id && (
                          <div className="absolute right-0 top-full mt-0.5 z-10 bg-white border border-oxford-200 rounded shadow-lg py-1 min-w-[140px]">
                            <button
                              type="button"
                              onClick={(e) => cancelarRegistro(r.id, e)}
                              className="w-full text-left text-xs py-1.5 px-2 text-red-700 hover:bg-red-50"
                            >
                              Pasar a Cancelado
                            </button>
                          </div>
                        )}
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* Registros aprobados */}
          <div className="p-3 flex-1 flex flex-col min-h-0">
            <div className="flex items-center justify-between gap-2 mb-2">
              <span className="text-sm font-bold text-oxford-800">Registros aprobados</span>
              {aprobados > 0 && (
                <span className="flex items-center justify-center min-w-[1.25rem] h-5 px-1.5 rounded-full bg-green-600 text-white text-xs font-bold">
                  {aprobados}
                </span>
              )}
            </div>
            {aprobados === 0 ? (
              <p className="text-xs text-oxford-500">Ninguno</p>
            ) : (
              <ul className="space-y-1 flex-1 overflow-y-auto min-h-0">
                {listAprob.map((r) => (
                  <li key={r.id} className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => onSeleccionarRegistro(r.id)}
                      className={`flex-1 min-w-0 text-left text-xs py-1.5 px-2 rounded border truncate block ${
                        registroIdActual === r.id
                          ? 'bg-green-100 border-green-400 font-medium'
                          : 'bg-white border-oxford-200 hover:bg-oxford-100'
                      }`}
                      title={`${r.oficial_nombre || 'Sin nombre'} – ${r.folio || ''}`}
                    >
                      <span className="font-mono text-oxford-600">{r.folio || `#${r.id}`}</span>
                      <span className="ml-1 truncate">{r.oficial_nombre || '—'}</span>
                      {r.fecha_hora && (
                        <span className="block text-oxford-500 mt-0.5">
                          {format(new Date(r.fecha_hora), 'd MMM yyyy', { locale: es })}
                        </span>
                      )}
                    </button>
                    {puedeCancelar && (
                      <div className="relative shrink-0">
                        <button
                          type="button"
                          onClick={(e) => { e.stopPropagation(); setMenuAbiertoId(menuAbiertoId === r.id ? null : r.id) }}
                          className="py-1 px-1.5 text-xs border border-oxford-300 rounded text-oxford-600 hover:bg-oxford-100"
                          title="Más opciones"
                          disabled={cancelandoId === r.id}
                        >
                          ⋮
                        </button>
                        {menuAbiertoId === r.id && (
                          <div className="absolute right-0 top-full mt-0.5 z-10 bg-white border border-oxford-200 rounded shadow-lg py-1 min-w-[140px]">
                            <button
                              type="button"
                              onClick={(e) => cancelarRegistro(r.id, e)}
                              className="w-full text-left text-xs py-1.5 px-2 text-red-700 hover:bg-red-50"
                            >
                              Pasar a Cancelado
                            </button>
                          </div>
                        )}
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </>
      )}

      {/* Modal vista previa completa del registro pendiente */}
      {(previewRegistro !== null || cargandoPreview) && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          onClick={() => !cargandoPreview && setPreviewRegistro(null)}
        >
          <div
            className="bg-white rounded-xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-hidden flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-4 border-b border-oxford-200 flex items-center justify-between shrink-0">
              <h3 className="font-bold text-oxford-900">Vista previa – Pendiente de aprobar</h3>
              <button
                type="button"
                onClick={() => setPreviewRegistro(null)}
                className="px-2 py-1 text-sm border border-oxford-300 rounded text-oxford-700 hover:bg-oxford-100"
              >
                Cerrar
              </button>
            </div>
            <div className="p-4 overflow-y-auto flex-1 text-sm space-y-4">
              {cargandoPreview ? (
                <p className="text-oxford-500">Cargando...</p>
              ) : previewRegistro ? (
                <>
                  <div className="grid grid-cols-2 gap-2">
                    <p><span className="font-medium text-oxford-600">Folio:</span> {previewRegistro.folio || '—'}</p>
                    <p><span className="font-medium text-oxford-600">Oficial:</span> {previewRegistro.oficial_nombre || '—'}</p>
                    <p><span className="font-medium text-oxford-600">CURP:</span> {previewRegistro.curp || '—'}</p>
                    <p><span className="font-medium text-oxford-600">Fecha ingreso:</span> {previewRegistro.fecha_ingreso || '—'}</p>
                    <p><span className="font-medium text-oxford-600">Fecha inicio efectiva:</span> {previewRegistro.fecha_inicio_efectiva || '—'}</p>
                    <p><span className="font-medium text-oxford-600">Fecha llenado:</span> {previewRegistro.fecha_llenado || '—'}</p>
                    <p><span className="font-medium text-oxford-600">Fecha registro:</span> {previewRegistro.fecha_registro || '—'}</p>
                    <p><span className="font-medium text-oxford-600">Creado por:</span> {previewRegistro.creado_por || '—'}</p>
                    <p><span className="font-medium text-oxford-600">Solicitado por:</span> {previewRegistro.solicitado_por || '—'}</p>
                  </div>
                  <div>
                    <p className="font-medium text-oxford-600 mb-1">Comparativa</p>
                    <table className="w-full border border-oxford-200 text-xs">
                      <thead>
                        <tr className="bg-oxford-100">
                          <th className="border border-oxford-200 px-2 py-1 text-left">Campo</th>
                          <th className="border border-oxford-200 px-2 py-1 text-left">Actual</th>
                          <th className="border border-oxford-200 px-2 py-1 text-left">Nuevo</th>
                        </tr>
                      </thead>
                      <tbody>
                        <tr><td className="border px-2 py-1">Servicio</td><td className="border px-2 py-1">{previewRegistro.servicio_actual_nombre || '—'}</td><td className="border px-2 py-1">{previewRegistro.servicio_nuevo_nombre || '—'}</td></tr>
                        <tr><td className="border px-2 py-1">Puesto</td><td className="border px-2 py-1">{previewRegistro.puesto_actual_nombre || '—'}</td><td className="border px-2 py-1">{previewRegistro.puesto_nuevo_nombre || '—'}</td></tr>
                        <tr><td className="border px-2 py-1">Sueldo</td><td className="border px-2 py-1">{previewRegistro.sueldo_actual != null ? `$ ${Number(previewRegistro.sueldo_actual).toLocaleString('es-MX')}` : '—'}</td><td className="border px-2 py-1">{previewRegistro.sueldo_nuevo != null ? `$ ${Number(previewRegistro.sueldo_nuevo).toLocaleString('es-MX')}` : '—'}</td></tr>
                        <tr><td className="border px-2 py-1">Motivo</td><td className="border px-2 py-1">—</td><td className="border px-2 py-1">{previewRegistro.motivo || '—'}</td></tr>
                      </tbody>
                    </table>
                  </div>
                  <div>
                    <p className="font-medium text-oxford-600 mb-2">Estado de firmas</p>
                    <ul className="space-y-1">
                      {FIRMAS_PREVIEW.map(({ label, colAt }) => {
                        const fecha = previewRegistro[colAt as keyof RegistroCompleto] as string | null
                        const firmado = !!fecha
                        return (
                          <li key={colAt} className="flex items-center justify-between py-1 border-b border-oxford-100 last:border-0">
                            <span>{label}</span>
                            <span className={firmado ? 'text-green-700 font-medium' : 'text-amber-600'}>{firmado ? `Firmado ${format(new Date(fecha), 'd MMM yyyy, HH:mm', { locale: es })}` : 'Pendiente'}</span>
                          </li>
                        )
                      })}
                    </ul>
                  </div>
                  <div className="pt-2 flex justify-end">
                    <button
                      type="button"
                      onClick={() => { onSeleccionarRegistro(previewRegistro.id); setPreviewRegistro(null) }}
                      className="px-4 py-2 bg-black text-white rounded text-sm font-medium hover:bg-oxford-800"
                    >
                      Abrir registro
                    </button>
                  </div>
                </>
              ) : (
                <p className="text-red-600">No se pudo cargar el registro.</p>
              )}
            </div>
          </div>
        </div>
      )}
    </aside>
  )
}
