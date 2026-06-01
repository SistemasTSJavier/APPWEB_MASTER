"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { CatListaFiltro, filtrarEmpleados } from "@/components/categorizacion/CatEmpleadoBuscador";
import { CAT_NIVEL_REGLAS, CAT_PAQUETE_REGLAS } from "@/lib/categorizacion-calificaciones";
import type { CatResumenEmpleado } from "@/lib/categorizacion-types";
import { CatMsg } from "@/components/categorizacion/cat-form-ui";

export function CatResumenPanel({ tipo }: { tipo: "nivel" | "paquete-prestaciones" }) {
  const [rows, setRows] = useState<CatResumenEmpleado[]>([]);
  const [nota, setNota] = useState("");
  const [busy, setBusy] = useState(true);
  const [msg, setMsg] = useState<string | null>(null);
  const [filtroTabla, setFiltroTabla] = useState("");

  const rowsFiltrados = useMemo(
    () =>
      filtrarEmpleados(
        rows.map((r) => ({ noEmpleado: r.noEmpleado, nombre: r.nombre })),
        filtroTabla,
      ).map((f) => rows.find((r) => r.noEmpleado === f.noEmpleado)!),
    [rows, filtroTabla],
  );

  const load = useCallback(async () => {
    setBusy(true);
    try {
      const r = await fetch("/api/categorizacion/resumen", { cache: "no-store" });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error);
      setRows(j.rows ?? []);
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
            {tipo === "nivel" ? "Nivel por empleado" : "Paquete de prestaciones"} ({rows.length})
          </h2>
          <button type="button" className="text-xs font-bold uppercase text-violet-800" onClick={() => void load()}>
            Actualizar
          </button>
        </div>
        {busy ? <p className="text-sm text-slate-500">Cargando…</p> : null}
        <CatListaFiltro
          value={filtroTabla}
          onChange={setFiltroTabla}
          total={rows.length}
          filtrados={rowsFiltrados.length}
        />
        <table className="w-full min-w-[720px] text-xs">
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
