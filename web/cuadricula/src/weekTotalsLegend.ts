/**
 * Definiciones oficiales: códigos en la cuadrícula y su significado para totales / color.
 * Textos de tabla compactos; `detail` se usa como tooltip (título al pasar el ratón).
 */

export type LegendVariant = 'gray' | 'red' | 'orange' | 'navy'

export interface WeekTotalsLegendEntry {
  /** Texto corto en columna «Código». */
  codes: string
  /** Texto breve en columna «Concepto». */
  label: string
  /** Explicación larga (tooltip). */
  detail?: string
  variant: LegendVariant
}

export const WEEK_TOTALS_LEGEND: WeekTotalsLegendEntry[] = [
  {
    codes: 'Número / A',
    label: 'Asistencia',
    detail: 'Un número en celda (ej. 937) o la letra A cuenta en Asist.',
    variant: 'orange',
  },
  {
    codes: 'DD+n.º',
    label: 'Tiempo extra',
    detail: 'DD seguido de número (ej. DD937) → columna Extra únicamente.',
    variant: 'gray',
  },
  {
    codes: 'F',
    label: 'Falta → F1, F2…',
    detail:
      'Escriba solo F; el sistema asigna F1, F2… en orden (lun–dom, D→T→N). Al borrar, renumeración automática.',
    variant: 'red',
  },
  {
    codes: 'D',
    label: 'Descanso',
    detail:
      '1 Desc. por día si hay D en algún turno (columna D, T o N). D en D+T+N = 1 Desc. Con DD937 en D y D en T+N = 1 Extra + 1 Desc.',
    variant: 'orange',
  },
  {
    codes: 'INC',
    label: 'Incapacidad',
    detail: 'Incapacidad — columna Inc.',
    variant: 'navy',
  },
  {
    codes: 'VAC',
    label: 'Vacaciones',
    detail: 'Vacaciones — columna Vac.',
    variant: 'navy',
  },
  {
    codes: 'PSGS',
    label: 'Perm. sin goce',
    detail: 'Permiso sin goce de sueldo — columna PSGS.',
    variant: 'navy',
  },
  {
    codes: 'PCGS',
    label: 'Perm. con goce',
    detail: 'Permiso con goce de sueldo — columna PCGS.',
    variant: 'navy',
  },
  {
    codes: 'CAP',
    label: 'Capacitación',
    detail: 'Capacitación — columna Cap.',
    variant: 'navy',
  },
]

/** Tooltips para las columnas de totales del grid. */
export const TOTAL_COLUMN_HELP: Record<
  'asist' | 'extra' | 'desc' | 'falta' | 'inc' | 'pcgs' | 'psgs' | 'vac' | 'cap',
  string
> = {
  asist: 'Asistencia — número en celda o letra A.',
  extra: 'Tiempo extra — DD seguido de número (ej. DD937).',
  desc:
    'Descanso: 1 por día si hay D en algún turno (D/T/N). Día completo D+D+T+N = 1. DD+número en otro turno suma Extra aparte.',
  falta:
    'Faltas — celdas F1, F2, F3… (en captura solo se escribe F; el número lo asigna el sistema en orden semanal).',
  inc: 'Incapacidades — celdas INC.',
  pcgs: 'Permisos con goce de sueldo — celdas PCGS.',
  psgs: 'Permisos sin goce de sueldo — celdas PSGS.',
  vac: 'Vacaciones — celdas VAC.',
  cap: 'Capacitación — celdas CAP.',
}
