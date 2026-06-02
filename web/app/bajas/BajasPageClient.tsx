"use client";

import { FormEvent, Fragment, useEffect, useMemo, useRef, useState } from "react";
import type { ColaboradorCompleto } from "@/lib/colaboradores-types";
import {
  findColaboradorCompletoByNo,
  listColaboradoresCompletos,
  upsertColaboradorCompleto,
} from "@/lib/colaboradores-store";
import {
  aplicarBajaEnExpediente,
  bajasFormDesdeColaborador,
  listarColaboradoresBajaFiltrados,
  serviciosUnicosColaboradoresDadosDeBaja,
  servicioAsignadoDesdeExpediente,
  zonasDisponiblesFiltroBajas,
  ZONA_FILTRO_SIN_SUFIJO,
  type BajasFormState,
} from "@/lib/colaboradores-baja";
import type { AppRole } from "@/lib/app-role";
import { roleMayFilterBajasPorFechaBaja } from "@/lib/app-role";
import { normalizarFechaParaInputDate } from "@/lib/fecha-input-normalize";
import { servicioAgrupadoUsaZona } from "@/lib/servicio-agrupacion";
import { fetchServiciosCatalogo } from "@/lib/servicios-catalogo-client";
import { registrarVacanteTrasBaja } from "@/lib/vacantes-catalog-flujo";

const EMPTY_FORM: BajasFormState = {
  noEmpleado: "",
  nombreCompleto: "",
  servicioAsignado: "",
  ultimoServicio: "",
  nss: "",
  puesto: "",
  ingreso: "",
  fechaBaja: "",
  fechaRenuncia: "",
  ultimoDiaLaborado: "",
  motivoSeparacion: "",
  especificacion: "",
  comentario: "",
};

const MAX_SUGERENCIAS = 60;

function coincideBusqueda(c: ColaboradorCompleto, q: string): boolean {
  const n = q.trim().toLowerCase();
  if (!n) return true;
  const no = c.noEmpleado.toLowerCase();
  const nom = (c.nombreCompleto ?? "").toLowerCase();
  const nss = (c.nss ?? "").toLowerCase();
  return no.includes(n) || nom.includes(n) || nss.includes(n);
}

function formatoSoloFechaYmd(raw: string): string {
  const n = normalizarFechaParaInputDate(String(raw ?? ""));
  if (!n) return "—";
  const [y, mo, d] = n.split("-").map((x) => parseInt(x, 10));
  if (!y || !mo || !d) return "—";
  const dt = new Date(y, mo - 1, d);
  if (Number.isNaN(dt.getTime())) return "—";
  return dt.toLocaleDateString("es-MX", { dateStyle: "medium" }).toUpperCase();
}

export function BajasPageClient({
  readOnly,
  appRole,
}: {
  readOnly: boolean;
  appRole: AppRole;
}) {
  const puedeFiltrarFechaBaja = roleMayFilterBajasPorFechaBaja(appRole);
  const [rows, setRows] = useState<ColaboradorCompleto[]>([]);
  const [loadErr, setLoadErr] = useState<string | null>(null);
  const [sel, setSel] = useState("");
  const [busqueda, setBusqueda] = useState("");
  const [listaAbierta, setListaAbierta] = useState(false);
  const blurTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [form, setForm] = useState<BajasFormState>(EMPTY_FORM);
  const [searchMsg, setSearchMsg] = useState<string | null>(null);
  const [statusMsg, setStatusMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [guardando, setGuardando] = useState(false);

  const [filtroServicios, setFiltroServicios] = useState<string[]>([]);
  const [filtroZona, setFiltroZona] = useState("");
  const [filtroDesde, setFiltroDesde] = useState("");
  const [filtroHasta, setFiltroHasta] = useState("");
  /** N° empleado cuya fila de detalle de baja esta expandida en la tabla de consulta. */
  const [bajaDetalleAbierta, setBajaDetalleAbierta] = useState<string | null>(null);

  useEffect(() => {
    let cancel = false;
    (async () => {
      setLoadErr(null);
      try {
        const list = await listColaboradoresCompletos();
        if (!cancel) setRows(list);
      } catch (e) {
        if (!cancel) {
          setRows([]);
          setLoadErr(e instanceof Error ? e.message : "ERROR AL CARGAR COLABORADORES.");
        }
      }
    })();
    return () => {
      cancel = true;
    };
  }, []);

  const opciones = useMemo(
    () =>
      [...rows].sort((a, b) =>
        a.noEmpleado.localeCompare(b.noEmpleado, "es", { numeric: true, sensitivity: "base" }),
      ),
    [rows],
  );

  const sugerencias = useMemo(() => {
    const filtradas = opciones.filter((c) => coincideBusqueda(c, busqueda));
    return filtradas.slice(0, MAX_SUGERENCIAS);
  }, [opciones, busqueda]);

  const serviciosOpcionesBajas = useMemo(() => serviciosUnicosColaboradoresDadosDeBaja(rows), [rows]);

  const servicioUnicoParaZona = filtroServicios.length === 1 ? filtroServicios[0]!.trim() : "";

  const zonasFiltroConsulta = useMemo(
    () => zonasDisponiblesFiltroBajas(rows, servicioUnicoParaZona),
    [rows, servicioUnicoParaZona],
  );

  const bajasRegistradasEnPeriodo = useMemo(() => {
    const list = listarColaboradoresBajaFiltrados(rows, {
      desde: filtroDesde.trim() || undefined,
      hasta: filtroHasta.trim() || undefined,
      servicios: filtroServicios.length > 0 ? filtroServicios : undefined,
      zona: filtroZona.trim() || undefined,
      usarFechaBajaEnRango: puedeFiltrarFechaBaja,
    });
    return [...list].sort((a, b) => {
      if (puedeFiltrarFechaBaja) {
        const fa = normalizarFechaParaInputDate(String(a.form?.fechaBaja ?? ""));
        const fb = normalizarFechaParaInputDate(String(b.form?.fechaBaja ?? ""));
        if (fa && fb) return fb.localeCompare(fa);
      }
      const ua = normalizarFechaParaInputDate(String(a.form?.ultimoDiaLaborado ?? ""));
      const ub = normalizarFechaParaInputDate(String(b.form?.ultimoDiaLaborado ?? ""));
      if (ua && ub) return ub.localeCompare(ua);
      if (ua && !ub) return -1;
      if (!ua && ub) return 1;
      const fa = normalizarFechaParaInputDate(String(a.form?.fechaBaja ?? ""));
      const fb = normalizarFechaParaInputDate(String(b.form?.fechaBaja ?? ""));
      return fb.localeCompare(fa);
    });
  }, [
    rows,
    filtroDesde,
    filtroHasta,
    filtroServicios,
    filtroZona,
    puedeFiltrarFechaBaja,
  ]);

  function toggleFiltroServicio(servicio: string) {
    setFiltroServicios((prev) =>
      prev.includes(servicio) ? prev.filter((x) => x !== servicio) : [...prev, servicio],
    );
    setFiltroZona("");
  }

  function seleccionarTodosServicios() {
    setFiltroServicios([...serviciosOpcionesBajas]);
    setFiltroZona("");
  }

  useEffect(() => {
    if (
      bajaDetalleAbierta &&
      !bajasRegistradasEnPeriodo.some((x) => x.noEmpleado === bajaDetalleAbierta)
    ) {
      setBajaDetalleAbierta(null);
    }
  }, [bajaDetalleAbierta, bajasRegistradasEnPeriodo]);

  useEffect(() => {
    return () => {
      if (blurTimer.current) clearTimeout(blurTimer.current);
    };
  }, []);

  function updateField(name: keyof BajasFormState, value: string) {
    setForm((prev) => ({ ...prev, [name]: value }));
  }

  async function cargarExpedienteYBaja(noEmpleadoKey: string) {
    setStatusMsg(null);
    const key = noEmpleadoKey.trim().toUpperCase();
    if (!key) {
      setSearchMsg("INDIQUE UN COLABORADOR DESDE LA LISTA.");
      return;
    }
    let completo;
    try {
      completo = await findColaboradorCompletoByNo(key);
    } catch (err) {
      setSearchMsg(err instanceof Error ? err.message : "ERROR AL CONSULTAR SUPABASE.");
      setSel("");
      setForm(EMPTY_FORM);
      return;
    }
    if (!completo) {
      setSearchMsg("NO SE ENCONTRO COLABORADOR. REVISE EL TEXTO O REGISTRELO EN ALTAS.");
      setSel("");
      setForm(EMPTY_FORM);
      return;
    }
    setSearchMsg(null);
    setForm(bajasFormDesdeColaborador(completo, undefined));
    setSel(completo.noEmpleado);
    setBusqueda(`${completo.noEmpleado} — ${completo.nombreCompleto || "(SIN NOMBRE)"}`);
  }

  function elegirColaborador(c: ColaboradorCompleto) {
    if (blurTimer.current) {
      clearTimeout(blurTimer.current);
      blurTimer.current = null;
    }
    setListaAbierta(false);
    void cargarExpedienteYBaja(c.noEmpleado);
  }

  function limpiarSeleccionYBuscador() {
    setSel("");
    setBusqueda("");
    setListaAbierta(false);
    setForm(EMPTY_FORM);
    setSearchMsg(null);
    setStatusMsg(null);
  }

  function limpiar() {
    limpiarSeleccionYBuscador();
  }

  async function submitBaja(e: FormEvent) {
    e.preventDefault();
    setStatusMsg(null);
    const no = form.noEmpleado.trim().toUpperCase();
    if (!no) {
      setStatusMsg({ ok: false, text: "SELECCIONE UN COLABORADOR PARA GUARDAR." });
      return;
    }
    setGuardando(true);
    try {
      const existing = await findColaboradorCompletoByNo(no);
      if (!existing) {
        setStatusMsg({ ok: false, text: "NO HAY EXPEDIENTE. REGISTRE EL COLABORADOR EN ALTAS PRIMERO." });
        return;
      }
      const next = aplicarBajaEnExpediente(existing, form);
      await upsertColaboradorCompleto(next);
      let catalogo: Awaited<ReturnType<typeof fetchServiciosCatalogo>> = [];
      try {
        catalogo = await fetchServiciosCatalogo();
      } catch {
        catalogo = [];
      }
      const vacante = await registrarVacanteTrasBaja(next, catalogo);
      const list = await listColaboradoresCompletos();
      setRows(list);
      const partes = ["BAJA GUARDADA. EXPEDIENTE ACTUALIZADO EN SUPABASE."];
      if (vacante.creada && vacante.registro) {
        partes.push(
          `NUEVA VACANTE EN CATALOGO (${vacante.registro.planta} · POS. ${vacante.registro.posicion} · ${vacante.registro.servicioLinea ?? "—"}) — DISPONIBLE EN ALTAS Y CUADRICULA → VACANTES.`,
        );
        if (!vacante.sync.ok) {
          partes.push(vacante.sync.aviso?.toUpperCase() ?? "VACANTE LOCAL; NO SINCRONIZADA A PRODUCCION.");
        }
      } else if (vacante.ok && vacante.motivo) {
        partes.push(vacante.motivo.toUpperCase());
      } else if (!vacante.ok && vacante.motivo) {
        partes.push(`VACANTE: ${vacante.motivo.toUpperCase()}`);
      }
      setStatusMsg({
        ok: true,
        text: partes.join(" "),
      });
    } catch (err) {
      setStatusMsg({ ok: false, text: err instanceof Error ? err.message : "ERROR AL GUARDAR." });
    } finally {
      setGuardando(false);
    }
  }

  function limpiarFiltrosConsulta() {
    setFiltroServicios([]);
    setFiltroZona("");
    setFiltroDesde("");
    setFiltroHasta("");
  }

  return (
    <div className="w-full">
        <div className="mb-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Modulo</p>
            <h1 className="text-3xl font-bold uppercase tracking-tight text-slate-900">BAJAS</h1>
          </div>
        </div>

        {loadErr ? (
          <div className="card mb-4 border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold uppercase text-red-900">
            {loadErr}
          </div>
        ) : null}

        {readOnly ? (
          <div className="card mb-4 border border-slate-300 bg-slate-100 px-4 py-3 text-sm font-bold uppercase leading-relaxed text-slate-800">
            Modo solo consulta: puedes usar la consulta de bajas registradas. El registro y edicion de bajas no esta permitido para tu rol.
          </div>
        ) : null}

        {!readOnly ? (
        <form onSubmit={submitBaja} className="card space-y-5">
          <h2 className="text-lg font-bold uppercase">REGISTRO DE BAJA</h2>
          <p className="text-sm font-semibold uppercase leading-relaxed text-slate-800">
            Los datos se fusionan con el expediente ALTAS en Supabase: no borra otras partes (1–6), solo actualiza baja y campos editados aqui.
          </p>

          <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
            <div className="relative space-y-1">
              <span className="form-label uppercase">Buscar colaborador</span>
              <p className="text-[11px] text-slate-500">Escribe numero de empleado, nombre o NSS; elige de la lista.</p>
              <div className="flex flex-wrap gap-2">
                <div className="relative min-w-0 flex-1">
                  <input
                    type="search"
                    autoComplete="off"
                    spellCheck={false}
                    placeholder="EJ. 9117 O JUAN PEREZ…"
                    className="form-control uppercase"
                    value={busqueda}
                    onChange={(e) => {
                      const v = e.target.value;
                      setBusqueda(v);
                      setListaAbierta(true);
                      if (sel) {
                        const etiqueta =
                          form.noEmpleado === sel
                            ? `${form.noEmpleado} — ${form.nombreCompleto || "(SIN NOMBRE)"}`
                            : (() => {
                                const r = rows.find((x) => x.noEmpleado === sel);
                                return r ? `${r.noEmpleado} — ${r.nombreCompleto || "(SIN NOMBRE)"}` : "";
                              })();
                        if (etiqueta && v.trim().toUpperCase() !== etiqueta.trim().toUpperCase()) {
                          setSel("");
                          setForm(EMPTY_FORM);
                          setSearchMsg(null);
                          setStatusMsg(null);
                        }
                      }
                    }}
                    onFocus={() => setListaAbierta(true)}
                    onBlur={() => {
                      blurTimer.current = setTimeout(() => setListaAbierta(false), 180);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        if (sugerencias.length === 1) {
                          elegirColaborador(sugerencias[0]!);
                        }
                      }
                    }}
                    aria-autocomplete="list"
                    aria-expanded={listaAbierta && sugerencias.length > 0}
                    aria-controls="bajas-sugerencias"
                  />
                  {listaAbierta && sugerencias.length > 0 ? (
                    <ul
                      id="bajas-sugerencias"
                      role="listbox"
                      className="absolute z-20 mt-1 max-h-64 w-full overflow-auto rounded-lg border border-slate-200 bg-white py-1 shadow-lg"
                    >
                      {sugerencias.map((r) => (
                        <li key={r.noEmpleado} role="option">
                          <button
                            type="button"
                            className="w-full px-3 py-2 text-left text-sm uppercase hover:bg-slate-100"
                            onMouseDown={(ev) => ev.preventDefault()}
                            onClick={() => elegirColaborador(r)}
                          >
                            <span className="font-mono font-semibold text-slate-900">{r.noEmpleado}</span>
                            <span className="text-slate-600"> — {r.nombreCompleto || "(SIN NOMBRE)"}</span>
                          </button>
                        </li>
                      ))}
                    </ul>
                  ) : null}
                  {listaAbierta && busqueda.trim() && sugerencias.length === 0 ? (
                    <p className="absolute z-20 mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-600 shadow-lg">
                      Sin coincidencias.
                    </p>
                  ) : null}
                </div>
                <button type="button" className="btn-secondary shrink-0 self-end uppercase text-xs" onClick={limpiarSeleccionYBuscador}>
                  Limpiar
                </button>
              </div>
              {opciones.length > MAX_SUGERENCIAS && !busqueda.trim() ? (
                <p className="text-[11px] text-slate-500">
                  Mostrando los primeros {MAX_SUGERENCIAS} por orden de numero. Escribe para acotar.
                </p>
              ) : null}
            </div>
            {searchMsg ? <p className="mt-2 text-sm font-medium uppercase text-amber-800">{searchMsg}</p> : null}
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <Field label="NOMBRE COMPLETO" value={form.nombreCompleto} onChange={(v) => updateField("nombreCompleto", v)} />
            <Field
              label="SERVICIO ASIGNADO (ALTA / CONTRATO)"
              value={form.servicioAsignado}
              onChange={(v) => updateField("servicioAsignado", v)}
            />
            <Field label="ULTIMO SERVICIO (EXPEDIENTE)" value={form.ultimoServicio} onChange={(v) => updateField("ultimoServicio", v)} />
            <Field label="NSS" value={form.nss} onChange={(v) => updateField("nss", v)} />
            <Field label="PUESTO" value={form.puesto} onChange={(v) => updateField("puesto", v)} />
            <Field label="INGRESO" type="date" value={form.ingreso} onChange={(v) => updateField("ingreso", v)} />
            <Field label="FECHA DE BAJA" type="date" value={form.fechaBaja} onChange={(v) => updateField("fechaBaja", v)} />
            <Field label="FECHA DE RENUNCIA" type="date" value={form.fechaRenuncia} onChange={(v) => updateField("fechaRenuncia", v)} />
            <Field
              label="ULTIMO DIA LABORADO"
              type="date"
              value={form.ultimoDiaLaborado}
              onChange={(v) => updateField("ultimoDiaLaborado", v)}
            />
            <Field
              label="MOTIVO DE SEPARACION"
              value={form.motivoSeparacion}
              onChange={(v) => updateField("motivoSeparacion", v)}
            />
            <TextAreaField
              className="md:col-span-2"
              label="ESPECIFICACION"
              value={form.especificacion}
              onChange={(v) => updateField("especificacion", v)}
            />
            <TextAreaField
              className="md:col-span-3"
              label="COMENTARIO"
              value={form.comentario}
              onChange={(v) => updateField("comentario", v)}
            />
          </div>

          {statusMsg ? (
            <p
              className={`rounded-lg px-3 py-2 text-sm font-semibold uppercase ${
                statusMsg.ok ? "border border-green-200 bg-green-50 text-green-900" : "border border-amber-200 bg-amber-50 text-amber-950"
              }`}
            >
              {statusMsg.text}
            </p>
          ) : null}

          <div className="flex flex-wrap justify-end gap-2 border-t border-slate-200 pt-4">
            <button type="button" className="btn-secondary uppercase" onClick={limpiar} disabled={guardando}>
              Limpiar
            </button>
            <button type="submit" className="btn-primary uppercase" disabled={guardando}>
              {guardando ? "GUARDANDO…" : "Guardar baja"}
            </button>
          </div>
        </form>
        ) : null}

        <section className="card mt-6 space-y-6" aria-labelledby="bajas-consulta-historial">
          <div>
            <h2 id="bajas-consulta-historial" className="text-lg font-bold uppercase text-slate-900">
              Consulta de bajas registradas
            </h2>
            <p className="mt-1 max-w-3xl text-sm font-semibold uppercase leading-relaxed text-slate-800">
              Marque uno o más <strong>servicios</strong> (sin marcar = todos). Solo aparecen expedientes con{" "}
              <strong>fecha de baja</strong>.
              {puedeFiltrarFechaBaja ? (
                <>
                  {" "}
                  El rango <strong>Desde / Hasta</strong> filtra por <strong>fecha de baja</strong> (Gerente RH /
                  Administrador).
                </>
              ) : (
                <>
                  {" "}
                  El rango <strong>Desde / Hasta</strong> filtra por <strong>último día laborado</strong>.
                </>
              )}{" "}
              Para <strong>CAT</strong> y <strong>U-ERRE</strong>, la <strong>zona</strong> aplica si eliges un solo
              servicio.
            </p>
          </div>

          <div className="grid grid-cols-1 gap-4 rounded-xl border border-slate-200 bg-slate-50 p-4 lg:grid-cols-12">
            <div className="space-y-2 lg:col-span-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="form-label uppercase">Servicios</span>
                <div className="flex gap-1">
                  <button
                    type="button"
                    className="btn-secondary px-2 py-1 text-[10px] uppercase"
                    onClick={seleccionarTodosServicios}
                    disabled={serviciosOpcionesBajas.length === 0}
                  >
                    Todos
                  </button>
                  <button
                    type="button"
                    className="btn-secondary px-2 py-1 text-[10px] uppercase"
                    onClick={() => {
                      setFiltroServicios([]);
                      setFiltroZona("");
                    }}
                    disabled={filtroServicios.length === 0}
                  >
                    Ninguno
                  </button>
                </div>
              </div>
              <div
                className="max-h-40 overflow-y-auto rounded-lg border border-slate-200 bg-white p-2"
                role="group"
                aria-label="Selección de servicios"
              >
                {serviciosOpcionesBajas.length === 0 ? (
                  <p className="text-[11px] uppercase text-slate-500">Sin servicios en bajas registradas.</p>
                ) : (
                  serviciosOpcionesBajas.map((s) => (
                    <label
                      key={s}
                      className="flex cursor-pointer items-start gap-2 border-b border-slate-50 py-1.5 text-xs uppercase last:border-0"
                    >
                      <input
                        type="checkbox"
                        className="mt-0.5"
                        checked={filtroServicios.includes(s)}
                        onChange={() => toggleFiltroServicio(s)}
                      />
                      <span>{s}</span>
                    </label>
                  ))
                )}
              </div>
              <span className="block text-[10px] font-medium uppercase leading-tight text-slate-400">
                {filtroServicios.length === 0
                  ? "Ninguno marcado = todos los servicios."
                  : `${filtroServicios.length} servicio(s) seleccionado(s).`}
              </span>
            </div>
            <label className="space-y-1 lg:col-span-2">
              <span className="form-label uppercase">Zona (CAT / U-ERRE)</span>
              <select
                className="form-control uppercase"
                value={filtroZona}
                onChange={(e) => setFiltroZona(e.target.value)}
                disabled={!servicioAgrupadoUsaZona(servicioUnicoParaZona)}
              >
                <option value="">Todas</option>
                {zonasFiltroConsulta.haySinSufijo ? (
                  <option value={ZONA_FILTRO_SIN_SUFIJO}>SIN ZONA (SOLO &quot;CAT&quot; O &quot;U-ERRE&quot;)</option>
                ) : null}
                {zonasFiltroConsulta.labels.map((z) => (
                  <option key={z} value={z}>
                    {z}
                  </option>
                ))}
              </select>
              <span className="block text-[10px] font-medium uppercase leading-tight text-slate-400">
                {filtroServicios.length === 1
                  ? "Activo para CAT o U-ERRE."
                  : "Seleccione un solo servicio para filtrar zona."}
              </span>
            </label>
            <label className="space-y-1 lg:col-span-2">
              <span className="form-label uppercase">
                {puedeFiltrarFechaBaja ? "Fecha de baja desde" : "Desde (último día laborado)"}
              </span>
              <input
                className="form-control uppercase"
                type="date"
                value={filtroDesde}
                onChange={(e) => setFiltroDesde(e.target.value)}
              />
            </label>
            <label className="space-y-1 lg:col-span-2">
              <span className="form-label uppercase">
                {puedeFiltrarFechaBaja ? "Fecha de baja hasta" : "Hasta (último día laborado)"}
              </span>
              <input
                className="form-control uppercase"
                type="date"
                value={filtroHasta}
                onChange={(e) => setFiltroHasta(e.target.value)}
              />
            </label>
            <div className="flex flex-col justify-end lg:col-span-2">
              <button
                type="button"
                className="btn-secondary uppercase text-xs self-start"
                onClick={limpiarFiltrosConsulta}
              >
                Limpiar filtros
              </button>
            </div>
          </div>

          <div className="space-y-3">
            <h3 className="text-sm font-bold uppercase text-slate-800">Bajas registradas en el periodo</h3>
            {bajasRegistradasEnPeriodo.length === 0 ? (
              <p className="rounded-lg border border-slate-200 bg-white px-3 py-3 text-sm uppercase leading-snug text-slate-600">
                No hay bajas en este rango y filtros.
                {puedeFiltrarFechaBaja
                  ? " Si usas Desde/Hasta, la fecha de baja debe caer en el periodo."
                  : " Si usas Desde/Hasta, el ultimo dia laborado debe estar en el periodo."}
              </p>
            ) : (
              <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
                <table className="min-w-[880px] w-full text-left">
                  <thead className="border-b border-slate-200 bg-slate-50 text-[11px] font-bold uppercase tracking-wide text-slate-600">
                    <tr>
                      <th className="whitespace-nowrap px-3 py-2">No de empleado</th>
                      <th className="min-w-[160px] px-3 py-2">Nombre</th>
                      {puedeFiltrarFechaBaja ? (
                        <th className="whitespace-nowrap px-3 py-2">Fecha de baja</th>
                      ) : null}
                      <th className="whitespace-nowrap px-3 py-2">Ultimo dia laborado</th>
                      <th className="min-w-[140px] px-3 py-2">Ultimo servicio</th>
                      <th className="min-w-[140px] px-3 py-2">Motivo</th>
                      <th className="whitespace-nowrap px-3 py-2 text-right">Ver datos</th>
                    </tr>
                  </thead>
                  <tbody>
                    {bajasRegistradasEnPeriodo.map((c) => {
                      const selHighlight = readOnly ? "" : form.noEmpleado.trim().toUpperCase();
                      const noUp = c.noEmpleado.trim().toUpperCase();
                      const destacado = Boolean(selHighlight && noUp === selHighlight);
                      const celda = `border-b border-slate-100 px-3 py-2 align-top text-xs uppercase text-slate-800 ${destacado ? "bg-amber-50/90" : ""}`;
                      const abierto = bajaDetalleAbierta === c.noEmpleado;
                      const f = c.form ?? {};
                      return (
                        <Fragment key={c.noEmpleado}>
                          <tr className={destacado ? "bg-amber-50/50" : "hover:bg-slate-50"}>
                            <td className={`${celda} font-mono font-semibold`}>{c.noEmpleado}</td>
                            <td className={celda}>{(c.nombreCompleto ?? "").trim() || "—"}</td>
                            {puedeFiltrarFechaBaja ? (
                              <td className={`${celda} whitespace-nowrap font-mono text-[11px] text-slate-600`}>
                                {formatoSoloFechaYmd(String(f.fechaBaja ?? ""))}
                              </td>
                            ) : null}
                            <td className={`${celda} whitespace-nowrap font-mono text-[11px] text-slate-600`}>
                              {formatoSoloFechaYmd(String(f.ultimoDiaLaborado ?? ""))}
                            </td>
                            <td className={celda}>{String(c.ultimoServicio ?? "").trim() || "—"}</td>
                            <td className={`${celda} max-w-[240px]`}>{String(f.motivoSeparacion ?? "").trim() || "—"}</td>
                            <td className={`${celda} text-right`}>
                              <button
                                type="button"
                                className="btn-outline-light px-2 py-1 text-[11px] font-semibold uppercase"
                                onClick={() => setBajaDetalleAbierta((prev) => (prev === c.noEmpleado ? null : c.noEmpleado))}
                              >
                                {abierto ? "Ocultar" : "Ver datos"}
                              </button>
                            </td>
                          </tr>
                          {abierto ? (
                            <tr className="bg-slate-50/95">
                              <td colSpan={puedeFiltrarFechaBaja ? 7 : 6} className="border-b border-slate-200 px-3 py-4">
                                <DetalleDatosBajaExpediente c={c} />
                              </td>
                            </tr>
                          ) : null}
                        </Fragment>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
            {bajasRegistradasEnPeriodo.length > 0 ? (
              <p className="text-[11px] text-slate-500">
                {bajasRegistradasEnPeriodo.length} baja(s) en esta vista. Pulsa <strong>Ver datos</strong> para ver el expediente completo de la baja. La fila en tono ambar coincide con el colaborador cargado arriba.
              </p>
            ) : null}
          </div>
        </section>
    </div>
  );
}

function DetalleDatosBajaExpediente({ c }: { c: ColaboradorCompleto }) {
  const f = c.form ?? {};
  const ingresoRaw = String(c.fechaIngreso ?? f.fechaIngreso ?? "").trim();
  const ingresoNorm = normalizarFechaParaInputDate(ingresoRaw);
  const ingresoMostrar = ingresoNorm ? formatoSoloFechaYmd(ingresoNorm) : ingresoRaw ? formatoSoloFechaYmd(ingresoRaw) : "—";

  const item = (label: string, value: string) => (
    <div className="min-w-0">
      <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-0.5 whitespace-pre-wrap break-words text-xs font-medium uppercase text-slate-900">{value.trim() || "—"}</p>
    </div>
  );

  return (
    <div className="space-y-3">
      <p className="text-[11px] font-semibold uppercase text-slate-600">Datos de baja en expediente (solo lectura)</p>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {item("N° DE EMPLEADO", c.noEmpleado)}
        {item("NOMBRE COMPLETO", String(c.nombreCompleto ?? ""))}
        {item("NSS", String(c.nss ?? ""))}
        {item("PUESTO", String(c.puesto ?? ""))}
        {item("INGRESO", ingresoMostrar)}
        {item("SERVICIO ASIGNADO (ALTA / CONTRATO)", servicioAsignadoDesdeExpediente(c))}
        {item("ULTIMO SERVICIO (EXPEDIENTE)", String(c.ultimoServicio ?? ""))}
        {item("FECHA DE BAJA", formatoSoloFechaYmd(String(f.fechaBaja ?? "")))}
        {item("FECHA DE RENUNCIA", formatoSoloFechaYmd(String(f.fechaRenuncia ?? "")))}
        {item("ULTIMO DIA LABORADO", formatoSoloFechaYmd(String(f.ultimoDiaLaborado ?? "")))}
        {item("MOTIVO DE SEPARACION", String(f.motivoSeparacion ?? ""))}
      </div>
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        <div className="min-w-0">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">ESPECIFICACION</p>
          <p className="mt-1 whitespace-pre-wrap rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs uppercase text-slate-800">
            {String(f.especificacion ?? "").trim() || "—"}
          </p>
        </div>
        <div className="min-w-0">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">COMENTARIO</p>
          <p className="mt-1 whitespace-pre-wrap rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs uppercase text-slate-800">
            {String(f.comentarioBaja ?? f.comentario ?? "").trim() || "—"}
          </p>
        </div>
      </div>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  type = "text",
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
}) {
  return (
    <label className="space-y-1">
      <span className="form-label uppercase">{label}</span>
      <input className="form-control uppercase" type={type} value={value} onChange={(e) => onChange(e.target.value)} />
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
  onChange: (value: string) => void;
  className?: string;
}) {
  return (
    <label className={`space-y-1 ${className}`}>
      <span className="form-label uppercase">{label}</span>
      <textarea className="form-control min-h-24 uppercase" value={value} onChange={(e) => onChange(e.target.value)} />
    </label>
  );
}
