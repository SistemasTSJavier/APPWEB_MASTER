"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { CatPersonalRow } from "@/lib/categorizacion-types";
import { listColaboradoresCompletos } from "@/lib/colaboradores-store";
import {
  CatEmpleadoBuscador,
  CatListaFiltro,
  filtrarEmpleados,
  type CatEmpleadoOpcion,
} from "@/components/categorizacion/CatEmpleadoBuscador";
import { CatMsg } from "@/components/categorizacion/cat-form-ui";

export function CatPersonalPanel() {
  const [rows, setRows] = useState<CatPersonalRow[]>([]);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [noNuevo, setNoNuevo] = useState("");
  const [periodoNuevo, setPeriodoNuevo] = useState("");
  const [edit, setEdit] = useState<CatPersonalRow | null>(null);
  const [colaboradores, setColaboradores] = useState<CatEmpleadoOpcion[]>([]);
  const [filtroTabla, setFiltroTabla] = useState("");

  const rowsFiltrados = useMemo(() => filtrarEmpleados(rows, filtroTabla), [rows, filtroTabla]);

  const load = useCallback(async () => {
    setBusy(true);
    setMsg(null);
    try {
      const r = await fetch("/api/categorizacion/personal", { cache: "no-store" });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error ?? `Error ${r.status}`);
      setRows(Array.isArray(j.rows) ? j.rows : []);
    } catch (e) {
      setMsg(e instanceof Error ? e.message.toUpperCase() : "ERROR AL CARGAR.");
    } finally {
      setBusy(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    let cancel = false;
    (async () => {
      try {
        const list = await listColaboradoresCompletos();
        if (!cancel) {
          setColaboradores(
            list.map((c) => ({
              noEmpleado: c.noEmpleado.trim().toUpperCase(),
              nombre: String(c.nombreCompleto ?? "").trim(),
            })),
          );
        }
      } catch {
        if (!cancel) setColaboradores([]);
      }
    })();
    return () => {
      cancel = true;
    };
  }, []);

  async function registrarDesdeColaboradores() {
    if (!noNuevo.trim()) {
      setMsg("INDICA N° DE EMPLEADO.");
      return;
    }
    setBusy(true);
    setMsg(null);
    try {
      const r = await fetch("/api/categorizacion/personal", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "register_from_colaborador",
          noEmpleado: noNuevo.trim(),
          periodoEvaluacion: periodoNuevo.trim(),
        }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error ?? `Error ${r.status}`);
      setMsg("EMPLEADO REGISTRADO DESDE COLABORADORES.");
      setNoNuevo("");
      await load();
    } catch (e) {
      setMsg(e instanceof Error ? e.message.toUpperCase() : "ERROR AL REGISTRAR.");
    } finally {
      setBusy(false);
    }
  }

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
      await load();
    } catch (e) {
      setMsg(e instanceof Error ? e.message.toUpperCase() : "ERROR AL GUARDAR.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      <section className="card space-y-3 border border-violet-100">
        <h2 className="text-sm font-bold uppercase text-slate-900">Registrar empleado</h2>
        <p className="text-xs font-medium text-slate-600">
          Toma datos del expediente en <strong>Colaboradores</strong> (nombre, servicio, puesto, fechas, escolaridad,
          estatus).
        </p>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div className="sm:col-span-1">
            <CatEmpleadoBuscador
              label="Colaborador (expediente)"
              hint="Busca en Colaboradores por N° o nombre."
              value={noNuevo}
              onChange={setNoNuevo}
              opciones={colaboradores}
              listId="cat-personal-reg-colaborador"
              disabled={busy}
            />
          </div>
          <label className="space-y-1 sm:col-span-2">
            <span className="form-label">Periodo de evaluación</span>
            <input
              className="form-control uppercase"
              placeholder="EJ. 2026-Q1 O ENERO-JUNIO 2026"
              value={periodoNuevo}
              onChange={(e) => setPeriodoNuevo(e.target.value)}
            />
          </label>
        </div>
        <button type="button" className="btn-primary uppercase" disabled={busy} onClick={() => void registrarDesdeColaboradores()}>
          Registrar desde Colaboradores
        </button>
      </section>

      <CatMsg msg={msg} />

      <section className="card overflow-x-auto">
        <h2 className="mb-3 text-sm font-bold uppercase text-slate-900">Personal registrado ({rows.length})</h2>
        <CatListaFiltro
          value={filtroTabla}
          onChange={setFiltroTabla}
          total={rows.length}
          filtrados={rowsFiltrados.length}
        />
        <table className="w-full min-w-[1200px] text-left text-xs">
          <thead>
            <tr className="border-b border-slate-200 text-[10px] font-bold uppercase text-slate-600">
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
              <th className="p-2">F. baja</th>
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
                <td className="p-2">{r.fechaBaja || "—"}</td>
                <td className="p-2">
                  <button type="button" className="text-[10px] font-bold uppercase text-violet-800" onClick={() => setEdit({ ...r })}>
                    Editar
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {rows.length === 0 ? <p className="py-6 text-center text-sm text-slate-500">Sin registros. Registra el primer empleado.</p> : null}
      </section>

      {edit ? (
        <section className="card space-y-3 border-2 border-violet-200">
          <h2 className="text-sm font-bold uppercase">Editar {edit.noEmpleado}</h2>
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
            <button type="button" className="btn-primary uppercase" disabled={busy} onClick={() => void guardarEdicion()}>
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
