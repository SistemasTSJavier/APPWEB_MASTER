"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { CatCapacitacionCurso } from "@/lib/categorizacion-types";
import {
  etiquetaEstadoCurso,
  estadoCursoCapacitacion,
  filtrarCursosPorNombre,
} from "@/lib/categorizacion-capacitacion-curso";
import { CatListaFiltro } from "@/components/categorizacion/CatEmpleadoBuscador";
import { CatMsg } from "@/components/categorizacion/cat-form-ui";

const EMPTY_FORM = {
  nombre: "",
  fechaInicio: "",
  fechaVencimiento: "",
  activo: true,
};

export function CatCatalogoCapacitacionesPanel() {
  const [cursos, setCursos] = useState<CatCapacitacionCurso[]>([]);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [filtro, setFiltro] = useState("");
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);

  const load = useCallback(async () => {
    setBusy(true);
    try {
      const r = await fetch("/api/categorizacion/capacitacion", { cache: "no-store" });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error);
      setCursos(j.cursos ?? []);
    } catch (e) {
      setMsg(e instanceof Error ? e.message.toUpperCase() : "ERROR AL CARGAR.");
    } finally {
      setBusy(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const cursosFiltrados = useMemo(() => filtrarCursosPorNombre(cursos, filtro), [cursos, filtro]);

  function empezarNueva() {
    setEditId(null);
    setForm(EMPTY_FORM);
    setMsg(null);
  }

  function empezarEdicion(c: CatCapacitacionCurso) {
    setEditId(c.id);
    setForm({
      nombre: c.nombre,
      fechaInicio: c.fechaInicio,
      fechaVencimiento: c.fechaVencimiento,
      activo: c.activo,
    });
    setMsg(null);
  }

  async function guardar() {
    if (!form.nombre.trim() || !form.fechaVencimiento) {
      setMsg("NOMBRE Y FECHA DE VENCIMIENTO SON OBLIGATORIOS.");
      return;
    }
    if (form.fechaInicio && form.fechaInicio > form.fechaVencimiento) {
      setMsg("LA FECHA DE INICIO NO PUEDE SER POSTERIOR AL VENCIMIENTO.");
      return;
    }
    setBusy(true);
    setMsg(null);
    try {
      const r = await fetch("/api/categorizacion/capacitacion", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "save_curso",
          id: editId ?? undefined,
          nombre: form.nombre,
          fechaInicio: form.fechaInicio,
          fechaVencimiento: form.fechaVencimiento,
          activo: form.activo,
        }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error);
      setMsg(editId ? "CAPACITACIÓN ACTUALIZADA." : "CAPACITACIÓN CREADA.");
      empezarNueva();
      await load();
    } catch (e) {
      setMsg(e instanceof Error ? e.message.toUpperCase() : "ERROR AL GUARDAR.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      <p className="text-xs font-medium text-slate-600">
        Define aquí las capacitaciones disponibles. Luego, en{" "}
        <Link href="/categorizacion/capacitacion" className="font-bold text-violet-800 underline">
          Capacitación
        </Link>
        , asigna colaboradores y califica desempeño.
      </p>

      <section className="card space-y-3 border border-violet-100">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-sm font-bold uppercase">{editId ? "Editar capacitación" : "Nueva capacitación"}</h2>
          {editId ? (
            <button type="button" className="text-xs font-bold uppercase text-slate-600" onClick={empezarNueva}>
              Cancelar edición
            </button>
          ) : null}
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <label className="space-y-1 sm:col-span-2 lg:col-span-2">
            <span className="form-label">Nombre de la capacitación</span>
            <input
              className="form-control uppercase"
              value={form.nombre}
              onChange={(e) => setForm((f) => ({ ...f, nombre: e.target.value }))}
              placeholder="EJ. SEGURIDAD INDUSTRIAL"
            />
          </label>
          <label className="space-y-1">
            <span className="form-label">Fecha de inicio</span>
            <input
              type="date"
              className="form-control"
              value={form.fechaInicio}
              onChange={(e) => setForm((f) => ({ ...f, fechaInicio: e.target.value }))}
            />
          </label>
          <label className="space-y-1">
            <span className="form-label">Fecha de vencimiento</span>
            <input
              type="date"
              className="form-control"
              value={form.fechaVencimiento}
              onChange={(e) => setForm((f) => ({ ...f, fechaVencimiento: e.target.value }))}
              required
            />
          </label>
        </div>
        <label className="flex items-center gap-2 text-xs font-semibold uppercase text-slate-700">
          <input
            type="checkbox"
            checked={form.activo}
            onChange={(e) => setForm((f) => ({ ...f, activo: e.target.checked }))}
          />
          Activa (visible para registro de colaboradores si está vigente)
        </label>
        <button type="button" className="btn-primary uppercase" disabled={busy} onClick={() => void guardar()}>
          {editId ? "Guardar cambios" : "Crear capacitación"}
        </button>
      </section>

      <CatMsg msg={msg} />

      <section className="card overflow-x-auto">
        <h2 className="mb-2 text-sm font-bold uppercase">Catálogo ({cursos.length})</h2>
        <CatListaFiltro value={filtro} onChange={setFiltro} total={cursos.length} filtrados={cursosFiltrados.length} />
        {busy && cursos.length === 0 ? <p className="text-sm text-slate-500">Cargando…</p> : null}
        <table className="w-full min-w-[720px] text-xs">
          <thead>
            <tr className="border-b text-[10px] font-bold uppercase text-slate-600">
              <th className="p-2 text-left">Capacitación</th>
              <th className="p-2 text-left">Inicio</th>
              <th className="p-2 text-left">Vence</th>
              <th className="p-2 text-left">Estado</th>
              <th className="p-2" />
            </tr>
          </thead>
          <tbody>
            {cursosFiltrados.map((c) => {
              const estado = estadoCursoCapacitacion(c);
              return (
                <tr key={c.id} className="border-b border-slate-100 hover:bg-slate-50">
                  <td className="p-2 font-semibold uppercase">{c.nombre}</td>
                  <td className="p-2">{c.fechaInicio || "—"}</td>
                  <td className="p-2">{c.fechaVencimiento}</td>
                  <td className="p-2">
                    <EstadoBadge estado={estado} />
                  </td>
                  <td className="p-2 text-right">
                    <button
                      type="button"
                      className="text-[10px] font-bold uppercase text-violet-800"
                      onClick={() => empezarEdicion(c)}
                    >
                      Editar
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {cursosFiltrados.length === 0 && !busy ? (
          <p className="py-6 text-center text-sm text-slate-500">Sin capacitaciones en el catálogo.</p>
        ) : null}
      </section>
    </div>
  );
}

function EstadoBadge({ estado }: { estado: ReturnType<typeof estadoCursoCapacitacion> }) {
  const cls =
    estado === "vigente"
      ? "bg-emerald-100 text-emerald-900"
      : estado === "programada"
        ? "bg-sky-100 text-sky-900"
        : estado === "vencida"
          ? "bg-amber-100 text-amber-900"
          : "bg-slate-200 text-slate-700";
  return (
    <span className={`inline-block rounded px-2 py-0.5 text-[10px] font-bold uppercase ${cls}`}>
      {etiquetaEstadoCurso(estado)}
    </span>
  );
}
