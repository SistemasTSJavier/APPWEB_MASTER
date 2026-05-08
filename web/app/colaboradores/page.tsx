"use client";

import { useMemo, useState, useEffect, Fragment } from "react";
import Link from "next/link";
import { listColaboradoresCompletos, type ColaboradorCompleto } from "@/lib/colaboradores-store";
import { colaboradoresToCsv, downloadCsv } from "@/lib/colaboradores-csv";
import { listMoperHistorialPorEmpleado, type MoperHistorialEntrada } from "@/lib/moper-historial";

function fechaEnRango(fechaIngreso: string, desde: string, hasta: string): boolean {
  if (!fechaIngreso.trim()) return !desde && !hasta;
  const f = fechaIngreso.trim();
  if (desde && f < desde) return false;
  if (hasta && f > hasta) return false;
  return true;
}

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

function textoBusquedaCoincide(c: ColaboradorCompleto, q: string): boolean {
  if (!q.trim()) return true;
  const n = q.trim().toLowerCase();
  const campos = [
    c.noEmpleado,
    c.nombreCompleto,
    c.servicioAsignado,
    c.ultimoServicio,
    c.nss,
    c.posicion,
    c.puesto,
    c.fechaIngreso,
    ...Object.values(c.form),
    ...c.familiares.flatMap((f) => [f.nombreFamiliar, f.parentesco, f.fechaNacimiento]),
  ];
  return campos.some((t) => String(t).toLowerCase().includes(n));
}

export default function ColaboradoresPage() {
  const [rows, setRows] = useState<ColaboradorCompleto[]>([]);
  const [busqueda, setBusqueda] = useState("");
  const [servicio, setServicio] = useState("");
  const [fechaDesde, setFechaDesde] = useState("");
  const [fechaHasta, setFechaHasta] = useState("");
  const [expandido, setExpandido] = useState<string | null>(null);
  const [seleccion, setSeleccion] = useState<Set<string>>(new Set());

  useEffect(() => {
    setRows(listColaboradoresCompletos());
  }, []);

  const serviciosUnicos = useMemo(() => {
    const s = new Set<string>();
    for (const r of rows) {
      const v = r.servicioAsignado.trim();
      if (v) s.add(v);
    }
    return [...s].sort((a, b) => a.localeCompare(b, "es"));
  }, [rows]);

  const filtrados = useMemo(() => {
    return rows.filter((c) => {
      if (!fechaEnRango(c.fechaIngreso, fechaDesde, fechaHasta)) return false;
      if (servicio && c.servicioAsignado.trim() !== servicio) return false;
      if (!textoBusquedaCoincide(c, busqueda)) return false;
      return true;
    });
  }, [rows, busqueda, servicio, fechaDesde, fechaHasta]);

  function toggleSel(no: string) {
    setSeleccion((prev) => {
      const next = new Set(prev);
      if (next.has(no)) next.delete(no);
      else next.add(no);
      return next;
    });
  }

  function seleccionarTodosFiltrados() {
    setSeleccion(new Set(filtrados.map((r) => r.noEmpleado)));
  }

  function limpiarSeleccion() {
    setSeleccion(new Set());
  }

  function exportarCsv() {
    const usarSeleccion = seleccion.size > 0;
    const datos = usarSeleccion
      ? filtrados.filter((r) => seleccion.has(r.noEmpleado))
      : filtrados;
    if (datos.length === 0) return;
    const csv = colaboradoresToCsv(datos);
    const suf = new Date().toISOString().slice(0, 10);
    downloadCsv(`colaboradores_tactical_${suf}.csv`, csv);
  }

  return (
    <div className="min-h-screen bg-slate-100">
      <div className="mx-auto w-full max-w-[1600px] px-3 py-4 md:px-6 md:py-6">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Modulo</p>
            <h1 className="text-3xl font-bold uppercase tracking-tight text-slate-900">COLABORADORES</h1>
            <p className="mt-1 text-sm text-slate-600">
              Busqueda general, filtros por servicio y por fecha de ingreso. Exportacion CSV compatible con Excel.
            </p>
          </div>
          <Link href="/" className="btn-secondary uppercase">
            Regresar al inicio
          </Link>
        </div>

        <div className="card mb-4 space-y-4">
          <h2 className="text-sm font-bold uppercase text-slate-800">Filtros</h2>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-5">
            <label className="space-y-1 md:col-span-2 xl:col-span-1">
              <span className="form-label uppercase">Busqueda general</span>
              <input
                className="form-control uppercase"
                value={busqueda}
                onChange={(e) => setBusqueda(e.target.value)}
                placeholder="NUMERO, NOMBRE, NSS, TEXTO EN EXPEDIENTE..."
              />
            </label>
            <label className="space-y-1">
              <span className="form-label uppercase">Servicio asignado</span>
              <select className="form-control uppercase" value={servicio} onChange={(e) => setServicio(e.target.value)}>
                <option value="">TODOS</option>
                {serviciosUnicos.map((sv) => (
                  <option key={sv} value={sv}>
                    {sv.toUpperCase()}
                  </option>
                ))}
              </select>
            </label>
            <label className="space-y-1">
              <span className="form-label uppercase">Ingreso desde</span>
              <input className="form-control uppercase" type="date" value={fechaDesde} onChange={(e) => setFechaDesde(e.target.value)} />
            </label>
            <label className="space-y-1">
              <span className="form-label uppercase">Ingreso hasta</span>
              <input className="form-control uppercase" type="date" value={fechaHasta} onChange={(e) => setFechaHasta(e.target.value)} />
            </label>
          </div>
          <div className="flex flex-wrap items-center gap-2 border-t border-slate-200 pt-4">
            <button type="button" className="btn-primary uppercase" onClick={exportarCsv} disabled={filtrados.length === 0}>
              Exportar CSV (Excel)
            </button>
            <span className="text-xs text-slate-500">
              {seleccion.size > 0
                ? `EXPORTA ${seleccion.size} SELECCIONADO(S) DENTRO DEL FILTRO.`
                : "SIN CASILLAS MARCA EXPORTA TODOS LOS RESULTADOS DEL FILTRO."}
            </span>
            <button type="button" className="btn-secondary uppercase text-xs" onClick={seleccionarTodosFiltrados}>
              Marcar todos (filtrados)
            </button>
            <button type="button" className="btn-secondary uppercase text-xs" onClick={limpiarSeleccion}>
              Quitar seleccion
            </button>
            <span className="ml-auto text-sm font-semibold text-slate-700">
              {filtrados.length} / {rows.length} COLABORADOR(ES)
            </span>
          </div>
        </div>

        <div className="table-wrap">
          <table className="min-w-full text-left text-sm">
            <thead className="table-head">
              <tr>
                <th className="w-10 px-2 py-3"></th>
                <th className="px-4 py-3">N°</th>
                <th className="px-4 py-3">NOMBRE</th>
                <th className="px-4 py-3">SERVICIO</th>
                <th className="px-4 py-3">INGRESO</th>
                <th className="px-4 py-3">NSS</th>
                <th className="px-4 py-3">POSICION</th>
                <th className="px-4 py-3">PUESTO</th>
                <th className="px-4 py-3 w-40"></th>
              </tr>
            </thead>
            <tbody>
              {filtrados.map((c) => (
                <Fragment key={c.noEmpleado}>
                  <tr className="table-row-hover">
                    <td className="table-cell px-2">
                      <input
                        type="checkbox"
                        className="h-4 w-4 rounded border-slate-300"
                        checked={seleccion.has(c.noEmpleado)}
                        onChange={() => toggleSel(c.noEmpleado)}
                        aria-label={`Seleccionar ${c.noEmpleado}`}
                      />
                    </td>
                    <td className="table-cell font-mono font-medium">{c.noEmpleado}</td>
                    <td className="table-cell font-medium text-slate-900">{c.nombreCompleto || "—"}</td>
                    <td className="table-cell text-slate-700">{c.servicioAsignado || "—"}</td>
                    <td className="table-cell">{c.fechaIngreso || "—"}</td>
                    <td className="table-cell">{c.nss || "—"}</td>
                    <td className="table-cell">{c.posicion || "—"}</td>
                    <td className="table-cell">{c.puesto || "—"}</td>
                    <td className="table-cell text-right">
                      <button
                        type="button"
                        className="link-action text-sm uppercase"
                        onClick={() =>
                          setExpandido((prev) => (prev === c.noEmpleado ? null : c.noEmpleado))
                        }
                      >
                        {expandido === c.noEmpleado ? "Ocultar" : "Ver expediente"}
                      </button>
                    </td>
                  </tr>
                  {expandido === c.noEmpleado ? (
                    <tr className="bg-slate-50">
                      <td colSpan={9} className="border-t border-slate-200 px-4 py-4">
                        <DetalleExpediente c={c} />
                      </td>
                    </tr>
                  ) : null}
                </Fragment>
              ))}
            </tbody>
          </table>
          {filtrados.length === 0 ? (
            <p className="p-8 text-center text-sm text-slate-600">
              {rows.length === 0
                ? "NO HAY COLABORADORES GUARDADOS. REGISTRALOS EN ALTAS Y FINALIZA LA CAPTURA."
                : "NINGUN REGISTRO COINCIDE CON LOS FILTROS."}
            </p>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function DetalleExpediente({ c }: { c: ColaboradorCompleto }) {
  const formEntries = Object.entries(c.form).filter(([, v]) => String(v).trim() !== "");
  const historialMoper = listMoperHistorialPorEmpleado(c.noEmpleado);

  return (
    <div className="grid gap-4 text-sm md:grid-cols-2">
      <section>
        <h3 className="mb-2 text-xs font-bold uppercase tracking-wide text-slate-500">Resumen guardado</h3>
        <ul className="space-y-1 text-slate-800">
          <li>
            <strong className="text-slate-600">ULTIMO SERVICIO (MOPER):</strong> {c.ultimoServicio || "—"}
          </li>
          <li>
            <strong className="text-slate-600">LINEA ACTUAL MOPER:</strong>{" "}
            {c.moperActual?.servicio || c.servicioAsignado || "—"} — {c.moperActual?.puesto || c.puesto || "—"}
          </li>
          <li>
            <strong className="text-slate-600">REGISTRADO EN:</strong> {c.registeredAt || "—"}
          </li>
        </ul>
      </section>
      <section>
        <h3 className="mb-2 text-xs font-bold uppercase tracking-wide text-slate-500">Familiares</h3>
        {c.familiares.length === 0 ? (
          <p className="text-slate-500">SIN REGISTROS.</p>
        ) : (
          <ul className="list-disc space-y-1 pl-5">
            {c.familiares.map((f, i) => (
              <li key={i}>
                {f.nombreFamiliar.toUpperCase()} — {f.parentesco.toUpperCase()} — NAC.: {f.fechaNacimiento} — BEN.:{" "}
                {f.beneficiarioBancario}
              </li>
            ))}
          </ul>
        )}
      </section>
      <section className="md:col-span-2">
        <h3 className="mb-2 text-xs font-bold uppercase tracking-wide text-slate-500">Historial MOPER</h3>
        <p className="mb-2 text-xs text-slate-500">
          Movimientos registrados desde el modulo MOPER (mas recientes arriba). {historialMoper.length} MOVIMIENTO(S).
        </p>
        {historialMoper.length === 0 ? (
          <p className="rounded-lg border border-slate-200 bg-white px-3 py-3 text-slate-600">
            SIN MOVIMIENTOS MOPER PARA ESTE COLABORADOR.
          </p>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
            <table className="min-w-[900px] w-full text-left text-xs">
              <thead className="border-b border-slate-200 bg-slate-100 text-[11px] font-bold uppercase tracking-wide text-slate-600">
                <tr>
                  <th className="whitespace-nowrap px-3 py-2">Fecha</th>
                  <th className="whitespace-nowrap px-3 py-2">Serv. inicial</th>
                  <th className="whitespace-nowrap px-3 py-2">Serv. final</th>
                  <th className="whitespace-nowrap px-3 py-2">Puesto inicial</th>
                  <th className="whitespace-nowrap px-3 py-2">Puesto final</th>
                  <th className="min-w-[120px] px-3 py-2">Motivo</th>
                  <th className="min-w-[140px] px-3 py-2">Especificacion</th>
                </tr>
              </thead>
              <tbody>
                {historialMoper.map((mov, idx) => (
                  <HistorialMoperFila key={`${mov.registradoEn}-${idx}`} mov={mov} />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
      <section className="md:col-span-2">
        <h3 className="mb-2 text-xs font-bold uppercase tracking-wide text-slate-500">Campos capturados (ALTAS)</h3>
        {formEntries.length === 0 ? (
          <p className="text-slate-500">SIN DETALLE EXTRA (REGISTRO ANTERIOR A EXPEDIENTE COMPLETO).</p>
        ) : (
          <div className="grid max-h-[320px] grid-cols-1 gap-x-8 gap-y-2 overflow-auto rounded-lg border border-slate-200 bg-white p-3 sm:grid-cols-2 lg:grid-cols-3">
            {formEntries.map(([k, v]) => (
              <div key={k}>
                <p className="text-[11px] font-semibold uppercase text-slate-500">{k}</p>
                <p className="font-mono text-xs text-slate-900">{String(v).toUpperCase()}</p>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function HistorialMoperFila({ mov }: { mov: MoperHistorialEntrada }) {
  const celda = "border-b border-slate-100 px-3 py-2 align-top uppercase text-slate-800";
  return (
    <tr className="hover:bg-slate-50">
      <td className={`${celda} whitespace-nowrap font-mono text-[11px] text-slate-600`}>
        {formatoFechaMoper(mov.registradoEn)}
      </td>
      <td className={celda}>{mov.servicioInicial.trim() || "—"}</td>
      <td className={celda}>{mov.servicioFinal.trim() || "—"}</td>
      <td className={celda}>{mov.puestoInicial.trim() || "—"}</td>
      <td className={celda}>{mov.puestoFinal.trim() || "—"}</td>
      <td className={celda}>{mov.motivo.trim() || "—"}</td>
      <td className={celda}>{mov.especificacion.trim() || "—"}</td>
    </tr>
  );
}
