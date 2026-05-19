/** Filas de bajas: historial de asistencia D/T/N por semana (solo lectura en UI). */

export interface BajasRow {
  id: string
  servicio: string
  noServicio: string
  planta: string
  posicion: string
  puesto: string
  fechaIngreso: string
  noEmpleado: string
  nombres: string
  /** Fecha de baja en expediente (display). */
  fechaBaja?: string
  shifts: { D: string; T: string; N: string }[]
}

const DAY_COUNT = 7

export function emptyBajasShifts(): { D: string; T: string; N: string }[] {
  return Array.from({ length: DAY_COUNT }, () => ({ D: '', T: '', N: '' }))
}

/** Ejemplo de historial para demo (semana de 7 días). */
export const SAMPLE_BAJAS_ROWS: BajasRow[] = [
  {
    id: 'bx-1',
    servicio: 'Planta — línea A',
    noServicio: '101',
    planta: 'Planta norte',
    posicion: 'OP-3',
    puesto: 'Operador',
    fechaIngreso: '10/06/2018',
    noEmpleado: '1201',
    nombres: 'Hernández Ruiz, Marco',
    shifts: [
      { D: '101', T: '101', N: 'D' },
      { D: 'D', T: 'F1', N: 'D' },
      { D: '101', T: '101', N: '101' },
      { D: 'INC', T: 'D', N: 'D' },
      { D: 'D', T: 'D', N: 'D' },
      { D: 'VAC', T: 'VAC', N: 'VAC' },
      { D: 'D', T: 'D', N: 'D' },
    ],
  },
  {
    id: 'bx-2',
    servicio: 'Centro — cobertura',
    noServicio: '204',
    planta: 'Centro',
    posicion: 'COV-1',
    puesto: 'Auxiliar',
    fechaIngreso: '22/03/2020',
    noEmpleado: '3302',
    nombres: 'Soto Pérez, Ana',
    shifts: [
      { D: '204', T: '204', N: '204' },
      { D: '204', T: 'F2', N: 'D' },
      { D: 'D', T: 'D', N: 'D' },
      { D: 'D', T: 'D', N: 'D' },
      { D: 'PCGS', T: 'D', N: 'D' },
      { D: 'D', T: 'D', N: 'D' },
      { D: 'D', T: 'D', N: 'D' },
    ],
  },
]

export const INITIAL_BAJAS_ROWS: BajasRow[] = []
