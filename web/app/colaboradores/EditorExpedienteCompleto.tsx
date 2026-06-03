"use client";

import { FormEvent, useRef, useState } from "react";
import Link from "next/link";
import { ColaboradorVacantePicker, type VacantePickerValores } from "@/components/colaboradores/colaborador-vacante-picker";
import { upsertColaboradorCompleto, type ColaboradorCompleto } from "@/lib/colaboradores-store";
import type { FamiliarGuardado } from "@/lib/colaboradores-types";
import { ALTAS_ETIQUETA_PARTE_IMPORT } from "@/lib/altas-import-partes";
import {
  ALTAS_FORM_KEYS_PARTE,
  etiquetaCampoExpediente,
} from "@/lib/altas-expediente-partes";
import { normalizarFechaParaInputDate } from "@/lib/fecha-input-normalize";
import { edadAniosAlaFecha, textoEdadDesdeExpediente } from "@/lib/edad-desde-nacimiento";
import type { CatalogoServicioItem } from "@/lib/servicios-catalogo-client";
import { limpiarPosicionDuplicadaDeNoServicio } from "@/lib/colaboradores-catalogo-display";
import {
  colaboradorTieneBaja,
  estatusEmpleadoNormalizado,
  parcheFormularioAlCambiarFechaBaja,
  sincronizarEstadoBajaEnColaborador,
} from "@/lib/colaboradores-baja";
import { consumirVacanteTrasAlta, persistirVacantesCatalogoEnServidor, registrarVacanteTrasBaja } from "@/lib/vacantes-catalog-flujo";
import { addVacanteRegistro } from "@/lib/vacantes-catalog";
import { aMayusculasPlataforma } from "@/lib/texto-plataforma-mayusculas";

const DATE_KEYS = new Set([
  "fechaIngreso",
  "fechaBaja",
  "reingreso",
  "fechaNacimiento",
  "fechaRenuncia",
  "ultimoDiaLaborado",
]);

const TEXTAREA_KEYS = new Set([
  "direccionCompleta",
  "alergicoA",
  "enfermedadTratamiento",
  "estudioSocioeconomico",
  "documentacionOriginal",
]);

const NUMBER_KEYS = new Set(["sueldoMensual"]);

function formInicialDesdeColaborador(c: ColaboradorCompleto): Record<string, string> {
  const o: Record<string, string> = { ...c.form };
  for (let p = 1; p <= 6; p++) {
    for (const k of ALTAS_FORM_KEYS_PARTE[p] ?? []) {
      if (o[k] === undefined) o[k] = "";
    }
  }
  return o;
}

function familiaresInicial(c: ColaboradorCompleto): FamiliarGuardado[] {
  if (c.familiares.length > 0) {
    return c.familiares.map((f) => ({ ...f, beneficiarioBancario: f.beneficiarioBancario === "SI" ? "SI" : "NO" }));
  }
  return [{ nombreFamiliar: "", parentesco: "", fechaNacimiento: "", beneficiarioBancario: "NO" }];
}

const CAMPOS_VACANTE_PARTE1 = new Set(["servicio", "noServicio", "planta", "posicion"]);

type Props = {
  colaborador: ColaboradorCompleto;
  catalogoServicios: CatalogoServicioItem[];
  editarVacantesCuadricula?: boolean;
  onCancel: () => void;
  /** Recibe el registro ya persistido para refrescar la lista sin esperar recarga. */
  onGuardado: (guardado: ColaboradorCompleto) => Promise<void>;
};

export function EditorExpedienteCompleto({
  colaborador,
  catalogoServicios,
  editarVacantesCuadricula = false,
  onCancel,
  onGuardado,
}: Props) {
  const [formValues, setFormValues] = useState(() => formInicialDesdeColaborador(colaborador));
  const [familiares, setFamiliares] = useState<FamiliarGuardado[]>(() => familiaresInicial(colaborador));
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [guardando, setGuardando] = useState(false);
  const vacanteIdRef = useRef("");
  const asignacionInicialRef = useRef({
    servicio: (colaborador.form?.servicio ?? colaborador.servicioAsignado ?? "").trim(),
    noServicio: (colaborador.form?.noServicio ?? "").trim(),
    planta: (colaborador.form?.planta ?? "").trim(),
    posicion: (colaborador.posicion ?? colaborador.form?.posicion ?? "").trim(),
    puesto: (colaborador.puesto ?? colaborador.form?.puesto ?? "").trim(),
  });

  function setKey(key: string, value: string) {
    const v = DATE_KEYS.has(key) || NUMBER_KEYS.has(key) ? value : aMayusculasPlataforma(value, key);
    setFormValues((prev) => {
      if (key === "fechaBaja") {
        const parche = parcheFormularioAlCambiarFechaBaja(v);
        return { ...prev, ...parche };
      }
      return { ...prev, [key]: v };
    });
  }

  function onVacantePickerChange(v: VacantePickerValores, vacanteId: string) {
    vacanteIdRef.current = vacanteId;
    setFormValues((prev) => ({
      ...prev,
      servicio: v.servicio,
      noServicio: v.noServicio,
      planta: v.planta,
      posicion: v.posicion,
      puesto: v.puesto || prev.puesto || "",
    }));
  }

  function updateFamiliar(i: number, patch: Partial<FamiliarGuardado>) {
    const norm: Partial<FamiliarGuardado> = { ...patch };
    if (patch.nombreFamiliar != null) norm.nombreFamiliar = aMayusculasPlataforma(patch.nombreFamiliar);
    if (patch.parentesco != null) norm.parentesco = aMayusculasPlataforma(patch.parentesco);
    setFamiliares((prev) => prev.map((f, idx) => (idx === i ? { ...f, ...norm } : f)));
  }

  function addFamiliar() {
    setFamiliares((prev) => [...prev, { nombreFamiliar: "", parentesco: "", fechaNacimiento: "", beneficiarioBancario: "NO" }]);
  }

  function removeFamiliar(i: number) {
    setFamiliares((prev) => (prev.length <= 1 ? prev : prev.filter((_, idx) => idx !== i)));
  }

  async function guardar(ev: FormEvent) {
    ev.preventDefault();
    setMsg(null);
    setGuardando(true);
    try {
      const form: Record<string, string> = {
        ...colaborador.form,
        ...formValues,
        noEmpleado1: colaborador.noEmpleado,
      };

      const fnNorm = normalizarFechaParaInputDate(String(form.fechaNacimiento ?? "").trim());
      const edadCalc = fnNorm ? edadAniosAlaFecha(fnNorm) : null;
      if (edadCalc != null) form.edad = String(edadCalc);

      const nombreT = (form.nombreCompleto ?? "").trim() || colaborador.nombreCompleto;
      const srv = (form.servicio ?? "").trim();
      const pst = (form.puesto ?? "").trim();
      const nssT = (form.imss ?? "").trim() || colaborador.nss;

      const moperPrev = colaborador.moperActual;
      /** La lista usa `moperActual.servicio` como línea vigente; hay que alinearlo con el expediente al guardar. */
      const moperActual = moperPrev
        ? { servicio: srv ? srv : moperPrev.servicio, puesto: pst || moperPrev.puesto }
        : { servicio: srv, puesto: pst };

      const famFiltrados = familiares.filter(
        (f) => f.nombreFamiliar.trim() || f.parentesco.trim() || f.fechaNacimiento.trim(),
      );

      let actualizado: ColaboradorCompleto = {
        ...colaborador,
        nombreCompleto: nombreT,
        fechaIngreso: (form.fechaIngreso ?? "").trim() || colaborador.fechaIngreso,
        nss: nssT,
        servicioAsignado: srv || colaborador.servicioAsignado,
        posicion: (form.posicion ?? "").trim() || colaborador.posicion,
        puesto: pst || colaborador.puesto,
        ultimoServicio: (form.ultimoServicio ?? "").trim() || colaborador.ultimoServicio,
        moperActual,
        familiares: famFiltrados,
        form,
      };
      actualizado = sincronizarEstadoBajaEnColaborador(limpiarPosicionDuplicadaDeNoServicio(actualizado));

      await upsertColaboradorCompleto(actualizado);

      if (editarVacantesCuadricula) {
        const ini = asignacionInicialRef.current;
        const cambioSlot =
          ini.planta &&
          ini.posicion &&
          (ini.planta !== (form.planta ?? "").trim().toUpperCase() ||
            ini.posicion !== (form.posicion ?? "").trim().toUpperCase() ||
            ini.servicio !== (form.servicio ?? "").trim().toUpperCase());
        if (cambioSlot) {
          const creada = addVacanteRegistro(
            {
              planta: ini.planta,
              posicion: ini.posicion,
              servicioLinea: ini.servicio,
              rowServiceNo: ini.noServicio,
              puesto: ini.puesto,
            },
            catalogoServicios,
          );
          if (creada) await persistirVacantesCatalogoEnServidor();
        }
        if (vacanteIdRef.current) {
          await consumirVacanteTrasAlta({
            vacanteId: vacanteIdRef.current,
            alta: {
              planta: (form.planta ?? "").trim(),
              servicioLinea: (form.servicio ?? "").trim(),
              rowServiceNo: (form.noServicio ?? "").trim(),
            },
            posicion: (form.posicion ?? "").trim(),
          });
          vacanteIdRef.current = "";
        }
      }

      if (colaboradorTieneBaja(actualizado)) {
        await registrarVacanteTrasBaja(actualizado, catalogoServicios);
      }
      await onGuardado(actualizado);
    } catch (e) {
      setMsg({ ok: false, text: e instanceof Error ? e.message : "ERROR AL GUARDAR." });
    } finally {
      setGuardando(false);
    }
  }

  const dlId = `servicios-editor-exp-${colaborador.noEmpleado}`;

  function campoParte(key: string) {
    const raw = formValues[key] ?? "";
    const label = etiquetaCampoExpediente(key);

    if (key === "noEmpleado1") {
      return (
        <label key={key} className="space-y-1">
          <span className="form-label uppercase">{label}</span>
          <input className="form-control uppercase bg-slate-100 text-slate-600" readOnly value={colaborador.noEmpleado} />
        </label>
      );
    }

    if (key === "servicio") {
      return (
        <label key={key} className="space-y-1 md:col-span-2 lg:col-span-2">
          <span className="form-label uppercase">{label}</span>
          <input
            className="form-control uppercase"
            list={dlId}
            value={raw}
            onChange={(e) => {
              const nombre = e.target.value;
              const match = catalogoServicios.find(
                (s) => s.nombre.trim().replace(/\s+/g, " ").toUpperCase() === nombre.trim().replace(/\s+/g, " ").toUpperCase(),
              );
              setFormValues((prev) => ({
                ...prev,
                servicio: nombre,
                ...(match
                  ? {
                      noServicio: (match.numero_servicio ?? "").trim(),
                      planta: (match.planta ?? "").trim(),
                    }
                  : {}),
              }));
            }}
            autoComplete="off"
          />
          <datalist id={dlId}>
            {catalogoServicios.map((s) => (
              <option key={s.id} value={s.nombre} />
            ))}
          </datalist>
          <p className="text-[10px] text-slate-500">
            <Link href="/servicios" className="text-blue-900 underline">
              Catálogo servicios
            </Link>
          </p>
        </label>
      );
    }

    if (key === "noServicio" || key === "planta") {
      return (
        <label key={key} className="space-y-1">
          <span className="form-label uppercase">{label}</span>
          <input
            className={`form-control ${key === "noServicio" ? "" : "uppercase"}`}
            value={raw}
            onChange={(e) => setKey(key, e.target.value)}
            autoComplete="off"
          />
        </label>
      );
    }

    if (key === "localForaneo") {
      return (
        <label key={key} className="space-y-1">
          <span className="form-label uppercase">{label}</span>
          <select className="form-control uppercase" value={raw} onChange={(e) => setKey(key, e.target.value)}>
            {["LOCAL", "FORANEO"].map((o) => (
              <option key={o} value={o}>
                {o}
              </option>
            ))}
          </select>
        </label>
      );
    }

    if (key === "diabetico" || key === "hipertenso") {
      return (
        <label key={key} className="space-y-1">
          <span className="form-label uppercase">{label}</span>
          <select className="form-control uppercase" value={raw || "NO"} onChange={(e) => setKey(key, e.target.value)}>
            {["SI", "NO"].map((o) => (
              <option key={o} value={o}>
                {o}
              </option>
            ))}
          </select>
        </label>
      );
    }

    if (DATE_KEYS.has(key)) {
      const v = normalizarFechaParaInputDate(raw) || raw;
      const esFechaBaja = key === "fechaBaja";
      const estatusVista = estatusEmpleadoNormalizado(formValues);
      return (
        <label key={key} className="space-y-1">
          <span className="form-label uppercase">{label}</span>
          <input className="form-control uppercase" type="date" value={v} onChange={(e) => setKey(key, e.target.value)} />
          {esFechaBaja ? (
            <span className="text-[10px] font-medium leading-tight text-slate-600">
              Sin fecha de baja el estatus pasa a <strong>ACTIVO</strong> al guardar. Estatus actual en formulario:{" "}
              <strong>{estatusVista}</strong>
              {!v && estatusVista === "BAJA" ? " (se corregirá al guardar)" : ""}.
            </span>
          ) : null}
        </label>
      );
    }

    if (key === "estatusEmpleado") {
      const estatusVista = estatusEmpleadoNormalizado(formValues);
      const enBaja = Boolean(normalizarFechaParaInputDate(String(formValues.fechaBaja ?? "").trim()));
      return (
        <label key={key} className="space-y-1">
          <span className="form-label uppercase">{label}</span>
          <input
            className="form-control uppercase bg-slate-100 text-slate-700"
            readOnly
            value={enBaja ? "BAJA" : estatusVista}
            aria-readonly="true"
          />
          <span className="text-[10px] font-medium text-slate-500">
            Se define por la fecha de baja (BAJA) o queda ACTIVO / INACTIVO si no hay baja.
          </span>
        </label>
      );
    }

    if (key === "edad") {
      const muestra = textoEdadDesdeExpediente(String(formValues.fechaNacimiento ?? ""), raw);
      return (
        <label key={key} className="space-y-1">
          <span className="form-label uppercase">{label}</span>
          <input
            className="form-control uppercase bg-slate-100 text-slate-700"
            readOnly
            value={muestra ? muestra.toUpperCase() : ""}
            aria-readonly="true"
          />
          <span className="text-[10px] font-medium uppercase leading-tight text-slate-500">
            Años cumplidos al día de hoy según fecha de nacimiento
          </span>
        </label>
      );
    }

    if (TEXTAREA_KEYS.has(key)) {
      return (
        <label key={key} className={`space-y-1 ${key === "direccionCompleta" || key === "documentacionOriginal" ? "md:col-span-2" : ""}`}>
          <span className="form-label uppercase">{label}</span>
          <textarea className="form-control min-h-20 uppercase" value={raw} onChange={(e) => setKey(key, e.target.value)} />
        </label>
      );
    }

    const inputType = NUMBER_KEYS.has(key) ? "number" : "text";
    return (
      <label key={key} className="space-y-1">
        <span className="form-label uppercase">{label}</span>
        <input className="form-control uppercase" type={inputType} value={raw} onChange={(e) => setKey(key, e.target.value)} />
      </label>
    );
  }

  return (
    <section className="rounded-xl border border-blue-300 bg-white p-4 shadow-sm">
      <h3 className="mb-1 text-sm font-bold uppercase text-slate-900">EDITAR EXPEDIENTE COMPLETO</h3>
      <p className="mb-3 text-[11px] text-slate-600">
        N° <span className="font-mono font-semibold">{colaborador.noEmpleado}</span>. Partes 1 a 6 y familiares. El historial MOPER en tabla aparte no se modifica aquí. Al guardar, el servicio y puesto del expediente actualizan la línea vigente en el listado; si borras el servicio y ya había MOPER, se conserva el servicio MOPER anterior.
      </p>
      {msg ? (
        <p
          className={`mb-3 rounded-lg px-3 py-2 text-xs font-semibold uppercase ${
            msg.ok ? "border border-green-200 bg-green-50 text-green-900" : "border border-red-200 bg-red-50 text-red-900"
          }`}
        >
          {msg.text}
        </p>
      ) : null}
      <form onSubmit={guardar} className="space-y-8">
        {editarVacantesCuadricula ? (
          <div className="space-y-3 rounded-lg border-2 border-blue-200 bg-blue-50/40 p-4">
            <h4 className="text-xs font-bold uppercase tracking-wide text-blue-950">
              Asignación (vacantes Cuadrícula)
            </h4>
            <p className="text-[11px] text-blue-900">
              Elija servicio, planta y posición del catálogo para corregir. Al guardar, la posición elegida se quita del
              catálogo; la asignación anterior vuelve como vacante si cambió.
            </p>
            <ColaboradorVacantePicker
              valores={{
                servicio: formValues.servicio ?? "",
                noServicio: formValues.noServicio ?? "",
                planta: formValues.planta ?? "",
                posicion: formValues.posicion ?? "",
                puesto: formValues.puesto ?? "",
              }}
              onChange={onVacantePickerChange}
            />
          </div>
        ) : null}

        {([1, 2, 3, 4, 6] as const).map((parteNum) => {
          const keys = [...(ALTAS_FORM_KEYS_PARTE[parteNum] ?? [])].filter(
            (k) => !(editarVacantesCuadricula && parteNum === 1 && CAMPOS_VACANTE_PARTE1.has(k)),
          );
          return (
            <div key={`parte-${parteNum}`} className="space-y-3 border-b border-slate-100 pb-6 last:border-0">
              <h4 className="text-xs font-bold uppercase tracking-wide text-slate-500">
                {ALTAS_ETIQUETA_PARTE_IMPORT[parteNum] ?? `PARTE ${parteNum}`}
              </h4>
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">{keys.map((k) => campoParte(k))}</div>
            </div>
          );
        })}

        <div className="space-y-3 border-b border-slate-100 pb-6">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h4 className="text-xs font-bold uppercase tracking-wide text-slate-500">{ALTAS_ETIQUETA_PARTE_IMPORT[5]}</h4>
            <button type="button" className="btn-secondary text-xs uppercase" onClick={addFamiliar}>
              Agregar familiar
            </button>
          </div>
          <div className="space-y-4">
            {familiares.map((f, index) => (
              <article key={index} className="rounded-lg border border-slate-200 bg-slate-50/80 p-3">
                <div className="mb-2 flex items-center justify-between">
                  <span className="text-[11px] font-bold uppercase text-slate-600">Familiar {index + 1}</span>
                  {familiares.length > 1 ? (
                    <button type="button" className="text-[11px] font-bold uppercase text-red-700" onClick={() => removeFamiliar(index)}>
                      Quitar
                    </button>
                  ) : null}
                </div>
                <div className="grid grid-cols-1 gap-2 md:grid-cols-2 lg:grid-cols-4">
                  <label className="space-y-1">
                    <span className="form-label uppercase">Nombre</span>
                    <input
                      className="form-control uppercase"
                      value={f.nombreFamiliar}
                      onChange={(e) => updateFamiliar(index, { nombreFamiliar: e.target.value })}
                    />
                  </label>
                  <label className="space-y-1">
                    <span className="form-label uppercase">Parentesco</span>
                    <input
                      className="form-control uppercase"
                      value={f.parentesco}
                      onChange={(e) => updateFamiliar(index, { parentesco: e.target.value })}
                    />
                  </label>
                  <label className="space-y-1">
                    <span className="form-label uppercase">Nacimiento</span>
                    <input
                      className="form-control uppercase"
                      type="date"
                      value={normalizarFechaParaInputDate(f.fechaNacimiento) || f.fechaNacimiento}
                      onChange={(e) => updateFamiliar(index, { fechaNacimiento: e.target.value })}
                    />
                  </label>
                  <label className="space-y-1">
                    <span className="form-label uppercase">Benef. bancario</span>
                    <select
                      className="form-control uppercase"
                      value={f.beneficiarioBancario === "SI" ? "SI" : "NO"}
                      onChange={(e) => updateFamiliar(index, { beneficiarioBancario: e.target.value as "SI" | "NO" })}
                    >
                      <option value="NO">NO</option>
                      <option value="SI">SI</option>
                    </select>
                  </label>
                </div>
              </article>
            ))}
          </div>
        </div>

        <div className="flex flex-wrap gap-2 border-t border-slate-200 pt-4">
          <button type="submit" className="btn-primary uppercase" disabled={guardando}>
            {guardando ? "Guardando…" : "Guardar expediente"}
          </button>
          <button type="button" className="btn-secondary uppercase" disabled={guardando} onClick={onCancel}>
            Cancelar
          </button>
        </div>
      </form>
    </section>
  );
}
