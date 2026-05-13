"use client";

import { type ChangeEvent, FormEvent, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  findColaboradorCompletoByNo,
  upsertColaboradorCompleto,
  type ColaboradorCompleto,
} from "@/lib/colaboradores-store";
import { colaboradorTieneBaja, fechaIngresoNormalizadaColaborador } from "@/lib/colaboradores-baja";
import { normalizarFechaParaInputDate } from "@/lib/fecha-input-normalize";
import { importColaboradoresDesdeCsv, generarCsvPlantillaAltas } from "@/lib/altas-csv-import";
import {
  ALTAS_ETIQUETA_PARTE_IMPORT,
  generarCsvPlantillaAltasPorParte,
  importColaboradoresDesdeCsvPorParte,
} from "@/lib/altas-import-partes";
import { downloadCsv } from "@/lib/colaboradores-csv";
import { type CatalogoServicioItem, fetchServiciosCatalogo } from "@/lib/servicios-catalogo-client";
import type { AppRole } from "@/lib/app-role";
import { roleMayWriteAltas } from "@/lib/app-role";
import { aplicarUnSoloCampoColaborador } from "@/lib/altas-un-campo";
import {
  generarPlantillaCorreccionCsvDosColumnas,
  parseCorreccionCsvDosColumnas,
} from "@/lib/altas-csv-correccion-dos-columnas";

type Familiar = {
  nombreFamiliar: string;
  parentesco: string;
  fechaNacimiento: string;
  beneficiarioBancario: "SI" | "NO";
};

const PARTS = [
  "PARTE 1",
  "PARTE 2",
  "PARTE 3",
  "PARTE 4",
  "PARTE 5",
] as const;

export function AltasPageClient({ appRole }: { appRole: AppRole }) {
  const puedeEditarAltas = roleMayWriteAltas(appRole);
  const csvInputRef = useRef<HTMLInputElement>(null);
  const csvCorreccionDosRef = useRef<HTMLInputElement>(null);
  const [preserveMoperEnImport, setPreserveMoperEnImport] = useState(true);
  const [csvModo, setCsvModo] = useState<"completo" | "parte">("parte");
  const [csvParteNum, setCsvParteNum] = useState<number>(1);
  const [importResultado, setImportResultado] = useState<{
    imported: number;
    skippedEmpty: number;
    errors: Array<{ row: number; message: string }>;
    origen?: string;
  } | null>(null);
  const [step, setStep] = useState(0);
  const [pteSequence, setPteSequence] = useState(1);
  const [form, setForm] = useState({
    // Parte 1
    noEmpleado1: "",
    fechaIngreso: "",
    fechaBaja: "",
    envio: "",
    reyna: "",
    reingreso: "",
    nombreCompleto: "",
    puesto: "",
    servicio: "",
    posicion: "",
    localForaneo: "LOCAL",
    numeroFolio: "",
    creditoInfonavit: "",
    escolaridad: "",
    licenciaConducir: "",
    cartaNoAntecedentes: "",
    idiomas: "",

    // Parte 2
    apellidoPaterno: "",
    apellidoMaterno: "",
    nombres: "",
    fechaNacimiento: "",
    edad: "",
    estadoCivil: "",
    curp: "",
    rfc: "",
    noIfe: "",
    imss: "",
    codigoPostal: "",
    estadoNatal: "",
    direccionCompleta: "",
    telefonoPersonalCasa: "",

    // Parte 3
    estaturaPeso: "",
    tipoSangre: "",
    alergicoA: "",
    enfermedadTratamiento: "",
    diabetico: "NO",
    hipertenso: "NO",
    emergenciaLlamarA: "",
    telefonoEmergencia: "",

    // Parte 4
    banco: "",
    numeroCuenta: "",
    clabeInterbancaria: "",
    noTarjeta: "",
    sueldoMensual: "",
    fuenteReclutamiento: "",
    gestorProceso: "",
    estudioSocioeconomico: "",
    documentacionOriginal: "",
  });

  const [familiares, setFamiliares] = useState<Familiar[]>([
    { nombreFamiliar: "", parentesco: "", fechaNacimiento: "", beneficiarioBancario: "NO" },
  ]);

  const progress = useMemo(() => `${step + 1} / ${PARTS.length}`, [step]);
  const empleadoClave = useMemo(() => {
    const userValue = form.noEmpleado1.trim().toUpperCase();
    return userValue || `PTE-${pteSequence}`;
  }, [form.noEmpleado1, pteSequence]);

  const [altaMsg, setAltaMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [catalogoServicios, setCatalogoServicios] = useState<CatalogoServicioItem[]>([]);
  const [expedientePrevio, setExpedientePrevio] = useState<ColaboradorCompleto | null>(null);
  const [expedienteBuscando, setExpedienteBuscando] = useState(false);

  const reingresoObligatorioPorBaja = Boolean(
    expedientePrevio && colaboradorTieneBaja(expedientePrevio),
  );

  const [correccionCsvMsg, setCorreccionCsvMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [correccionCsvBusy, setCorreccionCsvBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const rows = await fetchServiciosCatalogo();
        if (!cancelled) setCatalogoServicios(rows);
      } catch {
        if (!cancelled) setCatalogoServicios([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const key = form.noEmpleado1.trim().toUpperCase();
    if (!key || key.startsWith("PTE-")) {
      setExpedientePrevio(null);
      setExpedienteBuscando(false);
      return;
    }
    setExpedientePrevio(null);
    let active = true;
    setExpedienteBuscando(true);
    const timer = setTimeout(async () => {
      try {
        const ex = await findColaboradorCompletoByNo(key);
        if (!active) return;
        setExpedientePrevio(ex);
      } catch {
        if (!active) return;
        setExpedientePrevio(null);
      } finally {
        if (active) setExpedienteBuscando(false);
      }
    }, 450);
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [form.noEmpleado1]);

  function updateField(name: string, value: string) {
    setForm((prev) => ({ ...prev, [name]: value }));
  }

  function addFamiliar() {
    setFamiliares((prev) => [...prev, { nombreFamiliar: "", parentesco: "", fechaNacimiento: "", beneficiarioBancario: "NO" }]);
  }

  function removeFamiliar(index: number) {
    setFamiliares((prev) => prev.filter((_, i) => i !== index));
  }

  function updateFamiliar(index: number, key: keyof Familiar, value: string) {
    setFamiliares((prev) => prev.map((f, i) => (i === index ? { ...f, [key]: value } : f)));
  }

  async function submitAll(e: FormEvent) {
    e.preventDefault();
    setAltaMsg(null);
    if (!puedeEditarAltas) {
      setAltaMsg({ ok: false, text: "SOLO EL PERFIL ADMINISTRADOR PUEDE GUARDAR O ACTUALIZAR DESDE ALTAS." });
      return;
    }
    const noManual = form.noEmpleado1.trim();
    const noFinal = noManual ? noManual.toUpperCase() : `PTE-${pteSequence}`;
    if (noManual) {
      try {
        const prev = await findColaboradorCompletoByNo(noFinal);
        if (prev && colaboradorTieneBaja(prev)) {
          const reingNorm = normalizarFechaParaInputDate(form.reingreso.trim());
          if (!reingNorm) {
            setStep(0);
            setAltaMsg({
              ok: false,
              text: "ESTE NUMERO YA TIENE EXPEDIENTE CON FECHA DE BAJA. CAPTURA LA FECHA DE REINGRESO EN PARTE 1 ANTES DE GUARDAR.",
            });
            return;
          }
        }
      } catch {
        setAltaMsg({ ok: false, text: "NO SE PUDO VERIFICAR SI EL EMPLEADO YA EXISTE. REVISA CONEXION E INTENTA DE NUEVO." });
        return;
      }
    }
    const flatForm: Record<string, string> = {};
    for (const [k, v] of Object.entries(form)) {
      flatForm[k] = String(v ?? "");
    }

    const servicioAlta = form.servicio.trim();

    try {
      await upsertColaboradorCompleto({
        noEmpleado: noFinal,
        nombreCompleto: form.nombreCompleto,
        fechaIngreso: form.fechaIngreso,
        servicioAsignado: form.servicio,
        ultimoServicio: "",
        nss: form.imss,
        posicion: form.posicion,
        puesto: form.puesto,
        moperActual: {
          servicio: servicioAlta,
          puesto: form.puesto.trim(),
        },
        registeredAt: new Date().toISOString(),
        form: flatForm,
        familiares: familiares.map((f) => ({
          nombreFamiliar: f.nombreFamiliar,
          parentesco: f.parentesco,
          fechaNacimiento: f.fechaNacimiento,
          beneficiarioBancario: f.beneficiarioBancario,
        })),
      });
      if (!noManual) {
        setPteSequence((prev) => prev + 1);
      }
      setAltaMsg({ ok: true, text: "EXPEDIENTE GUARDADO EN SUPABASE." });
    } catch (err) {
      setAltaMsg({
        ok: false,
        text: err instanceof Error ? err.message : "ERROR AL GUARDAR EL EXPEDIENTE.",
      });
    }
  }

  async function handleCsvFileChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (!puedeEditarAltas) {
      setImportResultado({
        imported: 0,
        skippedEmpty: 0,
        errors: [{ row: 0, message: "LA IMPORTACION CSV SOLO LA PUEDE EJECUTAR UN ADMINISTRADOR." }],
      });
      return;
    }
    setImportResultado(null);
    try {
      const text = await file.text();
      if (csvModo === "completo") {
        const res = await importColaboradoresDesdeCsv(text, { preserveMoper: preserveMoperEnImport });
        setImportResultado({
          ...res,
          origen: "IMPORTACION TODO-EN-UNO (COLUMNAS MIXTAS)",
        });
      } else {
        const res = await importColaboradoresDesdeCsvPorParte(text, csvParteNum, {
          preserveMoper: preserveMoperEnImport,
        });
        setImportResultado({
          imported: res.imported,
          skippedEmpty: res.skippedEmpty,
          errors: res.errors,
          origen: ALTAS_ETIQUETA_PARTE_IMPORT[csvParteNum] ?? `PARTE ${csvParteNum}`,
        });
      }
    } catch (err) {
      setImportResultado({
        imported: 0,
        skippedEmpty: 0,
        errors: [{ row: 0, message: `ERROR AL LEER EL ARCHIVO: ${err instanceof Error ? err.message : String(err)}` }],
      });
    }
  }

  async function handleCorreccionCsvDosColumnas(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (!puedeEditarAltas) {
      setCorreccionCsvMsg({ ok: false, text: "LA IMPORTACION SOLO LA PUEDE EJECUTAR UN ADMINISTRADOR." });
      return;
    }
    setCorreccionCsvMsg(null);
    setCorreccionCsvBusy(true);
    try {
      const text = await file.text();
      const parsed = parseCorreccionCsvDosColumnas(text);
      if (!parsed.ok) {
        setCorreccionCsvMsg({ ok: false, text: parsed.errors.join(" ") });
        return;
      }
      let ok = 0;
      const rowErrs: string[] = [];
      const campo = parsed.fieldKey;
      for (const { noEmpleado, valor } of parsed.rows) {
        try {
          const existing = await findColaboradorCompletoByNo(noEmpleado);
          if (!existing) {
            rowErrs.push(`${noEmpleado}: SIN EXPEDIENTE`);
            continue;
          }
          const next = aplicarUnSoloCampoColaborador(existing, campo, valor);
          await upsertColaboradorCompleto({
            ...next,
            registeredAt: existing.registeredAt,
          });
          ok++;
        } catch (err) {
          rowErrs.push(`${noEmpleado}: ${err instanceof Error ? err.message : String(err)}`);
        }
      }
      const base = `CAMPO "${campo}": ${ok} EXPEDIENTE(S) ACTUALIZADO(S).`;
      if (rowErrs.length === 0) {
        setCorreccionCsvMsg({ ok: true, text: base });
      } else {
        const slice = rowErrs.slice(0, 15);
        const more = rowErrs.length > 15 ? ` …(+${rowErrs.length - 15} MAS)` : "";
        setCorreccionCsvMsg({
          ok: false,
          text: `${base} AVISOS: ${slice.join(" | ")}${more}`,
        });
      }
    } catch (err) {
      setCorreccionCsvMsg({
        ok: false,
        text: err instanceof Error ? err.message : `ERROR AL LEER EL ARCHIVO: ${String(err)}`,
      });
    } finally {
      setCorreccionCsvBusy(false);
    }
  }

  return (
    <div className="w-full">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Modulo</p>
            <h1 className="text-3xl font-bold uppercase tracking-tight text-slate-900">ALTAS</h1>
            {!puedeEditarAltas ? (
              <p className="mt-2 max-w-2xl rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-sm font-bold uppercase text-amber-950">
                Esta pantalla es solo de consulta para tu perfil. Solo un <strong>administrador</strong> puede capturar, importar CSV o importar el
                CSV de correccion (dos columnas).
              </p>
            ) : null}
          </div>
          <span className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700">{progress}</span>
        </div>

        {puedeEditarAltas ? (
          <section className="card mb-4 border-2 border-blue-900/25 bg-gradient-to-br from-blue-50 to-slate-50 space-y-4">
            <h2 className="text-base font-bold uppercase text-slate-900">Administrador: CSV de correccion (dos columnas)</h2>
            <p className="text-sm font-medium text-slate-800">
              Archivo con solo dos columnas: una es el numero de empleado (ej. <code className="rounded bg-white px-1">no_de_empleado</code>) y la
              otra el nombre del dato que falta o esta mal (ej. <code className="rounded bg-white px-1">curp</code>,{" "}
              <code className="rounded bg-white px-1">servicio</code>, <code className="rounded bg-white px-1">fecha_de_ingreso</code>). Los
              encabezados usan el mismo criterio que el CSV masivo de colaboradores. Cada fila actualiza solo ese campo; el resto del expediente no
              cambia.
            </p>
            <input
              ref={csvCorreccionDosRef}
              type="file"
              accept=".csv,text/csv"
              className="sr-only"
              onChange={handleCorreccionCsvDosColumnas}
            />
            <div className="flex flex-wrap items-center gap-3">
              <button
                type="button"
                className="btn-primary uppercase"
                disabled={correccionCsvBusy}
                onClick={() => csvCorreccionDosRef.current?.click()}
              >
                {correccionCsvBusy ? "Procesando…" : "Elegir CSV (2 columnas)"}
              </button>
              <button
                type="button"
                className="btn-secondary uppercase"
                onClick={() =>
                  downloadCsv("plantilla_correccion_2_columnas.csv", generarPlantillaCorreccionCsvDosColumnas())
                }
              >
                Descargar ejemplo
              </button>
            </div>
            {correccionCsvMsg ? (
              <p
                className={`rounded-lg px-3 py-2 text-sm font-bold uppercase ${
                  correccionCsvMsg.ok
                    ? "border border-green-200 bg-green-50 text-green-900"
                    : "border border-red-200 bg-red-50 text-red-900"
                }`}
              >
                {correccionCsvMsg.text}
              </p>
            ) : null}
          </section>
        ) : null}

        <section className={`card mb-4 space-y-3 ${!puedeEditarAltas ? "pointer-events-none opacity-50" : ""}`}>
          <h2 className="text-sm font-bold uppercase text-slate-800">Importacion masiva CSV</h2>
          <fieldset className="space-y-2 border-0 p-0">
            <legend className="sr-only">Modo de importacion</legend>
            <p className="text-xs font-semibold uppercase text-slate-700">¿Como viene tu archivo?</p>
            <div className="flex flex-wrap gap-4">
              <label className="flex cursor-pointer items-center gap-2 text-xs font-semibold uppercase text-slate-700">
                <input
                  type="radio"
                  name="csv-modo"
                  className="h-4 w-4 border-slate-300"
                  checked={csvModo === "parte"}
                  onChange={() => setCsvModo("parte")}
                />
                Por parte (PARTE 1, 2… archivos separados)
              </label>
              <label className="flex cursor-pointer items-center gap-2 text-xs font-semibold uppercase text-slate-700">
                <input
                  type="radio"
                  name="csv-modo"
                  className="h-4 w-4 border-slate-300"
                  checked={csvModo === "completo"}
                  onChange={() => setCsvModo("completo")}
                />
                Todo en un solo CSV
              </label>
            </div>
          </fieldset>
          {csvModo === "parte" ? (
            <div className="flex flex-wrap items-end gap-3">
              <label className="space-y-1">
                <span className="block text-xs font-semibold uppercase text-slate-600">Este CSV corresponde a</span>
                <select
                  className="form-control min-w-[260px] text-sm uppercase"
                  value={csvParteNum}
                  onChange={(ev) => setCsvParteNum(Number(ev.target.value))}
                >
                  {([1, 2, 3, 4, 5, 6] as const).map((n) => (
                    <option key={n} value={n}>
                      {ALTAS_ETIQUETA_PARTE_IMPORT[n]}
                    </option>
                  ))}
                </select>
              </label>
              <p className="max-w-xl text-[11px] leading-snug text-slate-600">
                Cada archivo solo lleva las columnas de ese bloque (mas <strong>NO_EMPLEADO</strong>). El sistema va uniendo datos al
                mismo expediente. <strong>PARTE 5:</strong> la plantilla trae formato ancho (NO DE EMPLEADO, PADRE, MADRE, PAREJA, HIJO1… HIJO4): una fila por empleado <strong>sustituye</strong> toda la lista de familiares. El formato clasico una fila por familiar (nombre + parentesco) sigue admitido y <strong>sigue acumulando</strong>.
              </p>
            </div>
          ) : (
            <p className="text-xs text-slate-600">
              Un CSV con muchas columnas a la vez. Minimo por fila: <strong className="text-slate-800">NO_EMPLEADO</strong> y nombre.
              Tambien puede incluir columnas <strong className="text-slate-800">FORM_*</strong> como en el export de COLABORADORES. Si usa columnas{" "}
              <strong className="text-slate-800">PADRE, MADRE, PAREJA, HIJO1…</strong> junto con N° empleado, los familiares se toman de ese formato
              ancho cuando la fila trae algun nombre en esas celdas.
            </p>
          )}
          <div className="flex flex-wrap items-center gap-3">
            <label className="flex cursor-pointer items-center gap-2 text-sm font-semibold uppercase text-slate-700">
              <input
                type="checkbox"
                className="h-4 w-4 rounded border-slate-300"
                checked={preserveMoperEnImport}
                onChange={(ev) => setPreserveMoperEnImport(ev.target.checked)}
              />
              Conservar MOPER (en PARTE 1, si la fila no trae SERVICIO ni PUESTO, no se cambia la linea MOPER vigente)
            </label>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              className="btn-secondary uppercase"
              onClick={() => {
                if (csvModo === "completo") {
                  downloadCsv("plantilla_altas_tactical.csv", generarCsvPlantillaAltas());
                } else {
                  downloadCsv(
                    `plantilla_altas_PARTE_${csvParteNum}.csv`,
                    generarCsvPlantillaAltasPorParte(csvParteNum),
                  );
                }
              }}
            >
              Descargar plantilla CSV
            </button>
            <input
              ref={csvInputRef}
              type="file"
              accept=".csv,text/csv"
              className="sr-only"
              onChange={handleCsvFileChange}
            />
            <button type="button" className="btn-primary uppercase" onClick={() => csvInputRef.current?.click()}>
              {csvModo === "parte"
                ? `Importar archivo PARTE ${csvParteNum}`
                : "Importar colaboradores desde CSV"}
            </button>
          </div>
          {importResultado ? (
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm">
              <p className="text-[11px] font-medium uppercase tracking-wide text-slate-600">
                {importResultado.origen ?? ""}
              </p>
              <p className="font-semibold uppercase text-slate-800">
                Resultado: <span className="text-green-800">{importResultado.imported} importado(s)</span>
                {importResultado.skippedEmpty > 0 ? (
                  <span className="text-slate-600"> — {importResultado.skippedEmpty} fila(s) vacia(s)</span>
                ) : null}
              </p>
              {importResultado.errors.length > 0 ? (
                <div className="mt-2 max-h-48 overflow-auto border-t border-slate-200 pt-2">
                  <p className="text-xs font-bold uppercase text-amber-900">
                    {importResultado.errors.length} aviso(s) / fila(s) no importadas:
                  </p>
                  <ul className="mt-1 list-inside list-disc text-xs text-amber-950">
                    {importResultado.errors.slice(0, 25).map((er, i) => (
                      <li key={i}>
                        Fila {er.row}: {er.message}
                      </li>
                    ))}
                    {importResultado.errors.length > 25 ? (
                      <li className="font-semibold">…y {importResultado.errors.length - 25} mas.</li>
                    ) : null}
                  </ul>
                </div>
              ) : null}
            </div>
          ) : null}
        </section>

        <div className="mb-4 grid grid-cols-2 gap-2 md:grid-cols-5">
          {PARTS.map((label, i) => (
            <button
              key={label}
              type="button"
              onClick={() => setStep(i)}
              className={`rounded-lg border px-3 py-2 text-sm font-semibold uppercase transition ${
                i === step
                  ? "border-slate-900 bg-slate-900 text-white"
                  : "border-slate-300 bg-white text-slate-700 hover:border-slate-400"
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        <form onSubmit={submitAll} className="card space-y-6">
          {altaMsg ? (
            <p
              className={`rounded-lg px-3 py-2 text-sm font-semibold uppercase ${
                altaMsg.ok ? "border border-green-200 bg-green-50 text-green-900" : "border border-red-200 bg-red-50 text-red-900"
              }`}
            >
              {altaMsg.text}
            </p>
          ) : null}
          <fieldset disabled={!puedeEditarAltas} className="min-w-0 space-y-6 border-0 p-0">
          {step === 0 && (
            <section className="space-y-4">
              <h2 className="text-lg font-bold uppercase">PARTE 1 - DATOS GENERALES</h2>
              <p className="text-sm font-medium uppercase text-slate-500">
                CLAVE ACTUAL: <span className="font-bold text-slate-800">{empleadoClave}</span>
                {!form.noEmpleado1.trim() ? " (SE GENERA AUTOMATICAMENTE SI NO CAPTURAS NO DE EMPLEADO)" : ""}
              </p>
              {form.noEmpleado1.trim() && !form.noEmpleado1.trim().toUpperCase().startsWith("PTE-") ? (
                <div className="space-y-2">
                  {expedienteBuscando ? (
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Buscando expediente existente…</p>
                  ) : null}
                  {expedientePrevio ? (
                    colaboradorTieneBaja(expedientePrevio) ? (
                      <div className="rounded-lg border-2 border-amber-500 bg-amber-50 px-3 py-3 text-sm uppercase leading-snug text-amber-950">
                        <p className="font-bold">Reingreso: expediente ya registrado y con baja</p>
                        <p className="mt-2 text-xs font-medium text-amber-900">
                          Nombre en sistema: <strong>{(expedientePrevio.nombreCompleto ?? "").trim() || "—"}</strong>
                          {" · "}
                          Ingreso previo:{" "}
                          <strong>
                            {fechaIngresoNormalizadaColaborador(expedientePrevio) ||
                              (expedientePrevio.fechaIngreso || expedientePrevio.form?.fechaIngreso || "—").toString()}
                          </strong>
                          {" · "}
                          Fecha de baja en expediente:{" "}
                          <strong>
                            {normalizarFechaParaInputDate(String(expedientePrevio.form?.fechaBaja ?? "")) ||
                              String(expedientePrevio.form?.fechaBaja ?? "").trim() ||
                              "—"}
                          </strong>
                        </p>
                        <p className="mt-2 text-xs font-bold text-amber-950">
                          Debes capturar <strong>FECHA DE REINGRESO</strong> (fecha en que reingresa a la empresa). Puedes igualarla a la fecha de
                          ingreso de este alta.
                        </p>
                      </div>
                    ) : (
                      <div className="rounded-lg border border-sky-300 bg-sky-50 px-3 py-3 text-sm uppercase leading-snug text-sky-950">
                        <p className="font-bold">Expediente ya existe (activo / sin baja en expediente)</p>
                        <p className="mt-2 text-xs font-medium text-sky-900">
                          Nombre: <strong>{(expedientePrevio.nombreCompleto ?? "").trim() || "—"}</strong>. Guardar desde Altas{" "}
                          <strong>sustituye</strong> datos del expediente con lo que captures aqui; para ajustes puntuales suele usarse{" "}
                          <Link href="/colaboradores" className="font-bold underline underline-offset-2">
                            Colaboradores
                          </Link>
                          . Si es un reingreso formal, captura tambien <strong>REINGRESO</strong>.
                        </p>
                      </div>
                    )
                  ) : !expedienteBuscando ? (
                    <p className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold uppercase text-slate-600">
                      No hay otro expediente con este numero de empleado (alta nueva con esta clave).
                    </p>
                  ) : null}
                </div>
              ) : null}
              <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                <Field label="NO DE EMPLEADO" value={form.noEmpleado1} onChange={(v) => updateField("noEmpleado1", v)} />
                <Field label="FECHA DE INGRESO" type="date" value={form.fechaIngreso} onChange={(v) => updateField("fechaIngreso", v)} />
                <Field label="FECHA DE BAJA" type="date" value={form.fechaBaja} onChange={(v) => updateField("fechaBaja", v)} />
                <Field label="ENVIO" value={form.envio} onChange={(v) => updateField("envio", v)} />
                <Field label="REYNA" value={form.reyna} onChange={(v) => updateField("reyna", v)} />
                <div className="space-y-1">
                  <div className="flex flex-wrap items-end gap-2">
                    <div className="min-w-0 flex-1">
                      <Field
                        label="REINGRESO"
                        type="date"
                        value={form.reingreso}
                        onChange={(v) => updateField("reingreso", v)}
                        inputClassName={reingresoObligatorioPorBaja ? "ring-2 ring-amber-500" : ""}
                      />
                    </div>
                    {form.fechaIngreso.trim() ? (
                      <button
                        type="button"
                        className="btn-secondary mb-[2px] shrink-0 px-2 py-2 text-[10px] font-bold uppercase"
                        onClick={() => updateField("reingreso", form.fechaIngreso)}
                      >
                        Igual que ingreso
                      </button>
                    ) : null}
                  </div>
                  {reingresoObligatorioPorBaja ? (
                    <p className="text-[10px] font-bold uppercase text-amber-800">Obligatorio: expediente previo con fecha de baja.</p>
                  ) : (
                    <p className="text-[10px] font-medium uppercase text-slate-500">Si ya hubo alta y baja, usa la fecha de reingreso laboral.</p>
                  )}
                </div>
                <Field label="NOMBRE COMPLETO" value={form.nombreCompleto} onChange={(v) => updateField("nombreCompleto", v)} />
                <Field label="PUESTO" value={form.puesto} onChange={(v) => updateField("puesto", v)} />
                <label className="space-y-1">
                  <span className="form-label uppercase">SERVICIO (CLIENTE/LUGAR)</span>
                  <input
                    className="form-control uppercase"
                    list="lista-catalogo-servicios-altas"
                    value={form.servicio}
                    onChange={(e) => updateField("servicio", e.target.value)}
                    placeholder={catalogoServicios.length ? "ELIGE DE LA LISTA O ESCRIBE…" : "CAPTURA O CONFIGURA CATÁLOGO EN SERVICIOS"}
                    autoComplete="off"
                  />
                  <datalist id="lista-catalogo-servicios-altas">
                    {catalogoServicios.map((s) => (
                      <option key={s.id} value={s.nombre} />
                    ))}
                  </datalist>
                  <p className="text-[11px] font-medium text-slate-500">
                    <Link href="/servicios" className="text-blue-900 underline underline-offset-2 hover:text-blue-950">
                      Administracion de catalogo · Servicios
                    </Link>
                    . Tambien puedes escribir un servicio que no este en la lista.
                  </p>
                </label>
                <Field label="POSICION" value={form.posicion} onChange={(v) => updateField("posicion", v)} />
                <SelectField
                  label="LOCAL/FORANEO"
                  value={form.localForaneo}
                  options={["LOCAL", "FORANEO"]}
                  onChange={(v) => updateField("localForaneo", v)}
                />
                <Field label="NUMERO DE EXPEDIENTE" value={form.numeroFolio} onChange={(v) => updateField("numeroFolio", v)} />
                <Field label="CREDITO INFONAVIT" value={form.creditoInfonavit} onChange={(v) => updateField("creditoInfonavit", v)} />
                <Field label="ESCOLARIDAD" value={form.escolaridad} onChange={(v) => updateField("escolaridad", v)} />
                <Field label="LICENCIA" value={form.licenciaConducir} onChange={(v) => updateField("licenciaConducir", v)} />
                <Field label="CARTA NO PENALES / ANTECEDENTES" value={form.cartaNoAntecedentes} onChange={(v) => updateField("cartaNoAntecedentes", v)} />
                <Field label="IDIOMAS EXTERNOS" value={form.idiomas} onChange={(v) => updateField("idiomas", v)} />
              </div>
            </section>
          )}

          {step === 1 && (
            <section className="space-y-4">
              <h2 className="text-lg font-bold uppercase">PARTE 2 - IDENTIDAD Y DOMICILIO</h2>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                <Field label="NO DE EMPLEADO" value={empleadoClave} onChange={() => undefined} readOnly />
                <Field label="APELLIDO PATERNO" value={form.apellidoPaterno} onChange={(v) => updateField("apellidoPaterno", v)} />
                <Field label="APELLIDO MATERNO" value={form.apellidoMaterno} onChange={(v) => updateField("apellidoMaterno", v)} />
                <Field label="NOMBRE(S)" value={form.nombres} onChange={(v) => updateField("nombres", v)} />
                <Field label="FECHA DE NACIMIENTO" type="date" value={form.fechaNacimiento} onChange={(v) => updateField("fechaNacimiento", v)} />
                <Field label="EDAD" type="number" value={form.edad} onChange={(v) => updateField("edad", v)} />
                <Field label="ESTADO CIVIL" value={form.estadoCivil} onChange={(v) => updateField("estadoCivil", v)} />
                <Field label="CURP" value={form.curp} onChange={(v) => updateField("curp", v)} />
                <Field label="RFC" value={form.rfc} onChange={(v) => updateField("rfc", v)} />
                <Field
                  label="NO. INE / IFE"
                  value={form.noIfe}
                  onChange={(v) => updateField("noIfe", v)}
                />
                <Field label="IMSS" value={form.imss} onChange={(v) => updateField("imss", v)} />
                <Field label="CODIGO POSTAL" value={form.codigoPostal} onChange={(v) => updateField("codigoPostal", v)} />
                <Field label="ESTADO NATAL" value={form.estadoNatal} onChange={(v) => updateField("estadoNatal", v)} />
                <Field label="TELEFONO PERSONAL / CASA" value={form.telefonoPersonalCasa} onChange={(v) => updateField("telefonoPersonalCasa", v)} />
                <TextAreaField
                  className="md:col-span-2"
                  label="ESTADO / MUNICIPIO / COLONIA / CALLE Y NUMERO"
                  value={form.direccionCompleta}
                  onChange={(v) => updateField("direccionCompleta", v)}
                />
              </div>
            </section>
          )}

          {step === 2 && (
            <section className="space-y-4">
              <h2 className="text-lg font-bold uppercase">PARTE 3 - SALUD</h2>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                <Field label="NO DE EMPLEADO" value={empleadoClave} onChange={() => undefined} readOnly />
                <Field label="ESTATURA/PESO" value={form.estaturaPeso} onChange={(v) => updateField("estaturaPeso", v)} />
                <Field label="TIPO DE SANGRE" value={form.tipoSangre} onChange={(v) => updateField("tipoSangre", v)} />
                <TextAreaField
                  label="ALERGICO A (MEDICAMENTO/COMIDA)"
                  value={form.alergicoA}
                  onChange={(v) => updateField("alergicoA", v)}
                />
                <TextAreaField
                  label="ENFERMEDAD ACTUAL / TRATAMIENTO MEDICO"
                  value={form.enfermedadTratamiento}
                  onChange={(v) => updateField("enfermedadTratamiento", v)}
                />
                <SelectField label="DIABETICO (SI/NO)" value={form.diabetico} options={["SI", "NO"]} onChange={(v) => updateField("diabetico", v)} />
                <SelectField
                  label="HIPERTENSO (SI/NO)"
                  value={form.hipertenso}
                  options={["SI", "NO"]}
                  onChange={(v) => updateField("hipertenso", v)}
                />
                <Field label="EN CASO DE EMERGENCIA LLAMAR A" value={form.emergenciaLlamarA} onChange={(v) => updateField("emergenciaLlamarA", v)} />
                <Field label="TELEFONO DE EMERGENCIA" value={form.telefonoEmergencia} onChange={(v) => updateField("telefonoEmergencia", v)} />
              </div>
            </section>
          )}

          {step === 3 && (
            <section className="space-y-4">
              <h2 className="text-lg font-bold uppercase">PARTE 4 - NOMINA Y RECLUTAMIENTO</h2>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                <Field label="NO DE EMPLEADO" value={empleadoClave} onChange={() => undefined} readOnly />
                <Field label="BANCO" value={form.banco} onChange={(v) => updateField("banco", v)} />
                <Field label="NO. CUENTA" value={form.numeroCuenta} onChange={(v) => updateField("numeroCuenta", v)} />
                <Field label="CLABE INTERBANCARIA" value={form.clabeInterbancaria} onChange={(v) => updateField("clabeInterbancaria", v)} />
                <Field label="NO. TARJETA" value={form.noTarjeta} onChange={(v) => updateField("noTarjeta", v)} />
                <Field label="SUELDO MENSUAL" type="number" value={form.sueldoMensual} onChange={(v) => updateField("sueldoMensual", v)} />
                <Field label="FUENTE DE RECLUTAMIENTO" value={form.fuenteReclutamiento} onChange={(v) => updateField("fuenteReclutamiento", v)} />
                <Field label="GESTOR DEL PROCESO" value={form.gestorProceso} onChange={(v) => updateField("gestorProceso", v)} />
                <TextAreaField
                  label="ESTUDIO SOCIOECONOMICO"
                  value={form.estudioSocioeconomico}
                  onChange={(v) => updateField("estudioSocioeconomico", v)}
                />
                <TextAreaField
                  className="md:col-span-2"
                  label="DOCUMENTACION ORIGINAL (CONTABILIDAD)"
                  value={form.documentacionOriginal}
                  onChange={(v) => updateField("documentacionOriginal", v)}
                />
              </div>
            </section>
          )}

          {step === 4 && (
            <section className="space-y-4">
              <div className="flex items-center justify-between gap-3">
                <h2 className="text-lg font-bold uppercase">PARTE 5 - FAMILIARES</h2>
                <button type="button" onClick={addFamiliar} className="btn-secondary uppercase">
                  Agregar familiar
                </button>
              </div>

              <div className="space-y-4">
                {familiares.map((familiar, index) => (
                  <article key={index} className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                    <div className="mb-3 flex items-center justify-between">
                      <p className="text-sm font-semibold uppercase text-slate-700">FAMILIAR {index + 1}</p>
                      {familiares.length > 1 ? (
                        <button type="button" onClick={() => removeFamiliar(index)} className="text-sm font-semibold uppercase text-red-700">
                          Eliminar
                        </button>
                      ) : null}
                    </div>
                    <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
                      <Field label="NO DE EMPLEADO" value={empleadoClave} onChange={() => undefined} readOnly />
                      <Field label="NOMBRE DEL FAMILIAR" value={familiar.nombreFamiliar} onChange={(v) => updateFamiliar(index, "nombreFamiliar", v)} />
                      <Field label="PARENTESCO" value={familiar.parentesco} onChange={(v) => updateFamiliar(index, "parentesco", v)} />
                      <Field
                        label="FECHA NACIMIENTO"
                        type="date"
                        value={familiar.fechaNacimiento}
                        onChange={(v) => updateFamiliar(index, "fechaNacimiento", v)}
                      />
                      <SelectField
                        label="BENEFICIARIO BANCARIO"
                        value={familiar.beneficiarioBancario}
                        options={["SI", "NO"]}
                        onChange={(v) => updateFamiliar(index, "beneficiarioBancario", v as "SI" | "NO")}
                      />
                    </div>
                  </article>
                ))}
              </div>
            </section>
          )}
          </fieldset>

          <div className="flex flex-wrap justify-between gap-3 border-t border-slate-200 pt-4">
            <button type="button" className="btn-secondary uppercase" onClick={() => setStep((s) => Math.max(0, s - 1))} disabled={step === 0}>
              Anterior
            </button>
            <div className="flex gap-2">
              <button type="button" className="btn-secondary uppercase">
                Guardar borrador
              </button>
              {step < PARTS.length - 1 ? (
                <button type="button" className="btn-primary uppercase" onClick={() => setStep((s) => Math.min(PARTS.length - 1, s + 1))}>
                  Siguiente
                </button>
              ) : (
                <button type="submit" className="btn-primary uppercase">
                  Finalizar captura
                </button>
              )}
            </div>
          </div>
        </form>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  type = "text",
  className = "",
  readOnly = false,
  inputClassName = "",
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
  className?: string;
  readOnly?: boolean;
  inputClassName?: string;
}) {
  return (
    <label className={`space-y-1 ${className}`}>
      <span className="form-label uppercase">{label}</span>
      <input
        className={`form-control uppercase ${readOnly ? "bg-slate-100 text-slate-500" : ""} ${inputClassName}`.trim()}
        type={type}
        value={value}
        readOnly={readOnly}
        onChange={(e) => onChange(e.target.value)}
      />
    </label>
  );
}

function SelectField({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: string[];
  onChange: (value: string) => void;
}) {
  return (
    <label className="space-y-1">
      <span className="form-label uppercase">{label}</span>
      <select className="form-control uppercase" value={value} onChange={(e) => onChange(e.target.value)}>
        {options.map((opt) => (
          <option key={opt} value={opt}>
            {opt}
          </option>
        ))}
      </select>
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
