"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { findColaboradorByNo } from "@/lib/colaboradores-store";

const EMPTY_FORM = {
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

export default function BajasPage() {
  const [form, setForm] = useState(EMPTY_FORM);
  const [searchMsg, setSearchMsg] = useState<string | null>(null);

  function updateField(name: keyof typeof EMPTY_FORM, value: string) {
    setForm((prev) => ({ ...prev, [name]: value }));
  }

  function applyFoundToForm(found: NonNullable<ReturnType<typeof findColaboradorByNo>>) {
    setForm((prev) => ({
      ...prev,
      noEmpleado: found.noEmpleado,
      nombreCompleto: found.nombreCompleto,
      servicioAsignado: found.servicioAsignado,
      ultimoServicio: found.ultimoServicio,
      nss: found.nss,
      puesto: found.puesto,
      ingreso: found.fechaIngreso,
    }));
  }

  function buscarPorNoEmpleado() {
    const key = form.noEmpleado.trim().toUpperCase();
    if (!key) {
      setSearchMsg("CAPTURE UN N° DE EMPLEADO PARA BUSCAR.");
      return;
    }
    const found = findColaboradorByNo(key);
    if (!found) {
      setSearchMsg("NO SE ENCONTRO COLABORADOR. REVISE EL NUMERO O REGISTRELO EN ALTAS.");
      setForm((prev) => ({
        ...prev,
        noEmpleado: key,
        nombreCompleto: "",
        servicioAsignado: "",
        ultimoServicio: "",
        nss: "",
        puesto: "",
        ingreso: "",
      }));
      return;
    }
    setSearchMsg(null);
    applyFoundToForm(found);
  }

  function limpiar() {
    setForm(EMPTY_FORM);
    setSearchMsg(null);
  }

  function submitBaja(e: FormEvent) {
    e.preventDefault();
  }

  return (
    <div className="min-h-screen bg-slate-100">
      <div className="mx-auto w-full max-w-[1200px] px-3 py-4 md:px-6 md:py-6">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Modulo</p>
            <h1 className="text-3xl font-bold uppercase tracking-tight text-slate-900">BAJAS</h1>
          </div>
          <Link href="/" className="btn-secondary uppercase">
            Regresar al inicio
          </Link>
        </div>

        <form onSubmit={submitBaja} className="card space-y-5">
          <h2 className="text-lg font-bold uppercase">REGISTRO DE BAJA</h2>

          <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-600">Buscar colaborador</p>
            <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
              <label className="min-w-0 flex-1 space-y-1">
                <span className="form-label uppercase">N° DE EMPLEADO</span>
                <input
                  className="form-control uppercase"
                  value={form.noEmpleado}
                  onChange={(e) => updateField("noEmpleado", e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      buscarPorNoEmpleado();
                    }
                  }}
                  placeholder="EJ. PTE-1 O NUMERO CAPTURADO"
                />
              </label>
              <button type="button" className="btn-primary shrink-0 uppercase sm:min-w-[140px]" onClick={buscarPorNoEmpleado}>
                Buscar
              </button>
            </div>
            {searchMsg ? <p className="mt-2 text-sm font-medium uppercase text-amber-800">{searchMsg}</p> : null}
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <Field label="NOMBRE COMPLETO" value={form.nombreCompleto} onChange={(v) => updateField("nombreCompleto", v)} />
            <Field label="SERVICIO ASIGNADO" value={form.servicioAsignado} onChange={(v) => updateField("servicioAsignado", v)} />
            <Field label="ULTIMO SERVICIO" value={form.ultimoServicio} onChange={(v) => updateField("ultimoServicio", v)} />
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

          <div className="flex flex-wrap justify-end gap-2 border-t border-slate-200 pt-4">
            <button type="button" className="btn-secondary uppercase" onClick={limpiar}>
              Limpiar
            </button>
            <button type="submit" className="btn-primary uppercase">
              Guardar baja
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
