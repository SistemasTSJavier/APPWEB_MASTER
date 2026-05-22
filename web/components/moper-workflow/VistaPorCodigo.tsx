import { useEffect, useCallback } from 'react'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import { useMoperWorkflow } from './MoperWorkflowContext'
import { FirmasWorkflow } from './FirmasWorkflow'
import { moperFetch } from '@/lib/moper-fetch'
import { buildMailtoBody } from './build-mailto'

export function VistaPorCodigo() {
  const { accesoPorCodigo, clearCodigoAcceso, setRegistroPorCodigo } = useMoperWorkflow()
  const { codigo, registro } = accesoPorCodigo ?? { codigo: '', registro: null }

  const refetch = useCallback(() => {
    if (!codigo) return
    moperFetch(`/api/moper/codigo/${encodeURIComponent(codigo)}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.id) setRegistroPorCodigo(data)
      })
      .catch(() => {})
  }, [codigo, setRegistroPorCodigo])

  useEffect(() => {
    refetch()
  }, [refetch])

  if (!registro) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-oxford-50">
        <p className="text-oxford-600">Cargando...</p>
      </div>
    )
  }

  return (
    <div className="w-full flex flex-col rounded-xl border-2 border-oxford-200 bg-white overflow-hidden">
      <header className="border-b-2 border-oxford-200 bg-oxford-50 px-4 py-3 flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">MOPER</p>
          <span className="font-bold text-oxford-800 uppercase">Firma del oficial por codigo</span>
        </div>
        <button
          type="button"
          onClick={clearCodigoAcceso}
          className="btn-secondary text-xs uppercase"
        >
          Salir
        </button>
      </header>
      <main className="flex-1 max-w-2xl mx-auto w-full px-4 py-6">
        <h1 className="text-center font-bold text-oxford-800 text-lg mb-4">Resumen del movimiento</h1>
        <div className="border-2 border-oxford-300 rounded-lg p-4 mb-4 bg-oxford-50/30 space-y-2">
          <p><span className="text-oxford-600 font-medium">Folio:</span> {registro.folio || '—'}</p>
          <p><span className="text-oxford-600 font-medium">Oficial:</span> {registro.oficial_nombre || '—'}</p>
          <p><span className="text-oxford-600 font-medium">CURP:</span> {registro.curp || '—'}</p>
          <p><span className="text-oxford-600 font-medium">Servicio actual → nuevo:</span> {registro.servicio_actual_nombre || '—'} → {registro.servicio_nuevo_nombre || '—'}</p>
          <p><span className="text-oxford-600 font-medium">Puesto actual → nuevo:</span> {registro.puesto_actual_nombre || '—'} → {registro.puesto_nuevo_nombre || '—'}</p>
          <p><span className="text-oxford-600 font-medium">Sueldo actual → nuevo:</span> {registro.sueldo_actual != null ? `$ ${Number(registro.sueldo_actual).toLocaleString('es-MX')}` : '—'} → {registro.sueldo_nuevo != null ? `$ ${Number(registro.sueldo_nuevo).toLocaleString('es-MX')}` : '—'}</p>
          <p><span className="text-oxford-600 font-medium">Motivo:</span> {registro.motivo || '—'}</p>
          {registro.created_at && (
            <p><span className="text-oxford-600 font-medium">Fecha de llenado:</span> {format(new Date(registro.created_at), "d 'de' MMMM yyyy", { locale: es })}</p>
          )}
        </div>
        <div className="mb-4">
          <a
            href={`mailto:?subject=${encodeURIComponent(`MOPER - ${registro.folio || 'Movimiento de Personal'}`)}&body=${encodeURIComponent(buildMailtoBody(registro))}`}
            className="inline-flex items-center justify-center px-4 py-2 border-2 border-oxford-400 rounded font-medium text-oxford-800 hover:bg-oxford-100"
          >
            Enviar por correo
          </a>
        </div>
        <FirmasWorkflow
          registroId={registro.id}
          registro={registro as any}
          onFirmaRegistrada={refetch}
          modoCodigo
          codigoAcceso={codigo}
        />
      </main>
    </div>
  )
}
