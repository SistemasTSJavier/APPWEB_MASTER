import { useState } from 'react'
import './App.css'
import { APP_MODULES, isModuleActive, type ModuleId } from './modules'
import { AttendanceView } from './views/AttendanceView'
import { AsistenciaConsultaView } from './views/AsistenciaConsultaView'
import { BajasView } from './views/BajasView'
import { ComidasView } from './views/ComidasView'
import { IncidenciasView } from './views/IncidenciasView'

export default function App() {
  const [module, setModule] = useState<ModuleId>('asistencia')

  return (
    <div className="app app--shell">
      <aside className="shellNav" aria-label="Módulos">
        <div className="shellNav__brand">
          <span className="shellNav__brandTitle">Módulos</span>
        </div>
        <nav className="shellNav__list">
          {APP_MODULES.map((m) => {
            const activo = m.active
            return (
              <button
                key={m.id}
                type="button"
                className={`shellNav__item${module === m.id && activo ? ' shellNav__item--active' : ''}${!activo ? ' shellNav__item--inactive' : ''}`}
                onClick={() => {
                  if (activo) setModule(m.id)
                }}
                disabled={!activo}
                aria-disabled={!activo}
                title={activo ? m.hint : `${m.hint} — módulo inactivo por ahora`}
              >
                <span className="shellNav__itemLabel">
                  {m.label}
                  {!activo ? <span className="shellNav__itemBadge">Inactivo</span> : null}
                </span>
                <span className="shellNav__itemHint">{activo ? m.hint : 'No disponible temporalmente'}</span>
              </button>
            )
          })}
        </nav>
      </aside>

      <div className="shellMain">
        {module === 'asistencia' && <AttendanceView />}
        {module === 'consulta_asistencia' && <AsistenciaConsultaView />}
        {module === 'bajas' && isModuleActive('bajas') && <BajasView />}
        {module === 'incidencias' && isModuleActive('incidencias') && <IncidenciasView />}
        {module === 'comidas' && isModuleActive('comidas') && <ComidasView />}
      </div>
    </div>
  )
}
