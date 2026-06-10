"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { CatEvalModuloId } from "@/lib/categorizacion-campos";
import { CAT_RH_AUSENTISMOS_LABEL, camposPorModulo, labelModuloEval } from "@/lib/categorizacion-campos";
import {
  CAT_OPERACIONES_ROLES,
  filtrarOficialesParaCalificarJefe,
  personalCoincideRolOperaciones,
  submoduloOperaciones,
  type CatOperacionesRolId,
} from "@/lib/categorizacion-operaciones-roles";
import type { FaltasMesMap } from "@/lib/categorizacion-faltas-cuadricula";
import { faltasMesParaEmpleado } from "@/lib/categorizacion-faltas-cuadricula";
import {
  promedioAcumuladoEvaluaciones,
  promedioDeScores,
  promedioEvaluacionModulo,
} from "@/lib/categorizacion-calificaciones";
import type { CatPersonalRow } from "@/lib/categorizacion-types";
import {
  CatEmpleadoBuscador,
  CatFiltroServicio,
  CatListaFiltro,
  filtrarPersonalListado,
} from "@/components/categorizacion/CatEmpleadoBuscador";
import { CatMsg, CatPromedioBadge, CatRatingGrid } from "@/components/categorizacion/cat-form-ui";
import { fetchCatPersonalList } from "@/lib/categorizacion-personal-client";

type EvalRow = {
  scores: Record<string, number>;
  comentarios: string;
  promedio: number | null;
  calificadoPor?: string;
};

function noKey(no: string): string {
  return no.trim().toUpperCase();
}

export function CatEvaluacionPanel({ modulo }: { modulo: CatEvalModuloId }) {
  const esRh = modulo === "recursos_humanos";
  const esOperaciones = modulo === "operaciones";
  const [rolOperaciones, setRolOperaciones] = useState<CatOperacionesRolId>("oficial");
  const campos = useMemo(
    () => camposPorModulo(modulo, esOperaciones ? { rolOperaciones } : undefined),
    [modulo, esOperaciones, rolOperaciones],
  );
  const [personal, setPersonal] = useState<CatPersonalRow[]>([]);
  const [evalMap, setEvalMap] = useState<Map<string, EvalRow>>(new Map());
  const [jefeEvalMap, setJefeEvalMap] = useState<Map<string, EvalRow[]>>(new Map());
  const [calificadoPorSel, setCalificadoPorSel] = useState("");
  const [faltasMap, setFaltasMap] = useState<FaltasMesMap>({});
  const [faltasMesYm, setFaltasMesYm] = useState("");
  const [noSel, setNoSel] = useState("");
  const [scores, setScores] = useState<Record<string, number | "">>({});
  const [comentarios, setComentarios] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [filtroTabla, setFiltroTabla] = useState("");
  const [filtroServicio, setFiltroServicio] = useState("");

  const filtroPorServicio = modulo === "operaciones" || modulo === "enfoque_cliente";
  const esJefeTurno = esOperaciones && rolOperaciones === "jefe_turno";

  const servicioContexto = useMemo(() => {
    if (filtroServicio.trim()) return filtroServicio.trim();
    const jefe = personal.find((p) => noKey(p.noEmpleado) === noKey(noSel));
    return jefe?.servicio?.trim() ?? "";
  }, [filtroServicio, personal, noSel]);

  const oficialesOpciones = useMemo(
    () => filtrarOficialesParaCalificarJefe(personal, servicioContexto),
    [personal, servicioContexto],
  );

  const personalPorRol = useMemo(() => {
    if (!esOperaciones) return personal;
    return personal.filter((p) => personalCoincideRolOperaciones(p.puesto, rolOperaciones));
  }, [personal, esOperaciones, rolOperaciones]);

  const personalFiltrado = useMemo(
    () =>
      filtrarPersonalListado(
        personalPorRol,
        filtroTabla,
        filtroPorServicio ? filtroServicio : "",
      ),
    [personalPorRol, filtroTabla, filtroServicio, filtroPorServicio],
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
      if (esJefeTurno) {
        const evals = jefeEvalMap.get(noKey(p.noEmpleado)) ?? [];
        if (promedioAcumuladoEvaluaciones(evals.map((e) => e.promedio)) != null) n++;
      } else {
        const ev = evalMap.get(noKey(p.noEmpleado));
        if (promedioEvaluacionModulo(ev?.scores, ev?.promedio) != null) n++;
      }
    }
    return n;
  }, [personalFiltrado, evalMap, jefeEvalMap, esJefeTurno]);

  const acumuladoJefeSel = useMemo(() => {
    if (!esJefeTurno || !noSel) return null;
    const evals = jefeEvalMap.get(noKey(noSel)) ?? [];
    return promedioAcumuladoEvaluaciones(evals.map((e) => e.promedio));
  }, [esJefeTurno, noSel, jefeEvalMap]);

  const evalsJefeSel = useMemo(() => {
    if (!esJefeTurno || !noSel) return [];
    return jefeEvalMap.get(noKey(noSel)) ?? [];
  }, [esJefeTurno, noSel, jefeEvalMap]);

  const load = useCallback(async () => {
    setBusy(true);
    try {
      const faltasReq = esRh
        ? fetch("/api/categorizacion/faltas-mes", { cache: "no-store" })
        : Promise.resolve(null);
      const [personalRows, re, rf] = await Promise.all([
        fetchCatPersonalList(),
        fetch(
          esOperaciones
            ? `/api/categorizacion/evaluaciones?modulo=${modulo}&submodulo=${submoduloOperaciones(rolOperaciones)}`
            : `/api/categorizacion/evaluaciones?modulo=${modulo}`,
          { cache: "no-store" },
        ),
        faltasReq,
      ]);
      const je = await re.json();
      if (!re.ok) throw new Error(je.error);
      setPersonal(personalRows);
      if (esJefeTurno) {
        const porJefe = new Map<string, EvalRow[]>();
        for (const row of je.rows ?? []) {
          const key = noKey(row.noEmpleado);
          const list = porJefe.get(key) ?? [];
          list.push({
            scores: row.scores ?? {},
            comentarios: row.comentarios ?? "",
            promedio: promedioEvaluacionModulo(row.scores, row.promedio),
            calificadoPor: row.calificadoPor ? noKey(row.calificadoPor) : "",
          });
          porJefe.set(key, list);
        }
        setJefeEvalMap(porJefe);
        setEvalMap(new Map());
      } else {
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
        setJefeEvalMap(new Map());
      }
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
  }, [modulo, esRh, esOperaciones, esJefeTurno, rolOperaciones]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    setNoSel("");
    setCalificadoPorSel("");
    setMsg(null);
  }, [rolOperaciones]);

  useEffect(() => {
    setCalificadoPorSel("");
  }, [noSel, filtroServicio]);

  useEffect(() => {
    if (!noSel) {
      setScores({});
      setComentarios("");
      return;
    }
    let ex: EvalRow | undefined;
    if (esJefeTurno) {
      if (!calificadoPorSel) {
        setScores({});
        setComentarios("");
        return;
      }
      ex = (jefeEvalMap.get(noKey(noSel)) ?? []).find(
        (e) => e.calificadoPor === noKey(calificadoPorSel),
      );
    } else {
      ex = evalMap.get(noKey(noSel));
    }
    const init: Record<string, number | ""> = {};
    for (const c of campos) {
      init[c.key] = ex?.scores[c.key] ?? "";
    }
    setScores(init);
    setComentarios(ex?.comentarios ?? "");
  }, [noSel, calificadoPorSel, evalMap, jefeEvalMap, campos, esJefeTurno]);

  function seleccionarEmpleado(no: string) {
    setNoSel(noKey(no));
    setMsg(null);
  }

  async function guardar() {
    if (!noSel) {
      setMsg("SELECCIONA EMPLEADO.");
      return;
    }
    if (esJefeTurno) {
      if (!servicioContexto) {
        setMsg("SELECCIONA UN SERVICIO EN EL FILTRO.");
        return;
      }
      if (!calificadoPorSel) {
        setMsg("SELECCIONA EL OFICIAL (CALIFICADO POR).");
        return;
      }
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
        body: JSON.stringify({
          noEmpleado: noKey(noSel),
          modulo,
          submodulo: esOperaciones ? submoduloOperaciones(rolOperaciones) : undefined,
          calificadoPor: esJefeTurno ? noKey(calificadoPorSel) : undefined,
          scores: nums,
          comentarios,
        }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error);
      const acumJefe =
        esJefeTurno && noSel
          ? promedioAcumuladoEvaluaciones(
              (jefeEvalMap.get(noKey(noSel)) ?? [])
                .filter((e) => e.calificadoPor !== noKey(calificadoPorSel))
                .map((e) => e.promedio)
                .concat(prom != null ? [prom] : []),
            )
          : null;
      setMsg(
        esJefeTurno
          ? `CALIFICACIÓN DEL OFICIAL ${noKey(calificadoPorSel)} GUARDADA.${acumJefe != null ? ` PROMEDIO ACUMULADO DEL JEFE: ${acumJefe.toFixed(2)}` : ""}`
          : prom != null
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
        ) : esOperaciones ? (
          <>
            <strong>Oficial:</strong> 15 criterios operativos (autoevaluación / capacitación).{" "}
            <strong>Jefe de turno:</strong> cada <strong>oficial del servicio</strong> califica por separado (elige
            servicio, jefe de turno y «Calificado por»). El promedio operaciones del jefe es la{" "}
            <strong>media de las calificaciones de todos los oficiales</strong>.
          </>
        ) : (
          <>
            Califica cada criterio del <strong>1 al 5</strong>. El promedio del módulo es la media de los criterios
            calificados ({campos.length} en {labelModuloEval(modulo)}).
          </>
        )}
      </p>

      {esOperaciones ? (
        <div className="flex flex-wrap gap-2">
          {CAT_OPERACIONES_ROLES.map((r) => (
            <button
              key={r.id}
              type="button"
              className={`rounded-lg border px-3 py-2 text-left text-xs transition ${
                rolOperaciones === r.id
                  ? "border-violet-500 bg-violet-100 font-bold text-violet-950"
                  : "border-slate-200 bg-white font-semibold text-slate-700 hover:border-violet-300"
              }`}
              onClick={() => setRolOperaciones(r.id)}
            >
              <span className="block uppercase">{r.label}</span>
              <span className="mt-0.5 block font-normal text-slate-600">{r.hint}</span>
            </button>
          ))}
        </div>
      ) : null}

      <section className="card space-y-3">
        <h2 className="text-sm font-bold uppercase">{labelModuloEval(modulo)} — evaluar empleado</h2>
        {esJefeTurno && !filtroServicio.trim() ? (
          <p className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-950">
            Selecciona primero un <strong>servicio</strong> en el filtro del resumen (abajo) para listar jefes de turno y
            oficiales de ese servicio.
          </p>
        ) : null}
        <CatEmpleadoBuscador
          label={esJefeTurno ? "Jefe de turno a calificar" : "Empleado (registrado en Personal)"}
          value={noSel}
          onChange={seleccionarEmpleado}
          opciones={opciones}
          listId={`cat-eval-${modulo}-empleado`}
          disabled={busy || opciones.length === 0 || (esJefeTurno && !servicioContexto)}
        />
        {esJefeTurno && noSel ? (
          <CatEmpleadoBuscador
            label="Calificado por (oficial del servicio)"
            value={calificadoPorSel}
            onChange={(no) => {
              setCalificadoPorSel(noKey(no));
              setMsg(null);
            }}
            opciones={oficialesOpciones}
            listId={`cat-eval-${modulo}-oficial`}
            disabled={busy || oficialesOpciones.length === 0}
            hint="Cada oficial califica una vez al jefe de turno. Puede editar su propia calificación."
          />
        ) : null}
        {esJefeTurno && noSel && evalsJefeSel.length > 0 ? (
          <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-[11px] text-slate-800">
            <p className="font-bold uppercase text-slate-600">Calificaciones registradas</p>
            <ul className="mt-1 space-y-0.5">
              {evalsJefeSel.map((e) => {
                const of = personal.find((p) => noKey(p.noEmpleado) === e.calificadoPor);
                return (
                  <li key={e.calificadoPor}>
                    Oficial <span className="font-mono">{e.calificadoPor}</span>
                    {of ? ` — ${of.nombre}` : ""}:{" "}
                    <strong>{e.promedio != null ? e.promedio.toFixed(2) : "—"}</strong>
                  </li>
                );
              })}
            </ul>
            {acumuladoJefeSel != null ? (
              <p className="mt-2 font-bold text-violet-950">
                Promedio acumulado operaciones: {acumuladoJefeSel.toFixed(2)} ({evalsJefeSel.length} oficial
                {evalsJefeSel.length === 1 ? "" : "es"})
              </p>
            ) : null}
          </div>
        ) : null}
        {opciones.length === 0 ? (
          <p className="text-xs font-medium text-amber-800">Sincroniza colaboradores activos en el módulo Personal primero.</p>
        ) : null}
        {esJefeTurno && servicioContexto && oficialesOpciones.length === 0 ? (
          <p className="text-xs font-medium text-amber-800">
            No hay oficiales activos en el servicio «{servicioContexto}». Revise puestos en Personal / Colaboradores.
          </p>
        ) : null}
        {!noSel || (esJefeTurno && !calificadoPorSel) ? (
          <p className="rounded-lg border border-dashed border-violet-200 bg-violet-50/50 px-3 py-2 text-xs font-medium text-violet-900">
            {esJefeTurno
              ? "Elige jefe de turno y el oficial que califica."
              : "Elige un empleado de la lista para calificar:"}{" "}
            {!esJefeTurno ? (
              <strong>{campos.map((c) => c.label).join(" · ")}</strong>
            ) : null}
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
              <CatPromedioBadge promedio={promedioPreview} label={esJefeTurno ? "Prom. esta calificación" : undefined} />
              {esJefeTurno && acumuladoJefeSel != null ? (
                <CatPromedioBadge promedio={acumuladoJefeSel} label="Prom. acumulado jefe" />
              ) : null}
              <button type="button" className="btn-primary uppercase" disabled={busy} onClick={() => void guardar()}>
                {esJefeTurno ? "Guardar calificación del oficial" : "Guardar y promediar"}
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
          Resumen — {labelModuloEval(modulo)}
          {esOperaciones ? ` (${rolOperaciones === "jefe_turno" ? "Jefe de turno" : "Oficial"})` : ""} (
          {evaluadosCount} de {personalFiltrado.length} con promedio
          {personalPorRol.length !== personalFiltrado.length
            ? ` · ${personalPorRol.length} en este perfil`
            : ""}
          {personal.length !== personalPorRol.length ? ` · ${personal.length} en catálogo` : ""})
        </h2>
        <div className="mb-3 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {filtroPorServicio ? (
            <CatFiltroServicio
              value={filtroServicio}
              onChange={setFiltroServicio}
              personal={esOperaciones ? personalPorRol : personal}
            />
          ) : null}
          <div className={filtroPorServicio ? "sm:col-span-2" : "sm:col-span-3"}>
            <CatListaFiltro
              value={filtroTabla}
              onChange={setFiltroTabla}
              total={personal.length}
              filtrados={personalFiltrado.length}
            />
          </div>
        </div>
        <div className="max-h-[min(70vh,36rem)] overflow-auto rounded-lg border border-slate-100">
          <table className="w-full min-w-[640px] text-xs">
            <thead className="sticky top-0 z-[1] border-b border-slate-200 bg-slate-50 text-[10px] font-bold uppercase text-slate-600">
              <tr>
                <th className="p-2 text-left">N°</th>
                <th className="p-2 text-left">Nombre</th>
                {esOperaciones ? <th className="p-2 text-left">Puesto</th> : null}
                {esRh ? (
                  <th className="p-2 text-center" title={CAT_RH_AUSENTISMOS_LABEL}>
                    Faltas
                  </th>
                ) : null}
                {esJefeTurno ? (
                  <>
                    <th className="p-2 text-center">Oficiales</th>
                    <th className="p-2 text-center">Prom. acum.</th>
                  </>
                ) : (
                  campos.map((c) => (
                    <th key={c.key} className="p-2 text-center" title={c.label}>
                      {abreviarCriterio(c.label)}
                    </th>
                  ))
                )}
                {!esJefeTurno ? <th className="p-2 text-center">Prom.</th> : null}
                <th className="p-2" />
              </tr>
            </thead>
            <tbody>
              {personalFiltrado.map((p) => {
                const evalsJefe = jefeEvalMap.get(noKey(p.noEmpleado)) ?? [];
                const ev = evalMap.get(noKey(p.noEmpleado));
                const prom = esJefeTurno
                  ? promedioAcumuladoEvaluaciones(evalsJefe.map((e) => e.promedio))
                  : promedioEvaluacionModulo(ev?.scores, ev?.promedio);
                const activo = noKey(p.noEmpleado) === noKey(noSel);
                const faltas = esRh ? faltasMesParaEmpleado(faltasMap, p.noEmpleado) : null;
                return (
                  <tr
                    key={p.noEmpleado}
                    className={`border-b border-slate-100 ${activo ? "bg-violet-50" : "hover:bg-slate-50"}`}
                  >
                    <td className="p-2 font-mono">{p.noEmpleado}</td>
                    <td className="p-2">{p.nombre}</td>
                    {esOperaciones ? (
                      <td className="p-2 text-[10px] font-medium uppercase text-slate-600">{p.puesto || "—"}</td>
                    ) : null}
                    {esRh ? (
                      <td
                        className={`p-2 text-center font-mono font-bold ${(faltas?.total ?? 0) > 0 ? "text-amber-900" : "text-slate-400"}`}
                      >
                        {faltas?.total ?? 0}
                      </td>
                    ) : null}
                    {esJefeTurno ? (
                      <>
                        <td className="p-2 text-center font-mono">{evalsJefe.length}</td>
                        <td className="p-2 text-center text-sm font-bold text-violet-950">
                          {prom != null ? prom.toFixed(2) : "—"}
                        </td>
                      </>
                    ) : (
                      <>
                        {campos.map((c) => (
                          <td key={c.key} className="p-2 text-center font-mono">
                            {ev?.scores[c.key] != null ? ev.scores[c.key] : "—"}
                          </td>
                        ))}
                        <td className="p-2 text-center text-sm font-bold text-violet-950">
                          {prom != null ? prom.toFixed(2) : "—"}
                        </td>
                      </>
                    )}
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
