"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  CatFiltroPlanta,
  CatFiltroServicio,
  CatListaFiltro,
  CatResumenServicios,
  filtrarEmpleados,
  filtrarPorServicio,
} from "@/components/categorizacion/CatEmpleadoBuscador";
import { CAT_NIVEL_REGLAS, CAT_PAQUETE_REGLAS } from "@/lib/categorizacion-calificaciones";
import type { CatPersonalRow, CatResumenEmpleado } from "@/lib/categorizacion-types";
import { CatMsg } from "@/components/categorizacion/cat-form-ui";
import { fetchColaboradoresActivosCat } from "@/lib/categorizacion-colaboradores-client";

type ResumenConServicio = CatResumenEmpleado & { servicio: string; planta?: string };

export function CatResumenPanel({ tipo }: { tipo: "nivel" | "paquete-prestaciones" }) {
  const [rows, setRows] = useState<ResumenConServicio[]>([]);
  const [nota, setNota] = useState("");
  const [busy, setBusy] = useState(true);
  const [msg, setMsg] = useState<string | null>(null);
  const [filtroTabla, setFiltroTabla] = useState("");
  const [filtroServicio, setFiltroServicio] = useState("");
  const [filtroPlanta, setFiltroPlanta] = useState("");

  const rowsPorServicio = useMemo(
    () => filtrarPorServicio(rows, filtroServicio, filtroPlanta),
    [rows, filtroServicio, filtroPlanta],
  );

  const rowsFiltrados = useMemo(() => {
    const base = filtrarEmpleados(
      rowsPorServicio.map((r) => ({ noEmpleado: r.noEmpleado, nombre: r.nombre })),
      filtroTabla,
    );
    const keys = new Set(base.map((f) => f.noEmpleado));
    return rowsPorServicio.filter((r) => keys.has(r.noEmpleado));
  }, [rows, rowsPorServicio, filtroTabla]);

  const load = useCallback(async () => {
    setBusy(true);
    try {
      const [r, activosRows] = await Promise.all([
        fetch("/api/categorizacion/resumen", { cache: "no-store" }),
        fetchColaboradoresActivosCat({ forceRefresh: true }),
      ]);
      const j = await r.json();
      if (!r.ok) throw new Error(j.error);
      const servicioPorNo = new Map(
        activosRows.map((p) => [p.noEmpleado.trim().toUpperCase(), p.servicio ?? ""]),
      );
      const plantaPorNo = new Map(
        activosRows.map((p) => [p.noEmpleado.trim().toUpperCase(), p.planta ?? ""]),
      );
      const merged: ResumenConServicio[] = (j.rows ?? []).map((row: CatResumenEmpleado) => ({
        ...row,
        servicio: servicioPorNo.get(row.noEmpleado.trim().toUpperCase()) ?? "",
        planta: plantaPorNo.get(row.noEmpleado.trim().toUpperCase()) ?? "",
      }));
      setRows(merged);
      setNota(String(j.nota ?? ""));
    } catch (e) {
      setMsg(e instanceof Error ? e.message.toUpperCase() : "ERROR.");
    } finally {
      setBusy(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const reglas = tipo === "nivel" ? CAT_NIVEL_REGLAS : CAT_PAQUETE_REGLAS;

  return (
    <div className="space-y-4">
      <p className="text-xs font-medium text-slate-700">{nota}</p>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
        {reglas.map((r) => (
          <div key={r.id} className="rounded-lg border border-violet-200 bg-violet-50/50 px-3 py-2 text-xs">
            <p className="font-bold uppercase text-violet-950">{r.label}</p>
            <p className="font-semibold text-slate-700">Promedio {r.rango}</p>
            {"incluye" in r ? <p className="mt-1 text-slate-600">{r.incluye}</p> : null}
          </div>
        ))}
      </div>

      <CatMsg msg={msg} />

      <section className="card overflow-x-auto">
        <div className="mb-2 flex items-center justify-between">
          <h2 className="text-sm font-bold uppercase">
            {tipo === "nivel" ? "Nivel por empleado" : "Paquete de prestaciones"} ({rowsFiltrados.length}
            {rowsPorServicio.length !== rowsFiltrados.length ? ` de ${rowsPorServicio.length}` : ""}
            {filtroServicio && rows.length !== rowsPorServicio.length ? ` · ${rows.length} en catálogo` : ""})
          </h2>
          <button type="button" className="text-xs font-bold uppercase text-violet-800" onClick={() => void load()}>
            Actualizar
          </button>
        </div>
        {busy ? <p className="text-sm text-slate-500">Cargando…</p> : null}
        <CatResumenServicios
          personal={rows.map((r) => ({ servicio: r.servicio, planta: r.planta }))}
          servicioFiltro={filtroServicio}
          className="mb-3"
        />
        <div className="mb-3 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <CatFiltroServicio
            value={filtroServicio}
            onChange={(v) => {
              setFiltroServicio(v);
              setFiltroPlanta("");
            }}
            personal={rows.map((r) => ({ servicio: r.servicio, planta: r.planta }))}
          />
          <CatFiltroPlanta
            servicioFiltro={filtroServicio}
            value={filtroPlanta}
            onChange={setFiltroPlanta}
            personal={rows.map((r) => ({ servicio: r.servicio, planta: r.planta }))}
          />
          <div className="sm:col-span-2">
            <CatListaFiltro
              value={filtroTabla}
              onChange={setFiltroTabla}
              total={rowsPorServicio.length}
              filtrados={rowsFiltrados.length}
              totalCatalogo={filtroServicio ? rows.length : undefined}
            />
          </div>
        </div>
        <table className="w-full min-w-[800px] text-xs">
          <thead>
            <tr className="border-b text-[10px] font-bold uppercase text-slate-600">
              <th className="p-2">N°</th>
              <th className="p-2">Nombre</th>
              <th className="p-2">Prom. RH</th>
              <th className="p-2">Prom. Cap.</th>
              <th className="p-2">Prom. Op.</th>
              <th className="p-2">Prom. Enf.</th>
              <th className="p-2">Prom. general</th>
              <th className="p-2">{tipo === "nivel" ? "Nivel" : "Paquete"}</th>
            </tr>
          </thead>
          <tbody>
            {rowsFiltrados.map((r) => (
              <tr key={r.noEmpleado} className="border-b border-slate-100">
                <td className="p-2 font-mono">{r.noEmpleado}</td>
                <td className="p-2">{r.nombre}</td>
                <td className="p-2">{fmt(r.promedioRh)}</td>
                <td className="p-2">{fmt(r.promedioCapacitacion)}</td>
                <td className="p-2">{fmt(r.promedioOperaciones)}</td>
                <td className="p-2">{fmt(r.promedioEnfoque)}</td>
                <td className="p-2 font-bold">{fmt(r.promedioGeneral)}</td>
                <td className="p-2 font-bold text-violet-900">{tipo === "nivel" ? r.nivel : r.paquete}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  );
}

function fmt(n: number | null): string {
  return n != null ? n.toFixed(2) : "—";
}
