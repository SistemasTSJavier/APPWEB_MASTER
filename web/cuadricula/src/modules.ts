export type ModuleId =
  | 'asistencia'
  | 'consulta_asistencia'
  | 'bajas'
  | 'incidencias'
  | 'comidas'
  | 'vacantes'

export interface AppModule {
  id: ModuleId
  label: string
  hint: string
}

export const APP_MODULES: AppModule[] = [
  { id: 'asistencia', label: 'Asistencia', hint: 'Cuadrícula semanal por planta' },
  {
    id: 'consulta_asistencia',
    label: 'Consulta asistencia',
    hint: 'Buscar colaborador y ver resumen por semana',
  },
  { id: 'bajas', label: 'Bajas', hint: 'Bajas y movimientos de personal' },
  {
    id: 'incidencias',
    label: 'Incidencias',
    hint: 'Vacaciones, incapacidades, permisos y horas acumuladas',
  },
  { id: 'comidas', label: 'Comidas', hint: 'Comedor y turnos de comida' },
  { id: 'vacantes', label: 'Vacantes', hint: 'Posiciones libres por planta' },
]
