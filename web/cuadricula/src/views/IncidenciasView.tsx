import { useState } from 'react'
import { EmployeeSearchBar } from '../components/EmployeeSearchBar'
import {
  INCIDENCIAS_SUBMODULES,
  type IncidenciasSubId,
} from '../incidenciasConfig'
import type { EmpleadoIncidenciaMock } from '../incidenciasEmployeesMock'
import { useCuadriculaData } from '../CuadriculaDataContext'

/** Solo Elemento viene del buscador; el resto de columnas es manual. */
const COLUMNA_ELEMENTO = 'elemento'

export interface IncidenciaFila {
  id: string
  elemento: string
  manual: Record<string, string>
}

function filaVaciaManual(columnKeys: string[]): Record<string, string> {
  const m: Record<string, string> = {}
  for (const k of columnKeys) {
    if (k !== COLUMNA_ELEMENTO) m[k] = ''
  }
  return m
}

function nuevaFilaDesdeEmpleado(
  emp: EmpleadoIncidenciaMock,
  columnKeys: string[],
): IncidenciaFila {
  return {
    id: `inc-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
    elemento: emp.nombres,
    manual: filaVaciaManual(columnKeys),
  }
}

const filasIniciales = (): Record<IncidenciasSubId, IncidenciaFila[]> => ({
  vacaciones: [],
  incapacidades: [],
  permiso: [],
  'horas-acumuladas': [],
})

export function IncidenciasView() {
  const { empleadosBusqueda, loading, error, reload, puedeEditar } = useCuadriculaData()
  const [sub, setSub] = useState<IncidenciasSubId>('vacaciones')
  const [filasPorSub, setFilasPorSub] =
    useState<Record<IncidenciasSubId, IncidenciaFila[]>>(filasIniciales)

  const active = INCIDENCIAS_SUBMODULES.find((m) => m.id === sub)!
  const columnKeys = active.columns.map((c) => c.key)
  const filas = filasPorSub[sub]

  function elegirEmpleado(emp: EmpleadoIncidenciaMock) {
    if (!puedeEditar) return
    const nueva = nuevaFilaDesdeEmpleado(emp, columnKeys)
    setFilasPorSub((prev) => ({
      ...prev,
      [sub]: [...prev[sub], nueva],
    }))
  }

  function actualizarManual(filaId: string, key: string, valor: string) {
    setFilasPorSub((prev) => ({
      ...prev,
      [sub]: prev[sub].map((f) =>
        f.id === filaId ? { ...f, manual: { ...f.manual, [key]: valor } } : f,
      ),
    }))
  }

  return (
    <div className="incidenciasView">
      <header className="topbar">
        <div className="topbar__title">
          <h1>Incidencias</h1>
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
                onSelect={elegirEmpleado}
                ariaPrefix="inc-buscar"
              />
            ) : (
              <p className="hint">Solo lectura. Su rol no permite captura en este módulo.</p>
            )}
          </div>
        </div>
        <nav className="incidenciasTabs" aria-label="Submódulos de incidencias">
          {INCIDENCIAS_SUBMODULES.map((m) => (
            <button
              key={m.id}
              type="button"
              className={`incidenciasTabs__btn${sub === m.id ? ' incidenciasTabs__btn--active' : ''}`}
              onClick={() => setSub(m.id)}
            >
              {m.label}
            </button>
          ))}
        </nav>
        <p className="hint">
          Submódulo <strong>{active.label}</strong>: al elegir un empleado solo se
          rellena <strong>Elemento</strong> con su nombre; <strong>F. ingreso</strong>,{' '}
          <strong>Servicio</strong> y el resto son manuales (el buscador sigue mostrando
          fecha y servicio solo como ayuda al elegir).
        </p>
      </header>

      <div className="sheetWrap">
        <table
          className="sheet sheet--incidencias"
          key={sub}
          aria-label={`Incidencias — ${active.label}`}
        >
          <thead>
            <tr className="theadSub">
              {active.columns.map((col) => (
                <th key={col.key} className="th th--incCol">
                  {col.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filas.length === 0 ? (
              <tr>
                <td
                  colSpan={active.columns.length}
                  className="td td--emptyInc"
                >
                  Busca por nombre o número de empleado y elige una coincidencia para
                  añadir una fila.
                </td>
              </tr>
            ) : (
              filas.map((fila) => (
                <tr key={fila.id}>
                  {active.columns.map((col) => {
                    if (col.key === COLUMNA_ELEMENTO) {
                      return (
                        <td key={col.key} className="td td--incAuto">
                          {fila.elemento}
                        </td>
                      )
                    }
                    return (
                      <td key={col.key} className="td td--incManual">
                        <input
                          type="text"
                          className="incManualInput"
                          value={fila.manual[col.key] ?? ''}
                          onChange={(e) =>
                            actualizarManual(fila.id, col.key, e.target.value)
                          }
                          readOnly={!puedeEditar}
                          disabled={!puedeEditar}
                          aria-label={col.header}
                        />
                      </td>
                    )
                  })}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <footer className="footer">
        Buscador compartido con Comidas (mock): solo escribe en Elemento; integra API
        cuando toque.
      </footer>
    </div>
  )
}
