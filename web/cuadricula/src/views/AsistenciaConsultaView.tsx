import { useEffect, useMemo, useState } from "react";
import type { ColaboradorCompleto } from "@/lib/colaboradores-types";
import {
  colaboradoresParaConsultaAsistencia,
  estatusExpedienteColaborador,
  fechaBajaDisplayColaborador,
  fechaIngresoDisplayColaborador,
  plantaExpedienteColaborador,
} from "../cuadriculaColaboradoresBridge";
import { servicioLineaColaborador } from "@/lib/servicio-agrupacion";
import { useCuadriculaData } from "../CuadriculaDataContext";
import { loadResumenMensualColaborador, type SemanaResumenColaborador } from "../attendanceResumenColaborador";
import { ColaboradorSearchBar } from "../components/ColaboradorSearchBar";
import { ColaboradorAsistenciaResumenPanel } from "../components/ColaboradorAsistenciaResumenPanel";

function toMonthYm(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  return `${y}-${m}`;
}

export function AsistenciaConsultaView() {
  const { catalogo, colaboradores, loading, error, reload } = useCuadriculaData();
  const [seleccionado, setSeleccionado] = useState<ColaboradorCompleto | null>(null);
  const [mesYm, setMesYm] = useState(() => toMonthYm(new Date()));
  const [mostrarCodigos, setMostrarCodigos] = useState(false);
  const [resumenFilas, setResumenFilas] = useState<SemanaResumenColaborador[]>([]);
  const [resumenLoading, setResumenLoading] = useState(false);

  const listaConsulta = useMemo(
    () => colaboradoresParaConsultaAsistencia(colaboradores),
    [colaboradores],
  );

  const plantaColaborador = useMemo(() => {
    if (!seleccionado) return "";
    return plantaExpedienteColaborador(seleccionado).trim();
  }, [seleccionado]);

  const estatusColaborador = seleccionado ? estatusExpedienteColaborador(seleccionado) : null;
  const fechaBajaColaborador = seleccionado ? fechaBajaDisplayColaborador(seleccionado) : "—";
  const fechaIngresoColaborador = seleccionado ? fechaIngresoDisplayColaborador(seleccionado) : "—";
  const enBaja = estatusColaborador === "BAJA";

  useEffect(() => {
    if (!seleccionado?.noEmpleado.trim() || !plantaColaborador) {
      setResumenFilas([]);
      setResumenLoading(false);
      return;
    }
    let cancelled = false;
    setResumenLoading(true);
    (async () => {
      try {
        const filas = await loadResumenMensualColaborador(
          colaboradores,
          catalogo,
          plantaColaborador,
          seleccionado.noEmpleado,
          mesYm,
        );
        if (!cancelled) setResumenFilas(filas);
      } finally {
        if (!cancelled) setResumenLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [seleccionado?.noEmpleado, plantaColaborador, mesYm, colaboradores, catalogo]);

  return (
    <div className="attendanceView attendanceView--consulta">
      <header className="topbar">
        <div className="topbar__title">
          <h1>Consulta de asistencia</h1>
          <span className="badge">Por colaborador</span>
        </div>
        <p className="hint consultaIntro">
          Busque un colaborador <strong>activo o dado de baja</strong> y consulte el resumen de asistencia{" "}
          <strong>por semana</strong> (totales lun–dom) del mes elegido. Se muestran <strong>Estatus</strong> y{" "}
          <strong>Fecha de baja</strong> del expediente. El historial se lee del servidor (misma fuente que la
          cuadrícula por planta), incluso si la persona ya no aparece en la captura semanal.
        </p>
        {loading ? (
          <p className="hint" style={{ marginBottom: 8 }}>
            Cargando colaboradores…
          </p>
        ) : null}
        {error ? (
          <p className="hint" style={{ marginBottom: 8, color: "#b91c1c" }}>
            <strong>{error}</strong>{" "}
            <button type="button" className="btn btn--linkish" onClick={() => reload()}>
              Reintentar
            </button>
          </p>
        ) : null}

        <ColaboradorSearchBar
          colaboradores={listaConsulta}
          loading={loading}
          selected={seleccionado}
          onSelect={setSeleccionado}
          marcarBajasEnLista
        />

        {seleccionado ? (
          <div className={`consultaMeta cardLike${enBaja ? " consultaMeta--baja" : ""}`}>
            <div className="consultaMeta__grid">
              <div>
                <span className="consultaMeta__label">Colaborador</span>
                <p className="consultaMeta__value">
                  {seleccionado.nombreCompleto || "—"}
                </p>
              </div>
              <div>
                <span className="consultaMeta__label">No. empleado</span>
                <p className="consultaMeta__value">{seleccionado.noEmpleado}</p>
              </div>
              <div>
                <span className="consultaMeta__label">Fecha de ingreso</span>
                <p className="consultaMeta__value">{fechaIngresoColaborador}</p>
              </div>
              <div>
                <span className="consultaMeta__label">Estatus</span>
                <p
                  className={`consultaMeta__value consultaMeta__estatus${enBaja ? " consultaMeta__estatus--baja" : ""}`}
                >
                  {estatusColaborador}
                </p>
              </div>
              <div>
                <span className="consultaMeta__label">Fecha de baja</span>
                <p className="consultaMeta__value">{fechaBajaColaborador}</p>
              </div>
              <div>
                <span className="consultaMeta__label">Planta (expediente)</span>
                <p className="consultaMeta__value">{plantaColaborador || "—"}</p>
              </div>
              <div>
                <span className="consultaMeta__label">Servicio</span>
                <p className="consultaMeta__value">
                  {servicioLineaColaborador(seleccionado) || "—"}
                </p>
              </div>
            </div>
            <div className="consultaMeta__controls">
              <label className="field">
                <span className="field__label">Mes a consultar</span>
                <input
                  className="input input--month"
                  type="month"
                  value={mesYm}
                  onChange={(e) => setMesYm(e.target.value)}
                  aria-label="Mes del resumen"
                />
              </label>
              <label className="field field--checkbox">
                <input
                  type="checkbox"
                  checked={mostrarCodigos}
                  onChange={(e) => setMostrarCodigos(e.target.checked)}
                />
                <span>Mostrar códigos por día (resumen)</span>
              </label>
            </div>
            {enBaja ? (
              <p className="hint consultaMeta__bajaNote">
                Persona en <strong>baja</strong>: se muestra el historial de asistencia guardado antes y después de
                la baja, según lo registrado por semana.
              </p>
            ) : null}
          </div>
        ) : (
          <p className="hint consultaPlaceholder">
            Seleccione un colaborador de la lista (activo o baja) para ver su asistencia semanal.
          </p>
        )}
      </header>

      <div className="sheetWrap">
        {!seleccionado ? null : !plantaColaborador ? (
          <p className="hint" style={{ padding: "1rem" }}>
            Este colaborador no tiene <strong>Planta</strong> en expediente. Capture el campo en Altas
            / Colaboradores para consultar su asistencia.
          </p>
        ) : (
          <ColaboradorAsistenciaResumenPanel
            titulo={`Resumen mensual — ${seleccionado.nombreCompleto || seleccionado.noEmpleado}`}
            subtitulo={`Planta: ${plantaColaborador}. Totales por semana según datos guardados (activos y bajas).`}
            mesYm={mesYm}
            filas={resumenFilas}
            loading={resumenLoading}
            mostrarCodigos={mostrarCodigos}
          />
        )}
      </div>
    </div>
  );
}
