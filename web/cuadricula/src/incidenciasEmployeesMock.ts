/**
 * Empleados de ejemplo para el buscador de incidencias (sustituir por API).
 * Búsqueda por nombre o número de empleado.
 */
export interface EmpleadoIncidenciaMock {
  id: string
  nombres: string
  noEmpleado: string
  /** Fecha de ingreso mostrada en tabla (F. ingreso). */
  fIngreso: string
  /** Texto para columna Servicio. */
  servicio: string
}

export const EMPLEADOS_INCIDENCIAS_MOCK: EmpleadoIncidenciaMock[] = [
  {
    id: 'e1',
    nombres: 'SANCHEZ CHACON JOSE FRANCISCO',
    noEmpleado: '1006',
    fIngreso: '27/01/2017',
    servicio: '903 — PATRIMONIO',
  },
  {
    id: 'e2',
    nombres: 'GARCIA LOPEZ MARIA',
    noEmpleado: '2044',
    fIngreso: '15/03/2019',
    servicio: '903 — PATRIMONIO',
  },
  {
    id: 'e3',
    nombres: 'MARTINEZ RUIZ CARLOS',
    noEmpleado: '3150',
    fIngreso: '02/08/2021',
    servicio: '303 — SEGURIDAD',
  },
  {
    id: 'e4',
    nombres: 'LOPEZ HERNANDEZ ANA LUCIA',
    noEmpleado: '0892',
    fIngreso: '10/11/2015',
    servicio: '120 — MANTENIMIENTO',
  },
]

export function normalizarBusqueda(s: string): string {
  return s.trim().toLowerCase()
}

export function filtrarEmpleadosIncidencias(
  lista: EmpleadoIncidenciaMock[],
  query: string,
): EmpleadoIncidenciaMock[] {
  const q = normalizarBusqueda(query)
  if (!q) return []
  return lista.filter((e) => {
    const nombre = normalizarBusqueda(e.nombres)
    const num = e.noEmpleado.trim().toLowerCase()
    return nombre.includes(q) || num.includes(q)
  })
}
