export type IncidenciasSubId =
  | 'vacaciones'
  | 'incapacidades'
  | 'permiso'
  | 'horas-acumuladas'

export interface IncidenciasColumn {
  key: string
  header: string
}

export interface IncidenciasSubmodule {
  id: IncidenciasSubId
  label: string
  columns: IncidenciasColumn[]
}

export const INCIDENCIAS_SUBMODULES: IncidenciasSubmodule[] = [
  {
    id: 'vacaciones',
    label: 'Vacaciones',
    columns: [
      { key: 'elemento', header: 'Elemento' },
      { key: 'fIngreso', header: 'F. ingreso' },
      { key: 'servicio', header: 'Servicio' },
      { key: 'vacaciones', header: 'Vacaciones' },
      { key: 'noDias', header: 'No. días' },
      { key: 'periodoTotal', header: 'Periodo total' },
    ],
  },
  {
    id: 'incapacidades',
    label: 'Incapacidades',
    columns: [
      { key: 'elemento', header: 'Elemento' },
      { key: 'fIngreso', header: 'F. ingreso' },
      { key: 'servicio', header: 'Servicio' },
      { key: 'tipo', header: 'Tipo' },
      { key: 'ramo', header: 'Ramo' },
      { key: 'noDias', header: 'No. días' },
      { key: 'periodoTotal', header: 'Periodo total' },
    ],
  },
  {
    id: 'permiso',
    label: 'Permiso',
    columns: [
      { key: 'elemento', header: 'Elemento' },
      { key: 'fIngreso', header: 'F. ingreso' },
      { key: 'servicio', header: 'Servicio' },
      { key: 'tipoPermiso', header: 'Tipo de permiso' },
      { key: 'noDias', header: 'No. días' },
      { key: 'periodoTotal', header: 'Periodo total' },
    ],
  },
  {
    id: 'horas-acumuladas',
    label: 'Horas acumuladas',
    columns: [
      { key: 'elemento', header: 'Elemento' },
      { key: 'fIngreso', header: 'F. ingreso' },
      { key: 'servicio', header: 'Servicio' },
      {
        key: 'fechaHorasAcumuladas',
        header: 'Fecha de horas acumuladas',
      },
      { key: 'totalHoras', header: 'Total de horas' },
      { key: 'observaciones', header: 'Observaciones' },
    ],
  },
]
