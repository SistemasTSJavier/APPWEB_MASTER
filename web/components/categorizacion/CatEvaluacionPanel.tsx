"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { CatEvalModuloId } from "@/lib/categorizacion-campos";
import { CAT_RH_AUSENTISMOS_LABEL, camposPorModulo, labelModuloEval } from "@/lib/categorizacion-campos";
import {
  CAT_OPERACIONES_ROLES,
  filtrarLiderazgoParaCalificar,
  filtrarOficialesParaCalificarJefe,
  personalCoincideRolOperaciones,
  puestoEsJefeServicio,
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
  CatFiltroPlanta,
  CatFiltroServicio,
  CatListaFiltro,
  CatResumenServicios,
  CatSelectorServicioObligatorio,
  filtrarPersonalListado,
  filtrarPorServicio,
  serviciosCoincidenCat,
} from "@/components/categorizacion/CatEmpleadoBuscador";
import { servicioUsaFiltroPlanta } from "@/lib/categorizacion-filtros-servicio";
import { CatMsg, CatPromedioBadge, CatRatingGrid } from "@/components/categorizacion/cat-form-ui";
import type { AppRole } from "@/lib/app-role";
import { roleEsClienteEnfoque } from "@/lib/app-role";
import { puedeAdministrarAccesosEnfoque } from "@/lib/categorizacion-enfoque-auth";
import { CatEnfoqueAccesosPanel, serviciosDesdeActivos } from "@/components/categorizacion/CatEnfoqueAccesosPanel";
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

export function CatEvaluacionPanel({ modulo, appRole }: { modulo: CatEvalModuloId; appRole: AppRole }) {
  const esRh = modulo === "recursos_humanos";
  const esOperaciones = modulo === "operaciones";
  const esEnfoque = modulo === "enfoque_cliente";
  const esClienteEnfoque = roleEsClienteEnfoque(appRole);
  const esAdminEnfoque = puedeAdministrarAccesosEnfoque(appRole);
  const esAdmin = appRole === "admin";
  const [rolOperaciones, setRolOperaciones] = useState<CatOperacionesRolId>("oficial");
  const campos = useMemo(
    () => camposPorModulo(modulo, esOperaciones ? { rolOperaciones } : undefined),
    [modulo, esOperaciones, rolOperaciones],
  );
  const [activos, setActivos] = useState<CatColaboradorActivoOpcion[]>([]);
  const [evalMap, setEvalMap] = useState<Map<string, EvalRow>>(new Map());
  const [multiEvalMap, setMultiEvalMap] = useState<Map<string, EvalRow[]>>(new Map());
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
  const [filtroPlanta, setFiltroPlanta] = useState("");
  const [enfoqueClienteServicio, setEnfoqueClienteServicio] = useState("");
  const [enfoqueClienteFin, setEnfoqueClienteFin] = useState("");

  const filtroPorServicio = false;
  const mostrarFiltrosServicioResumen = !esOperaciones && !esEnfoque;
  const servicioEnfoqueElegido = esEnfoque
    ? esClienteEnfoque
      ? enfoqueClienteServicio.trim()
      : filtroServicio.trim()
    : "";
  const necesitaServicioEnfoque = esEnfoque && !servicioEnfoqueElegido && !esClienteEnfoque;
  const esJefeTurno = esOperaciones && rolOperaciones === "jefe_turno";
  const esOficialOperaciones = esOperaciones && rolOperaciones === "oficial";
  const usaEvalMultiCalificador = esOperaciones;
  const servicioOperacionesElegido = esOperaciones ? filtroServicio.trim() : "";
  const necesitaServicioOperaciones = esOperaciones && !servicioOperacionesElegido;

  const activosEnServicioOperaciones = useMemo(
    () =>
      servicioOperacionesElegido
        ? filtrarPorServicio(activos, servicioOperacionesElegido, filtroPlanta)
        : [],
    [activos, servicioOperacionesElegido, filtroPlanta],
  );

  const conteoServicioOperaciones = useMemo(() => {
    let oficiales = 0;
    let jefesTurno = 0;
    let jefesServicio = 0;
    for (const p of activosEnServicioOperaciones) {
      if (puestoEsJefeServicio(p.puesto)) jefesServicio++;
      else if (puestoEsJefeTurno(p.puesto)) jefesTurno++;
      else if (puestoEsOficialOperaciones(p.puesto)) oficiales++;
    }
    return { oficiales, jefesTurno, jefesServicio };
  }, [activosEnServicioOperaciones]);

  function elegirServicioOperaciones(servicio: string) {
    setFiltroServicio(servicio.trim());
    setFiltroPlanta("");
    setNoSel("");
    setCalificadoPorSel("");
    setFiltroTabla("");
    setMsg(null);
  }

  function cambiarServicioOperaciones() {
    elegirServicioOperaciones("");
  }

  const oficialesOpciones = useMemo(
    () =>
      filtrarOficialesParaCalificarJefe(
        activosEnServicioOperaciones,
        servicioOperacionesElegido,
        serviciosCoincidenCat,
      ),
    [activosEnServicioOperaciones, servicioOperacionesElegido],
  );

  const liderazgoOpciones = useMemo(
    () =>
      filtrarLiderazgoParaCalificar(
        activosEnServicioOperaciones,
        servicioOperacionesElegido,
        serviciosCoincidenCat,
      ),
    [activosEnServicioOperaciones, servicioOperacionesElegido],
  );

  /** Oficial ← JT+JS; JT/JS ← oficiales del servicio (oficial por oficial). */
  const calificadoresOpciones = useMemo(() => {
    if (esOficialOperaciones) return liderazgoOpciones;

    const byNo = new Map(oficialesOpciones.map((o) => [noKey(o.noEmpleado), o] as const));
    // Compat: calificadores ya registrados (p. ej. JS legacy) que siguen en el servicio.
    if (noSel) {
      for (const e of multiEvalMap.get(noKey(noSel)) ?? []) {
        const k = noKey(e.calificadoPor ?? "");
        if (!k || byNo.has(k)) continue;
        const p = activosEnServicioOperaciones.find((x) => noKey(x.noEmpleado) === k);
        if (p) byNo.set(k, { noEmpleado: p.noEmpleado, nombre: p.nombre });
      }
    }
    return [...byNo.values()].sort((a, b) =>
      a.noEmpleado.localeCompare(b.noEmpleado, "es", { numeric: true }),
    );
  }, [
    esOficialOperaciones,
    liderazgoOpciones,
    oficialesOpciones,
    activosEnServicioOperaciones,
    noSel,
    multiEvalMap,
  ]);

  function elegirServicioEnfoque(servicio: string) {
    setFiltroServicio(servicio.trim());
    setFiltroPlanta("");
    setNoSel("");
    setFiltroTabla("");
    setMsg(null);
    if (servicio.trim()) {
      void fetch("/api/categorizacion/enfoque-sincronizar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ servicio: servicio.trim() }),
      }).catch(() => undefined);
    }
  }

  useEffect(() => {
    if (!esClienteEnfoque) return;
    void (async () => {
      try {
        const r = await fetch("/api/categorizacion/enfoque-accesos/contexto", { cache: "no-store" });
        const j = await r.json();
        if (!r.ok) throw new Error(j.error);
        setEnfoqueClienteServicio(String(j.servicio ?? ""));
        setEnfoqueClienteFin(String(j.fechaFin ?? ""));
        setFiltroServicio(String(j.servicio ?? ""));
      } catch (e) {
        setMsg(e instanceof Error ? e.message.toUpperCase() : "ACCESO NO VIGENTE.");
      }
    })();
  }, [esClienteEnfoque]);

  const activosPorRol = useMemo(() => {
    if (!esOperaciones) {
      if (esEnfoque) {
        if (!servicioEnfoqueElegido) return [];
        return filtrarPorServicio(activos, servicioEnfoqueElegido, filtroPlanta);
      }
      return activos;
    }
    if (!servicioOperacionesElegido) return [];
    const enServicio = filtrarPorServicio(activos, servicioOperacionesElegido, filtroPlanta);
    const porRol = enServicio.filter((p) => personalCoincideRolOperaciones(p.puesto, rolOperaciones));

    // Incluir a quienes ya tienen calificación del rol actual aunque el puesto no coincida
    // (p. ej. JT con puesto mal capturado): así no se “pierden” calificaciones JS→JT.
    const nosConEval = new Set<string>();
    for (const [no, evals] of multiEvalMap) {
      if (evals.length > 0) nosConEval.add(no);
    }
    if (nosConEval.size === 0) return porRol;

    const ya = new Set(porRol.map((p) => noKey(p.noEmpleado)));
    const extras = enServicio.filter((p) => {
      const k = noKey(p.noEmpleado);
      return !ya.has(k) && nosConEval.has(k);
    });
    return extras.length ? [...porRol, ...extras] : porRol;
  }, [
    activos,
    esOperaciones,
    esEnfoque,
    rolOperaciones,
    servicioOperacionesElegido,
    servicioEnfoqueElegido,
    filtroPlanta,
    multiEvalMap,
  ]);

  const personalPorServicio = useMemo(
    () =>
      esOperaciones || esEnfoque
        ? activosPorRol
        : filtrarPorServicio(activosPorRol, filtroServicio, filtroPlanta),
    [activosPorRol, filtroServicio, filtroPlanta, esOperaciones, esEnfoque],
  );

  const personalFiltrado = useMemo(
    () =>
      esOperaciones
        ? filtrarPersonalListado(activosPorRol, filtroTabla, servicioOperacionesElegido, filtroPlanta)
        : esEnfoque
          ? filtrarPersonalListado(activosPorRol, filtroTabla, servicioEnfoqueElegido, filtroPlanta)
          : filtrarPersonalListado(activosPorRol, filtroTabla, filtroServicio, filtroPlanta),
    [
      activosPorRol,
      filtroTabla,
      filtroServicio,
      filtroPlanta,
      esOperaciones,
      esEnfoque,
      servicioOperacionesElegido,
      servicioEnfoqueElegido,
    ],
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
      if (usaEvalMultiCalificador) {
        const evals = multiEvalMap.get(noKey(p.noEmpleado)) ?? [];
        if (promedioAcumuladoEvaluaciones(evals.map((e) => e.promedio)) != null) n++;
      } else {
        const ev = evalMap.get(noKey(p.noEmpleado));
        if (promedioEvaluacionModulo(ev?.scores, ev?.promedio) != null) n++;
      }
    }
    return n;
  }, [personalFiltrado, evalMap, multiEvalMap, usaEvalMultiCalificador]);

  const acumuladoMultiSel = useMemo(() => {
    if (!usaEvalMultiCalificador || !noSel) return null;
    const evals = multiEvalMap.get(noKey(noSel)) ?? [];
    return promedioAcumuladoEvaluaciones(evals.map((e) => e.promedio));
  }, [usaEvalMultiCalificador, noSel, multiEvalMap]);

  const evalsMultiSel = useMemo(() => {
    if (!usaEvalMultiCalificador || !noSel) return [];
    return multiEvalMap.get(noKey(noSel)) ?? [];
  }, [usaEvalMultiCalificador, noSel, multiEvalMap]);

  const tieneEvaluacionGuardadaSel = useMemo(() => {
    if (!noSel) return false;
    if (usaEvalMultiCalificador) return evalsMultiSel.length > 0;
    const ev = evalMap.get(noKey(noSel));
    return promedioEvaluacionModulo(ev?.scores, ev?.promedio) != null;
  }, [noSel, usaEvalMultiCalificador, evalsMultiSel, evalMap]);

  const aplicarFilasEvaluacion = useCallback(
    (rows: Array<{
      noEmpleado: string;
      scores?: Record<string, number>;
      comentarios?: string;
      promedio?: number | null;
      calificadoPor?: string;
    }>) => {
      if (usaEvalMultiCalificador) {
        const porEmpleado = new Map<string, EvalRow[]>();
        for (const row of rows) {
          const key = noKey(row.noEmpleado);
          const list = porEmpleado.get(key) ?? [];
          list.push({
            scores: row.scores ?? {},
            comentarios: row.comentarios ?? "",
            promedio: promedioEvaluacionModulo(row.scores, row.promedio),
            calificadoPor: row.calificadoPor ? noKey(row.calificadoPor) : "",
          });
          porEmpleado.set(key, list);
        }
        setMultiEvalMap(porEmpleado);
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
      setMultiEvalMap(new Map());
    },
    [usaEvalMultiCalificador],
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
        setMultiEvalMap(new Map());
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
    if (usaEvalMultiCalificador) {
      if (!calificadoPorSel) {
        setScores({});
        setComentarios("");
        return;
      }
      ex = (multiEvalMap.get(noKey(noSel)) ?? []).find(
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
  }, [noSel, calificadoPorSel, evalMap, multiEvalMap, campos, usaEvalMultiCalificador]);

  function seleccionarEmpleado(no: string) {
    setNoSel(noKey(no));
    setMsg(null);
  }

  function evalRowKey(calificadoPor: string): string {
    return calificadoPor || "__legacy__";
  }

  function esCalificadorFantasma(calNo: string): boolean {
    const key = noKey(calNo);
    if (!key) return false;
    if (esOficialOperaciones) {
      return !liderazgoOpciones.some((j) => noKey(j.noEmpleado) === key);
    }
    if (esJefeTurno) {
      // Oficiales vigentes; legacy (otro JT/JS) que ya calificó no cuenta como fantasma si sigue en servicio
      const esOficial = oficialesOpciones.some((o) => noKey(o.noEmpleado) === key);
      if (esOficial) return false;
      return !activosEnServicioOperaciones.some((p) => noKey(p.noEmpleado) === key);
    }
    return false;
  }

  async function eliminarRegistroCalificacion(calificadoPor: string) {
    if (!esAdmin || !noSel) return;
    const calKey = noKey(calificadoPor);
    const etiqueta = calKey
      ? `${esOficialOperaciones ? "JT/JS" : "Oficial"} ${calKey}`
      : "registro anterior (sin calificador)";
    if (
      !window.confirm(
        `¿Eliminar la calificación de ${etiqueta} para el empleado ${noKey(noSel)}? El promedio se recalculará sin este registro.`,
      )
    ) {
      return;
    }
    setBusy(true);
    setMsg(null);
    try {
      const params = new URLSearchParams({
        modulo,
        no_empleado: noKey(noSel),
      });
      if (esOperaciones) params.set("submodulo", submoduloOperaciones(rolOperaciones));
      if (usaEvalMultiCalificador) params.set("calificado_por", calKey);
      const r = await fetch(`/api/categorizacion/evaluaciones?${params.toString()}`, { method: "DELETE" });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error);
      if (noKey(calificadoPorSel) === calKey) {
        setCalificadoPorSel("");
        setScores({});
        setComentarios("");
      }
      setMsg(`CALIFICACIÓN ELIMINADA (${etiqueta}).`);
      await load();
    } catch (e) {
      setMsg(e instanceof Error ? e.message.toUpperCase() : "ERROR AL ELIMINAR.");
    } finally {
      setBusy(false);
    }
  }

  async function eliminarEvaluacionEmpleado() {
    if (!esAdmin || !noSel || usaEvalMultiCalificador) return;
    if (
      !window.confirm(
        `¿Eliminar toda la evaluación de ${labelModuloEval(modulo)} del empleado ${noKey(noSel)}?`,
      )
    ) {
      return;
    }
    setBusy(true);
    setMsg(null);
    try {
      const params = new URLSearchParams({ modulo, no_empleado: noKey(noSel) });
      const r = await fetch(`/api/categorizacion/evaluaciones?${params.toString()}`, { method: "DELETE" });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error);
      setScores({});
      setComentarios("");
      setMsg("EVALUACIÓN ELIMINADA.");
      await load();
    } catch (e) {
      setMsg(e instanceof Error ? e.message.toUpperCase() : "ERROR AL ELIMINAR.");
    } finally {
      setBusy(false);
    }
  }

  async function reiniciarCapturaSiguiente(mensajeOk: string) {
    setNoSel("");
    setCalificadoPorSel("");
    setScores({});
    setComentarios("");
    setFiltroTabla("");
    setMsg(mensajeOk);
    if (typeof window !== "undefined") {
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  }

  async function guardar() {
    if (!noSel) {
      setMsg("SELECCIONA EMPLEADO.");
      return;
    }
    if (esEnfoque && !servicioEnfoqueElegido) {
      setMsg("SELECCIONA UN SERVICIO.");
      return;
    }
    if (usaEvalMultiCalificador) {
      if (!servicioOperacionesElegido) {
        setMsg("SELECCIONA UN SERVICIO.");
        return;
      }
      if (!calificadoPorSel) {
        setMsg(
          esOficialOperaciones
            ? "SELECCIONA EL JT O JS (CALIFICADO POR)."
            : "SELECCIONA EL OFICIAL (CALIFICADO POR).",
        );
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
    const empleadoGuardado = noKey(noSel);
    const calificadorGuardado = usaEvalMultiCalificador ? noKey(calificadoPorSel) : "";
    setBusy(true);
    setMsg(null);
    try {
      const r = await fetch("/api/categorizacion/evaluaciones", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          noEmpleado: empleadoGuardado,
          modulo,
          submodulo: esOperaciones ? submoduloOperaciones(rolOperaciones) : undefined,
          rolOperaciones: esOperaciones ? rolOperaciones : undefined,
          calificadoPor: usaEvalMultiCalificador ? calificadorGuardado : undefined,
          scores: nums,
          comentarios,
        }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error);

      // Confirmar en listado antes de limpiar (evita “desaparecer” visualmente).
      await load();

      const etiquetaCalificador = esOficialOperaciones ? "JT/JS" : "Oficial";
      const baseOk = usaEvalMultiCalificador
        ? `GUARDADO: ${empleadoGuardado} calificado por ${etiquetaCalificador} ${calificadorGuardado}${
            prom != null ? ` (prom. ${prom.toFixed(2)})` : ""
          }. LISTO PARA OTRA CAPTURA.`
        : prom != null
          ? `EVALUACIÓN DE ${empleadoGuardado} GUARDADA (PROM. ${prom.toFixed(2)}). LISTO PARA OTRA CAPTURA.`
          : `EVALUACIÓN DE ${empleadoGuardado} GUARDADA. LISTO PARA OTRA CAPTURA.`;

      await reiniciarCapturaSiguiente(baseOk);
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
            <strong>{faltasMesYm || "anterior"}</strong> (códigos F, mes en desfase). Califica rotación y actas del{" "}
            <strong>1 al 5</strong>; el promedio RH usa solo esos criterios.
          </>
        ) : esOperaciones ? (
          <>
            Elija primero el <strong>servicio</strong>. Después podrá calificar <strong>oficiales</strong>{" "}
            (criterios operativos; cada JT o JS del servicio califica al oficial) o <strong>JT / JS</strong>{" "}
            (criterios de liderazgo; cada oficial del servicio califica al JT/JS). El promedio es la media de esas
            calificaciones.
          </>
        ) : esEnfoque ? (
          esClienteEnfoque ? (
            <>
              Califique a los colaboradores <strong>activos</strong> de su servicio asignado. Cada criterio del{" "}
              <strong>1 al 5</strong>; el promedio de Enfoque al cliente alimenta el dashboard de categorización.
            </>
          ) : (
            <>
              Elija el <strong>servicio</strong> o genere un <strong>acceso temporal</strong> para el cliente. Solo se
              listan colaboradores activos y calificables de ese servicio; al guardar se registra en Enfoque al cliente.
            </>
          )
        ) : (
          <>
            Califica cada criterio del <strong>1 al 5</strong>. El promedio del módulo es la media de los criterios
            calificados ({campos.length} en {labelModuloEval(modulo)}).
          </>
        )}
      </p>

      {esEnfoque && esAdminEnfoque ? (
        <CatEnfoqueAccesosPanel serviciosDisponibles={serviciosDesdeActivos(activos)} />
      ) : null}

      <CatMsg msg={msg} />

      {esEnfoque && esClienteEnfoque && servicioEnfoqueElegido ? (
        <div className="rounded-lg border border-sky-200 bg-sky-50 px-3 py-2 text-xs text-sky-950">
          <strong>Servicio asignado:</strong> <span className="uppercase">{servicioEnfoqueElegido}</span>
          {enfoqueClienteFin ? (
            <span className="ml-2 text-slate-600">· Acceso vigente hasta {enfoqueClienteFin}</span>
          ) : null}
        </div>
      ) : null}

      {esEnfoque && necesitaServicioEnfoque ? (
        <section className="card space-y-4">
          <div>
            <h2 className="text-sm font-bold uppercase text-violet-950">Paso 1 — Seleccione el servicio</h2>
            <p className="mt-1 text-xs text-slate-600">
              Solo colaboradores activos y calificables del servicio elegido. Al elegir servicio se sincroniza{" "}
              <strong>cat_personal</strong> para evitar errores al guardar.
            </p>
          </div>
          <CatSelectorServicioObligatorio
            value={filtroServicio}
            onChange={elegirServicioEnfoque}
            personal={activos}
            disabled={busy}
            plantaFiltro={filtroPlanta}
            onPlantaChange={setFiltroPlanta}
          />
        </section>
      ) : null}

      {esEnfoque && !necesitaServicioEnfoque && !esClienteEnfoque ? (
        <div className="space-y-2 rounded-lg border border-violet-200 bg-violet-50 px-3 py-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-xs font-semibold text-violet-950">
              Servicio: <strong className="uppercase">{servicioEnfoqueElegido}</strong>
            </p>
            <button type="button" className="btn-secondary text-[10px] uppercase" onClick={() => elegirServicioEnfoque("")}>
              Cambiar servicio
            </button>
          </div>
          {servicioUsaFiltroPlanta(servicioEnfoqueElegido) ? (
            <CatFiltroPlanta
              servicioFiltro={servicioEnfoqueElegido}
              value={filtroPlanta}
              onChange={setFiltroPlanta}
              personal={activos}
            />
          ) : null}
        </div>
      ) : null}

      {esOperaciones && necesitaServicioOperaciones ? (
        <section className="card space-y-4">
          <div>
            <h2 className="text-sm font-bold uppercase text-violet-950">Paso 1 — Seleccione el servicio</h2>
            <p className="mt-1 text-xs text-slate-600">
              Solo se listan colaboradores del servicio elegido: oficiales (calificados por JT o JS) y jefes de
              turno / servicio (JT y JS, calificados por cada oficial).
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
            plantaFiltro={filtroPlanta}
            onPlantaChange={setFiltroPlanta}
          />
        </section>
      ) : null}

      {esOperaciones && !necesitaServicioOperaciones ? (
        <div className="space-y-2 rounded-lg border border-violet-200 bg-violet-50 px-3 py-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-xs font-semibold text-violet-950">
              Servicio: <strong className="uppercase">{servicioOperacionesElegido}</strong>
              <span className="ml-2 font-normal text-slate-600">
                {conteoServicioOperaciones.oficiales} oficial
                {conteoServicioOperaciones.oficiales === 1 ? "" : "es"} · {conteoServicioOperaciones.jefesTurno} JT ·{" "}
                {conteoServicioOperaciones.jefesServicio} JS
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
          {servicioUsaFiltroPlanta(servicioOperacionesElegido) ? (
            <CatFiltroPlanta
              servicioFiltro={servicioOperacionesElegido}
              value={filtroPlanta}
              onChange={setFiltroPlanta}
              personal={activos}
            />
          ) : null}
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
        {necesitaServicioOperaciones || necesitaServicioEnfoque ? (
          <p className="rounded-lg border border-dashed border-violet-200 bg-violet-50/50 px-3 py-2 text-xs font-medium text-violet-900">
            {esEnfoque
              ? "Seleccione un servicio arriba para calificar colaboradores activos de ese servicio."
              : "Seleccione un servicio arriba para ver oficiales, jefes de turno y jefes de servicio de ese servicio."}
          </p>
        ) : (
          <>
        <CatResumenServicios
          personal={activosPorRol}
          servicioFiltro={esEnfoque ? servicioEnfoqueElegido : esOperaciones ? servicioOperacionesElegido : filtroServicio}
        />
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {filtroPorServicio ? (
            <CatFiltroServicio value={filtroServicio} onChange={setFiltroServicio} personal={activosPorRol} />
          ) : null}
          <div className={filtroPorServicio ? "sm:col-span-2" : "sm:col-span-3"}>
            <CatEmpleadoBuscador
              label={
                esJefeTurno
                  ? "JT o JS a calificar"
                  : esOficialOperaciones
                    ? "Oficial a calificar"
                    : "Empleado (activo en Colaboradores)"
              }
              hint="Datos en vivo desde expedientes activos. Escribe N° o nombre."
              value={noSel}
              onChange={seleccionarEmpleado}
              opciones={opciones}
              listId={`cat-eval-${modulo}-empleado`}
              disabled={busy || opciones.length === 0}
            />
          </div>
        </div>
        {usaEvalMultiCalificador && noSel ? (
          <CatEmpleadoBuscador
            label={
              esOficialOperaciones
                ? "Calificado por (JT o JS del servicio)"
                : "Calificado por (oficial del servicio)"
            }
            value={calificadoPorSel}
            onChange={(no) => {
              setCalificadoPorSel(noKey(no));
              setMsg(null);
            }}
            opciones={calificadoresOpciones}
            listId={`cat-eval-${modulo}-calificador`}
            disabled={busy || calificadoresOpciones.length === 0}
            hint={
              esOficialOperaciones
                ? `Cada JT/JS califica una vez al oficial. El servicio tiene ${liderazgoOpciones.length} JT/JS. Puede editar su propia calificación.`
                : `Cada oficial califica una vez al JT/JS. El servicio tiene ${oficialesOpciones.length} oficiales. Puede editar su propia calificación.`
            }
          />
        ) : null}
        {usaEvalMultiCalificador && noSel && evalsMultiSel.length > 0 ? (
          <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-[11px] text-slate-800">
            <p className="font-bold uppercase text-slate-600">Calificaciones registradas</p>
            {esAdmin ? (
              <p className="mt-0.5 text-[10px] font-medium text-amber-900">
                Admin: puede eliminar registros erróneos o fantasmas (calificador no vigente en el servicio).
              </p>
            ) : null}
            <ul className="mt-1 space-y-1">
              {evalsMultiSel.map((e) => {
                const cal = activos.find((p) => noKey(p.noEmpleado) === e.calificadoPor);
                const calPuesto = cal?.puesto ?? "";
                const rolLabel = esOficialOperaciones
                  ? puestoEsJefeServicio(calPuesto)
                    ? "JS"
                    : puestoEsJefeTurno(calPuesto)
                      ? "JT"
                      : "Calificador"
                  : "Oficial";
                const fantasma = esCalificadorFantasma(e.calificadoPor ?? "");
                const rowKey = evalRowKey(e.calificadoPor ?? "");
                return (
                  <li key={rowKey} className="flex flex-wrap items-center justify-between gap-2">
                    <span>
                      {rolLabel}{" "}
                      {e.calificadoPor ? (
                        <span className="font-mono">{e.calificadoPor}</span>
                      ) : (
                        <span className="font-semibold text-amber-800">(sin calificador / legacy)</span>
                      )}
                      {cal ? ` — ${cal.nombre}` : fantasma && e.calificadoPor ? " — no está en el servicio" : ""}
                      {fantasma ? (
                        <span className="ml-1 rounded bg-amber-100 px-1 py-0.5 text-[9px] font-bold uppercase text-amber-900">
                          fantasma
                        </span>
                      ) : null}
                      : <strong>{e.promedio != null ? e.promedio.toFixed(2) : "—"}</strong>
                    </span>
                    {esAdmin ? (
                      <button
                        type="button"
                        className="shrink-0 text-[10px] font-bold uppercase text-red-700 hover:text-red-900"
                        disabled={busy}
                        onClick={() => void eliminarRegistroCalificacion(e.calificadoPor ?? "")}
                      >
                        Eliminar
                      </button>
                    ) : null}
                  </li>
                );
              })}
            </ul>
            {acumuladoMultiSel != null ? (
              <p className="mt-2 font-bold text-violet-950">
                Promedio acumulado operaciones: {acumuladoMultiSel.toFixed(2)} (
                {evalsMultiSel.length}{" "}
                {esOficialOperaciones ? "JT/JS" : "oficial"}
                {evalsMultiSel.length === 1 ? "" : esOficialOperaciones ? "" : "es"}
                {esOficialOperaciones && liderazgoOpciones.length > 0
                  ? ` de ${liderazgoOpciones.length} en el servicio`
                  : !esOficialOperaciones && oficialesOpciones.length > 0
                    ? ` de ${oficialesOpciones.length} en el servicio`
                    : ""}
                )
              </p>
            ) : null}
          </div>
        ) : null}
        {opciones.length === 0 ? (
          <p className="text-xs font-medium text-amber-800">No hay colaboradores activos en expedientes.</p>
        ) : null}
        {esJefeTurno && servicioOperacionesElegido && oficialesOpciones.length === 0 ? (
          <p className="text-xs font-medium text-amber-800">
            No hay oficiales activos en el servicio «{servicioOperacionesElegido}» para calificar al JT/JS. Revise
            puestos en Colaboradores.
          </p>
        ) : null}
        {esOficialOperaciones && servicioOperacionesElegido && liderazgoOpciones.length === 0 ? (
          <p className="text-xs font-medium text-amber-800">
            No hay jefes de turno ni de servicio activos en «{servicioOperacionesElegido}». Revise puestos en
            Colaboradores (ej. Jefe de turno, Jefe de servicio, JT, JS).
          </p>
        ) : null}
        {!noSel || (usaEvalMultiCalificador && !calificadoPorSel) ? (
          <p className="rounded-lg border border-dashed border-violet-200 bg-violet-50/50 px-3 py-2 text-xs font-medium text-violet-900">
            {usaEvalMultiCalificador
              ? esOficialOperaciones
                ? "Elige oficial y el JT o JS que califica."
                : "Elige JT o JS a calificar y el oficial que califica."
              : "Elige un empleado de la lista para calificar."}{" "}
            {usaEvalMultiCalificador ? (
              <strong>
                {campos.length} criterios {esOficialOperaciones ? "operativos" : "de liderazgo"} (1–5 cada uno).
              </strong>
            ) : (
              <strong>{campos.map((c) => c.label).join(" · ")}</strong>
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
                  <p className="mt-1 text-[11px] text-slate-500">Sin faltas registradas en cuadrícula del mes anterior.</p>
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
              <CatPromedioBadge promedio={promedioPreview} label={usaEvalMultiCalificador ? "Prom. esta calificación" : undefined} />
              {usaEvalMultiCalificador && acumuladoMultiSel != null ? (
                <CatPromedioBadge promedio={acumuladoMultiSel} label="Prom. acumulado" />
              ) : null}
              <button type="button" className="btn-primary uppercase" disabled={busy} onClick={() => void guardar()}>
                {usaEvalMultiCalificador ? "Guardar calificación" : "Guardar y promediar"}
              </button>
              {esAdmin && !usaEvalMultiCalificador && tieneEvaluacionGuardadaSel ? (
                <button
                  type="button"
                  className="btn-secondary uppercase text-red-800"
                  disabled={busy}
                  onClick={() => void eliminarEvaluacionEmpleado()}
                >
                  Eliminar evaluación
                </button>
              ) : null}
              {!esClienteEnfoque ? (
                <Link
                  href={`/categorizacion/dashboard?no=${encodeURIComponent(noSel)}`}
                  className="btn-secondary uppercase"
                >
                  Ver dashboard
                </Link>
              ) : null}
            </div>
          </>
        )}
          </>
        )}
      </section>

      <section className="card overflow-hidden">
        <h2 className="mb-2 px-1 text-sm font-bold uppercase">
          Resumen — {labelModuloEval(modulo)}
          {esOperaciones ? ` (${rolOperaciones === "jefe_turno" ? "JT / JS" : "Oficial"})` : ""} (
          {evaluadosCount} evaluado(s) de {personalPorServicio.length} activo(s)
          {esOperaciones ? "" : filtroServicio && activosPorRol.length !== personalPorServicio.length
            ? ` · ${activosPorRol.length} en perfil`
            : ""}
          )
        </h2>
        {necesitaServicioOperaciones || necesitaServicioEnfoque ? (
          <p className="mb-3 rounded-lg border border-dashed border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600">
            {esEnfoque
              ? "Elija un servicio para ver el resumen de colaboradores activos de ese servicio."
              : "Elija un servicio para ver el resumen de oficiales, JT y JS de ese servicio."}
          </p>
        ) : (
          <>
        <div className="mb-3 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {mostrarFiltrosServicioResumen ? (
            <>
              <CatFiltroServicio
                value={filtroServicio}
                onChange={(v) => {
                  setFiltroServicio(v);
                  setFiltroPlanta("");
                }}
                personal={activosPorRol}
              />
              <CatFiltroPlanta
                servicioFiltro={filtroServicio}
                value={filtroPlanta}
                onChange={setFiltroPlanta}
                personal={activosPorRol}
              />
            </>
          ) : null}
          <div className={mostrarFiltrosServicioResumen ? "sm:col-span-2" : "sm:col-span-3"}>
            <CatListaFiltro
              value={filtroTabla}
              onChange={setFiltroTabla}
              total={personalPorServicio.length}
              filtrados={personalFiltrado.length}
              totalCatalogo={
                mostrarFiltrosServicioResumen && filtroServicio ? activosPorRol.length : undefined
              }
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
                ) : esOficialOperaciones ? (
                  <>
                    <th className="p-2 text-center">JT/JS</th>
                    <th className="p-2 text-center">Prom. acum.</th>
                  </>
                ) : (
                  campos.map((c) => (
                    <th key={c.key} className="p-2 text-center" title={c.label}>
                      {abreviarCriterio(c.label)}
                    </th>
                  ))
                )}
                {!usaEvalMultiCalificador ? <th className="p-2 text-center">Prom.</th> : null}
                <th className="p-2" />
              </tr>
            </thead>
            <tbody>
              {personalFiltrado.map((p) => {
                const evalsMulti = multiEvalMap.get(noKey(p.noEmpleado)) ?? [];
                const ev = evalMap.get(noKey(p.noEmpleado));
                const prom = usaEvalMultiCalificador
                  ? promedioAcumuladoEvaluaciones(evalsMulti.map((e) => e.promedio))
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
                    {usaEvalMultiCalificador ? (
                      <>
                        <td className="p-2 text-center font-mono">{evalsMulti.length}</td>
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
