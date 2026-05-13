"use client";

import { FormEvent, useCallback, useEffect, useState, type MouseEvent } from "react";
import {
  aplicarMoperMovimiento,
  findColaboradorCompletoByNo,
  getMoperInicialesParaFormulario,
  sincronizarColaboradoresConHistorialMoper,
} from "@/lib/colaboradores-store";
import {
  pushMoperHistorial,
  listMoperHistorialPorEmpleado,
  listMoperHistorialReciente,
  deleteMoperHistorial,
  deleteAllMoperHistorial,
} from "@/lib/moper-historial";
import type { MoperHistorialEntrada } from "@/lib/moper-historial-types";

function formatoFechaMoper(iso: string): string {
  if (!iso.trim()) return "—";
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return iso.toUpperCase();
    return d.toLocaleString("es-MX", { dateStyle: "short", timeStyle: "short" }).toUpperCase();
  } catch {
    return iso.toUpperCase();
  }
}

export default function MoperPage() {
  const [noEmpleadoBusqueda, setNoEmpleadoBusqueda] = useState("");
  const [noEmpleado, setNoEmpleado] = useState("");
  const [servicioInicial, setServicioInicial] = useState("");
  const [servicioFinal, setServicioFinal] = useState("");
  const [puestoInicial, setPuestoInicial] = useState("");
  const [puestoFinal, setPuestoFinal] = useState("");
  const [motivo, setMotivo] = useState("");
  const [especificacion, setEspecificacion] = useState("");
  const [searchMsg, setSearchMsg] = useState<string | null>(null);
  const [nombreRef, setNombreRef] = useState("");
  const [okMsg, setOkMsg] = useState<string | null>(null);

  const [historialReciente, setHistorialReciente] = useState<MoperHistorialEntrada[]>([]);
  const [historialRecienteLoading, setHistorialRecienteLoading] = useState(true);
  const [historialRecienteErr, setHistorialRecienteErr] = useState<string | null>(null);

  const [historialColab, setHistorialColab] = useState<MoperHistorialEntrada[]>([]);
  const [historialColabLoading, setHistorialColabLoading] = useState(false);
  const [historialColabErr, setHistorialColabErr] = useState<string | null>(null);

  const [sincronizandoColab, setSincronizandoColab] = useState(false);
  const [syncMsg, setSyncMsg] = useState<string | null>(null);
  const [syncErr, setSyncErr] = useState<string | null>(null);

  const [isAdmin, setIsAdmin] = useState(false);
  const [purgingHistorial, setPurgingHistorial] = useState(false);

  const cargarHistorialReciente = useCallback(async () => {
    setHistorialRecienteLoading(true);
    setHistorialRecienteErr(null);
    try {
      const list = await listMoperHistorialReciente(80);
      setHistorialReciente(list);
    } catch (e) {
      setHistorialReciente([]);
      setHistorialRecienteErr(e instanceof Error ? e.message : "NO SE PUDO CARGAR EL HISTORIAL.");
    } finally {
      setHistorialRecienteLoading(false);
    }
  }, []);

  useEffect(() => {
    void cargarHistorialReciente();
  }, [cargarHistorialReciente]);

  useEffect(() => {
    let cancel = false;
    fetch("/api/auth/me", { cache: "no-store" })
      .then((r) => r.json() as Promise<{ role: string | null }>)
      .then((d) => {
        if (!cancel) setIsAdmin(d.role === "admin");
      })
      .catch(() => {
        if (!cancel) setIsAdmin(false);
      });
    return () => {
      cancel = true;
    };
  }, []);

  useEffect(() => {
    if (!noEmpleado.trim()) {
      setHistorialColab([]);
      setHistorialColabErr(null);
      return;
    }
    let cancel = false;
    setHistorialColabLoading(true);
    setHistorialColabErr(null);
    listMoperHistorialPorEmpleado(noEmpleado)
      .then((list) => {
        if (!cancel) setHistorialColab(list);
      })
      .catch((e) => {
        if (!cancel) {
          setHistorialColab([]);
          setHistorialColabErr(e instanceof Error ? e.message : "ERROR AL CARGAR HISTORIAL DEL COLABORADOR.");
        }
      })
      .finally(() => {
        if (!cancel) setHistorialColabLoading(false);
      });
    return () => {
      cancel = true;
    };
  }, [noEmpleado]);

  async function ejecutarSincronizarExpedientes() {
    setSyncErr(null);
    setSyncMsg(null);
    setSincronizandoColab(true);
    try {
      const res = await sincronizarColaboradoresConHistorialMoper();
      const extra =
        res.personasEnHistorial != null ? ` ${res.personasEnHistorial} PERSONA(S) CON AL MENOS UN MOVIMIENTO EN HISTORIAL.` : "";
      setSyncMsg(
        `EXPEDIENTES ACTUALIZADOS: ${res.updated}. SIN CAMBIO (YA COINCIDIAN): ${res.sinCambio}. SIN EXPEDIENTE EN TABLA: ${res.sinExpediente}.${extra}`,
      );
    } catch (e) {
      setSyncErr(e instanceof Error ? e.message : "ERROR AL SINCRONIZAR EXPEDIENTES.");
    } finally {
      setSincronizandoColab(false);
    }
  }

  async function cargarColaborador(noOverride?: string) {
    const key = (noOverride ?? noEmpleadoBusqueda).trim().toUpperCase();
    if (!key) {
      setSearchMsg("CAPTURE UN N° DE EMPLEADO.");
      return;
    }
    setNoEmpleadoBusqueda(key);
    setOkMsg(null);
    let c;
    try {
      c = await findColaboradorCompletoByNo(key);
    } catch (err) {
      setSearchMsg(err instanceof Error ? err.message : "ERROR AL CONSULTAR SUPABASE.");
      return;
    }
    if (!c) {
      setSearchMsg("NO ENCONTRADO. REGISTRELO EN ALTAS PRIMERO.");
      setNoEmpleado("");
      setNombreRef("");
      setServicioInicial("");
      setPuestoInicial("");
      setServicioFinal("");
      setPuestoFinal("");
      setMotivo("");
      setEspecificacion("");
      return;
    }
    setSearchMsg(null);
    setOkMsg(null);
    setNoEmpleado(c.noEmpleado);
    setNombreRef(c.nombreCompleto);
    const ini = getMoperInicialesParaFormulario(c);
    setServicioInicial(ini.servicio);
    setPuestoInicial(ini.puesto);
    setServicioFinal("");
    setPuestoFinal("");
    setMotivo("");
    setEspecificacion("");
  }

  function scrollABuscarColaborador() {
    document.getElementById("moper-panel-buscar")?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  async function abrirDesdeHistorial(entry: MoperHistorialEntrada, ev: MouseEvent<HTMLButtonElement>) {
    ev.preventDefault();
    ev.stopPropagation();
    const no = entry.noEmpleado.trim().toUpperCase();
    if (!no) {
      setSearchMsg("ESTE REGISTRO NO TIENE N° DE EMPLEADO VÁLIDO. USE ELIMINAR SI ES UN DUPLICADO ERRÓNEO.");
      scrollABuscarColaborador();
      return;
    }
    setNoEmpleadoBusqueda(no);
    await cargarColaborador(no);
    scrollABuscarColaborador();
  }

  /** Precarga iniciales desde una fila del historial (reutilizar o corregir). Abre el colaborador y copia valores. */
  async function usarValoresMovimiento(entry: MoperHistorialEntrada, ev?: MouseEvent<HTMLButtonElement>) {
    ev?.preventDefault();
    ev?.stopPropagation();
    const no = entry.noEmpleado.trim().toUpperCase();
    if (!no) {
      setSearchMsg("ESTE REGISTRO NO TIENE N° DE EMPLEADO VÁLIDO.");
      scrollABuscarColaborador();
      return;
    }
    await cargarColaborador(no);
    setServicioInicial(entry.servicioInicial.trim());
    setPuestoInicial(entry.puestoInicial.trim());
    setServicioFinal(entry.servicioFinal.trim());
    setPuestoFinal(entry.puestoFinal.trim());
    setMotivo(entry.motivo.trim());
    setEspecificacion(entry.especificacion.trim());
    setOkMsg(null);
    setSearchMsg(null);
    scrollABuscarColaborador();
  }

  async function eliminarMoper(entry: MoperHistorialEntrada, ev: MouseEvent<HTMLButtonElement>) {
    ev.preventDefault();
    ev.stopPropagation();
    if (!entry.historialId?.trim()) {
      setSearchMsg("RECARGA LA PÁGINA: FALTA EL ID DEL REGISTRO PARA ELIMINAR.");
      return;
    }
    const ok = window.confirm(
      "¿Eliminar este movimiento del historial MOPER? No revierte el expediente; solo borra la fila del historial.",
    );
    if (!ok) return;
    setSearchMsg(null);
    try {
      await deleteMoperHistorial(entry.historialId);
      await cargarHistorialReciente();
      const noColab = noEmpleado.trim().toUpperCase();
      const noEnt = entry.noEmpleado.trim().toUpperCase();
      if (noColab && noEnt === noColab) {
        const list = await listMoperHistorialPorEmpleado(noColab);
        setHistorialColab(list);
      }
    } catch (e) {
      setSearchMsg(e instanceof Error ? e.message : "NO SE PUDO ELIMINAR EL MOVIMIENTO.");
    }
  }

  async function eliminarTodoHistorialMoper() {
    const ok = window.confirm(
      "¿VACIAR TODO EL HISTORIAL MOPER? Se borrarán todas las filas en la base de datos. Los expedientes de colaboradores NO se modifican; solo desaparece el registro histórico de movimientos.",
    );
    if (!ok) return;
    setSearchMsg(null);
    setOkMsg(null);
    setPurgingHistorial(true);
    try {
      await deleteAllMoperHistorial();
      await cargarHistorialReciente();
      const noColab = noEmpleado.trim().toUpperCase();
      if (noColab) {
        const list = await listMoperHistorialPorEmpleado(noColab);
        setHistorialColab(list);
      }
      setOkMsg("HISTORIAL MOPER VACIADO (TODOS LOS REGISTROS ELIMINADOS).");
    } catch (e) {
      setSearchMsg(e instanceof Error ? e.message : "NO SE PUDO VACIAR EL HISTORIAL.");
    } finally {
      setPurgingHistorial(false);
    }
  }

  async function guardarMovimiento(e: FormEvent) {
    e.preventDefault();
    if (!noEmpleado) {
      setSearchMsg("BUSQUE UN COLABORADOR VALIDO.");
      return;
    }
    if (!servicioFinal.trim() || !puestoFinal.trim()) {
      setSearchMsg("SERVICIO FINAL Y PUESTO FINAL SON OBLIGATORIOS.");
      return;
    }
    const inicialServ = servicioInicial;
    const inicialPuesto = puestoInicial;
    try {
      await aplicarMoperMovimiento(noEmpleado, {
        servicioFinal,
        puestoFinal,
      });
      await pushMoperHistorial({
        noEmpleado,
        servicioInicial: inicialServ,
        servicioFinal: servicioFinal.trim(),
        puestoInicial: inicialPuesto,
        puestoFinal: puestoFinal.trim(),
        motivo: motivo.trim(),
        especificacion: especificacion.trim(),
        registradoEn: new Date().toISOString(),
      });
    } catch (err) {
      setSearchMsg(err instanceof Error ? err.message : "ERROR AL GUARDAR MOVIMIENTO.");
      setOkMsg(null);
      return;
    }

    try {
      const c2 = await findColaboradorCompletoByNo(noEmpleado);
      if (c2) {
        const ini = getMoperInicialesParaFormulario(c2);
        setServicioInicial(ini.servicio);
        setPuestoInicial(ini.puesto);
        setServicioFinal("");
        setPuestoFinal("");
        setMotivo("");
        setEspecificacion("");
      }
    } catch {
      /* Movimiento ya persistido; solo no se refrescaron iniciales */
    }
    setSearchMsg(null);
    setOkMsg("MOVIMIENTO REGISTRADO. SERVICIO Y PUESTO INICIAL ACTUALIZADOS PARA LA SIGUIENTE CAPTURA.");
    void cargarHistorialReciente();
  }

  function limpiar() {
    setNoEmpleadoBusqueda("");
    setNoEmpleado("");
    setNombreRef("");
    setServicioInicial("");
    setPuestoInicial("");
    setServicioFinal("");
    setPuestoFinal("");
    setMotivo("");
    setEspecificacion("");
    setSearchMsg(null);
    setOkMsg(null);
  }

  const celda = "border-b border-slate-100 px-3 py-2 align-top text-xs uppercase text-slate-800";

  return (
    <div className="w-full">
        <div className="mb-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Modulo</p>
            <h1 className="text-3xl font-bold uppercase tracking-tight text-slate-900">MOPER</h1>
            <p className="mt-1 max-w-xl text-base font-medium leading-relaxed text-slate-800">
              Cambio de servicio y puesto. Los valores iniciales salen del expediente y del ultimo movimiento. Usa el historial para abrir un colaborador o reutilizar valores de un movimiento anterior.
            </p>
          </div>
        </div>

        <section className="card mb-6 flex flex-col gap-3 border border-blue-100 bg-blue-50/60 md:flex-row md:items-start md:justify-between">
          <div className="min-w-0 flex-1 space-y-1">
            <h2 className="text-sm font-bold uppercase text-slate-900">Actualizar expedientes desde historial MOPER</h2>
            <p className="text-xs text-slate-600">
              Alinea cada expediente (servicio y puesto de <strong>Parte 1</strong>, mas linea vigente) con el <strong>ultimo movimiento</strong> del historial MOPER. El nombre de servicio se toma del <strong>catalogo Servicios</strong> cuando coincide con el texto del historial (misma normalización que en el modulo Servicios). Util si hubo importaciones o datos desfasados.
            </p>
            {syncErr ? (
              <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs font-semibold uppercase text-red-900">{syncErr}</p>
            ) : null}
            {syncMsg ? (
              <p className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-semibold uppercase text-emerald-950">{syncMsg}</p>
            ) : null}
          </div>
          <button
            type="button"
            className="btn-primary shrink-0 self-start uppercase"
            disabled={sincronizandoColab}
            onClick={() => void ejecutarSincronizarExpedientes()}
          >
            {sincronizandoColab ? "Actualizando…" : "Actualizar colaboradores con MOPER"}
          </button>
        </section>

        <section className="card mb-6 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-sm font-bold uppercase text-slate-800">Ultimos movimientos registrados</h2>
            <div className="flex flex-wrap items-center gap-2">
              <button type="button" className="btn-secondary text-xs uppercase" onClick={() => void cargarHistorialReciente()}>
                Actualizar lista
              </button>
              {isAdmin ? (
                <button
                  type="button"
                  className="rounded border border-rose-300 bg-white px-3 py-1.5 text-xs font-semibold uppercase text-rose-900 hover:bg-rose-50 disabled:opacity-60"
                  disabled={purgingHistorial || historialRecienteLoading}
                  onClick={() => void eliminarTodoHistorialMoper()}
                  title="Solo administradores: borra todas las filas del historial en Supabase."
                >
                  {purgingHistorial ? "Eliminando…" : "Eliminar todo el historial"}
                </button>
              ) : null}
            </div>
          </div>
          <p className="text-xs text-slate-600">
            Mas recientes primero. <strong>Abrir colaborador</strong> carga la ficha para capturar un nuevo movimiento. <strong>Cargar en formulario</strong> copia servicios, puestos y texto de ese registro. <strong>Eliminar</strong> borra solo la fila del historial (no modifica el expediente).
          </p>
          {historialRecienteErr ? (
            <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-semibold uppercase text-amber-950">
              {historialRecienteErr}
            </p>
          ) : null}
          {historialRecienteLoading ? (
            <p className="text-sm text-slate-500">Cargando historial…</p>
          ) : historialReciente.length === 0 ? (
            <p className="text-sm text-slate-600">AUN NO HAY MOVIMIENTOS REGISTRADOS EN ESTE MODULO.</p>
          ) : (
            <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
              <table className="min-w-[960px] w-full text-left">
                <thead className="border-b border-slate-200 bg-slate-50 text-[11px] font-bold uppercase tracking-wide text-slate-600">
                  <tr>
                    <th className="whitespace-nowrap px-3 py-2">Fecha</th>
                    <th className="whitespace-nowrap px-3 py-2">N°</th>
                    <th className="min-w-[120px] px-3 py-2">Servicio</th>
                    <th className="min-w-[120px] px-3 py-2">Puesto</th>
                    <th className="min-w-[140px] px-3 py-2">Motivo</th>
                    <th className="whitespace-nowrap px-3 py-2 text-right">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {historialReciente.map((mov, idx) => (
                    <tr key={mov.historialId ?? `${mov.registradoEn}-${mov.noEmpleado}-${idx}`} className="hover:bg-slate-50">
                      <td className={`${celda} whitespace-nowrap font-mono text-[11px] text-slate-600`}>
                        {formatoFechaMoper(mov.registradoEn)}
                      </td>
                      <td className={`${celda} font-mono font-semibold`}>{mov.noEmpleado.trim() || "—"}</td>
                      <td className={celda}>
                        <span className="text-slate-500">{mov.servicioInicial.trim() || "—"}</span>
                        <span className="mx-1 text-slate-400">→</span>
                        <span>{mov.servicioFinal.trim() || "—"}</span>
                      </td>
                      <td className={celda}>
                        <span className="text-slate-500">{mov.puestoInicial.trim() || "—"}</span>
                        <span className="mx-1 text-slate-400">→</span>
                        <span>{mov.puestoFinal.trim() || "—"}</span>
                      </td>
                      <td className={`${celda} max-w-[200px] truncate`} title={mov.motivo}>
                        {mov.motivo.trim() || "—"}
                      </td>
                      <td className={`${celda} text-right`}>
                        <div className="relative z-10 flex flex-col items-end gap-1 sm:flex-row sm:flex-wrap sm:justify-end sm:gap-x-2 sm:gap-y-1">
                          <button
                            type="button"
                            className="btn-outline-light px-2 py-1 text-[11px] uppercase"
                            onClick={(e) => void abrirDesdeHistorial(mov, e)}
                          >
                            Abrir colaborador
                          </button>
                          <button
                            type="button"
                            className="btn-primary px-2 py-1 text-[11px] uppercase"
                            onClick={(e) => void usarValoresMovimiento(mov, e)}
                          >
                            Cargar en formulario
                          </button>
                          <button
                            type="button"
                            className="rounded border border-rose-200 bg-white px-2 py-1 text-[11px] font-semibold uppercase text-rose-800 hover:bg-rose-50"
                            onClick={(e) => void eliminarMoper(mov, e)}
                          >
                            Eliminar
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <form id="moper-formulario" onSubmit={guardarMovimiento} className="card space-y-5">
          <div id="moper-panel-buscar" className="rounded-xl border border-slate-200 bg-slate-50 p-4 scroll-mt-4">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-600">Buscar colaborador</p>
            <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
              <label className="min-w-0 flex-1 space-y-1">
                <span className="form-label uppercase">N° DE EMPLEADO</span>
                <input
                  className="form-control uppercase"
                  value={noEmpleadoBusqueda}
                  onChange={(e) => setNoEmpleadoBusqueda(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      void cargarColaborador();
                    }
                  }}
                />
              </label>
              <button type="button" className="btn-primary shrink-0 uppercase sm:min-w-[140px]" onClick={() => void cargarColaborador()}>
                Buscar
              </button>
            </div>
            {nombreRef ? (
              <p className="mt-2 text-sm font-medium text-slate-700">
                <span className="uppercase text-slate-500">Colaborador:</span> {nombreRef.toUpperCase()}
              </p>
            ) : null}
            {searchMsg ? <p className="mt-2 text-sm font-medium uppercase text-amber-800">{searchMsg}</p> : null}
            {okMsg ? <p className="mt-2 text-sm font-medium uppercase text-green-800">{okMsg}</p> : null}
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <Field
              label="SERVICIO INICIAL (ALTA / ULTIMO MOPER)"
              value={servicioInicial}
              onChange={setServicioInicial}
              helper="SE PRECARGA DESDE EL EXPEDIENTE; PUEDE AJUSTARSE SI ES NECESARIO."
            />
            <Field label="SERVICIO FINAL" value={servicioFinal} onChange={setServicioFinal} />
            <Field
              label="PUESTO INICIAL (ALTA / ULTIMO MOPER)"
              value={puestoInicial}
              onChange={setPuestoInicial}
              helper="SE PRECARGA DESDE EL EXPEDIENTE; PUEDE AJUSTARSE SI ES NECESARIO."
            />
            <Field label="PUESTO FINAL" value={puestoFinal} onChange={setPuestoFinal} />
            <TextAreaField className="md:col-span-2" label="MOTIVO" value={motivo} onChange={setMotivo} />
            <TextAreaField className="md:col-span-2" label="ESPECIFICACION" value={especificacion} onChange={setEspecificacion} />
          </div>

          <div className="flex flex-wrap justify-end gap-2 border-t border-slate-200 pt-4">
            <button type="button" className="btn-secondary uppercase" onClick={limpiar}>
              Limpiar
            </button>
            <button type="submit" className="btn-primary uppercase" disabled={!noEmpleado}>
              Guardar movimiento
            </button>
          </div>
        </form>

        {noEmpleado ? (
          <section className="card mt-6 space-y-3">
            <h2 className="text-sm font-bold uppercase text-slate-800">Historial MOPER de este colaborador ({noEmpleado})</h2>
            {historialColabErr ? (
              <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-semibold uppercase text-amber-950">
                {historialColabErr}
              </p>
            ) : null}
            {historialColabLoading ? (
              <p className="text-sm text-slate-500">Cargando…</p>
            ) : historialColab.length === 0 ? (
              <p className="text-sm text-slate-600">SIN MOVIMIENTOS PREVIOS PARA ESTE NUMERO.</p>
            ) : (
              <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
                <table className="min-w-[900px] w-full text-left">
                  <thead className="border-b border-slate-200 bg-slate-50 text-[11px] font-bold uppercase tracking-wide text-slate-600">
                    <tr>
                      <th className="whitespace-nowrap px-3 py-2">Fecha</th>
                      <th className="min-w-[120px] px-3 py-2">Servicio</th>
                      <th className="min-w-[120px] px-3 py-2">Puesto</th>
                      <th className="min-w-[140px] px-3 py-2">Motivo</th>
                      <th className="whitespace-nowrap px-3 py-2 text-right">Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {historialColab.map((mov, idx) => (
                      <tr key={mov.historialId ?? `colab-${mov.registradoEn}-${idx}`} className="hover:bg-slate-50">
                        <td className={`${celda} whitespace-nowrap font-mono text-[11px] text-slate-600`}>
                          {formatoFechaMoper(mov.registradoEn)}
                        </td>
                        <td className={celda}>
                          <span className="text-slate-500">{mov.servicioInicial.trim() || "—"}</span>
                          <span className="mx-1 text-slate-400">→</span>
                          <span>{mov.servicioFinal.trim() || "—"}</span>
                        </td>
                        <td className={celda}>
                          <span className="text-slate-500">{mov.puestoInicial.trim() || "—"}</span>
                          <span className="mx-1 text-slate-400">→</span>
                          <span>{mov.puestoFinal.trim() || "—"}</span>
                        </td>
                        <td className={`${celda} max-w-[220px]`}>{mov.motivo.trim() || "—"}</td>
                        <td className={`${celda} text-right`}>
                          <div className="relative z-10 flex flex-wrap justify-end gap-2">
                            <button
                              type="button"
                              className="btn-primary px-2 py-1 text-[11px] uppercase"
                              onClick={(e) => void usarValoresMovimiento(mov, e)}
                            >
                              Cargar en formulario
                            </button>
                            <button
                              type="button"
                              className="rounded border border-rose-200 bg-white px-2 py-1 text-[11px] font-semibold uppercase text-rose-800 hover:bg-rose-50"
                              onClick={(e) => void eliminarMoper(mov, e)}
                            >
                              Eliminar
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        ) : null}
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  helper,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  helper?: string;
}) {
  return (
    <label className="space-y-1">
      <span className="form-label uppercase">{label}</span>
      <input className="form-control uppercase" value={value} onChange={(e) => onChange(e.target.value)} />
      {helper ? <span className="block text-[11px] font-medium uppercase tracking-wide text-slate-400">{helper}</span> : null}
    </label>
  );
}

function TextAreaField({
  label,
  value,
  onChange,
  className = "",
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  className?: string;
}) {
  return (
    <label className={`space-y-1 ${className}`}>
      <span className="form-label uppercase">{label}</span>
      <textarea className="form-control min-h-24 uppercase" value={value} onChange={(e) => onChange(e.target.value)} />
    </label>
  );
}
