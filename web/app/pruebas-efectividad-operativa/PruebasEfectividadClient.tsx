"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { AppModuleShell } from "@/components/app-module-shell";
import {
  CatEmpleadoBuscador,
  CatFiltroPlanta,
  CatFiltroServicio,
} from "@/components/categorizacion/CatEmpleadoBuscador";
import { fetchColaboradoresActivosCat } from "@/lib/categorizacion-colaboradores-client";
import { filtrarPorServicioYPlanta } from "@/lib/categorizacion-filtros-servicio";
import type { CatColaboradorActivoOpcion } from "@/lib/categorizacion-types";
import type { AppRole } from "@/lib/app-role";
import {
  PEO_CATEGORIAS,
  PEO_TIPOS,
  etiquetaPeoTipo,
  peoCategoria,
  type PeoCategoriaId,
  type PeoEvaluacion,
  type PeoTipoId,
} from "@/lib/pruebas-efectividad-operativa";

function hoyLocal(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function formatoPuntos(n: number): string {
  return new Intl.NumberFormat("es-MX", { maximumFractionDigits: 2 }).format(n);
}

export function PruebasEfectividadClient({
  appRole,
  email,
  modulosHabilitados,
}: {
  appRole: AppRole;
  email: string;
  modulosHabilitados?: readonly string[] | null;
}) {
  const [personal, setPersonal] = useState<CatColaboradorActivoOpcion[]>([]);
  const [servicio, setServicio] = useState("");
  const [planta, setPlanta] = useState("");
  const [noEmpleado, setNoEmpleado] = useState("");
  const [categoria, setCategoria] = useState<PeoCategoriaId>("extorsion_simulada");
  const [tipo, setTipo] = useState<PeoTipoId>("simulacion");
  const [evaluadaEn, setEvaluadaEn] = useState(hoyLocal);
  const [puntajes, setPuntajes] = useState<Record<string, string>>({});
  const [observaciones, setObservaciones] = useState("");
  const [historial, setHistorial] = useState<PeoEvaluacion[]>([]);
  const [historialFiltroTipo, setHistorialFiltroTipo] = useState<PeoTipoId | "">("");
  const [editandoId, setEditandoId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const categoriaDef = peoCategoria(categoria)!;
  const personalFiltrado = useMemo(
    () => filtrarPorServicioYPlanta(personal, servicio, planta),
    [personal, servicio, planta],
  );
  const seleccionado = useMemo(
    () => personal.find((p) => p.noEmpleado === noEmpleado) ?? null,
    [personal, noEmpleado],
  );
  const historialVisible = useMemo(
    () => (historialFiltroTipo ? historial.filter((e) => e.tipo === historialFiltroTipo) : historial),
    [historial, historialFiltroTipo],
  );
  const conteoSimulacion = useMemo(
    () => historial.filter((e) => e.tipo === "simulacion").length,
    [historial],
  );
  const conteoReal = useMemo(() => historial.filter((e) => e.tipo === "real").length, [historial]);
  const total = useMemo(
    () =>
      categoriaDef.criterios.reduce((sum, c) => {
        const v = Number(puntajes[c.id]);
        return sum + (Number.isFinite(v) ? Math.min(c.maximo, Math.max(0, v)) : 0);
      }, 0),
    [categoriaDef, puntajes],
  );
  const completo = categoriaDef.criterios.every((c) => {
    const raw = puntajes[c.id];
    const v = Number(raw);
    return raw !== undefined && raw !== "" && Number.isFinite(v) && v >= 0 && v <= c.maximo;
  });

  useEffect(() => {
    let cancel = false;
    void fetchColaboradoresActivosCat({ forceRefresh: true })
      .then((rows) => {
        if (!cancel) setPersonal(rows);
      })
      .catch((e) => {
        if (!cancel) setMsg({ ok: false, text: e instanceof Error ? e.message : "No se cargó personal." });
      })
      .finally(() => {
        if (!cancel) setLoading(false);
      });
    return () => {
      cancel = true;
    };
  }, []);

  useEffect(() => {
    if (!noEmpleado) return;
    let cancel = false;
    void fetch(
      `/api/pruebas-efectividad-operativa/evaluaciones?no_empleado=${encodeURIComponent(noEmpleado)}`,
      { cache: "no-store" },
    )
      .then(async (r) => {
        const j = (await r.json()) as { rows?: PeoEvaluacion[]; error?: string };
        if (!r.ok) throw new Error(j.error ?? `Error ${r.status}`);
        if (!cancel) setHistorial(Array.isArray(j.rows) ? j.rows : []);
      })
      .catch((e) => {
        if (!cancel) setMsg({ ok: false, text: e instanceof Error ? e.message : "No se cargó historial." });
      });
    return () => {
      cancel = true;
    };
  }, [noEmpleado]);

  function cambiarServicio(v: string) {
    if (editandoId) return;
    setServicio(v);
    setPlanta("");
    setNoEmpleado("");
  }

  async function guardar() {
    if (!seleccionado || !completo || saving) return;
    setSaving(true);
    setMsg(null);
    try {
      const scores = Object.fromEntries(categoriaDef.criterios.map((c) => [c.id, Number(puntajes[c.id])]));
      const r = await fetch("/api/pruebas-efectividad-operativa/evaluaciones", {
        method: editandoId ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: editandoId,
          noEmpleado: seleccionado.noEmpleado,
          categoria,
          tipo,
          evaluadaEn,
          observaciones,
          puntajes: scores,
        }),
      });
      const j = (await r.json()) as { row?: PeoEvaluacion; error?: string };
      if (!r.ok || !j.row) throw new Error(j.error ?? `Error ${r.status}`);
      setHistorial((prev) =>
        editandoId
          ? prev.map((e) => (e.id === editandoId ? j.row! : e))
          : [j.row!, ...prev],
      );
      setMsg({
        ok: true,
        text: `${seleccionado.noEmpleado} · ${etiquetaPeoTipo(j.row.tipo)} · ${categoriaDef.nombre} · ${evaluadaEn} · ${formatoPuntos(j.row.total)} / 100. Evaluación ${editandoId ? "actualizada" : "guardada"}.`,
      });
      setEditandoId(null);
      setPuntajes({});
      setObservaciones("");
      setEvaluadaEn(hoyLocal());
      setTipo("simulacion");
    } catch (e) {
      setMsg({ ok: false, text: e instanceof Error ? e.message : "No se guardó la evaluación." });
    } finally {
      setSaving(false);
    }
  }

  function iniciarEdicion(e: PeoEvaluacion) {
    setNoEmpleado(e.noEmpleado);
    setCategoria(e.categoria);
    setTipo(e.tipo ?? "simulacion");
    setEvaluadaEn(e.evaluadaEn);
    setObservaciones(e.observaciones);
    setPuntajes(Object.fromEntries(e.puntajes.map((p) => [p.id, String(p.obtenido)])));
    setEditandoId(e.id);
    setMsg({
      ok: true,
      text: `Editando ${etiquetaPeoTipo(e.tipo).toLowerCase()} del ${e.evaluadaEn}. Guarde para aplicar los cambios.`,
    });
    document.getElementById("peo-formulario-evaluacion")?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function cancelarEdicion() {
    setEditandoId(null);
    setPuntajes({});
    setObservaciones("");
    setEvaluadaEn(hoyLocal());
    setTipo("simulacion");
    setMsg(null);
  }

  async function eliminar(id: string) {
    if (appRole !== "admin" || !window.confirm("¿Eliminar definitivamente esta evaluación?")) return;
    const r = await fetch(`/api/pruebas-efectividad-operativa/evaluaciones?id=${encodeURIComponent(id)}`, {
      method: "DELETE",
    });
    const j = (await r.json()) as { error?: string };
    if (!r.ok) {
      setMsg({ ok: false, text: j.error ?? `Error ${r.status}` });
      return;
    }
    setHistorial((prev) => prev.filter((e) => e.id !== id));
    setMsg({ ok: true, text: "Evaluación eliminada." });
  }

  return (
    <AppModuleShell
      role={appRole}
      email={email}
      currentPath="/pruebas-efectividad-operativa"
      modulosHabilitados={modulosHabilitados}
    >
      <div className="min-w-0 space-y-5">
        <header className="rounded-2xl bg-gradient-to-br from-slate-950 via-indigo-950 to-violet-900 p-5 text-white shadow-lg sm:p-7">
          <p className="text-xs font-bold uppercase tracking-[0.22em] text-violet-200">Desarrollo operativo</p>
          <h1 className="mt-2 text-2xl font-black uppercase tracking-tight sm:text-4xl">
            Pruebas de Efectividad Operativa
          </h1>
          <p className="mt-2 max-w-4xl text-sm text-slate-200 sm:text-base">
            Registre simulaciones, mida la aplicación del protocolo y conserve cada intento para seguimiento.
          </p>
          <div className="mt-5 flex flex-wrap gap-2">
            <Link href="/pruebas-efectividad-operativa/dashboard" className="btn-primary uppercase">
              Dashboard ejecutivo
            </Link>
          </div>
        </header>

        {msg ? (
          <div
            className={`rounded-xl border px-4 py-3 text-sm font-bold uppercase ${
              msg.ok
                ? "border-emerald-200 bg-emerald-50 text-emerald-900"
                : "border-red-200 bg-red-50 text-red-900"
            }`}
          >
            {msg.text}
          </div>
        ) : null}

        <section id="peo-formulario-evaluacion" className="card space-y-5 scroll-mt-4">
          <div>
            <h2 className="text-lg font-black uppercase text-slate-900">
              {editandoId ? "Editar evaluación" : "Nueva evaluación"}
            </h2>
            <p className="text-sm text-slate-600">Todos los criterios aceptan un puntaje parcial entre 0 y su máximo.</p>
          </div>

          <div className="grid gap-4 lg:grid-cols-3">
            <CatFiltroServicio value={servicio} onChange={cambiarServicio} personal={personal} />
            <CatFiltroPlanta
              servicioFiltro={servicio}
              value={planta}
              onChange={(v) => {
                if (editandoId) return;
                setPlanta(v);
                setNoEmpleado("");
              }}
              personal={personal}
            />
            <CatEmpleadoBuscador
              label="Colaborador"
              value={noEmpleado}
              onChange={(no) => {
                setNoEmpleado(no);
                if (!no) setHistorial([]);
              }}
              opciones={personalFiltrado}
              disabled={loading || Boolean(editandoId)}
              listId="peo-empleados"
            />
          </div>

          {seleccionado ? (
            <div className="grid gap-2 rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm uppercase sm:grid-cols-4">
              <div><span className="block text-[10px] font-bold text-slate-500">N.º empleado</span>{seleccionado.noEmpleado}</div>
              <div><span className="block text-[10px] font-bold text-slate-500">Nombre</span>{seleccionado.nombre}</div>
              <div><span className="block text-[10px] font-bold text-slate-500">Servicio</span>{seleccionado.servicio}</div>
              <div><span className="block text-[10px] font-bold text-slate-500">Puesto</span>{seleccionado.puesto || "—"}</div>
            </div>
          ) : null}

          <div className="grid gap-4 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1.4fr)_minmax(200px,1fr)]">
            <label className="space-y-1">
              <span className="form-label">Tipo de prueba</span>
              <select
                className="form-control uppercase"
                value={tipo}
                onChange={(e) => setTipo(e.target.value as PeoTipoId)}
              >
                {PEO_TIPOS.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.nombre}
                  </option>
                ))}
              </select>
              <p className="text-xs font-semibold text-slate-600">
                {PEO_TIPOS.find((t) => t.id === tipo)?.descripcion}
              </p>
            </label>
            <label className="space-y-1">
              <span className="form-label">Categoría de prueba</span>
              <select
                className="form-control uppercase"
                value={categoria}
                disabled={Boolean(editandoId)}
                onChange={(e) => {
                  setCategoria(e.target.value as PeoCategoriaId);
                  setPuntajes({});
                }}
              >
                {PEO_CATEGORIAS.map((c) => (
                  <option key={c.id} value={c.id}>{c.nombre}</option>
                ))}
              </select>
              <p className="text-xs font-semibold text-violet-800">Objetivo: {categoriaDef.objetivo}</p>
            </label>
            <label className="space-y-1">
              <span className="form-label">Fecha de aplicación</span>
              <input
                type="date"
                className="form-control"
                value={evaluadaEn}
                max={hoyLocal()}
                onChange={(e) => setEvaluadaEn(e.target.value)}
              />
            </label>
          </div>

          <div className="overflow-hidden rounded-xl border border-slate-200">
            <div className="grid grid-cols-[minmax(0,1fr)_110px] bg-slate-900 px-4 py-3 text-xs font-black uppercase text-white">
              <span>Concepto</span>
              <span className="text-center">Puntos</span>
            </div>
            {categoriaDef.criterios.map((criterio) => (
              <div
                key={criterio.id}
                className="grid grid-cols-[minmax(0,1fr)_110px] items-center gap-3 border-t border-slate-200 px-4 py-3"
              >
                <div>
                  <p className="font-semibold text-slate-900">{criterio.etiqueta}</p>
                  <p className="text-[11px] text-slate-500">Máximo: {criterio.maximo} puntos</p>
                </div>
                <input
                  type="number"
                  min={0}
                  max={criterio.maximo}
                  step="0.5"
                  required
                  aria-label={`${criterio.etiqueta}, máximo ${criterio.maximo}`}
                  className="form-control text-center font-black"
                  value={puntajes[criterio.id] ?? ""}
                  onChange={(e) => setPuntajes((prev) => ({ ...prev, [criterio.id]: e.target.value }))}
                />
              </div>
            ))}
            <div className="flex items-center justify-between border-t-2 border-slate-900 bg-violet-50 px-4 py-4">
              <span className="text-sm font-black uppercase text-slate-900">Total</span>
              <span className="text-xl font-black text-violet-950">{formatoPuntos(total)} / 100</span>
            </div>
          </div>

          <label className="block space-y-1">
            <span className="form-label">Observaciones</span>
            <textarea
              className="form-control min-h-24"
              maxLength={4000}
              value={observaciones}
              onChange={(e) => setObservaciones(e.target.value)}
              placeholder="Incidentes observados, fortalezas y acciones de mejora…"
            />
          </label>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              className="btn-primary uppercase"
              disabled={!seleccionado || !completo || !evaluadaEn || saving}
              onClick={() => void guardar()}
            >
              {saving ? "Guardando…" : editandoId ? "Guardar cambios" : "Guardar intento histórico"}
            </button>
            {editandoId ? (
              <button type="button" className="btn-secondary uppercase" disabled={saving} onClick={cancelarEdicion}>
                Cancelar edición
              </button>
            ) : null}
          </div>
        </section>

        {noEmpleado ? (
          <section className="card">
            <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
              <div>
                <h2 className="text-lg font-black uppercase text-slate-900">Historial del colaborador</h2>
                <p className="text-xs text-slate-600">
                  {historial.length} intento(s): {conteoSimulacion} simulación · {conteoReal} real
                  {historialFiltroTipo
                    ? ` · mostrando ${historialVisible.length} de ${etiquetaPeoTipo(historialFiltroTipo).toLowerCase()}`
                    : ""}
                  .
                </p>
              </div>
              <label className="space-y-1">
                <span className="form-label">Ver historial</span>
                <select
                  className="form-control uppercase"
                  value={historialFiltroTipo}
                  onChange={(e) => setHistorialFiltroTipo(e.target.value as PeoTipoId | "")}
                >
                  <option value="">Todos</option>
                  {PEO_TIPOS.map((t) => (
                    <option key={t.id} value={t.id}>
                      Solo {t.nombre.toLowerCase()}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <div className="space-y-3">
              {historialVisible.map((e) => (
                <details key={e.id} className="rounded-xl border border-slate-200 bg-white">
                  <summary className="cursor-pointer px-4 py-3 font-bold uppercase text-slate-900">
                    <span
                      className={`mr-2 inline-block rounded px-2 py-0.5 text-[10px] ${
                        e.tipo === "real" ? "bg-rose-100 text-rose-900" : "bg-sky-100 text-sky-900"
                      }`}
                    >
                      {etiquetaPeoTipo(e.tipo)}
                    </span>
                    {e.evaluadaEn} · {peoCategoria(e.categoria)?.nombre ?? e.categoria} · {formatoPuntos(e.total)} / 100
                  </summary>
                  <div className="border-t border-slate-100 px-4 py-3 text-sm">
                    <ul className="space-y-1">
                      {e.puntajes.map((p) => (
                        <li key={p.id} className="flex justify-between gap-4">
                          <span>{p.etiqueta}</span>
                          <strong className="whitespace-nowrap">{formatoPuntos(p.obtenido)} / {p.maximo}</strong>
                        </li>
                      ))}
                    </ul>
                    {e.observaciones ? <p className="mt-3 rounded bg-slate-50 p-2">{e.observaciones}</p> : null}
                    <p className="mt-2 text-[11px] text-slate-500">Evaluó: {e.evaluadorEmail || "usuario interno"}</p>
                    <div className="mt-3 flex flex-wrap gap-3">
                      <button
                        type="button"
                        className="text-xs font-bold uppercase text-violet-800 hover:underline"
                        onClick={() => iniciarEdicion(e)}
                      >
                        Editar evaluación
                      </button>
                      {appRole === "admin" ? (
                        <button
                          type="button"
                          className="text-xs font-bold uppercase text-red-700 hover:underline"
                          onClick={() => void eliminar(e.id)}
                        >
                          Eliminar evaluación
                        </button>
                      ) : null}
                    </div>
                  </div>
                </details>
              ))}
              {historialVisible.length === 0 ? (
                <p className="text-sm text-slate-500">
                  {historial.length === 0
                    ? "Sin evaluaciones previas."
                    : `Sin evaluaciones de tipo ${etiquetaPeoTipo(historialFiltroTipo).toLowerCase()}.`}
                </p>
              ) : null}
            </div>
          </section>
        ) : null}
      </div>
    </AppModuleShell>
  );
}
