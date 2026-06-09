"use client";

import { FormEvent, memo, useEffect, useMemo, useRef, useState } from "react";
import type { ColaboradorCompleto } from "@/lib/colaboradores-types";
import {
  buildColaboradoresPorNoMap,
  findColaboradorEnLista,
  mergeColaboradorEnLista,
} from "@/lib/colaboradores-list-helpers";
import { upsertColaboradorCompleto } from "@/lib/colaboradores-store";
import {
  aplicarBajaEnExpediente,
  bajasFormDesdeColaborador,
  type BajasFormState,
} from "@/lib/colaboradores-baja";
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
const BUSQUEDA_DEBOUNCE_MS = 150;

function coincideBusqueda(c: ColaboradorCompleto, q: string): boolean {
  const n = q.trim().toLowerCase();
  if (!n) return true;
  const no = c.noEmpleado.toLowerCase();
  const nom = (c.nombreCompleto ?? "").toLowerCase();
  const nss = (c.nss ?? "").toLowerCase();
  return no.includes(n) || nom.includes(n) || nss.includes(n);
}

const Field = memo(function Field({
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
});

const TextAreaField = memo(function TextAreaField({
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
});

export function BajasRegistroForm({
  rows,
  onRowsChange,
  onColaboradorActivoChange,
}: {
  rows: ColaboradorCompleto[];
  onRowsChange: (next: ColaboradorCompleto[]) => void;
  /** N° empleado cargado en el formulario (para resaltar fila en consulta sin re-renderizar esa sección en cada tecla). */
  onColaboradorActivoChange: (noEmpleado: string) => void;
}) {
  const [sel, setSel] = useState("");
  const [busqueda, setBusqueda] = useState("");
  const [busquedaFiltrada, setBusquedaFiltrada] = useState("");
  const [listaAbierta, setListaAbierta] = useState(false);
  const blurTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [form, setForm] = useState<BajasFormState>(EMPTY_FORM);
  const [searchMsg, setSearchMsg] = useState<string | null>(null);
  const [statusMsg, setStatusMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [guardando, setGuardando] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setBusquedaFiltrada(busqueda), BUSQUEDA_DEBOUNCE_MS);
    return () => clearTimeout(t);
  }, [busqueda]);

  const porNo = useMemo(() => buildColaboradoresPorNoMap(rows), [rows]);

  const opciones = useMemo(
    () =>
      [...rows].sort((a, b) =>
        a.noEmpleado.localeCompare(b.noEmpleado, "es", { numeric: true, sensitivity: "base" }),
      ),
    [rows],
  );

  const sugerencias = useMemo(() => {
    const filtradas = opciones.filter((c) => coincideBusqueda(c, busquedaFiltrada));
    return filtradas.slice(0, MAX_SUGERENCIAS);
  }, [opciones, busquedaFiltrada]);

  useEffect(() => {
    return () => {
      if (blurTimer.current) clearTimeout(blurTimer.current);
    };
  }, []);

  function updateField(name: keyof BajasFormState, value: string) {
    setForm((prev) => ({ ...prev, [name]: value }));
  }

  function cargarExpedienteYBaja(noEmpleadoKey: string) {
    setStatusMsg(null);
    const key = noEmpleadoKey.trim().toUpperCase();
    if (!key) {
      setSearchMsg("INDIQUE UN COLABORADOR DESDE LA LISTA.");
      onColaboradorActivoChange("");
      return;
    }
    const completo = porNo.get(key) ?? findColaboradorEnLista(rows, key);
    if (!completo) {
      setSearchMsg("NO SE ENCONTRO COLABORADOR. ESPERE LA CARGA INICIAL O REGISTRELO EN ALTAS.");
      setSel("");
      setForm(EMPTY_FORM);
      onColaboradorActivoChange("");
      return;
    }
    setSearchMsg(null);
    setForm(bajasFormDesdeColaborador(completo, undefined));
    setSel(completo.noEmpleado);
    onColaboradorActivoChange(completo.noEmpleado);
    setBusqueda(`${completo.noEmpleado} — ${completo.nombreCompleto || "(SIN NOMBRE)"}`);
  }

  function elegirColaborador(c: ColaboradorCompleto) {
    if (blurTimer.current) {
      clearTimeout(blurTimer.current);
      blurTimer.current = null;
    }
    setListaAbierta(false);
    cargarExpedienteYBaja(c.noEmpleado);
  }

  function limpiarSeleccionYBuscador() {
    setSel("");
    setBusqueda("");
    setListaAbierta(false);
    setForm(EMPTY_FORM);
    setSearchMsg(null);
    setStatusMsg(null);
    onColaboradorActivoChange("");
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
      const existing = porNo.get(no) ?? findColaboradorEnLista(rows, no);
      if (!existing) {
        setStatusMsg({ ok: false, text: "NO HAY EXPEDIENTE. REGISTRE EL COLABORADOR EN ALTAS PRIMERO." });
        return;
      }
      const next = aplicarBajaEnExpediente(existing, form);
      await upsertColaboradorCompleto(next);
      onRowsChange(mergeColaboradorEnLista(rows, next));
      setStatusMsg({
        ok: true,
        text: "BAJA GUARDADA. EXPEDIENTE ACTUALIZADO EN SUPABASE.",
      });
    } catch (err) {
      setStatusMsg({ ok: false, text: err instanceof Error ? err.message : "ERROR AL GUARDAR." });
    } finally {
      setGuardando(false);
    }
  }

  return (
    <form onSubmit={submitBaja} className="card space-y-5">
      <h2 className="text-lg font-bold uppercase">REGISTRO DE BAJA</h2>
      <p className="text-sm font-semibold uppercase leading-relaxed text-slate-800">
        Los datos se fusionan con el expediente ALTAS en Supabase: no borra otras partes (1–6), solo actualiza baja y
        campos editados aqui.
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
                    const etiqueta = `${form.noEmpleado} — ${form.nombreCompleto || "(SIN NOMBRE)"}`;
                    if (etiqueta && v.trim().toUpperCase() !== etiqueta.trim().toUpperCase()) {
                      setSel("");
                      setForm(EMPTY_FORM);
                      setSearchMsg(null);
                      setStatusMsg(null);
                      onColaboradorActivoChange("");
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
                      return;
                    }
                    const soloNo = busqueda.trim().toUpperCase().split(/\s/)[0] ?? "";
                    const hit = soloNo ? porNo.get(soloNo) : undefined;
                    if (hit) cargarExpedienteYBaja(hit.noEmpleado);
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
            <button
              type="button"
              className="btn-secondary shrink-0 self-end uppercase text-xs"
              onClick={limpiarSeleccionYBuscador}
            >
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
        <Field
          label="ULTIMO SERVICIO (EXPEDIENTE)"
          value={form.ultimoServicio}
          onChange={(v) => updateField("ultimoServicio", v)}
        />
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
            statusMsg.ok
              ? "border border-green-200 bg-green-50 text-green-900"
              : "border border-amber-200 bg-amber-50 text-amber-950"
          }`}
        >
          {statusMsg.text}
        </p>
      ) : null}

      <div className="flex flex-wrap justify-end gap-2 border-t border-slate-200 pt-4">
        <button type="button" className="btn-secondary uppercase" onClick={limpiarSeleccionYBuscador} disabled={guardando}>
          Limpiar
        </button>
        <button type="submit" className="btn-primary uppercase" disabled={guardando}>
          {guardando ? "GUARDANDO…" : "Guardar baja"}
        </button>
      </div>
    </form>
  );
}
