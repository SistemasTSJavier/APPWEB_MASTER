import { useState, useCallback, useEffect } from 'react'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import { useAuth } from '../context/AuthContext'
import { API } from '../api'
import type { RegistroMoper } from '../App'

interface FormularioMoperProps {
  onGuardar: (id: number, folio: string | null) => void
  registroId: number | null
  registro: RegistroMoper | null
  /** Si true (admin o gerente), puede editar el registro: formulario se rellena y permite actualizar. */
  puedeEditar?: boolean
}

/** Fecha y hora local en formato para input datetime-local (yyyy-MM-ddTHH:mm) */
function fechaHoraLocal(): string {
  const d = new Date()
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

/** Formatea fecha YYYY-MM-DD para input type="date" */
function toInputDate(val: string | null | undefined): string {
  if (!val || !val.trim()) return ''
  const s = val.trim().slice(0, 10)
  return /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : ''
}

export function FormularioMoper({ onGuardar, registroId, registro, puedeEditar = false }: FormularioMoperProps) {
  const { authHeaders } = useAuth()
  const [nombreOficial, setNombreOficial] = useState('')
  const [curp, setCurp] = useState('')
  const [fechaHora, setFechaHora] = useState(() => fechaHoraLocal())
  const [fechaIngreso, setFechaIngreso] = useState('')
  const [fechaInicioEfectiva, setFechaInicioEfectiva] = useState('')
  const [servicioActual, setServicioActual] = useState('')
  const [servicioNuevo, setServicioNuevo] = useState('')
  const [puestoActual, setPuestoActual] = useState('')
  const [puestoNuevo, setPuestoNuevo] = useState('')
  const [sueldoActual, setSueldoActual] = useState<string>('')
  const [sueldoNuevo, setSueldoNuevo] = useState<string>('')
  const [motivo, setMotivo] = useState('')
  const [creadoPor, setCreadoPor] = useState('')
  const [solicitadoPor, setSolicitadoPor] = useState('')
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState('')

  const actualizarFechaHora = useCallback(() => setFechaHora(fechaHoraLocal()), [])
  useEffect(() => {
    const t = setInterval(actualizarFechaHora, 60_000)
    return () => clearInterval(t)
  }, [actualizarFechaHora])

  useEffect(() => {
    if (registro && registroId && puedeEditar) {
      setNombreOficial(registro.oficial_nombre ?? '')
      setCurp(registro.curp ?? '')
      setFechaIngreso(toInputDate(registro.fecha_ingreso))
      setFechaInicioEfectiva(toInputDate(registro.fecha_inicio_efectiva))
      setServicioActual(registro.servicio_actual_nombre ?? '')
      setServicioNuevo(registro.servicio_nuevo_nombre ?? '')
      setPuestoActual(registro.puesto_actual_nombre ?? '')
      setPuestoNuevo(registro.puesto_nuevo_nombre ?? '')
      setSueldoActual(registro.sueldo_actual != null ? String(registro.sueldo_actual) : '')
      setSueldoNuevo(registro.sueldo_nuevo != null ? String(registro.sueldo_nuevo) : '')
      setMotivo(registro.motivo ?? '')
      setCreadoPor(registro.creado_por ?? '')
      setSolicitadoPor(registro.solicitado_por ?? '')
    }
  }, [registro, registroId, puedeEditar])

  const payload = {
    oficial_nombre: nombreOficial.trim(),
    curp: curp.trim(),
    fecha_ingreso: fechaIngreso.trim() || null,
    fecha_inicio_efectiva: fechaInicioEfectiva || (() => { const d = new Date(); const p = (n: number) => String(n).padStart(2, '0'); return `${d.getFullYear()}-${p(d.getMonth()+1)}-${p(d.getDate())}`; })(),
    servicio_actual_nombre: servicioActual.trim(),
    servicio_nuevo_nombre: servicioNuevo.trim(),
    puesto_actual_nombre: puestoActual.trim(),
    puesto_nuevo_nombre: puestoNuevo.trim(),
    sueldo_actual: sueldoActual ? Number(sueldoActual) : null,
    sueldo_nuevo: Number(sueldoNuevo) || 0,
    motivo: motivo.trim(),
    creado_por: creadoPor.trim() || undefined,
    solicitado_por: solicitadoPor.trim() || undefined,
  }

  const guardar = async () => {
    if (!nombreOficial.trim()) {
      setError('Indique el nombre del oficial.')
      return
    }
    if (!fechaInicioEfectiva) {
      setError('Indique la fecha de inicio efectiva.')
      return
    }
    if (!servicioNuevo.trim() || !puestoNuevo.trim()) {
      setError('Complete servicio y puesto nuevos.')
      return
    }
    setError('')
    setGuardando(true)
    try {
      if (registroId && puedeEditar) {
        const res = await fetch(`${API}/api/moper/${registroId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json', ...authHeaders() },
          body: JSON.stringify(payload),
        })
        const data = await res.json()
        if (!res.ok) {
          const msg = data.detail ? `${data.error || 'Error al actualizar'}: ${data.detail}` : (data.error || 'Error al actualizar')
          throw new Error(msg)
        }
        onGuardar(registroId, registro?.folio ?? data.folio ?? null)
      } else {
        const res = await fetch(`${API}/api/moper`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', ...authHeaders() },
          body: JSON.stringify(payload),
        })
        const data = await res.json()
        if (!res.ok) {
          const msg = data.detail ? `${data.error || 'Error al guardar'}: ${data.detail}` : (data.error || 'Error al guardar')
          throw new Error(msg)
        }
        onGuardar(data.id, data.folio ?? null)
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al guardar')
    } finally {
      setGuardando(false)
    }
  }

  return (
    <div id="formulario-moper" className="space-y-4 sm:space-y-6">
      {/* Sección A: Datos Generales */}
      <section className="border-2 border-oxford-300 rounded-lg p-3 sm:p-4 bg-white">
        <h2 className="text-sm sm:text-base font-bold text-black border-b border-oxford-300 pb-2 mb-3 sm:mb-4">A. Datos Generales</h2>
        {(registro && registroId && !puedeEditar) && (registro?.creado_por != null || registro?.solicitado_por != null || registro?.created_at) && (
          <div className="grid gap-3 grid-cols-2 sm:grid-cols-3 mb-4 p-3 bg-oxford-50 rounded border border-oxford-200">
            <div>
              <span className="text-xs font-medium text-oxford-600">Creado por:</span>
              <p className="text-sm text-black">{registro?.creado_por || '-'}</p>
            </div>
            <div>
              <span className="text-xs font-medium text-oxford-600">Fecha de llenado:</span>
              <p className="text-sm text-black">
                {registro?.created_at ? format(new Date(registro.created_at), "d 'de' MMMM yyyy, HH:mm", { locale: es }) : '-'}
              </p>
            </div>
            <div>
              <span className="text-xs font-medium text-oxford-600">Solicitado por:</span>
              <p className="text-sm text-black">{registro?.solicitado_por || '-'}</p>
            </div>
          </div>
        )}
        <div className="grid gap-4 sm:grid-cols-2">
          {(!registro || (registroId && puedeEditar)) && (
            <>
              <div>
                <label className="block text-sm font-medium text-oxford-800 mb-1">Creado por</label>
                <input
                  type="text"
                  value={creadoPor}
                  onChange={(e) => setCreadoPor(e.target.value)}
                  placeholder="Nombre de quien crea el registro"
                  className="w-full border-2 border-oxford-300 rounded px-3 py-2 bg-white text-black placeholder-oxford-400"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-oxford-800 mb-1">Solicitado por</label>
                <input
                  type="text"
                  value={solicitadoPor}
                  onChange={(e) => setSolicitadoPor(e.target.value)}
                  placeholder="Nombre de quien solicita"
                  className="w-full border-2 border-oxford-300 rounded px-3 py-2 bg-white text-black placeholder-oxford-400"
                />
              </div>
            </>
          )}
          <div className="sm:col-span-2">
            <label className="block text-sm font-medium text-oxford-800 mb-1">Nombre del Oficial</label>
            <input
              type="text"
              value={nombreOficial}
              onChange={(e) => setNombreOficial(e.target.value)}
              placeholder="Nombre completo"
              className="w-full border-2 border-oxford-300 rounded px-3 py-2 bg-white text-black placeholder-oxford-400"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-oxford-800 mb-1">Fecha y Hora</label>
            <input
              type="datetime-local"
              value={fechaHora}
              readOnly
              className="w-full border-2 border-oxford-300 rounded px-3 py-2 bg-oxford-100 text-oxford-700"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-oxford-800 mb-1">CURP</label>
            <input
              type="text"
              value={curp}
              onChange={(e) => setCurp(e.target.value)}
              placeholder="CURP (texto libre)"
              className="w-full border-2 border-oxford-300 rounded px-3 py-2 bg-white text-black placeholder-oxford-400"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-oxford-800 mb-1">Fecha de Ingreso</label>
            <input
              type="date"
              value={fechaIngreso}
              onChange={(e) => setFechaIngreso(e.target.value)}
              className="w-full border-2 border-oxford-300 rounded px-3 py-2 bg-white text-black"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-oxford-800 mb-1">Fecha de Inicio Efectiva</label>
            <input
              type="date"
              value={fechaInicioEfectiva}
              onChange={(e) => setFechaInicioEfectiva(e.target.value)}
              className="w-full border-2 border-oxford-300 rounded px-3 py-2 bg-white text-black"
            />
          </div>
        </div>
      </section>

      {/* Sección B: Comparativa */}
      <section className="border-2 border-oxford-300 rounded-lg p-3 sm:p-4 bg-white">
        <h2 className="text-base font-bold text-black border-b border-oxford-300 pb-2 mb-4">B. Comparativa de Movimiento</h2>
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="border-b-2 border-oxford-400">
                <th className="text-left py-2 px-2 font-bold text-black border border-oxford-300">Campo</th>
                <th className="text-left py-2 px-2 font-bold text-black border border-oxford-300 bg-oxford-100">Situación ACTUAL</th>
                <th className="text-left py-2 px-2 font-bold text-black border border-oxford-300">Situación NUEVA</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td className="py-2 px-2 border border-oxford-300 font-medium">Servicio</td>
                <td className="py-2 px-2 border border-oxford-300 bg-oxford-50">
                  <input
                    type="text"
                    value={servicioActual}
                    onChange={(e) => setServicioActual(e.target.value)}
                    placeholder="Texto libre"
                    className="w-full border border-oxford-200 rounded px-2 py-1 bg-oxford-50 text-oxford-800"
                  />
                </td>
                <td className="py-2 px-2 border border-oxford-300">
                  <input
                    type="text"
                    value={servicioNuevo}
                    onChange={(e) => setServicioNuevo(e.target.value)}
                    placeholder="Texto libre"
                    className="w-full border border-oxford-300 rounded px-2 py-1 bg-white"
                  />
                </td>
              </tr>
              <tr>
                <td className="py-2 px-2 border border-oxford-300 font-medium">Puesto</td>
                <td className="py-2 px-2 border border-oxford-300 bg-oxford-50">
                  <input
                    type="text"
                    value={puestoActual}
                    onChange={(e) => setPuestoActual(e.target.value)}
                    placeholder="Texto libre"
                    className="w-full border border-oxford-200 rounded px-2 py-1 bg-oxford-50 text-oxford-800"
                  />
                </td>
                <td className="py-2 px-2 border border-oxford-300">
                  <input
                    type="text"
                    value={puestoNuevo}
                    onChange={(e) => setPuestoNuevo(e.target.value)}
                    placeholder="Texto libre"
                    className="w-full border border-oxford-300 rounded px-2 py-1 bg-white"
                  />
                </td>
              </tr>
              <tr>
                <td className="py-2 px-2 border border-oxford-300 font-medium">Sueldo Mensual</td>
                <td className="py-2 px-2 border border-oxford-300 bg-oxford-50">
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={sueldoActual}
                    onChange={(e) => setSueldoActual(e.target.value)}
                    placeholder="-"
                    className="w-full border border-oxford-200 rounded px-2 py-1 bg-oxford-50"
                  />
                </td>
                <td className="py-2 px-2 border border-oxford-300">
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={sueldoNuevo}
                    onChange={(e) => setSueldoNuevo(e.target.value)}
                    placeholder="0.00"
                    className="w-full border border-oxford-300 rounded px-2 py-1"
                  />
                </td>
              </tr>
              <tr>
                <td className="py-2 px-2 border border-oxford-300 font-medium">Motivo</td>
                <td className="py-2 px-2 border border-oxford-300 bg-oxford-50">-</td>
                <td className="py-2 px-2 border border-oxford-300">
                  <input
                    type="text"
                    value={motivo}
                    onChange={(e) => setMotivo(e.target.value)}
                    placeholder="Texto libre..."
                    className="w-full border border-oxford-300 rounded px-2 py-1"
                  />
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      {error && <p className="text-red-600 text-sm">{error}</p>}
      {puedeEditar && (
        <button
          type="button"
          onClick={guardar}
          disabled={guardando}
          className="w-full sm:w-auto px-6 py-3 min-h-[44px] bg-black text-white rounded border-2 border-black font-medium hover:bg-oxford-800 disabled:opacity-50 touch-manipulation"
        >
          {guardando ? (registroId ? 'Actualizando...' : 'Guardando...') : (registroId ? 'Actualizar registro' : 'Guardar registro')}
        </button>
      )}
    </div>
  )
}
