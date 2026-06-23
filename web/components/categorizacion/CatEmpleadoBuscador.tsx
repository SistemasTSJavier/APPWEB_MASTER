"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  puestoEsJefeTurno,
  puestoEsOficialOperaciones,
} from "@/lib/categorizacion-operaciones-roles";

export type CatEmpleadoOpcion = { noEmpleado: string; nombre: string; servicio?: string };

const MAX_SUGERENCIAS = 60;
const MAX_SUGERENCIAS_BUSQUEDA = 120;

export function etiquetaEmpleado(o: CatEmpleadoOpcion): string {
  return `${o.noEmpleado} — ${o.nombre.trim() || "(SIN NOMBRE)"}`;
}

export function coincideBusquedaEmpleado(o: CatEmpleadoOpcion, q: string): boolean {
  const n = q.trim().toLowerCase();
  if (!n) return true;
  const hay = `${o.noEmpleado} ${o.nombre}`.toLowerCase();
  const tokens = n.split(/\s+/).filter(Boolean);
  if (tokens.length > 1) return tokens.every((t) => hay.includes(t));
  return hay.includes(n);
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
    const limite = busqueda.trim() ? MAX_SUGERENCIAS_BUSQUEDA : MAX_SUGERENCIAS;
    return filtradas.slice(0, limite);
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
          {ordenadas.length} activo(s) en Colaboradores. Escribe N° o nombre para acotar.
        </p>
      ) : null}
      {busqueda.trim() && sugerencias.length >= MAX_SUGERENCIAS_BUSQUEDA ? (
        <p className="text-[11px] text-amber-800">Muchas coincidencias; refine la búsqueda.</p>
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
  totalCatalogo,
}: {
  value: string;
  onChange: (v: string) => void;
  total: number;
  filtrados: number;
  /** Total en catálogo completo (si difiere del alcance por servicio). */
  totalCatalogo?: number;
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
        {totalCatalogo != null && totalCatalogo !== total ? ` · ${totalCatalogo} en catálogo` : ""}
      </p>
    </div>
  );
}

export function filtrarEmpleados<T extends CatEmpleadoOpcion>(rows: T[], q: string): T[] {
  const n = q.trim();
  if (!n) return rows;
  return rows.filter((r) => coincideBusquedaEmpleado(r, n));
}

function normServicioFiltro(s: string): string {
  return s.trim().replace(/\s+/g, " ").toUpperCase();
}

export function normalizarServicioCatFiltro(s: string): string {
  return normServicioFiltro(s);
}

export function serviciosCoincidenCat(a: string, b: string): boolean {
  return normServicioFiltro(a) === normServicioFiltro(b);
}

export function conteoActivosPorServicio<T extends { servicio?: string }>(
  rows: T[],
): { servicio: string; count: number }[] {
  const map = new Map<string, number>();
  for (const r of rows) {
    const s = normServicioFiltro(String(r.servicio ?? ""));
    const key = s || "SIN SERVICIO";
    map.set(key, (map.get(key) ?? 0) + 1);
  }
  return [...map.entries()]
    .map(([servicio, count]) => ({ servicio, count }))
    .sort((a, b) => a.servicio.localeCompare(b.servicio, "es", { numeric: true }));
}

/** Filtra solo por servicio (sin texto de búsqueda). */
export function filtrarPorServicio<T extends { servicio?: string }>(rows: T[], servicioFiltro: string): T[] {
  const srv = normServicioFiltro(servicioFiltro);
  if (!srv) return rows;
  return rows.filter((r) => normServicioFiltro(String(r.servicio ?? "")) === srv);
}

/** Filtro por servicio (exacto) y texto (N°, nombre o servicio). */
export function filtrarPersonalListado<
  T extends CatEmpleadoOpcion & { servicio?: string },
>(rows: T[], busqueda: string, servicioFiltro: string): T[] {
  let out = rows;
  const srv = normServicioFiltro(servicioFiltro);
  if (srv) {
    out = out.filter((r) => normServicioFiltro(String(r.servicio ?? "")) === srv);
  }
  const q = busqueda.trim();
  if (!q) return out;
  const n = q.toLowerCase();
  return out.filter(
    (r) =>
      r.noEmpleado.toLowerCase().includes(n) ||
      r.nombre.toLowerCase().includes(n) ||
      String(r.servicio ?? "")
        .toLowerCase()
        .includes(n),
  );
}

export function serviciosUnicosDesdePersonal<T extends { servicio?: string }>(rows: T[]): string[] {
  const set = new Set<string>();
  for (const r of rows) {
    const s = normServicioFiltro(String(r.servicio ?? ""));
    if (s) set.add(s);
  }
  return [...set].sort((a, b) => a.localeCompare(b, "es", { numeric: true }));
}

/** Resumen compacto: activos por servicio. */
export function CatResumenServicios({
  personal,
  servicioFiltro = "",
  className = "",
}: {
  personal: { servicio?: string }[];
  servicioFiltro?: string;
  className?: string;
}) {
  const conteos = useMemo(() => conteoActivosPorServicio(personal), [personal]);
  const srvActivo = normServicioFiltro(servicioFiltro);
  if (conteos.length === 0) return null;

  return (
    <div className={`space-y-1.5 ${className}`.trim()}>
      <p className="text-[10px] font-bold uppercase tracking-wide text-slate-500">
        Activos por servicio ({personal.length} total)
      </p>
      <div className="flex flex-wrap gap-1.5">
        {conteos.map(({ servicio, count }) => {
          const activo = srvActivo && serviciosCoincidenCat(servicioFiltro, servicio);
          return (
            <span
              key={servicio}
              className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-[10px] font-semibold uppercase ${
                activo
                  ? "border-violet-300 bg-violet-100 text-violet-950"
                  : "border-slate-200 bg-slate-50 text-slate-700"
              }`}
            >
              <span className="max-w-[12rem] truncate">{servicio}</span>
              <span className="font-mono font-bold tabular-nums">{count}</span>
            </span>
          );
        })}
      </div>
    </div>
  );
}

/** Paso inicial en Operaciones: elegir servicio antes de listar oficiales y JT. */
export function CatSelectorServicioObligatorio({
  value,
  onChange,
  personal,
  disabled,
  className = "",
}: {
  value: string;
  onChange: (servicio: string) => void;
  personal: { servicio?: string; puesto?: string }[];
  disabled?: boolean;
  className?: string;
}) {
  const resumen = useMemo(() => {
    const map = new Map<
      string,
      { servicio: string; oficiales: number; jefesTurno: number; total: number }
    >();
    for (const r of personal) {
      const s = normServicioFiltro(String(r.servicio ?? ""));
      if (!s) continue;
      const row = map.get(s) ?? { servicio: s, oficiales: 0, jefesTurno: 0, total: 0 };
      row.total++;
      const puesto = String(r.puesto ?? "");
      if (puestoEsJefeTurno(puesto)) row.jefesTurno++;
      else if (puestoEsOficialOperaciones(puesto)) row.oficiales++;
      map.set(s, row);
    }
    return [...map.values()].sort((a, b) =>
      a.servicio.localeCompare(b.servicio, "es", { numeric: true }),
    );
  }, [personal]);

  if (resumen.length === 0) {
    return (
      <p className="text-xs font-medium text-amber-800">
        No hay colaboradores activos con servicio en expediente. Revise la sección Colaboradores.
      </p>
    );
  }

  return (
    <div className={`space-y-3 ${className}`.trim()}>
      <label className="block space-y-1">
        <span className="form-label">Servicio</span>
        <select
          className="form-control uppercase"
          value={value}
          disabled={disabled}
          onChange={(e) => onChange(e.target.value)}
        >
          <option value="">— Elija un servicio —</option>
          {resumen.map((r) => (
            <option key={r.servicio} value={r.servicio}>
              {r.servicio} — {r.oficiales} oficial(es), {r.jefesTurno} JT
            </option>
          ))}
        </select>
      </label>
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {resumen.map((r) => {
          const activo = value && serviciosCoincidenCat(value, r.servicio);
          return (
            <button
              key={r.servicio}
              type="button"
              disabled={disabled}
              onClick={() => onChange(r.servicio)}
              className={`rounded-lg border px-3 py-2.5 text-left text-xs transition ${
                activo
                  ? "border-violet-500 bg-violet-100 font-bold text-violet-950"
                  : "border-slate-200 bg-white font-semibold text-slate-800 hover:border-violet-300"
              }`}
            >
              <span className="block uppercase leading-snug">{r.servicio}</span>
              <span className="mt-1 block font-normal text-slate-600">
                {r.oficiales} oficial{r.oficiales === 1 ? "" : "es"} · {r.jefesTurno} jefe
                {r.jefesTurno === 1 ? "" : "s"} de turno
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

/** Selector de servicio (mismo criterio que Personal). */
export function CatFiltroServicio({
  value,
  onChange,
  personal,
  className = "",
}: {
  value: string;
  onChange: (v: string) => void;
  personal: { servicio?: string }[];
  className?: string;
}) {
  const conteos = useMemo(() => conteoActivosPorServicio(personal), [personal]);
  const mapConteo = useMemo(() => new Map(conteos.map((c) => [c.servicio, c.count])), [conteos]);
  const opciones = useMemo(() => serviciosUnicosDesdePersonal(personal), [personal]);
  return (
    <label className={`space-y-1 ${className}`.trim()}>
      <span className="form-label">Filtrar por servicio</span>
      <select className="form-control uppercase" value={value} onChange={(e) => onChange(e.target.value)}>
        <option value="">Todos los servicios ({personal.length})</option>
        {opciones.map((s) => (
          <option key={s} value={s}>
            {s} ({mapConteo.get(s) ?? 0})
          </option>
        ))}
      </select>
    </label>
  );
}
