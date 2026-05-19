import { useState } from 'react'
import './App.css'
import { APP_MODULES, type ModuleId } from './modules'
import { AttendanceView } from './views/AttendanceView'
import { AsistenciaConsultaView } from './views/AsistenciaConsultaView'
import { BajasView } from './views/BajasView'
import { ComidasView } from './views/ComidasView'
import { IncidenciasView } from './views/IncidenciasView'
import { VacantesView } from './views/VacantesView'

export default function App() {
  const [module, setModule] = useState<ModuleId>('asistencia')

  return (
    <div className="app app--shell">
      <aside className="shellNav" aria-label="Módulos">
        <div className="shellNav__brand">
          <span className="shellNav__brandTitle">Módulos</span>
        </div>
        <nav className="shellNav__list">
          {APP_MODULES.map((m) => (
            <button
              key={m.id}
              type="button"
              className={`shellNav__item${module === m.id ? ' shellNav__item--active' : ''}`}
              onClick={() => setModule(m.id)}
            >
              <span className="shellNav__itemLabel">{m.label}</span>
              <span className="shellNav__itemHint">{m.hint}</span>
            </button>
          ))}
        </nav>
      </aside>

      <div className="shellMain">
        {module === 'asistencia' && <AttendanceView />}
        {module === 'consulta_asistencia' && <AsistenciaConsultaView />}
        {module === 'bajas' && <BajasView />}
        {module === 'incidencias' && <IncidenciasView />}
        {module === 'comidas' && <ComidasView />}
        {module === 'vacantes' && <VacantesView />}
      </div>
    </div>
  )
}
