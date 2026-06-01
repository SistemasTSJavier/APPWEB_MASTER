"use client";

import { useEffect, useMemo, useRef, useState } from "react";

export type CatEmpleadoOpcion = { noEmpleado: string; nombre: string };

const MAX_SUGERENCIAS = 60;

export function etiquetaEmpleado(o: CatEmpleadoOpcion): string {
  return `${o.noEmpleado} — ${o.nombre.trim() || "(SIN NOMBRE)"}`;
}

export function coincideBusquedaEmpleado(o: CatEmpleadoOpcion, q: string): boolean {
  const n = q.trim().toLowerCase();
  if (!n) return true;
  return o.noEmpleado.toLowerCase().includes(n) || o.nombre.toLowerCase().includes(n);
}

export function CatEmpleadoBuscador({
  label,
  hint = "Escribe número de empleado o nombre; elige de la lista.",
  value,
  onChange,
  opciones,
  listId = "cat-empleado-sugerencias",
  disabled,
  placeholder = "EJ. 9117 O JUAN PEREZ…",
}: {
  label: string;
  hint?: string;
  value: string;
  onChange: (noEmpleado: string) => void;
  opciones: CatEmpleadoOpcion[];
  listId?: string;
  disabled?: boolean;
  placeholder?: string;
}) {
  const [busqueda, setBusqueda] = useState("");
  const [listaAbierta, setListaAbierta] = useState(false);
  const blurTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const ordenadas = useMemo(
    () =>
      [...opciones].sort((a, b) =>
        a.noEmpleado.localeCompare(b.noEmpleado, "es", { numeric: true, sensitivity: "base" }),
      ),
    [opciones],
  );

  const seleccionado = useMemo(
    () => ordenadas.find((o) => o.noEmpleado === value) ?? null,
    [ordenadas, value],
  );

  const sugerencias = useMemo(() => {
    const filtradas = ordenadas.filter((o) => coincideBusquedaEmpleado(o, busqueda));
    return filtradas.slice(0, MAX_SUGERENCIAS);
  }, [ordenadas, busqueda]);

  useEffect(() => {
    if (seleccionado) {
      setBusqueda(etiquetaEmpleado(seleccionado));
    } else if (!value) {
      setBusqueda("");
    }
  }, [seleccionado, value]);

  useEffect(() => {
    return () => {
      if (blurTimer.current) clearTimeout(blurTimer.current);
    };
  }, []);

  function elegir(o: CatEmpleadoOpcion) {
    if (blurTimer.current) {
      clearTimeout(blurTimer.current);
      blurTimer.current = null;
    }
    onChange(o.noEmpleado);
    setBusqueda(etiquetaEmpleado(o));
    setListaAbierta(false);
  }

  function limpiar() {
    onChange("");
    setBusqueda("");
    setListaAbierta(false);
  }

  return (
    <div className="relative space-y-1">
      <span className="form-label">{label}</span>
      {hint ? <p className="text-[11px] text-slate-500">{hint}</p> : null}
      <div className="flex flex-wrap gap-2">
        <div className="relative min-w-0 flex-1">
          <input
            type="search"
            autoComplete="off"
            spellCheck={false}
            disabled={disabled}
            placeholder={placeholder}
            className="form-control uppercase"
            value={busqueda}
            onChange={(e) => {
              const v = e.target.value;
              setBusqueda(v);
              setListaAbierta(true);
              if (value && seleccionado) {
                const etiqueta = etiquetaEmpleado(seleccionado);
                if (v.trim().toUpperCase() !== etiqueta.trim().toUpperCase()) {
                  onChange("");
                }
              }
            }}
            onFocus={() => setListaAbierta(true)}
            onBlur={() => {
              blurTimer.current = setTimeout(() => setListaAbierta(false), 180);
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                if (sugerencias.length === 1) elegir(sugerencias[0]!);
              }
            }}
            aria-autocomplete="list"
            aria-expanded={listaAbierta && sugerencias.length > 0}
            aria-controls={listId}
          />
          {listaAbierta && sugerencias.length > 0 ? (
            <ul
              id={listId}
              role="listbox"
              className="absolute z-20 mt-1 max-h-64 w-full overflow-auto rounded-lg border border-slate-200 bg-white py-1 shadow-lg"
            >
              {sugerencias.map((o) => (
                <li key={o.noEmpleado} role="option">
                  <button
                    type="button"
                    className="w-full px-3 py-2 text-left text-sm uppercase hover:bg-violet-50"
                    onMouseDown={(ev) => ev.preventDefault()}
                    onClick={() => elegir(o)}
                  >
                    <span className="font-mono font-semibold text-slate-900">{o.noEmpleado}</span>
                    <span className="text-slate-600"> — {o.nombre.trim() || "(SIN NOMBRE)"}</span>
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
          {listaAbierta && busqueda.trim() && sugerencias.length === 0 ? (
            <p className="absolute z-20 mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-600 shadow-lg">
              Sin coincidencias.
            </p>
          ) : null}
        </div>
        <button
          type="button"
          className="btn-secondary shrink-0 self-end text-xs uppercase"
          disabled={disabled || (!value && !busqueda.trim())}
          onClick={limpiar}
        >
          Limpiar
        </button>
      </div>
      {ordenadas.length > MAX_SUGERENCIAS && !busqueda.trim() ? (
        <p className="text-[11px] text-slate-500">
          Mostrando los primeros {MAX_SUGERENCIAS} por N°. Escribe para acotar.
        </p>
      ) : null}
    </div>
  );
}

/** Filtro de texto para tablas (N° o nombre). */
export function CatListaFiltro({
  value,
  onChange,
  total,
  filtrados,
}: {
  value: string;
  onChange: (v: string) => void;
  total: number;
  filtrados: number;
}) {
  return (
    <div className="mb-3 flex flex-wrap items-end gap-3">
      <label className="min-w-0 flex-1 space-y-1">
        <span className="form-label">Buscar en listado</span>
        <input
          type="search"
          autoComplete="off"
          spellCheck={false}
          placeholder="N° DE EMPLEADO O NOMBRE…"
          className="form-control uppercase"
          value={value}
          onChange={(e) => onChange(e.target.value)}
        />
      </label>
      <p className="pb-2 text-[11px] font-semibold text-slate-600">
        {filtrados} de {total}
      </p>
    </div>
  );
}

export function filtrarEmpleados<T extends CatEmpleadoOpcion>(rows: T[], q: string): T[] {
  const n = q.trim();
  if (!n) return rows;
  return rows.filter((r) => coincideBusquedaEmpleado(r, n));
}
