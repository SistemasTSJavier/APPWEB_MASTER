"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import {
  aplicarMoperMovimiento,
  findColaboradorCompletoByNo,
  getMoperInicialesParaFormulario,
} from "@/lib/colaboradores-store";
import { pushMoperHistorial } from "@/lib/moper-historial";

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

  function cargarColaborador() {
    const key = noEmpleadoBusqueda.trim().toUpperCase();
    if (!key) {
      setSearchMsg("CAPTURE UN N° DE EMPLEADO.");
      return;
    }
    const c = findColaboradorCompletoByNo(key);
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

  function guardarMovimiento(e: FormEvent) {
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
    aplicarMoperMovimiento(noEmpleado, {
      servicioFinal,
      puestoFinal,
    });
    pushMoperHistorial({
      noEmpleado,
      servicioInicial: inicialServ,
      servicioFinal: servicioFinal.trim(),
      puestoInicial: inicialPuesto,
      puestoFinal: puestoFinal.trim(),
      motivo: motivo.trim(),
      especificacion: especificacion.trim(),
      registradoEn: new Date().toISOString(),
    });

    const c2 = findColaboradorCompletoByNo(noEmpleado);
    if (c2) {
      const ini = getMoperInicialesParaFormulario(c2);
      setServicioInicial(ini.servicio);
      setPuestoInicial(ini.puesto);
      setServicioFinal("");
      setPuestoFinal("");
      setMotivo("");
      setEspecificacion("");
    }
    setSearchMsg(null);
    setOkMsg("MOVIMIENTO REGISTRADO. SERVICIO Y PUESTO INICIAL ACTUALIZADOS PARA LA SIGUIENTE CAPTURA.");
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

  return (
    <div className="min-h-screen bg-slate-100">
      <div className="mx-auto w-full max-w-[1100px] px-3 py-4 md:px-6 md:py-6">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Modulo</p>
            <h1 className="text-3xl font-bold uppercase tracking-tight text-slate-900">MOPER</h1>
            <p className="mt-1 max-w-xl text-sm text-slate-600">
              Cambio de servicio y puesto. Los valores iniciales salen de ALTAS y se actualizan al guardar cada movimiento.
            </p>
          </div>
          <Link href="/" className="btn-secondary uppercase">
            Regresar al inicio
          </Link>
        </div>

        <form onSubmit={guardarMovimiento} className="card space-y-5">
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
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
                      cargarColaborador();
                    }
                  }}
                />
              </label>
              <button type="button" className="btn-primary shrink-0 uppercase sm:min-w-[140px]" onClick={cargarColaborador}>
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
            <TextAreaField
              className="md:col-span-2"
              label="MOTIVO"
              value={motivo}
              onChange={setMotivo}
            />
            <TextAreaField
              className="md:col-span-2"
              label="ESPECIFICACION"
              value={especificacion}
              onChange={setEspecificacion}
            />
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
      </div>
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
