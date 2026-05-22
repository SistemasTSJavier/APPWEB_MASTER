import { useState, useEffect, useCallback } from 'react'
import { Header } from './components/Header'
import { PanelLateral } from './components/PanelLateral'
import { FormularioMoper } from './components/FormularioMoper'
import { FirmasWorkflow } from './components/FirmasWorkflow'
import { FooterLegal } from './components/FooterLegal'
import { LoginPanel } from './components/LoginPanel'
import { VistaPorCodigo } from './components/VistaPorCodigo'
import { useAuth } from './context/AuthContext'
import { API } from './api'
import { generarPDF, loadLogoAsDataUrl, loadPlantillaAsDataUrl } from './utils/pdf'

export interface RegistroMoper {
  id?: number
  folio: string
  oficial_nombre?: string
  curp: string
  fecha_ingreso: string | null
  fecha_inicio_efectiva: string
  sueldo_actual: number | null
  sueldo_nuevo: number
  motivo: string
  servicio_actual_nombre?: string
  servicio_nuevo_nombre?: string
  puesto_actual_nombre?: string
  puesto_nuevo_nombre?: string
  creado_por?: string | null
  solicitado_por?: string | null
  fecha_llenado?: string | null
  fecha_registro?: string | null
  created_at?: string | null
  firma_conformidad_at?: string | null
  firma_conformidad_nombre?: string | null
  firma_conformidad_imagen?: string | null
  firma_rh_at?: string | null
  firma_rh_nombre?: string | null
  firma_rh_imagen?: string | null
  firma_gerente_at?: string | null
  firma_gerente_nombre?: string | null
  firma_gerente_imagen?: string | null
  firma_control_at?: string | null
  firma_control_nombre?: string | null
  firma_control_imagen?: string | null
  completado?: boolean
  codigo_acceso?: string | null
}

/** Cuerpo del correo prellenado: fecha de llenado, oficial, servicio, puesto, sueldo, motivo, quien solicita. */
export function buildMailtoBody(registro: any): string {
  const appUrl = typeof window !== 'undefined' ? window.location.origin + window.location.pathname : ''
  const line = (label: string, value: string | number | null | undefined) =>
    value != null && String(value).trim() !== '' ? `${label}: ${String(value).trim()}` : null
  const sueldoActual = registro.sueldo_actual != null ? `$ ${Number(registro.sueldo_actual).toLocaleString('es-MX')}` : '-'
  const sueldoNuevo = registro.sueldo_nuevo != null ? `$ ${Number(registro.sueldo_nuevo).toLocaleString('es-MX')}` : '-'
  const lines = [
    'Movimiento de Personal (MOPER)',
    '',
    line('Folio', registro.folio),
    line('Fecha de llenado', registro.fecha_llenado || registro.created_at || null),
    line('Nombre del oficial', registro.oficial_nombre),
    line('Servicio', registro.servicio_actual_nombre && registro.servicio_nuevo_nombre ? `${registro.servicio_actual_nombre} → ${registro.servicio_nuevo_nombre}` : (registro.servicio_nuevo_nombre || registro.servicio_actual_nombre || null)),
    line('Puesto', registro.puesto_actual_nombre && registro.puesto_nuevo_nombre ? `${registro.puesto_actual_nombre} → ${registro.puesto_nuevo_nombre}` : (registro.puesto_nuevo_nombre || registro.puesto_actual_nombre || null)),
    line('Sueldo', sueldoActual !== '-' || sueldoNuevo !== '-' ? `${sueldoActual} → ${sueldoNuevo}` : null),
    line('Motivo', registro.motivo),
    line('Quien solicita', registro.solicitado_por),
    registro.codigo_acceso ? `\nCódigo de acceso para firma del oficial: ${registro.codigo_acceso}` : null,
    appUrl ? `\nApp MOPER: ${appUrl}` : null,
  ].filter(Boolean)
  return lines.join('\r\n')
}

export default function App() {
  const { user, accesoPorCodigo, loading, authHeaders } = useAuth()
  const [folioPreview, setFolioPreview] = useState('SPT/No. 0280/MOP')
  const [registroId, setRegistroId] = useState<number | null>(null)
  const [registroCompleto, setRegistroCompleto] = useState<RegistroMoper | null>(null)
  const [refreshPanel, setRefreshPanel] = useState(0)

  useEffect(() => {
    if (!user) return
    fetch(`${API}/api/folios/preview`, { headers: authHeaders() })
      .then((r) => r.json())
      .then((d) => d.folio && setFolioPreview(d.folio))
      .catch(() => {})
  }, [user, authHeaders])

  const cargarRegistro = useCallback((id: number) => {
    fetch(`${API}/api/moper/${id}`, { headers: authHeaders() })
      .then((r) => r.json())
      .then((r) => {
        setRegistroCompleto(r)
        if (r.folio) setFolioPreview(r.folio)
      })
      .catch(() => setRegistroCompleto(null))
  }, [authHeaders])

  const onGuardar = useCallback((id: number, folio: string | null) => {
    setRegistroId(id)
    if (folio) setFolioPreview(folio)
    cargarRegistro(id)
    setRefreshPanel((k) => k + 1)
  }, [cargarRegistro])

  const onFirmaRegistrada = useCallback(() => {
    setRefreshPanel((k) => k + 1)
    if (registroId != null) cargarRegistro(registroId)
  }, [registroId, cargarRegistro])

  const onSeleccionarRegistro = useCallback((id: number) => {
    setRegistroId(id)
    cargarRegistro(id)
  }, [cargarRegistro])

  const onGenerarPDF = useCallback(() => {
    if (!registroCompleto) return
    Promise.all([loadLogoAsDataUrl(), loadPlantillaAsDataUrl()]).then(([logo, plantilla]) => {
      if (!plantilla && typeof console !== 'undefined' && console.warn) {
        console.warn('PDF: plantilla.png no se cargó. Colóquela en client/public/plantilla.png y recargue.')
      }
      generarPDF(registroCompleto, logo, plantilla)
    })
  }, [registroCompleto])

  const actualizarFolioPreview = useCallback(() => {
    fetch(`${API}/api/folios/preview`, { headers: authHeaders() })
      .then((r) => r.json())
      .then((d) => d.folio && setFolioPreview(d.folio))
      .catch(() => {})
  }, [authHeaders])

  const ajustarFolio = useCallback(
    (delta: number) => {
      fetch(`${API}/api/folios/sequence`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body: JSON.stringify({ delta }),
      })
        .then((res) => res.json().then((d) => ({ ok: res.ok, data: d })))
        .then(({ ok, data }) => {
          if (data.folio) setFolioPreview(data.folio)
          if (!ok) throw new Error(data.error || 'Error')
        })
        .catch((e) => alert(e instanceof Error ? e.message : 'Error al ajustar folio'))
    },
    [authHeaders]
  )

  const onNuevoRegistro = useCallback(() => {
    setRegistroId(null)
    setRegistroCompleto(null)
    actualizarFolioPreview()
  }, [actualizarFolioPreview])

  const mailtoHref = useCallback((registro: RegistroMoper) => {
    const subject = `MOPER - ${registro.folio || 'Movimiento de Personal'}`
    const body = buildMailtoBody(registro)
    return `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`
  }, [])

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-oxford-50">
        <p className="text-oxford-600">Cargando...</p>
      </div>
    )
  }
  if (accesoPorCodigo) {
    return <VistaPorCodigo />
  }
  if (!user) {
    return <LoginPanel />
  }

  return (
    <div className="min-h-screen flex flex-col bg-white">
      <Header />
      <div className="flex-1 flex flex-col md:flex-row min-h-0">
        <PanelLateral
          registroIdActual={registroId}
          onSeleccionarRegistro={onSeleccionarRegistro}
          onNuevoRegistro={onNuevoRegistro}
          refreshTrigger={refreshPanel}
        />
        <main className="flex-1 min-w-0 max-w-4xl mx-auto w-full px-3 sm:px-4 py-4 sm:py-6 overflow-auto">
          <p className="text-center font-bold text-oxford-800 text-base sm:text-lg mb-4 sm:mb-6">
            Movimiento de Personal (MOPER)
          </p>
          <div className="border-2 border-oxford-300 rounded-lg p-3 sm:p-4 mb-4 bg-oxford-50/30 space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-oxford-600 text-sm font-medium">Folio: </span>
            <span className="font-mono font-semibold text-black">
              {registroCompleto?.folio ?? folioPreview}
              {registroId && !registroCompleto?.folio && (
                <span className="text-oxford-500 font-normal"> (asignado al firmar conformidad)</span>
              )}
            </span>
            {(user?.rol === 'admin' || user?.rol === 'gerente') && !registroCompleto?.folio && (
              <span className="inline-flex items-center gap-0.5 ml-2">
                <button
                  type="button"
                  onClick={() => ajustarFolio(1)}
                  className="p-1.5 border-2 border-oxford-300 rounded text-oxford-800 hover:bg-oxford-100 font-bold leading-none"
                  title="Subir número del próximo folio"
                >
                  ▲
                </button>
                <button
                  type="button"
                  onClick={() => ajustarFolio(-1)}
                  className="p-1.5 border-2 border-oxford-300 rounded text-oxford-800 hover:bg-oxford-100 font-bold leading-none"
                  title="Bajar número del próximo folio"
                >
                  ▼
                </button>
              </span>
            )}
          </div>
          {registroCompleto?.codigo_acceso && (
            <div className="text-sm">
              <span className="text-oxford-600 font-medium">Código de acceso para el oficial: </span>
              <span className="font-mono font-semibold text-black">{registroCompleto.codigo_acceso}</span>
              <span className="text-oxford-500 ml-1">(compartir con quien firma conformidad)</span>
            </div>
          )}
        </div>
        <FormularioMoper
          onGuardar={onGuardar}
          registroId={registroId}
          registro={registroCompleto}
          puedeEditar={user?.rol === 'admin' || user?.rol === 'gerente'}
        />
        {registroId && (
          <>
            <FirmasWorkflow
              registroId={registroId}
              registro={registroCompleto}
              onFirmaRegistrada={onFirmaRegistrada}
            />
            {registroId && registroCompleto && (
              <div className="mt-6 flex flex-wrap gap-3 justify-end">
                <a
                  href={mailtoHref(registroCompleto)}
                  className="px-4 py-3 min-h-[44px] border-2 border-oxford-400 text-oxford-800 rounded font-medium hover:bg-oxford-100 touch-manipulation inline-flex items-center justify-center"
                >
                  Enviar por correo
                </a>
                {registroCompleto.completado && (
                  <>
                    <button
                      type="button"
                      onClick={onGenerarPDF}
                      className="px-4 py-3 min-h-[44px] bg-black text-white rounded border-2 border-black font-medium hover:bg-oxford-800 touch-manipulation"
                    >
                      Descargar PDF
                    </button>
                    <button
                      type="button"
                      onClick={onNuevoRegistro}
                      className="px-4 py-3 min-h-[44px] border-2 border-oxford-400 text-oxford-800 rounded font-medium hover:bg-oxford-100 touch-manipulation"
                    >
                      Nuevo registro
                    </button>
                  </>
                )}
              </div>
            )}
          </>
        )}
        </main>
      </div>
      <FooterLegal />
    </div>
  )
}
