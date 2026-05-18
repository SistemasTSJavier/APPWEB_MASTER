import { useEffect, useMemo, useState } from "react";
import type { ColaboradorCompleto } from "@/lib/colaboradores-types";
import { colaboradoresActivosTodos, plantaExpedienteColaborador } from "../cuadriculaColaboradoresBridge";
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

  const activos = useMemo(() => colaboradoresActivosTodos(colaboradores), [colaboradores]);

  const plantaColaborador = useMemo(() => {
    if (!seleccionado) return "";
    return plantaExpedienteColaborador(seleccionado).trim();
  }, [seleccionado]);

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
          Busque un colaborador como en <strong>ficha técnica</strong> y consulte el resumen de asistencia{' '}
          <strong>por semana</strong> (totales lun–dom) del mes elegido. Los datos se leen del servidor
          (misma fuente que la cuadrícula por planta).
        </p>
        {loading ? (
          <p className="hint" style={{ marginBottom: 8 }}>
            Cargando colaboradores…
          </p>
        ) : null}
        {error ? (
          <div className="hint" style={{ marginBottom: 8, color: "#b91c1c" }}>
            <strong>{error}</strong>{" "}
            <button type="button" className="btn btn--linkish" onClick={() => reload()}>
              Reintentar
            </button>
          </div>
        ) : null}

        <ColaboradorSearchBar
          colaboradores={activos}
          loading={loading}
          selected={seleccionado}
          onSelect={setSeleccionado}
        />

        {seleccionado ? (
          <div className="consultaMeta cardLike">
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
          </div>
        ) : (
          <p className="hint consultaPlaceholder">
            Seleccione un colaborador de la lista para ver su asistencia semanal.
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
            subtitulo={`Planta: ${plantaColaborador}. Totales por semana según datos guardados en el servidor.`}
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
