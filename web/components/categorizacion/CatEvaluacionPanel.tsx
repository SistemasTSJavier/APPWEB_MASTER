"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { CatEvalModuloId } from "@/lib/categorizacion-campos";
import { camposPorModulo, labelModuloEval } from "@/lib/categorizacion-campos";
import { promedioDeScores, promedioEvaluacionModulo } from "@/lib/categorizacion-calificaciones";
import type { CatPersonalRow } from "@/lib/categorizacion-types";
import {
  CatEmpleadoBuscador,
  CatListaFiltro,
  filtrarEmpleados,
} from "@/components/categorizacion/CatEmpleadoBuscador";
import { CatMsg, CatPromedioBadge, CatRatingGrid } from "@/components/categorizacion/cat-form-ui";

type EvalRow = {
  scores: Record<string, number>;
  comentarios: string;
  promedio: number | null;
};

function noKey(no: string): string {
  return no.trim().toUpperCase();
}

export function CatEvaluacionPanel({ modulo }: { modulo: CatEvalModuloId }) {
  const campos = useMemo(() => camposPorModulo(modulo), [modulo]);
  const [personal, setPersonal] = useState<CatPersonalRow[]>([]);
  const [evalMap, setEvalMap] = useState<Map<string, EvalRow>>(new Map());
  const [noSel, setNoSel] = useState("");
  const [scores, setScores] = useState<Record<string, number | "">>({});
  const [comentarios, setComentarios] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [filtroTabla, setFiltroTabla] = useState("");

  const opciones = useMemo(
    () => personal.map((p) => ({ noEmpleado: p.noEmpleado, nombre: p.nombre })),
    [personal],
  );
  const personalFiltrado = useMemo(() => filtrarEmpleados(personal, filtroTabla), [personal, filtroTabla]);

  const promedioPreview = useMemo(() => {
    const nums: Record<string, number> = {};
    for (const [k, v] of Object.entries(scores)) {
      if (v !== "") nums[k] = v;
    }
    return promedioDeScores(nums);
  }, [scores]);

  const criteriosCalificados = useMemo(
    () => campos.filter((c) => scores[c.key] !== "" && scores[c.key] != null).length,
    [campos, scores],
  );

  const evaluadosCount = useMemo(() => {
    let n = 0;
    for (const p of personal) {
      const ev = evalMap.get(noKey(p.noEmpleado));
      if (promedioEvaluacionModulo(ev?.scores, ev?.promedio) != null) n++;
    }
    return n;
  }, [personal, evalMap]);

  const load = useCallback(async () => {
    setBusy(true);
    try {
      const [rp, re] = await Promise.all([
        fetch("/api/categorizacion/personal", { cache: "no-store" }),
        fetch(`/api/categorizacion/evaluaciones?modulo=${modulo}`, { cache: "no-store" }),
      ]);
      const jp = await rp.json();
      const je = await re.json();
      if (!rp.ok) throw new Error(jp.error);
      if (!re.ok) throw new Error(je.error);
      setPersonal(Array.isArray(jp.rows) ? jp.rows : []);
      const m = new Map<string, EvalRow>();
      for (const row of je.rows ?? []) {
        const key = noKey(row.noEmpleado);
        m.set(key, {
          scores: row.scores ?? {},
          comentarios: row.comentarios ?? "",
          promedio: promedioEvaluacionModulo(row.scores, row.promedio),
        });
      }
      setEvalMap(m);
    } catch (e) {
      setMsg(e instanceof Error ? e.message.toUpperCase() : "ERROR AL CARGAR.");
    } finally {
      setBusy(false);
    }
  }, [modulo]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!noSel) {
      setScores({});
      setComentarios("");
      return;
    }
    const ex = evalMap.get(noKey(noSel));
    const init: Record<string, number | ""> = {};
    for (const c of campos) {
      init[c.key] = ex?.scores[c.key] ?? "";
    }
    setScores(init);
    setComentarios(ex?.comentarios ?? "");
  }, [noSel, evalMap, campos]);

  function seleccionarEmpleado(no: string) {
    setNoSel(noKey(no));
    setMsg(null);
  }

  async function guardar() {
    if (!noSel) {
      setMsg("SELECCIONA EMPLEADO.");
      return;
    }
    const nums: Record<string, number> = {};
    for (const [k, v] of Object.entries(scores)) {
      if (v !== "") nums[k] = v;
    }
    if (Object.keys(nums).length === 0) {
      setMsg("CALIFICA AL MENOS UN CRITERIO (1–5).");
      return;
    }
    const prom = promedioDeScores(nums);
    setBusy(true);
    setMsg(null);
    try {
      const r = await fetch("/api/categorizacion/evaluaciones", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ noEmpleado: noKey(noSel), modulo, scores: nums, comentarios }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error);
      setMsg(
        prom != null
          ? `EVALUACIÓN GUARDADA. PROMEDIO ${modulo === "recursos_humanos" ? "RH" : ""}: ${prom.toFixed(2)}`.trim()
          : "EVALUACIÓN GUARDADA.",
      );
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
        Califica cada criterio del <strong>1 al 5</strong>. El <strong>promedio del módulo</strong> es la media de los
        criterios calificados ({campos.length} en {labelModuloEval(modulo)}).
      </p>

      <section className="card space-y-3">
        <h2 className="text-sm font-bold uppercase">{labelModuloEval(modulo)} — evaluar empleado</h2>
        <CatEmpleadoBuscador
          label="Empleado (registrado en Personal)"
          value={noSel}
          onChange={seleccionarEmpleado}
          opciones={opciones}
          listId={`cat-eval-${modulo}-empleado`}
          disabled={busy || opciones.length === 0}
        />
        {opciones.length === 0 ? (
          <p className="text-xs font-medium text-amber-800">Registra empleados en el módulo Personal primero.</p>
        ) : null}
        {!noSel ? (
          <p className="rounded-lg border border-dashed border-violet-200 bg-violet-50/50 px-3 py-2 text-xs font-medium text-violet-900">
            Elige un empleado de la lista para calificar:{" "}
            <strong>{campos.map((c) => c.label).join(" · ")}</strong>
          </p>
        ) : (
          <>
            <CatRatingGrid
              campos={campos}
              scores={scores}
              onChange={(key, v) => setScores((prev) => ({ ...prev, [key]: v }))}
            />
            <p className="text-[11px] font-semibold text-slate-600">
              Criterios calificados: {criteriosCalificados} de {campos.length}
              {criteriosCalificados > 0 && promedioPreview != null
                ? ` · Promedio parcial: ${promedioPreview.toFixed(2)}`
                : ""}
            </p>
            <label className="block space-y-1">
              <span className="form-label">Comentarios</span>
              <textarea
                className="form-control min-h-[80px]"
                value={comentarios}
                onChange={(e) => setComentarios(e.target.value)}
              />
            </label>
            <div className="flex flex-wrap items-center gap-3">
              <CatPromedioBadge promedio={promedioPreview} />
              <button type="button" className="btn-primary uppercase" disabled={busy} onClick={() => void guardar()}>
                Guardar y promediar
              </button>
              <Link
                href={`/categorizacion/dashboard?no=${encodeURIComponent(noSel)}`}
                className="btn-secondary uppercase"
              >
                Ver dashboard
              </Link>
            </div>
          </>
        )}
      </section>

      <CatMsg msg={msg} />

      <section className="card overflow-x-auto">
        <h2 className="mb-2 text-sm font-bold uppercase">
          Resumen — promedios {labelModuloEval(modulo)} ({evaluadosCount} de {personal.length})
        </h2>
        <CatListaFiltro
          value={filtroTabla}
          onChange={setFiltroTabla}
          total={personal.length}
          filtrados={personalFiltrado.length}
        />
        <table className="w-full min-w-[640px] text-xs">
          <thead>
            <tr className="border-b text-[10px] font-bold uppercase text-slate-600">
              <th className="p-2 text-left">N°</th>
              <th className="p-2 text-left">Nombre</th>
              {campos.map((c) => (
                <th key={c.key} className="p-2 text-center" title={c.label}>
                  {abreviarCriterio(c.label)}
                </th>
              ))}
              <th className="p-2 text-center">Prom.</th>
              <th className="p-2" />
            </tr>
          </thead>
          <tbody>
            {personalFiltrado.map((p) => {
              const ev = evalMap.get(noKey(p.noEmpleado));
              const prom = promedioEvaluacionModulo(ev?.scores, ev?.promedio);
              const activo = noKey(p.noEmpleado) === noKey(noSel);
              return (
                <tr
                  key={p.noEmpleado}
                  className={`border-b border-slate-100 ${activo ? "bg-violet-50" : "hover:bg-slate-50"}`}
                >
                  <td className="p-2 font-mono">{p.noEmpleado}</td>
                  <td className="p-2">{p.nombre}</td>
                  {campos.map((c) => (
                    <td key={c.key} className="p-2 text-center font-mono">
                      {ev?.scores[c.key] != null ? ev.scores[c.key] : "—"}
                    </td>
                  ))}
                  <td className="p-2 text-center text-sm font-bold text-violet-950">
                    {prom != null ? prom.toFixed(2) : "—"}
                  </td>
                  <td className="p-2 text-right">
                    <button
                      type="button"
                      className="text-[10px] font-bold uppercase text-violet-800"
                      onClick={() => seleccionarEmpleado(p.noEmpleado)}
                    >
                      {activo ? "Editando" : "Calificar"}
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </section>
    </div>
  );
}

/** Encabezado corto para columnas de la tabla resumen. */
function abreviarCriterio(label: string): string {
  const map: Record<string, string> = {
    Ausentismos: "Ausent.",
    "Rotación dentro de los servicios": "Rotac.",
    "Actas administrativas": "Actas",
  };
  if (map[label]) return map[label];
  if (label.length <= 12) return label;
  return `${label.slice(0, 10)}…`;
}
