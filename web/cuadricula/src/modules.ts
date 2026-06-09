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
  /** Si false, se muestra en el menú pero no se puede abrir (módulo en pausa). */
  active: boolean
}

export const APP_MODULES: AppModule[] = [
  { id: 'asistencia', label: 'Asistencia', hint: 'Cuadrícula semanal por planta', active: true },
  {
    id: 'consulta_asistencia',
    label: 'Consulta asistencia',
    hint: 'Buscar colaborador y ver resumen por semana',
    active: true,
  },
  { id: 'bajas', label: 'Bajas', hint: 'Bajas y movimientos de personal', active: false },
  {
    id: 'incidencias',
    label: 'Incidencias',
    hint: 'Vacaciones, incapacidades, permisos y horas acumuladas',
    active: false,
  },
  { id: 'comidas', label: 'Comidas', hint: 'Comedor y turnos de comida', active: false },
  { id: 'vacantes', label: 'Vacantes', hint: 'Posiciones libres por planta', active: false },
]

export const ACTIVE_MODULE_IDS = new Set(
  APP_MODULES.filter((m) => m.active).map((m) => m.id),
)

export function isModuleActive(id: ModuleId): boolean {
  return ACTIVE_MODULE_IDS.has(id)
}
