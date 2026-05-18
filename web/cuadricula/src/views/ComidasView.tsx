import { useState } from 'react'
import { EmployeeSearchBar } from '../components/EmployeeSearchBar'
import type { EmpleadoIncidenciaMock } from '../incidenciasEmployeesMock'
import { useCuadriculaData } from '../CuadriculaDataContext'

export interface ComidasFila {
  id: string
  elemento: string
  dia: string
  turno: string
  motivo: string
  comentarios: string
}

const COLUMNAS_COMIDAS = [
  { key: 'elemento', header: 'Elemento' },
  { key: 'dia', header: 'Día' },
  { key: 'turno', header: 'Turno' },
  { key: 'motivo', header: 'Motivo' },
  { key: 'comentarios', header: 'Comentarios' },
] as const

function nuevaFilaComidas(emp: EmpleadoIncidenciaMock): ComidasFila {
  return {
    id: `com-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
    elemento: emp.nombres,
    dia: '',
    turno: '',
    motivo: '',
    comentarios: '',
  }
}

export function ComidasView() {
  const { empleadosBusqueda, loading, error, reload, puedeEditar } = useCuadriculaData()
  const [filas, setFilas] = useState<ComidasFila[]>([])

  function onEmpleado(emp: EmpleadoIncidenciaMock) {
    if (!puedeEditar) return
    setFilas((prev) => [...prev, nuevaFilaComidas(emp)])
  }

  function actualizar(filaId: string, campo: keyof ComidasFila, valor: string) {
    if (campo === 'id' || campo === 'elemento') return
    setFilas((prev) =>
      prev.map((f) => (f.id === filaId ? { ...f, [campo]: valor } : f)),
    )
  }

  return (
    <div className="comidasView">
      <header className="topbar">
        <div className="topbar__title">
          <h1>Comidas</h1>
          <span className="badge">Borrador UI</span>
        </div>
        <div className="topbar__controls">
          <div className="topbar__bar topbar__bar--incidencias">
            {loading ? (
              <p className="hint">Cargando empleados…</p>
            ) : error ? (
              <p className="hint" style={{ color: '#b91c1c' }}>
                <strong>{error}</strong>{' '}
                <button type="button" className="btn btn--linkish" onClick={() => reload()}>
                  Reintentar
                </button>
              </p>
            ) : puedeEditar ? (
              <EmployeeSearchBar
                empleados={empleadosBusqueda}
                onSelect={onEmpleado}
                ariaPrefix="comidas-buscar"
              />
            ) : (
              <p className="hint">Solo lectura. Su rol no permite captura en este módulo.</p>
            )}
          </div>
        </div>
        <p className="hint">
          Al elegir empleado solo se rellena <strong>Elemento</strong> con el nombre;
          <strong> Día</strong>, <strong>Turno</strong>, <strong>Motivo</strong> y{' '}
          <strong>Comentarios</strong> son manuales (en el listado del buscador ves
          fecha y servicio solo como referencia).
        </p>
      </header>

      <div className="sheetWrap">
        <table className="sheet sheet--incidencias" aria-label="Registro de comidas">
          <thead>
            <tr className="theadSub">
              {COLUMNAS_COMIDAS.map((col) => (
                <th key={col.key} className="th th--incCol">
                  {col.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filas.length === 0 ? (
              <tr>
                <td colSpan={5} className="td td--emptyInc">
                  Busca por nombre o número de empleado y elige una coincidencia para
                  añadir una fila.
                </td>
              </tr>
            ) : (
              filas.map((fila) => (
                <tr key={fila.id}>
                  <td className="td td--incAuto">{fila.elemento}</td>
                  <td className="td td--incManual">
                    <input
                      type="text"
                      className="incManualInput"
                      value={fila.dia}
                      onChange={(e) => actualizar(fila.id, 'dia', e.target.value)}
                      readOnly={!puedeEditar}
                      disabled={!puedeEditar}
                      aria-label="Día"
                    />
                  </td>
                  <td className="td td--incManual">
                    <input
                      type="text"
                      className="incManualInput"
                      value={fila.turno}
                      onChange={(e) => actualizar(fila.id, 'turno', e.target.value)}
                      readOnly={!puedeEditar}
                      disabled={!puedeEditar}
                      aria-label="Turno"
                    />
                  </td>
                  <td className="td td--incManual">
                    <input
                      type="text"
                      className="incManualInput"
                      value={fila.motivo}
                      onChange={(e) => actualizar(fila.id, 'motivo', e.target.value)}
                      readOnly={!puedeEditar}
                      disabled={!puedeEditar}
                      aria-label="Motivo"
                    />
                  </td>
                  <td className="td td--incManual">
                    <input
                      type="text"
                      className="incManualInput"
                      value={fila.comentarios}
                      onChange={(e) =>
                        actualizar(fila.id, 'comentarios', e.target.value)
                      }
                      readOnly={!puedeEditar}
                      disabled={!puedeEditar}
                      aria-label="Comentarios"
                    />
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <footer className="footer">
        Misma lista mock de empleados que incidencias; conectar API para datos reales.
      </footer>
    </div>
  )
}
