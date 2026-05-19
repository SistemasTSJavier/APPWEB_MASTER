/** Estructura de cuadrícula (columnas / semana). Sin filas hasta conectar datos. */

export type Turn = 'D' | 'T' | 'N'

export interface WeekColumn {
  key: string
  weekday: string
  dateLabel: string
}

export interface GridRow {
  id: string
  position: string
  role: string
  hireDate: string
  employeeNo: string | null
  name: string
  /** N.º de servicio (catálogo según servicio vigente del colaborador). */
  rowServiceNo?: string
  /** Línea de servicio vigente en expediente (referencia). */
  servicioLinea?: string
  /** Planta del expediente (vista «todos» y vacantes). */
  plantaLinea?: string
  vacant: boolean
  /** ACTIVO o BAJA (expediente con fecha de baja). */
  estatus?: 'ACTIVO' | 'BAJA'
  /** Fecha de baja para mostrar (vacante / activo: —). */
  fechaBaja?: string
  shifts: { D: string; T: string; N: string }[]
  totals: {
    asist: number
    extra: number
    desc: number
    falta: number
    inc: number
    pcgs: number
    psgs: number
    vac: number
    cap: number
  }
}

export function emptyShifts(days: number): { D: string; T: string; N: string }[] {
  return Array.from({ length: days }, () => ({ D: '', T: '', N: '' }))
}

export const ZERO_TOTALS: GridRow['totals'] = {
  asist: 0,
  extra: 0,
  desc: 0,
  falta: 0,
  inc: 0,
  pcgs: 0,
  psgs: 0,
  vac: 0,
  cap: 0,
}

/** Cabecera de semana: solo etiquetas de columna (fechas llegan del backend). */
export const WEEK_COLUMNS: WeekColumn[] = [
  { key: 'd1', weekday: 'Lun', dateLabel: '' },
  { key: 'd2', weekday: 'Mar', dateLabel: '' },
  { key: 'd3', weekday: 'Mié', dateLabel: '' },
  { key: 'd4', weekday: 'Jue', dateLabel: '' },
  { key: 'd5', weekday: 'Vie', dateLabel: '' },
  { key: 'd6', weekday: 'Sáb', dateLabel: '' },
  { key: 'd7', weekday: 'Dom', dateLabel: '' },
]

export const WEEK_RANGE_PLACEHOLDER = 'Semana (sin cargar)'

export interface ServiceOption {
  label: string
  id: string
  /** N.º de servicio que corresponde a este servicio (se rellena solo al elegirlo o al cargar plantilla). */
  defaultServiceNo?: string
}

export const SERVICE_OPTIONS: ServiceOption[] = [
  { label: 'Seleccione servicio…', id: '' },
  { label: 'Planta — línea A', id: 'plant-a', defaultServiceNo: '101' },
  { label: 'Centro — cobertura', id: 'centro', defaultServiceNo: '204' },
]

export function defaultServiceNoForIndex(serviceIdx: number): string {
  const n = SERVICE_OPTIONS[serviceIdx]?.defaultServiceNo?.trim()
  return n ?? ''
}

/** Plantilla de ejemplo (sin conexión a API). Sustituir por carga real del servicio. */
export const SAMPLE_ATTENDANCE_ROWS: GridRow[] = [
  {
    id: 'sample-1',
    position: 'OP-1',
    role: 'Operador',
    hireDate: '15/01/2019',
    employeeNo: '4521',
    name: 'García López, Luis',
    vacant: false,
    shifts: emptyShifts(7),
    totals: { ...ZERO_TOTALS },
  },
  {
    id: 'sample-2',
    position: 'OP-2',
    role: 'Operador',
    hireDate: '03/08/2021',
    employeeNo: '8840',
    name: 'Martínez Ruiz, Elena',
    vacant: false,
    shifts: emptyShifts(7),
    totals: { ...ZERO_TOTALS },
  },
]

/** Filas iniciales: ninguna; la tabla muestra solo columnas. */
export const INITIAL_ROWS: GridRow[] = []
