"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { CatColaboradorActivoOpcion, CatPersonalRow } from "@/lib/categorizacion-types";
import {
  CatFiltroPlanta,
  CatFiltroServicio,
  CatListaFiltro,
  CatResumenServicios,
  filtrarPersonalListado,
  filtrarPorServicio,
} from "@/components/categorizacion/CatEmpleadoBuscador";
import { CatMsg } from "@/components/categorizacion/cat-form-ui";
import {
  fetchColaboradoresActivosCat,
  invalidateColaboradoresActivosCatCache,
} from "@/lib/categorizacion-colaboradores-client";
import {
  fetchCatPersonalList,
  patchCatPersonalCache,
  setCatPersonalCache,
} from "@/lib/categorizacion-personal-client";

type SyncStats = {
  sincronizados: number;
  eliminados: number;
  totalActivos: number;
  totalColaboradores: number;
};

export function CatPersonalPanel() {
  const [activos, setActivos] = useState<CatColaboradorActivoOpcion[]>([]);
  const [catRows, setCatRows] = useState<CatPersonalRow[]>([]);
  const [busy, setBusy] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [periodoDefault, setPeriodoDefault] = useState("");
  const [edit, setEdit] = useState<CatPersonalRow | null>(null);
  const [filtroTabla, setFiltroTabla] = useState("");
  const [filtroServicio, setFiltroServicio] = useState("");
  const [filtroPlanta, setFiltroPlanta] = useState("");

  const rows = useMemo(() => {
    const catMap = new Map(catRows.map((p) => [p.noEmpleado, p]));
    return activos.map((a) => {
      const prev = catMap.get(a.noEmpleado);
      if (prev) {
        return {
          ...prev,
          nombre: prev.nombre || a.nombre,
          servicio: a.servicio || prev.servicio,
          puesto: prev.puesto || a.puesto,
          estatus: prev.estatus || "ACTIVO",
        };
      }
      return {
        noEmpleado: a.noEmpleado,
        periodoEvaluacion: "",
        fechaIngreso: "",
        nombre: a.nombre,
        servicio: a.servicio,
        puesto: a.puesto,
        fechaNacimiento: "",
        edad: "",
        escolaridad: "",
        estatus: "ACTIVO",
        fechaBaja: "",
      } satisfies CatPersonalRow;
    });
  }, [activos, catRows]);

  const rowsConPlanta = useMemo(() => {
    const plantaPorNo = new Map(activos.map((a) => [a.noEmpleado, a.planta ?? ""]));
    return rows.map((r) => ({ ...r, planta: plantaPorNo.get(r.noEmpleado) ?? "" }));
  }, [rows, activos]);

  const personalPorServicio = useMemo(
    () => filtrarPorServicio(rowsConPlanta, filtroServicio, filtroPlanta),
    [rowsConPlanta, filtroServicio, filtroPlanta],
  );

  const rowsFiltrados = useMemo(
    () => filtrarPersonalListado(rowsConPlanta, filtroTabla, filtroServicio, filtroPlanta),
    [rowsConPlanta, filtroTabla, filtroServicio, filtroPlanta],
  );

  const sincronizarActivos = useCallback(
    async (opts?: { soloMensaje?: boolean }) => {
      setSyncing(true);
      if (!opts?.soloMensaje) setMsg(null);
      try {
        const r = await fetch("/api/categorizacion/personal", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "sync_activos",
            periodoEvaluacion: periodoDefault.trim(),
          }),
        });
        const j = await r.json();
        if (!r.ok) throw new Error(j.error ?? `Error ${r.status}`);
        const list = Array.isArray(j.rows) ? (j.rows as CatPersonalRow[]) : [];
        setCatPersonalCache(list);
        setCatRows(list);
        invalidateColaboradoresActivosCatCache();
        const activosList = await fetchColaboradoresActivosCat({ forceRefresh: true });
        setActivos(activosList);
        const stats = j.stats as SyncStats | undefined;
        if (stats) {
          const partes = [
            `${stats.sincronizados} activo(s) en catálogo`,
            `${stats.totalActivos} calificable(s) en expedientes`,
            stats.eliminados > 0 ? `${stats.eliminados} quitado(s) (baja/inactivo)` : null,
          ].filter(Boolean);
          setMsg(`SINCRONIZADO DESDE COLABORADORES: ${partes.join(" · ")}.`);
        } else if (!opts?.soloMensaje) {
          setMsg("LISTADO ACTUALIZADO.");
        }
        return true;
      } catch (e) {
        setMsg(e instanceof Error ? e.message.toUpperCase() : "ERROR AL SINCRONIZAR.");
        return false;
      } finally {
        setSyncing(false);
      }
    },
    [periodoDefault],
  );

  const load = useCallback(async () => {
    setBusy(true);
    setMsg(null);
    try {
      const [activosList, catList] = await Promise.all([
        fetchColaboradoresActivosCat({ forceRefresh: true }),
        fetchCatPersonalList({ forceRefresh: true }),
      ]);
      setActivos(activosList);
      setCatRows(catList);
    } catch (e) {
      setMsg(e instanceof Error ? e.message.toUpperCase() : "ERROR AL CARGAR.");
    } finally {
      setBusy(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function guardarEdicion() {
    if (!edit) return;
    setBusy(true);
    setMsg(null);
    try {
      const r = await fetch("/api/categorizacion/personal", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ row: edit }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error ?? `Error ${r.status}`);
      setMsg("GUARDADO.");
      setEdit(null);
      const saved = (j.row as CatPersonalRow) ?? edit;
      patchCatPersonalCache(saved);
      setCatRows((prev) => prev.map((p) => (p.noEmpleado === edit.noEmpleado ? saved : p)));
    } catch (e) {
      setMsg(e instanceof Error ? e.message.toUpperCase() : "ERROR AL GUARDAR.");
    } finally {
      setBusy(false);
    }
  }

  const ocupado = busy || syncing;

  return (
    <div className="space-y-4">
      <section className="card space-y-3 border border-violet-100 bg-violet-50/40">
        <h2 className="text-sm font-bold uppercase text-slate-900">Colaboradores activos (automático)</h2>
        <p className="text-xs font-medium leading-relaxed text-slate-700">
          El listado muestra <strong>colaboradores activos</strong> en expedientes (sección Colaboradores), en vivo.
          Use <strong>Actualizar desde Colaboradores</strong> para guardar periodo de evaluación y campos en el catálogo
          de categorización.
        </p>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <label className="space-y-1 sm:col-span-2">
            <span className="form-label">Periodo de evaluación (solo empleados nuevos en catálogo)</span>
            <input
              className="form-control uppercase"
              placeholder="EJ. 2026-Q1 O ENERO-JUNIO 2026"
              value={periodoDefault}
              onChange={(e) => setPeriodoDefault(e.target.value)}
              disabled={ocupado}
            />
          </label>
          <div className="flex items-end">
            <button
              type="button"
              className="btn-primary w-full uppercase"
              disabled={ocupado}
              onClick={() => void sincronizarActivos()}
            >
              {syncing ? "Sincronizando…" : "Actualizar desde Colaboradores"}
            </button>
          </div>
        </div>
        {syncing ? (
          <p className="text-xs font-semibold text-violet-900" role="status">
            Leyendo expedientes activos y actualizando catálogo…
          </p>
        ) : null}
      </section>

      <CatMsg msg={msg} />

      <section className="card overflow-x-auto">
        {busy && rows.length === 0 ? <p className="mb-2 text-sm text-slate-500">Cargando catálogo…</p> : null}
        <h2 className="mb-3 text-sm font-bold uppercase text-slate-900">
          Personal en categorización ({rowsFiltrados.length}
          {personalPorServicio.length !== rowsFiltrados.length ? ` de ${personalPorServicio.length}` : ""}
          {filtroServicio && rows.length !== personalPorServicio.length ? ` · ${rows.length} en catálogo` : ""})
        </h2>

        <CatResumenServicios personal={activos} servicioFiltro={filtroServicio} className="mb-3" />

        <div className="mb-3 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <CatFiltroServicio
            value={filtroServicio}
            onChange={(v) => {
              setFiltroServicio(v);
              setFiltroPlanta("");
            }}
            personal={activos}
          />
          <CatFiltroPlanta
            servicioFiltro={filtroServicio}
            value={filtroPlanta}
            onChange={setFiltroPlanta}
            personal={activos}
          />
          <div className="sm:col-span-2">
            <CatListaFiltro
              value={filtroTabla}
              onChange={setFiltroTabla}
              total={personalPorServicio.length}
              filtrados={rowsFiltrados.length}
              totalCatalogo={filtroServicio ? activos.length : undefined}
            />
          </div>
        </div>

        <div className="max-h-[min(70vh,36rem)] overflow-auto rounded-lg border border-slate-100">
          <table className="w-full min-w-[1200px] text-left text-xs">
            <thead className="sticky top-0 z-[1] border-b border-slate-200 bg-slate-50 text-[10px] font-bold uppercase text-slate-600">
              <tr>
                <th className="p-2">N°</th>
                <th className="p-2">F. ingreso</th>
                <th className="p-2">Periodo</th>
                <th className="p-2">Nombre</th>
                <th className="p-2">Servicio</th>
                <th className="p-2">Puesto</th>
                <th className="p-2">F. nac.</th>
                <th className="p-2">Edad</th>
                <th className="p-2">Escolaridad</th>
                <th className="p-2">Estatus</th>
                <th className="p-2" />
              </tr>
            </thead>
            <tbody>
              {rowsFiltrados.map((r) => (
                <tr key={r.noEmpleado} className="border-b border-slate-100 hover:bg-slate-50">
                  <td className="p-2 font-mono font-bold">{r.noEmpleado}</td>
                  <td className="p-2">{r.fechaIngreso || "—"}</td>
                  <td className="p-2">{r.periodoEvaluacion || "—"}</td>
                  <td className="p-2">{r.nombre}</td>
                  <td className="p-2">{r.servicio || "—"}</td>
                  <td className="p-2">{r.puesto || "—"}</td>
                  <td className="p-2">{r.fechaNacimiento || "—"}</td>
                  <td className="p-2">{r.edad || "—"}</td>
                  <td className="p-2">{r.escolaridad || "—"}</td>
                  <td className="p-2">{r.estatus || "—"}</td>
                  <td className="p-2">
                    <button
                      type="button"
                      className="text-[10px] font-bold uppercase text-violet-800"
                      onClick={() => setEdit({ ...r })}
                    >
                      Editar
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {activos.length === 0 && !busy && !syncing ? (
          <p className="py-6 text-center text-sm text-slate-500">
            No hay colaboradores activos en expedientes.
          </p>
        ) : null}
        {rows.length > 0 && rowsFiltrados.length === 0 ? (
          <p className="py-4 text-center text-sm text-slate-500">Sin coincidencias con los filtros actuales.</p>
        ) : null}
      </section>

      {edit ? (
        <section className="card space-y-3 border-2 border-violet-200">
          <h2 className="text-sm font-bold uppercase">Editar {edit.noEmpleado}</h2>
          <p className="text-[11px] text-slate-600">
            Los datos base se actualizan al sincronizar desde Colaboradores. Aquí puede ajustar periodo de evaluación y
            campos de categorización.
          </p>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {(
              [
                ["periodoEvaluacion", "Periodo evaluación"],
                ["fechaIngreso", "Fecha ingreso"],
                ["nombre", "Nombre"],
                ["servicio", "Servicio"],
                ["puesto", "Puesto"],
                ["fechaNacimiento", "Fecha nac."],
                ["edad", "Edad"],
                ["escolaridad", "Escolaridad"],
                ["estatus", "Estatus"],
                ["fechaBaja", "Fecha baja"],
              ] as const
            ).map(([key, label]) => (
              <label key={key} className="space-y-1">
                <span className="form-label">{label}</span>
                <input
                  className="form-control uppercase"
                  value={edit[key]}
                  onChange={(e) => setEdit({ ...edit, [key]: e.target.value })}
                />
              </label>
            ))}
          </div>
          <div className="flex flex-wrap gap-2">
            <button type="button" className="btn-primary uppercase" disabled={ocupado} onClick={() => void guardarEdicion()}>
              Guardar
            </button>
            <button type="button" className="btn-secondary uppercase" onClick={() => setEdit(null)}>
              Cancelar
            </button>
          </div>
        </section>
      ) : null}
    </div>
  );
}
