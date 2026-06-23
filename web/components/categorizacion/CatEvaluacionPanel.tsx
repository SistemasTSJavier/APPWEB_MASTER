"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { CatEvalModuloId } from "@/lib/categorizacion-campos";
import { CAT_RH_AUSENTISMOS_LABEL, camposPorModulo, labelModuloEval } from "@/lib/categorizacion-campos";
import {
  CAT_OPERACIONES_ROLES,
  filtrarOficialesParaCalificarJefe,
  personalCoincideRolOperaciones,
  puestoEsJefeTurno,
  puestoEsOficialOperaciones,
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
import type { CatColaboradorActivoOpcion } from "@/lib/categorizacion-types";
import {
  CatEmpleadoBuscador,
  CatFiltroServicio,
  CatListaFiltro,
  CatResumenServicios,
  CatSelectorServicioObligatorio,
  filtrarPersonalListado,
  filtrarPorServicio,
} from "@/components/categorizacion/CatEmpleadoBuscador";
import { CatMsg, CatPromedioBadge, CatRatingGrid } from "@/components/categorizacion/cat-form-ui";
import { fetchColaboradoresActivosCat } from "@/lib/categorizacion-colaboradores-client";

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
  const [activos, setActivos] = useState<CatColaboradorActivoOpcion[]>([]);
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

  const filtroPorServicio = modulo === "enfoque_cliente";
  const esJefeTurno = esOperaciones && rolOperaciones === "jefe_turno";
  const servicioOperacionesElegido = esOperaciones ? filtroServicio.trim() : "";
  const necesitaServicioOperaciones = esOperaciones && !servicioOperacionesElegido;

  const activosEnServicioOperaciones = useMemo(
    () => (servicioOperacionesElegido ? filtrarPorServicio(activos, servicioOperacionesElegido) : []),
    [activos, servicioOperacionesElegido],
  );

  const conteoServicioOperaciones = useMemo(() => {
    let oficiales = 0;
    let jefesTurno = 0;
    for (const p of activosEnServicioOperaciones) {
      if (puestoEsJefeTurno(p.puesto)) jefesTurno++;
      else if (puestoEsOficialOperaciones(p.puesto)) oficiales++;
    }
    return { oficiales, jefesTurno };
  }, [activosEnServicioOperaciones]);

  function elegirServicioOperaciones(servicio: string) {
    setFiltroServicio(servicio.trim());
    setNoSel("");
    setCalificadoPorSel("");
    setFiltroTabla("");
    setMsg(null);
  }

  function cambiarServicioOperaciones() {
    elegirServicioOperaciones("");
  }

  const oficialesOpciones = useMemo(
    () => filtrarOficialesParaCalificarJefe(activosEnServicioOperaciones, servicioOperacionesElegido),
    [activosEnServicioOperaciones, servicioOperacionesElegido],
  );

  const activosPorRol = useMemo(() => {
    if (!esOperaciones) return activos;
    const porRol = activos.filter((p) => personalCoincideRolOperaciones(p.puesto, rolOperaciones));
    if (!servicioOperacionesElegido) return [];
    return filtrarPorServicio(porRol, servicioOperacionesElegido);
  }, [activos, esOperaciones, rolOperaciones, servicioOperacionesElegido]);

  const personalPorServicio = useMemo(
    () => (esOperaciones ? activosPorRol : filtrarPorServicio(activosPorRol, filtroServicio)),
    [activosPorRol, filtroServicio, esOperaciones],
  );

  const personalFiltrado = useMemo(
    () =>
      esOperaciones
        ? filtrarPersonalListado(activosPorRol, filtroTabla, servicioOperacionesElegido)
        : filtrarPersonalListado(activosPorRol, filtroTabla, filtroServicio),
    [activosPorRol, filtroTabla, filtroServicio, esOperaciones, servicioOperacionesElegido],
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

  const aplicarFilasEvaluacion = useCallback(
    (rows: Array<{
      noEmpleado: string;
      scores?: Record<string, number>;
      comentarios?: string;
      promedio?: number | null;
      calificadoPor?: string;
    }>) => {
      if (esJefeTurno) {
        const porJefe = new Map<string, EvalRow[]>();
        for (const row of rows) {
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
        return;
      }
      const m = new Map<string, EvalRow>();
      for (const row of rows) {
        const key = noKey(row.noEmpleado);
        m.set(key, {
          scores: row.scores ?? {},
          comentarios: row.comentarios ?? "",
          promedio: promedioEvaluacionModulo(row.scores, row.promedio),
        });
      }
      setEvalMap(m);
      setJefeEvalMap(new Map());
    },
    [esJefeTurno],
  );

  const load = useCallback(async () => {
    setBusy(true);
    const avisos: string[] = [];
    try {
      try {
        const activosRows = await fetchColaboradoresActivosCat({ forceRefresh: true });
        setActivos(activosRows);
      } catch (e) {
        avisos.push(e instanceof Error ? e.message.toUpperCase() : "ERROR AL CARGAR COLABORADORES.");
        setActivos([]);
      }

      try {
        const re = await fetch(
          esOperaciones
            ? `/api/categorizacion/evaluaciones?modulo=${modulo}&submodulo=${submoduloOperaciones(rolOperaciones)}`
            : `/api/categorizacion/evaluaciones?modulo=${modulo}`,
          { cache: "no-store" },
        );
        const je = await re.json();
        if (!re.ok) throw new Error(je.error);
        aplicarFilasEvaluacion(je.rows ?? []);
      } catch (e) {
        avisos.push(e instanceof Error ? e.message.toUpperCase() : "ERROR AL CARGAR EVALUACIONES.");
        setEvalMap(new Map());
        setJefeEvalMap(new Map());
      }

      if (esRh) {
        try {
          const rf = await fetch("/api/categorizacion/faltas-mes", { cache: "no-store" });
          const jf = await rf.json();
          if (!rf.ok) throw new Error(jf.error);
          setFaltasMap(jf.faltas ?? {});
          setFaltasMesYm(String(jf.mesYm ?? ""));
        } catch (e) {
          avisos.push(e instanceof Error ? e.message.toUpperCase() : "ERROR AL CARGAR FALTAS.");
        }
      }

      setMsg(avisos.length > 0 ? avisos.join(" · ") : null);
    } finally {
      setBusy(false);
    }
  }, [modulo, esRh, esOperaciones, rolOperaciones, aplicarFilasEvaluacion]);

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
      if (!servicioOperacionesElegido) {
        setMsg("SELECCIONA UN SERVICIO.");
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
          ? `CALIFICACIÓN DEL OFICIAL ${noKey(calificadoPorSel)} GUARDADA.${acumJefe != null ? ` PROMEDIO ACUMULADO DEL JT: ${acumJefe.toFixed(2)}` : ""}`
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
            Elija primero el <strong>servicio</strong>. Después podrá calificar <strong>oficiales</strong> (15
            criterios) o <strong>jefes de turno</strong> (24 criterios; cada oficial del servicio califica al JT y el
            promedio es la media de esas calificaciones).
          </>
        ) : (
          <>
            Califica cada criterio del <strong>1 al 5</strong>. El promedio del módulo es la media de los criterios
            calificados ({campos.length} en {labelModuloEval(modulo)}).
          </>
        )}
      </p>

      <CatMsg msg={msg} />

      {esOperaciones && necesitaServicioOperaciones ? (
        <section className="card space-y-4">
          <div>
            <h2 className="text-sm font-bold uppercase text-violet-950">Paso 1 — Seleccione el servicio</h2>
            <p className="mt-1 text-xs text-slate-600">
              Solo se listan colaboradores del servicio elegido: oficiales para el perfil estándar y jefes de turno
              (JT) para calificación por oficiales.
            </p>
          </div>
          {busy && activos.length === 0 ? (
            <p className="text-xs font-medium text-slate-500">Cargando colaboradores activos…</p>
          ) : null}
          <CatSelectorServicioObligatorio
            value={filtroServicio}
            onChange={elegirServicioOperaciones}
            personal={activos}
            disabled={busy}
          />
        </section>
      ) : null}

      {esOperaciones && !necesitaServicioOperaciones ? (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-violet-200 bg-violet-50 px-3 py-2">
          <p className="text-xs font-semibold text-violet-950">
            Servicio: <strong className="uppercase">{servicioOperacionesElegido}</strong>
            <span className="ml-2 font-normal text-slate-600">
              {conteoServicioOperaciones.oficiales} oficial
              {conteoServicioOperaciones.oficiales === 1 ? "" : "es"} · {conteoServicioOperaciones.jefesTurno} JT
            </span>
          </p>
          <button
            type="button"
            className="btn-secondary text-[10px] uppercase"
            onClick={cambiarServicioOperaciones}
          >
            Cambiar servicio
          </button>
        </div>
      ) : null}

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
        {necesitaServicioOperaciones ? (
          <p className="rounded-lg border border-dashed border-violet-200 bg-violet-50/50 px-3 py-2 text-xs font-medium text-violet-900">
            Seleccione un servicio arriba para ver oficiales y jefes de turno de ese servicio.
          </p>
        ) : (
          <>
        <CatResumenServicios personal={activosPorRol} servicioFiltro={filtroServicio} />
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {filtroPorServicio ? (
            <CatFiltroServicio value={filtroServicio} onChange={setFiltroServicio} personal={activosPorRol} />
          ) : null}
          <div className={filtroPorServicio ? "sm:col-span-2" : "sm:col-span-3"}>
            <CatEmpleadoBuscador
              label={esJefeTurno ? "Jefe de turno (JT) a calificar" : "Empleado (activo en Colaboradores)"}
              hint="Datos en vivo desde expedientes activos. Escribe N° o nombre."
              value={noSel}
              onChange={seleccionarEmpleado}
              opciones={opciones}
              listId={`cat-eval-${modulo}-empleado`}
              disabled={busy || opciones.length === 0}
            />
          </div>
        </div>
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
            hint="Cada oficial califica una vez al JT. Puede editar su propia calificación."
          />
        ) : null}
        {esJefeTurno && noSel && evalsJefeSel.length > 0 ? (
          <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-[11px] text-slate-800">
            <p className="font-bold uppercase text-slate-600">Calificaciones registradas</p>
            <ul className="mt-1 space-y-0.5">
              {evalsJefeSel.map((e) => {
                const of = activos.find((p) => noKey(p.noEmpleado) === e.calificadoPor);
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
          <p className="text-xs font-medium text-amber-800">No hay colaboradores activos en expedientes.</p>
        ) : null}
        {esJefeTurno && servicioOperacionesElegido && oficialesOpciones.length === 0 ? (
          <p className="text-xs font-medium text-amber-800">
            No hay oficiales activos en el servicio «{servicioOperacionesElegido}». Revise puestos en Colaboradores.
          </p>
        ) : null}
        {!noSel || (esJefeTurno && !calificadoPorSel) ? (
          <p className="rounded-lg border border-dashed border-violet-200 bg-violet-50/50 px-3 py-2 text-xs font-medium text-violet-900">
            {esJefeTurno
              ? "Elige jefe de turno y el oficial que califica."
              : "Elige un empleado de la lista para calificar."}{" "}
            {!esJefeTurno ? (
              <strong>{campos.map((c) => c.label).join(" · ")}</strong>
            ) : (
              <strong>{campos.length} criterios de liderazgo (1–5 cada uno).</strong>
            )}
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
                <CatPromedioBadge promedio={acumuladoJefeSel} label="Prom. acumulado JT" />
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
          </>
        )}
      </section>

      <section className="card overflow-hidden">
        <h2 className="mb-2 px-1 text-sm font-bold uppercase">
          Resumen — {labelModuloEval(modulo)}
          {esOperaciones ? ` (${rolOperaciones === "jefe_turno" ? "Jefe de turno" : "Oficial"})` : ""} (
          {evaluadosCount} evaluado(s) de {personalPorServicio.length} activo(s)
          {esOperaciones ? "" : filtroServicio && activosPorRol.length !== personalPorServicio.length
            ? ` · ${activosPorRol.length} en perfil`
            : ""}
          )
        </h2>
        {necesitaServicioOperaciones ? (
          <p className="mb-3 rounded-lg border border-dashed border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600">
            Elija un servicio para ver el resumen de oficiales y JT de ese servicio.
          </p>
        ) : (
          <>
        <div className="mb-3 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {filtroPorServicio ? (
            <CatFiltroServicio value={filtroServicio} onChange={setFiltroServicio} personal={activosPorRol} />
          ) : (
            <div className="sm:col-span-3">
              <CatListaFiltro
                value={filtroTabla}
                onChange={setFiltroTabla}
                total={personalPorServicio.length}
                filtrados={personalFiltrado.length}
              />
            </div>
          )}
          {filtroPorServicio ? (
            <div className="sm:col-span-2">
              <CatListaFiltro
                value={filtroTabla}
                onChange={setFiltroTabla}
                total={personalPorServicio.length}
                filtrados={personalFiltrado.length}
                totalCatalogo={filtroServicio ? activosPorRol.length : undefined}
              />
            </div>
          ) : null}
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
          </>
        )}
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
