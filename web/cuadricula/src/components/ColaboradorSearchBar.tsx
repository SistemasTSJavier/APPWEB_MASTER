import { useEffect, useMemo, useRef, useState } from "react";
import type { ColaboradorCompleto } from "@/lib/colaboradores-types";
import {
  estatusExpedienteColaborador,
  plantaExpedienteColaborador,
} from "../cuadriculaColaboradoresBridge";
import { servicioLineaColaborador } from "@/lib/servicio-agrupacion";

const MAX_SUGERENCIAS = 60;

function coincideBusqueda(c: ColaboradorCompleto, q: string): boolean {
  const n = q.trim().toLowerCase();
  if (!n) return true;
  const no = c.noEmpleado.toLowerCase();
  const nom = (c.nombreCompleto ?? "").toLowerCase();
  const nss = (c.nss ?? "").toLowerCase();
  return no.includes(n) || nom.includes(n) || nss.includes(n);
}

export type ColaboradorSearchBarProps = {
  colaboradores: ColaboradorCompleto[];
  loading?: boolean;
  selected: ColaboradorCompleto | null;
  onSelect: (c: ColaboradorCompleto | null) => void;
  /** Muestra «(BAJA)» en sugerencias para colaboradores dados de baja. */
  marcarBajasEnLista?: boolean;
};

export function ColaboradorSearchBar({
  colaboradores,
  loading = false,
  selected,
  onSelect,
  marcarBajasEnLista = false,
}: ColaboradorSearchBarProps) {
  const [busqueda, setBusqueda] = useState("");
  const [listaAbierta, setListaAbierta] = useState(false);
  const blurTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const opciones = useMemo(
    () =>
      [...colaboradores].sort((a, b) =>
        a.noEmpleado.localeCompare(b.noEmpleado, "es", { numeric: true, sensitivity: "base" }),
      ),
    [colaboradores],
  );

  const sugerencias = useMemo(() => {
    const filtradas = opciones.filter((c) => coincideBusqueda(c, busqueda));
    return filtradas.slice(0, MAX_SUGERENCIAS);
  }, [opciones, busqueda]);

  useEffect(() => {
    if (!selected) {
      setBusqueda("");
      return;
    }
    setBusqueda(`${selected.noEmpleado} — ${selected.nombreCompleto || "(SIN NOMBRE)"}`);
  }, [selected?.noEmpleado, selected?.nombreCompleto]);

  useEffect(() => {
    return () => {
      if (blurTimer.current) clearTimeout(blurTimer.current);
    };
  }, []);

  function limpiar() {
    onSelect(null);
    setBusqueda("");
    setListaAbierta(false);
  }

  function elegir(c: ColaboradorCompleto) {
    if (blurTimer.current) {
      clearTimeout(blurTimer.current);
      blurTimer.current = null;
    }
    onSelect(c);
    setBusqueda(`${c.noEmpleado} — ${c.nombreCompleto || "(SIN NOMBRE)"}`);
    setListaAbierta(false);
  }

  const etiquetaSeleccion = selected
    ? `${selected.noEmpleado} — ${selected.nombreCompleto || "(SIN NOMBRE)"}`
    : "";

  return (
    <div className="consultaSearch cardLike">
      <div className="consultaSearch__field">
        <span className="field__label">Buscar colaborador</span>
        <p className="consultaSearch__hint">
          Número de empleado, nombre o NSS (como en ficha técnica).
        </p>
        <div className="consultaSearch__row">
          <div className="consultaSearch__inputWrap">
            <input
              type="search"
              className="input input--search"
              placeholder="Ej. 9117 o Juan Pérez…"
              value={busqueda}
              disabled={loading}
              autoComplete="off"
              spellCheck={false}
              aria-autocomplete="list"
              aria-expanded={listaAbierta && sugerencias.length > 0}
              onChange={(e) => {
                const v = e.target.value;
                setBusqueda(v);
                setListaAbierta(true);
                if (selected && v !== etiquetaSeleccion) {
                  onSelect(null);
                }
              }}
              onFocus={() => setListaAbierta(true)}
              onBlur={() => {
                blurTimer.current = setTimeout(() => setListaAbierta(false), 180);
              }}
            />
            {listaAbierta && busqueda.trim() && sugerencias.length > 0 ? (
              <ul className="consultaSearch__hits" role="listbox">
                {sugerencias.map((c) => {
                  const enBaja = marcarBajasEnLista && estatusExpedienteColaborador(c) === "BAJA";
                  return (
                  <li key={c.noEmpleado} role="option">
                    <button
                      type="button"
                      className={`consultaSearch__hit${enBaja ? " consultaSearch__hit--baja" : ""}`}
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => elegir(c)}
                    >
                      <span className="consultaSearch__hitName">
                        {c.nombreCompleto || "(SIN NOMBRE)"}
                        {enBaja ? (
                          <span className="consultaSearch__hitBaja" aria-label="Baja"> (BAJA)</span>
                        ) : null}
                      </span>
                      <span className="consultaSearch__hitMeta">
                        No. {c.noEmpleado}
                        {plantaExpedienteColaborador(c)
                          ? ` · ${plantaExpedienteColaborador(c)}`
                          : ""}
                        {servicioLineaColaborador(c)
                          ? ` · ${servicioLineaColaborador(c)}`
                          : ""}
                      </span>
                    </button>
                  </li>
                  );
                })}
              </ul>
            ) : null}
          </div>
          {selected ? (
            <button type="button" className="btn" onClick={limpiar}>
              Limpiar
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}
