"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { CatEmpleadoBuscador, CatFiltroServicio, filtrarPorServicio } from "@/components/categorizacion/CatEmpleadoBuscador";
import { CatMsg } from "@/components/categorizacion/cat-form-ui";
import { fetchColaboradoresActivosCat } from "@/lib/categorizacion-colaboradores-client";
import type { CatColaboradorActivoOpcion } from "@/lib/categorizacion-types";
import {
  CAT_RECOMPENSA_TIPOS,
  etiquetaMesYm,
  mesCalendarioAnteriorYm,
  type CatRecompensaRow,
  type CatRecompensaTipo,
} from "@/lib/categorizacion-recompensas";

function noKey(no: string): string {
  return no.trim().toUpperCase();
}

export function CatRecompensasPanel() {
  const [activos, setActivos] = useState<CatColaboradorActivoOpcion[]>([]);
  const [rows, setRows] = useState<CatRecompensaRow[]>([]);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [filtroServicio, setFiltroServicio] = useState("");
  const [noSel, setNoSel] = useState("");
  const [tipo, setTipo] = useState<CatRecompensaTipo>("bono");
  const [descripcion, setDescripcion] = useState("");
  const [mes, setMes] = useState(mesCalendarioAnteriorYm());
  const [editId, setEditId] = useState<string | null>(null);

  const activosFiltrados = useMemo(
    () => filtrarPorServicio(activos, filtroServicio),
    [activos, filtroServicio],
  );
  const opciones = useMemo(
    () => activosFiltrados.map((a) => ({ noEmpleado: a.noEmpleado, nombre: a.nombre })),
    [activosFiltrados],
  );

  const metaTipo = CAT_RECOMPENSA_TIPOS.find((t) => t.id === tipo)!;

  const load = useCallback(async () => {
    setBusy(true);
    setMsg(null);
    try {
      const [act, r] = await Promise.all([
        fetchColaboradoresActivosCat({ forceRefresh: true }),
        fetch("/api/categorizacion/recompensas", { cache: "no-store" }),
      ]);
      const j = await r.json();
      if (!r.ok) throw new Error(j.error);
      setActivos(act);
      setRows((j.rows ?? []) as CatRecompensaRow[]);
    } catch (e) {
      setMsg(e instanceof Error ? e.message.toUpperCase() : "ERROR AL CARGAR.");
    } finally {
      setBusy(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const rowsFiltrados = useMemo(() => {
    const enServicio = new Set(activosFiltrados.map((a) => noKey(a.noEmpleado)));
    let list = rows.filter((r) => !filtroServicio || enServicio.has(noKey(r.noEmpleado)));
    if (noSel.trim()) list = list.filter((r) => noKey(r.noEmpleado) === noKey(noSel));
    return list;
  }, [rows, activosFiltrados, filtroServicio, noSel]);

  function limpiarForm(keepEmpleado = true) {
    setEditId(null);
    setTipo("bono");
    setDescripcion("");
    setMes(mesCalendarioAnteriorYm());
    if (!keepEmpleado) setNoSel("");
  }

  function editar(row: CatRecompensaRow) {
    setEditId(row.id);
    setNoSel(row.noEmpleado);
    setTipo(row.tipo);
    setDescripcion(row.descripcion);
    setMes(row.mes);
    setMsg(null);
  }

  async function guardar() {
    if (!noSel.trim()) {
      setMsg("SELECCIONE UN COLABORADOR.");
      return;
    }
    setBusy(true);
    setMsg(null);
    try {
      const r = await fetch("/api/categorizacion/recompensas", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: editId ?? undefined,
          noEmpleado: noSel,
          tipo,
          descripcion,
          mes,
        }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error);
      await load();
      limpiarForm(true);
      setMsg(editId ? "REGISTRO ACTUALIZADO." : "REGISTRO GUARDADO.");
    } catch (e) {
      setMsg(e instanceof Error ? e.message.toUpperCase() : "ERROR AL GUARDAR.");
    } finally {
      setBusy(false);
    }
  }

  async function eliminar(id: string) {
    if (!window.confirm("¿Eliminar este registro de recompensas?")) return;
    setBusy(true);
    setMsg(null);
    try {
      const r = await fetch(`/api/categorizacion/recompensas?id=${encodeURIComponent(id)}`, {
        method: "DELETE",
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error);
      if (editId === id) limpiarForm(true);
      await load();
      setMsg("REGISTRO ELIMINADO.");
    } catch (e) {
      setMsg(e instanceof Error ? e.message.toUpperCase() : "ERROR AL ELIMINAR.");
    } finally {
      setBusy(false);
    }
  }

  const nombrePorNo = useMemo(() => {
    const m = new Map(activos.map((a) => [noKey(a.noEmpleado), a.nombre]));
    return m;
  }, [activos]);

  return (
    <div className="space-y-4">
      <p className="text-xs font-medium text-slate-600">
        Capture <strong>bonos</strong> (de qué son), <strong>empleado del mes</strong> (en qué mes) y{" "}
        <strong>reconocimientos</strong> (de qué son y en qué mes). El dashboard muestra el{" "}
        <strong>mes anterior</strong> (desfase); no afectan el promedio 1–5.
      </p>

      <CatMsg msg={msg} />

      <section className="card space-y-3">
        <h2 className="text-sm font-bold uppercase">Nuevo / editar registro</h2>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <CatFiltroServicio value={filtroServicio} onChange={setFiltroServicio} personal={activos} />
          <div className="sm:col-span-2">
            <CatEmpleadoBuscador
              label="Colaborador"
              value={noSel}
              onChange={setNoSel}
              opciones={opciones}
              listId="cat-recompensas-empleado"
              disabled={busy || opciones.length === 0}
            />
          </div>
          <label className="space-y-1">
            <span className="form-label">Tipo</span>
            <select
              className="form-control"
              value={tipo}
              onChange={(e) => setTipo(e.target.value as CatRecompensaTipo)}
            >
              {CAT_RECOMPENSA_TIPOS.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.label}
                </option>
              ))}
            </select>
          </label>
          <label className="space-y-1">
            <span className="form-label">Mes</span>
            <input className="form-control" type="month" value={mes} onChange={(e) => setMes(e.target.value)} />
          </label>
          <label className="space-y-1 sm:col-span-2 lg:col-span-3">
            <span className="form-label">
              {tipo === "empleado_del_mes" ? "Nota (opcional)" : "Detalle"}
            </span>
            <input
              className="form-control"
              value={descripcion}
              onChange={(e) => setDescripcion(e.target.value)}
              placeholder={metaTipo.descripcionHint}
            />
          </label>
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" className="btn-primary uppercase" disabled={busy} onClick={() => void guardar()}>
            {editId ? "Actualizar" : "Guardar"}
          </button>
          {editId ? (
            <button type="button" className="btn-secondary uppercase" disabled={busy} onClick={() => limpiarForm(true)}>
              Cancelar edición
            </button>
          ) : null}
          <button type="button" className="text-xs font-bold uppercase text-violet-800" onClick={() => void load()}>
            Actualizar lista
          </button>
        </div>
      </section>

      <section className="card overflow-x-auto">
        <h2 className="mb-3 text-sm font-bold uppercase">Registros ({rowsFiltrados.length})</h2>
        {busy && rows.length === 0 ? (
          <p className="text-xs text-slate-500">Cargando…</p>
        ) : rowsFiltrados.length === 0 ? (
          <p className="text-xs text-slate-500">Sin registros con el filtro actual.</p>
        ) : (
          <table className="w-full min-w-[640px] text-xs">
            <thead>
              <tr className="border-b text-[10px] font-bold uppercase text-slate-600">
                <th className="p-2 text-left">N°</th>
                <th className="p-2 text-left">Nombre</th>
                <th className="p-2 text-left">Tipo</th>
                <th className="p-2 text-left">Mes</th>
                <th className="p-2 text-left">Detalle</th>
                <th className="p-2" />
              </tr>
            </thead>
            <tbody>
              {rowsFiltrados.map((r) => {
                const tipoLabel = CAT_RECOMPENSA_TIPOS.find((t) => t.id === r.tipo)?.label ?? r.tipo;
                return (
                  <tr key={r.id} className="border-b border-slate-100">
                    <td className="p-2 font-mono">{r.noEmpleado}</td>
                    <td className="p-2">{nombrePorNo.get(noKey(r.noEmpleado)) ?? "—"}</td>
                    <td className="p-2 font-semibold uppercase">{tipoLabel}</td>
                    <td className="p-2 capitalize">{etiquetaMesYm(r.mes)}</td>
                    <td className="p-2">{r.descripcion || "—"}</td>
                    <td className="p-2 whitespace-nowrap text-right">
                      <button
                        type="button"
                        className="mr-2 font-bold uppercase text-violet-800"
                        onClick={() => editar(r)}
                      >
                        Editar
                      </button>
                      <button
                        type="button"
                        className="font-bold uppercase text-red-700"
                        onClick={() => void eliminar(r.id)}
                      >
                        Eliminar
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </section>
    </div>
  );
}
