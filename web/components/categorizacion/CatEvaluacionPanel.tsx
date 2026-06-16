"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { CatEvalModuloId } from "@/lib/categorizacion-campos";
import { CAT_RH_AUSENTISMOS_LABEL, camposPorModulo, labelModuloEval } from "@/lib/categorizacion-campos";
import type { FaltasMesMap } from "@/lib/categorizacion-faltas-cuadricula";
import { faltasMesParaEmpleado } from "@/lib/categorizacion-faltas-cuadricula";
import { promedioDeScores, promedioEvaluacionModulo } from "@/lib/categorizacion-calificaciones";
import type { CatPersonalRow } from "@/lib/categorizacion-types";
import {
  CatEmpleadoBuscador,
  CatFiltroServicio,
  CatListaFiltro,
  CatResumenServicios,
  filtrarPersonalListado,
  filtrarPorServicio,
} from "@/components/categorizacion/CatEmpleadoBuscador";
import { CatMsg, CatPromedioBadge, CatRatingGrid } from "@/components/categorizacion/cat-form-ui";
import { fetchCatPersonalList } from "@/lib/categorizacion-personal-client";

type EvalRow = {
  scores: Record<string, number>;
  comentarios: string;
  promedio: number | null;
};

function noKey(no: string): string {
  return no.trim().toUpperCase();
}

export function CatEvaluacionPanel({ modulo }: { modulo: CatEvalModuloId }) {
  const esRh = modulo === "recursos_humanos";
  const campos = useMemo(() => camposPorModulo(modulo), [modulo]);
  const [personal, setPersonal] = useState<CatPersonalRow[]>([]);
  const [evalMap, setEvalMap] = useState<Map<string, EvalRow>>(new Map());
  const [faltasMap, setFaltasMap] = useState<FaltasMesMap>({});
  const [faltasMesYm, setFaltasMesYm] = useState("");
  const [noSel, setNoSel] = useState("");
  const [scores, setScores] = useState<Record<string, number | "">>({});
  const [comentarios, setComentarios] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [filtroTabla, setFiltroTabla] = useState("");
  const [filtroServicio, setFiltroServicio] = useState("");

  const personalPorServicio = useMemo(
    () => filtrarPorServicio(personal, filtroServicio),
    [personal, filtroServicio],
  );

  const personalFiltrado = useMemo(
    () => filtrarPersonalListado(personal, filtroTabla, filtroServicio),
    [personal, filtroTabla, filtroServicio],
  );
  const opciones = useMemo(
    () => personalFiltrado.map((p) => ({ noEmpleado: p.noEmpleado, nombre: p.nombre })),
    [personalFiltrado],
  );

  const faltasSeleccionado = useMemo(
    () => (noSel && esRh ? faltasMesParaEmpleado(faltasMap, noSel) : null),
    [noSel, esRh, faltasMap],
  );

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
    for (const p of personalFiltrado) {
      const ev = evalMap.get(noKey(p.noEmpleado));
      if (promedioEvaluacionModulo(ev?.scores, ev?.promedio) != null) n++;
    }
    return n;
  }, [personalFiltrado, evalMap]);

  const load = useCallback(async () => {
    setBusy(true);
    try {
      const faltasReq = esRh
        ? fetch("/api/categorizacion/faltas-mes", { cache: "no-store" })
        : Promise.resolve(null);
      const [personalRows, re, rf] = await Promise.all([
        fetchCatPersonalList({ forceRefresh: true }),
        fetch(`/api/categorizacion/evaluaciones?modulo=${modulo}`, { cache: "no-store" }),
        faltasReq,
      ]);
      const je = await re.json();
      if (!re.ok) throw new Error(je.error);
      setPersonal(personalRows);
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
      if (rf) {
        const jf = await rf.json();
        if (!rf.ok) throw new Error(jf.error);
        setFaltasMap(jf.faltas ?? {});
        setFaltasMesYm(String(jf.mesYm ?? ""));
      }
    } catch (e) {
      setMsg(e instanceof Error ? e.message.toUpperCase() : "ERROR AL CARGAR.");
    } finally {
      setBusy(false);
    }
  }, [modulo, esRh]);

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
          ? `EVALUACIÓN GUARDADA. PROMEDIO ${esRh ? "RH" : ""}: ${prom.toFixed(2)}`.trim()
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
        {esRh ? (
          <>
            <strong>{CAT_RH_AUSENTISMOS_LABEL}</strong> se obtiene de la cuadrícula de asistencia del mes{" "}
            <strong>{faltasMesYm || "actual"}</strong> (códigos F). Califica rotación y actas del{" "}
            <strong>1 al 5</strong>; el promedio RH usa solo esos criterios.
          </>
        ) : (
          <>
            Califica cada criterio del <strong>1 al 5</strong>. El promedio del módulo es la media de los criterios
            calificados ({campos.length} en {labelModuloEval(modulo)}).
          </>
        )}
      </p>

      <section className="card space-y-3">
        <h2 className="text-sm font-bold uppercase">{labelModuloEval(modulo)} — evaluar empleado</h2>
        <CatResumenServicios personal={personal} servicioFiltro={filtroServicio} />
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <CatFiltroServicio value={filtroServicio} onChange={setFiltroServicio} personal={personal} />
          <div className="sm:col-span-2">
            <CatEmpleadoBuscador
              label="Empleado (registrado en Personal)"
              value={noSel}
              onChange={seleccionarEmpleado}
              opciones={opciones}
              listId={`cat-eval-${modulo}-empleado`}
              disabled={busy || opciones.length === 0}
            />
          </div>
        </div>
        {opciones.length === 0 ? (
          <p className="text-xs font-medium text-amber-800">Sincroniza colaboradores activos en el módulo Personal primero.</p>
        ) : null}
        {!noSel ? (
          <p className="rounded-lg border border-dashed border-violet-200 bg-violet-50/50 px-3 py-2 text-xs font-medium text-violet-900">
            Elige un empleado de la lista para calificar:{" "}
            <strong>{campos.map((c) => c.label).join(" · ")}</strong>
            {esRh ? ` · ${CAT_RH_AUSENTISMOS_LABEL} (automático)` : ""}
          </p>
        ) : (
          <>
            {esRh ? (
              <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-3">
                <p className="text-[10px] font-bold uppercase text-slate-600">{CAT_RH_AUSENTISMOS_LABEL}</p>
                <p className="mt-1 text-2xl font-extrabold tabular-nums text-slate-900">
                  {faltasSeleccionado?.total ?? 0}
                </p>
                {faltasSeleccionado && faltasSeleccionado.fechas.length > 0 ? (
                  <p className="mt-1 text-[11px] font-medium text-slate-700">{faltasSeleccionado.fechas.join(" · ")}</p>
                ) : (
                  <p className="mt-1 text-[11px] text-slate-500">Sin faltas registradas en cuadrícula este mes.</p>
                )}
              </div>
            ) : null}
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

      <section className="card overflow-hidden">
        <h2 className="mb-2 px-1 text-sm font-bold uppercase">
          Resumen — {labelModuloEval(modulo)} ({evaluadosCount} evaluado(s) de {personalPorServicio.length} activo(s)
          {filtroServicio && personal.length !== personalPorServicio.length ? ` · ${personal.length} en catálogo` : ""})
        </h2>
        <div className="mb-3 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <CatFiltroServicio value={filtroServicio} onChange={setFiltroServicio} personal={personal} />
          <div className="sm:col-span-2">
            <CatListaFiltro
              value={filtroTabla}
              onChange={setFiltroTabla}
              total={personalPorServicio.length}
              filtrados={personalFiltrado.length}
              totalCatalogo={filtroServicio ? personal.length : undefined}
            />
          </div>
        </div>
        <div className="max-h-[min(70vh,36rem)] overflow-auto rounded-lg border border-slate-100">
          <table className="w-full min-w-[640px] text-xs">
            <thead className="sticky top-0 z-[1] border-b border-slate-200 bg-slate-50 text-[10px] font-bold uppercase text-slate-600">
              <tr>
                <th className="p-2 text-left">N°</th>
                <th className="p-2 text-left">Nombre</th>
                {esRh ? (
                  <th className="p-2 text-center" title={CAT_RH_AUSENTISMOS_LABEL}>
                    Faltas
                  </th>
                ) : null}
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
                const faltas = esRh ? faltasMesParaEmpleado(faltasMap, p.noEmpleado) : null;
                return (
                  <tr
                    key={p.noEmpleado}
                    className={`border-b border-slate-100 ${activo ? "bg-violet-50" : "hover:bg-slate-50"}`}
                  >
                    <td className="p-2 font-mono">{p.noEmpleado}</td>
                    <td className="p-2">{p.nombre}</td>
                    {esRh ? (
                      <td
                        className={`p-2 text-center font-mono font-bold ${(faltas?.total ?? 0) > 0 ? "text-amber-900" : "text-slate-400"}`}
                      >
                        {faltas?.total ?? 0}
                      </td>
                    ) : null}
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
        </div>
      </section>
    </div>
  );
}

function abreviarCriterio(label: string): string {
  const map: Record<string, string> = {
    "Rotación dentro de los servicios": "Rotac.",
    "Actas administrativas": "Actas",
  };
  if (map[label]) return map[label];
  if (label.length <= 12) return label;
  return `${label.slice(0, 10)}…`;
}
