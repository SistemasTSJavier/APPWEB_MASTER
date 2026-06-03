"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { CatPersonalRow } from "@/lib/categorizacion-types";
import {
  CatListaFiltro,
  filtrarPersonalListado,
  serviciosUnicosDesdePersonal,
} from "@/components/categorizacion/CatEmpleadoBuscador";
import { CatMsg } from "@/components/categorizacion/cat-form-ui";

type SyncStats = {
  sincronizados: number;
  eliminados: number;
  totalActivos: number;
  totalColaboradores: number;
};

export function CatPersonalPanel() {
  const [rows, setRows] = useState<CatPersonalRow[]>([]);
  const [busy, setBusy] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [periodoDefault, setPeriodoDefault] = useState("");
  const [edit, setEdit] = useState<CatPersonalRow | null>(null);
  const [filtroTabla, setFiltroTabla] = useState("");
  const [filtroServicio, setFiltroServicio] = useState("");

  const serviciosOpciones = useMemo(() => serviciosUnicosDesdePersonal(rows), [rows]);

  const rowsFiltrados = useMemo(
    () => filtrarPersonalListado(rows, filtroTabla, filtroServicio),
    [rows, filtroTabla, filtroServicio],
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
        setRows(list);
        const stats = j.stats as SyncStats | undefined;
        if (stats) {
          const partes = [
            `${stats.sincronizados} activo(s) en catálogo`,
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
    try {
      await sincronizarActivos({ soloMensaje: true });
    } finally {
      setBusy(false);
    }
  }, [sincronizarActivos]);

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
      setRows((prev) =>
        prev.map((p) => (p.noEmpleado === edit.noEmpleado ? (j.row as CatPersonalRow) ?? edit : p)),
      );
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
          Al abrir este módulo se cargan los expedientes <strong>activos</strong> de Colaboradores (sin fecha de baja ni
          estatus inactivo). No hace falta registrar uno por uno: nombre, servicio, puesto, fechas y escolaridad se toman del
          expediente.
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
        <h2 className="mb-3 text-sm font-bold uppercase text-slate-900">
          Personal en categorización ({rowsFiltrados.length}
          {rows.length !== rowsFiltrados.length ? ` de ${rows.length}` : ""})
        </h2>

        <div className="mb-3 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <label className="space-y-1">
            <span className="form-label">Filtrar por servicio</span>
            <select
              className="form-control uppercase"
              value={filtroServicio}
              onChange={(e) => setFiltroServicio(e.target.value)}
            >
              <option value="">Todos los servicios</option>
              {serviciosOpciones.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </label>
          <div className="sm:col-span-2">
            <CatListaFiltro
              value={filtroTabla}
              onChange={setFiltroTabla}
              total={rows.length}
              filtrados={rowsFiltrados.length}
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
        {rows.length === 0 && !syncing ? (
          <p className="py-6 text-center text-sm text-slate-500">
            No hay colaboradores activos en expedientes o aún no se ha sincronizado.
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
