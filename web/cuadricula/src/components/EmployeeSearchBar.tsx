import { useEffect, useMemo, useRef, useState } from 'react'
import {
  filtrarEmpleadosIncidencias,
  type EmpleadoIncidenciaMock,
} from '../incidenciasEmployeesMock'

export interface EmployeeSearchBarProps {
  onSelect: (emp: EmpleadoIncidenciaMock) => void
  /** Expedientes reales (activos); sustituye al mock. */
  empleados: EmpleadoIncidenciaMock[]
  /** Prefijo para ids accesibles (único por pantalla). */
  ariaPrefix?: string
}

export function EmployeeSearchBar({
  onSelect,
  empleados,
  ariaPrefix = 'emp-buscar',
}: EmployeeSearchBarProps) {
  const [busqueda, setBusqueda] = useState('')
  const [listaAbierta, setListaAbierta] = useState(false)
  const wrapRef = useRef<HTMLDivElement>(null)

  const coincidencias = useMemo(
    () => filtrarEmpleadosIncidencias(empleados, busqueda),
    [empleados, busqueda],
  )

  useEffect(() => {
    function cerrarSiFuera(ev: MouseEvent) {
      if (!wrapRef.current?.contains(ev.target as Node)) {
        setListaAbierta(false)
      }
    }
    document.addEventListener('mousedown', cerrarSiFuera)
    return () => document.removeEventListener('mousedown', cerrarSiFuera)
  }, [])

  function elegir(emp: EmpleadoIncidenciaMock) {
    onSelect(emp)
    setBusqueda('')
    setListaAbierta(false)
  }

  const mostrarLista =
    listaAbierta && busqueda.trim().length > 0 && coincidencias.length > 0

  const labelId = `${ariaPrefix}-label`

  return (
    <div className="topbar__toolbarLeft" ref={wrapRef}>
      <div className="field field--grow">
        <span className="field__label" id={labelId}>
          Buscar empleado
        </span>
        <div className="incSearch">
          <input
            type="search"
            className="incSearch__input"
            placeholder="Nombre o no. de empleado…"
            value={busqueda}
            onChange={(e) => {
              setBusqueda(e.target.value)
              setListaAbierta(true)
            }}
            onFocus={() => setListaAbierta(true)}
            aria-labelledby={labelId}
            aria-autocomplete="list"
            aria-expanded={mostrarLista}
            autoComplete="off"
          />
          {mostrarLista ? (
            <ul className="incSearch__hits" role="listbox">
              {coincidencias.map((emp) => (
                <li key={emp.id} role="option">
                  <button
                    type="button"
                    className="incSearch__hit"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => elegir(emp)}
                  >
                    <span className="incSearch__hitName">{emp.nombres}</span>
                    <span className="incSearch__hitMeta">
                      No. {emp.noEmpleado} · {emp.fIngreso} · {emp.servicio}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      </div>
    </div>
  )
}
