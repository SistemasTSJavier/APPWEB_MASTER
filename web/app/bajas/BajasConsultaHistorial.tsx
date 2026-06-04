"use client";

import { Fragment, memo, useEffect, useMemo, useState } from "react";
import type { ColaboradorCompleto } from "@/lib/colaboradores-types";
import {
  listarColaboradoresBajaFiltrados,
  serviciosUnicosColaboradoresDadosDeBaja,
  servicioAsignadoDesdeExpediente,
  zonasDisponiblesFiltroBajas,
  ZONA_FILTRO_SIN_SUFIJO,
} from "@/lib/colaboradores-baja";
import type { AppRole } from "@/lib/app-role";
import { roleMayFilterBajasPorFechaBaja } from "@/lib/app-role";
import { normalizarFechaParaInputDate } from "@/lib/fecha-input-normalize";
import { servicioAgrupadoUsaZona } from "@/lib/servicio-agrupacion";

function formatoSoloFechaYmd(raw: string): string {
  const n = normalizarFechaParaInputDate(String(raw ?? ""));
  if (!n) return "—";
  const [y, mo, d] = n.split("-").map((x) => parseInt(x, 10));
  if (!y || !mo || !d) return "—";
  const dt = new Date(y, mo - 1, d);
  if (Number.isNaN(dt.getTime())) return "—";
  return dt.toLocaleDateString("es-MX", { dateStyle: "medium" }).toUpperCase();
}

function DetalleDatosBajaExpediente({ c }: { c: ColaboradorCompleto }) {
  const f = c.form ?? {};
  const ingresoRaw = String(c.fechaIngreso ?? f.fechaIngreso ?? "").trim();
  const ingresoNorm = normalizarFechaParaInputDate(ingresoRaw);
  const ingresoMostrar = ingresoNorm ? formatoSoloFechaYmd(ingresoNorm) : ingresoRaw ? formatoSoloFechaYmd(ingresoRaw) : "—";

  const item = (label: string, value: string) => (
    <div className="min-w-0">
      <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-0.5 whitespace-pre-wrap break-words text-xs font-medium uppercase text-slate-900">
        {value.trim() || "—"}
      </p>
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

const BajaFilaTabla = memo(function BajaFilaTabla({
  c,
  puedeFiltrarFechaBaja,
  destacado,
  abierto,
  onToggleDetalle,
}: {
  c: ColaboradorCompleto;
  puedeFiltrarFechaBaja: boolean;
  destacado: boolean;
  abierto: boolean;
  onToggleDetalle: () => void;
}) {
  const f = c.form ?? {};
  const celda = `border-b border-slate-100 px-3 py-2 align-top text-xs uppercase text-slate-800 ${destacado ? "bg-amber-50/90" : ""}`;

  return (
    <Fragment>
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
            onClick={onToggleDetalle}
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
});

function BajasConsultaHistorialInner({
  rows,
  appRole,
  highlightNoEmpleado,
}: {
  rows: ColaboradorCompleto[];
  appRole: AppRole;
  highlightNoEmpleado: string;
}) {
  const puedeFiltrarFechaBaja = roleMayFilterBajasPorFechaBaja(appRole);

  const [filtroServicios, setFiltroServicios] = useState<string[]>([]);
  const [filtroZona, setFiltroZona] = useState("");
  const [filtroDesde, setFiltroDesde] = useState("");
  const [filtroHasta, setFiltroHasta] = useState("");
  const [bajaDetalleAbierta, setBajaDetalleAbierta] = useState<string | null>(null);

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
  }, [rows, filtroDesde, filtroHasta, filtroServicios, filtroZona, puedeFiltrarFechaBaja]);

  const highlightNorm = highlightNoEmpleado.trim().toUpperCase();

  useEffect(() => {
    if (bajaDetalleAbierta && !bajasRegistradasEnPeriodo.some((x) => x.noEmpleado === bajaDetalleAbierta)) {
      setBajaDetalleAbierta(null);
    }
  }, [bajaDetalleAbierta, bajasRegistradasEnPeriodo]);

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

  function limpiarFiltrosConsulta() {
    setFiltroServicios([]);
    setFiltroZona("");
    setFiltroDesde("");
    setFiltroHasta("");
  }

  return (
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
          <div className="max-h-[min(70vh,36rem)] overflow-auto rounded-lg border border-slate-200 bg-white">
            <table className="min-w-[880px] w-full text-left">
              <thead className="border-b border-slate-200 bg-slate-50 text-[11px] font-bold uppercase tracking-wide text-slate-600">
                <tr>
                  <th className="whitespace-nowrap px-3 py-2">No de empleado</th>
                  <th className="min-w-[160px] px-3 py-2">Nombre</th>
                  {puedeFiltrarFechaBaja ? <th className="whitespace-nowrap px-3 py-2">Fecha de baja</th> : null}
                  <th className="whitespace-nowrap px-3 py-2">Ultimo dia laborado</th>
                  <th className="min-w-[140px] px-3 py-2">Ultimo servicio</th>
                  <th className="min-w-[140px] px-3 py-2">Motivo</th>
                  <th className="whitespace-nowrap px-3 py-2 text-right">Ver datos</th>
                </tr>
              </thead>
              <tbody>
                {bajasRegistradasEnPeriodo.map((c) => {
                  const noUp = c.noEmpleado.trim().toUpperCase();
                  return (
                    <BajaFilaTabla
                      key={c.noEmpleado}
                      c={c}
                      puedeFiltrarFechaBaja={puedeFiltrarFechaBaja}
                      destacado={Boolean(highlightNorm && noUp === highlightNorm)}
                      abierto={bajaDetalleAbierta === c.noEmpleado}
                      onToggleDetalle={() =>
                        setBajaDetalleAbierta((prev) => (prev === c.noEmpleado ? null : c.noEmpleado))
                      }
                    />
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        {bajasRegistradasEnPeriodo.length > 0 ? (
          <p className="text-[11px] text-slate-500">
            {bajasRegistradasEnPeriodo.length} baja(s) en esta vista. Pulsa <strong>Ver datos</strong> para ver el
            expediente completo de la baja. La fila en tono ambar coincide con el colaborador cargado arriba.
          </p>
        ) : null}
      </div>
    </section>
  );
}

export const BajasConsultaHistorial = memo(BajasConsultaHistorialInner);
