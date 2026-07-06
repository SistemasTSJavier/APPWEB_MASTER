"use client";

import { type ChangeEvent, FormEvent, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  findColaboradorCompletoByNo,
  invalidateColaboradoresListCache,
  listColaboradoresCompletos,
  upsertColaboradorCompleto,
  type ColaboradorCompleto,
} from "@/lib/colaboradores-store";
import {
  colaboradorTieneBaja,
  fechaIngresoNormalizadaColaborador,
  parcheFormularioAlCambiarFechaBaja,
} from "@/lib/colaboradores-baja";
import { normalizarFechaParaInputDate } from "@/lib/fecha-input-normalize";
import { edadAniosAlaFecha, textoEdadDesdeExpediente } from "@/lib/edad-desde-nacimiento";
import { generarCsvPlantillaAltas } from "@/lib/altas-csv-import";
import {
  ALTAS_ETIQUETA_PARTE_IMPORT,
  generarCsvPlantillaAltasPorParte,
  importColaboradoresDesdeCsvPorParte,
} from "@/lib/altas-import-partes";
import { downloadCsv } from "@/lib/colaboradores-csv";
import type { AppRole } from "@/lib/app-role";
import { roleMayWriteAltas } from "@/lib/app-role";
import {
  generarPlantillaCorreccionCsvDosColumnas,
} from "@/lib/altas-csv-correccion-dos-columnas";
import { generarPlantillaRenumeracionCsv } from "@/lib/altas-csv-renumeracion";
import {
  findColaboradoresNombreCoincideConBaja,
  fechaBajaNormalizadaColaborador,
  mejorCoincidenciaNombreConBajaPorBajaReciente,
} from "@/lib/altas-coincidencia-nombre";
import {
  familiaresDesdeColaboradorReingreso,
  fechaReingresoSugeridaDesdeExpediente,
  formAltaDesdeColaboradorReingreso,
  resolverExpedientePlantillaReingreso,
} from "@/lib/altas-prefill-reingreso";
import {
  ALTAS_ESTADO_CIVIL_OPCIONES,
  ALTAS_ESTADO_TRAMITE_OPCIONES,
  ALTAS_GESTORES_PROCESO_OPCIONES,
  calcularSiguienteNoEmpleado,
  calcularSiguienteNumeroFolio,
  nombreCompletoDesdePartes,
  normalizarFamiliaresAltaMayusculas,
  normalizarFormularioAltaMayusculas,
  partesNombreDesdeCompleto,
  valorCampoAltaMayusculas,
} from "@/lib/altas-form-catalogo";
import type { CurpPdfParseResult } from "@/lib/curp-pdf-parse";
import { CurpPdfImportModal } from "@/components/altas/CurpPdfImportModal";

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
  const csvRenumeracionRef = useRef<HTMLInputElement>(null);
  const [preserveMoperEnImport, setPreserveMoperEnImport] = useState(true);
  const [csvModo, setCsvModo] = useState<"completo" | "parte">("parte");
  const [csvParteNum, setCsvParteNum] = useState<number>(1);
  const [importCsvBusy, setImportCsvBusy] = useState(false);
  const [importResultado, setImportResultado] = useState<{
    imported: number;
    skippedEmpty: number;
    errors: Array<{ row: number; message: string }>;
    avisos?: Array<{ row: number; message: string }>;
    lotes?: number;
    filasCsvValidas?: number;
    duplicateNosMerged?: number;
    resolvedByNombre?: number;
    origen?: string;
  } | null>(null);
  const [step, setStep] = useState(0);
  const [curpPdfOpen, setCurpPdfOpen] = useState(false);
  const [curpPdfMsg, setCurpPdfMsg] = useState<string | null>(null);
  const [siguienteNoSugerido, setSiguienteNoSugerido] = useState("");
  const [secuenciasCargadas, setSecuenciasCargadas] = useState(false);
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
    noServicio: "",
    planta: "",
    posicion: "",
    localForaneo: "LOCAL",
    numeroFolio: "",
    creditoInfonavit: "",
    escolaridad: "",
    licenciaConducir: "",
    cartaNoAntecedentes: "",
    idiomas: "",
    estatusEmpleado: "ACTIVO",

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
    return userValue || siguienteNoSugerido || "—";
  }, [form.noEmpleado1, siguienteNoSugerido]);

  const [altaMsg, setAltaMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [expedientePrevio, setExpedientePrevio] = useState<ColaboradorCompleto | null>(null);
  const [expedienteBuscando, setExpedienteBuscando] = useState(false);

  /** Cache local del listado para buscar por nombre sin repetir la peticion en cada tecla. */
  const listadoColaboradoresCacheRef = useRef<ColaboradorCompleto[] | null>(null);
  const [coincidenciaNombreBaja, setCoincidenciaNombreBaja] = useState<{
    mejor: ColaboradorCompleto;
    total: number;
  } | null>(null);
  const [nombreCoincidenciaBuscando, setNombreCoincidenciaBuscando] = useState(false);
  const [modoReingreso, setModoReingreso] = useState(false);
  const [expedienteReingresoOrigen, setExpedienteReingresoOrigen] = useState<ColaboradorCompleto | null>(null);
  const prefillReingresoAplicadoRef = useRef<string | null>(null);

  const reingresoObligatorioPorBaja = Boolean(
    expedientePrevio && colaboradorTieneBaja(expedientePrevio),
  );

  const reingresoObligatorioPorNombreDistintoNo = Boolean(
    coincidenciaNombreBaja &&
      form.noEmpleado1.trim().length > 0 &&
      coincidenciaNombreBaja.mejor.noEmpleado.trim().toUpperCase() !== form.noEmpleado1.trim().toUpperCase(),
  );

  const reingresoRequerido = reingresoObligatorioPorBaja || reingresoObligatorioPorNombreDistintoNo;

  const nombreParaCoincidencia = useMemo(
    () =>
      form.nombreCompleto.trim() ||
      nombreCompletoDesdePartes(form.apellidoPaterno, form.apellidoMaterno, form.nombres),
    [form.nombreCompleto, form.apellidoPaterno, form.apellidoMaterno, form.nombres],
  );

  const plantillaReingreso = useMemo(
    () =>
      resolverExpedientePlantillaReingreso(
        expedientePrevio,
        coincidenciaNombreBaja?.mejor ?? null,
        form.noEmpleado1,
      ),
    [expedientePrevio, coincidenciaNombreBaja?.mejor, form.noEmpleado1],
  );

  const [correccionCsvMsg, setCorreccionCsvMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [correccionCsvOmitidos, setCorreccionCsvOmitidos] = useState<string[] | null>(null);
  const [correccionCsvBusy, setCorreccionCsvBusy] = useState(false);
  const [renumeracionCsvMsg, setRenumeracionCsvMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [renumeracionCsvBusy, setRenumeracionCsvBusy] = useState(false);

  useEffect(() => {
    let active = true;
    void (async () => {
      try {
        const list = await listColaboradoresCompletos();
        if (!active) return;
        listadoColaboradoresCacheRef.current = list;
        const nextNo = calcularSiguienteNoEmpleado(list);
        const nextFolio = calcularSiguienteNumeroFolio(list);
        setSiguienteNoSugerido(nextNo);
        setForm((prev) => ({
          ...prev,
          numeroFolio: prev.numeroFolio.trim() ? prev.numeroFolio : nextFolio,
          noEmpleado1: prev.noEmpleado1.trim() ? prev.noEmpleado1 : nextNo,
        }));
        setSecuenciasCargadas(true);
      } catch {
        if (active) setSecuenciasCargadas(true);
      }
    })();
    return () => {
      active = false;
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

  useEffect(() => {
    const nombre = nombreParaCoincidencia;
    if (!nombre) {
      setCoincidenciaNombreBaja(null);
      setNombreCoincidenciaBuscando(false);
      return;
    }
    let active = true;
    setNombreCoincidenciaBuscando(true);
    const timer = setTimeout(async () => {
      try {
        if (!listadoColaboradoresCacheRef.current) {
          listadoColaboradoresCacheRef.current = await listColaboradoresCompletos();
        }
        const list = listadoColaboradoresCacheRef.current;
        if (!active || !list.length) {
          if (active) setCoincidenciaNombreBaja(null);
          return;
        }
        const found = findColaboradoresNombreCoincideConBaja(list, nombre, {
          excludeNoEmpleado: form.noEmpleado1.trim().toUpperCase(),
        });
        const mejor = mejorCoincidenciaNombreConBajaPorBajaReciente(found);
        if (!active) return;
        setCoincidenciaNombreBaja(mejor ? { mejor, total: found.length } : null);
      } catch {
        if (active) setCoincidenciaNombreBaja(null);
      } finally {
        if (active) setNombreCoincidenciaBuscando(false);
      }
    }, 500);
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [nombreParaCoincidencia, form.noEmpleado1]);

  /** Rellena partes 1–5 desde expediente con baja (mismo N.º o coincidencia por nombre); enfoque en REINGRESO. */
  useEffect(() => {
    const fuente = plantillaReingreso;
    if (!fuente) {
      prefillReingresoAplicadoRef.current = null;
      setModoReingreso(false);
      setExpedienteReingresoOrigen(null);
      return;
    }
    const key = fuente.noEmpleado.trim().toUpperCase();
    if (prefillReingresoAplicadoRef.current === key) return;
    prefillReingresoAplicadoRef.current = key;

    const reingSug = fechaReingresoSugeridaDesdeExpediente(fuente);

    setForm((prev) => {
      const merged = formAltaDesdeColaboradorReingreso(fuente, {
        noEmpleadoCapturado: prev.noEmpleado1,
        numeroFolioActual: prev.numeroFolio,
      });
      const noKeep = prev.noEmpleado1.trim().toUpperCase();
      const folioKeep = prev.numeroFolio.trim() || merged.numeroFolio || "";
      const reing = prev.reingreso.trim() || reingSug || "";
      return {
        ...prev,
        ...merged,
        noEmpleado1: noKeep,
        numeroFolio: folioKeep,
        reingreso: reing,
        fechaBaja: "",
      };
    });
    setFamiliares(familiaresDesdeColaboradorReingreso(fuente));
    setModoReingreso(true);
    setExpedienteReingresoOrigen(fuente);
  }, [plantillaReingreso]);

  function updateField(name: string, value: string, inputType?: string) {
    setForm((prev) => {
      const v = valorCampoAltaMayusculas(name, value, inputType);
      let next = { ...prev, [name]: v };

      if (name === "fechaNacimiento") {
        const fn = normalizarFechaParaInputDate(v.trim());
        const ed = fn ? edadAniosAlaFecha(fn) : null;
        next.edad = ed != null ? String(ed) : "";
      }

      if (name === "nombreCompleto") {
        const partes = partesNombreDesdeCompleto(v);
        next = {
          ...next,
          apellidoPaterno: valorCampoAltaMayusculas("apellidoPaterno", partes.apellidoPaterno),
          apellidoMaterno: valorCampoAltaMayusculas("apellidoMaterno", partes.apellidoMaterno),
          nombres: valorCampoAltaMayusculas("nombres", partes.nombres),
        };
      }

      if (name === "apellidoPaterno" || name === "apellidoMaterno" || name === "nombres") {
        const nc = nombreCompletoDesdePartes(next.apellidoPaterno, next.apellidoMaterno, next.nombres);
        if (nc) next.nombreCompleto = valorCampoAltaMayusculas("nombreCompleto", nc);
      }

      if (name === "fechaBaja") {
        const parche = parcheFormularioAlCambiarFechaBaja(v);
        next = { ...next, ...parche };
      }

      return next;
    });
  }

  function aplicarCurpDesdePdf(result: CurpPdfParseResult) {
    setForm((prev) => {
      let next = { ...prev, curp: valorCampoAltaMayusculas("curp", result.curp) };
      if (result.nombreCompleto.trim()) {
        const nc = valorCampoAltaMayusculas("nombreCompleto", result.nombreCompleto);
        const partes = partesNombreDesdeCompleto(nc);
        next = {
          ...next,
          nombreCompleto: nc,
          apellidoPaterno: valorCampoAltaMayusculas("apellidoPaterno", partes.apellidoPaterno),
          apellidoMaterno: valorCampoAltaMayusculas("apellidoMaterno", partes.apellidoMaterno),
          nombres: valorCampoAltaMayusculas("nombres", partes.nombres),
        };
      }
      if (result.fechaNacimiento && !prev.fechaNacimiento.trim()) {
        const fn = normalizarFechaParaInputDate(result.fechaNacimiento);
        const ed = fn ? edadAniosAlaFecha(fn) : null;
        next = {
          ...next,
          fechaNacimiento: fn,
          edad: ed != null ? String(ed) : "",
        };
      }
      if (result.estadoNatal && !prev.estadoNatal.trim()) {
        next.estadoNatal = valorCampoAltaMayusculas("estadoNatal", result.estadoNatal);
      }
      return next;
    });
    const extras: string[] = ["nombre completo"];
    if (result.fechaNacimiento) extras.push("fecha de nacimiento");
    if (result.estadoNatal) extras.push("estado natal");
    setCurpPdfMsg(`PDF leído: CURP ${result.curp} y ${extras.join(", ")}.`);
  }

  function addFamiliar() {
    setFamiliares((prev) => [...prev, { nombreFamiliar: "", parentesco: "", fechaNacimiento: "", beneficiarioBancario: "NO" }]);
  }

  function removeFamiliar(index: number) {
    setFamiliares((prev) => prev.filter((_, i) => i !== index));
  }

  function updateFamiliar(index: number, key: keyof Familiar, value: string, inputType?: string) {
    const v =
      key === "fechaNacimiento" || key === "beneficiarioBancario"
        ? value
        : valorCampoAltaMayusculas(key, value, inputType);
    setFamiliares((prev) => prev.map((f, i) => (i === index ? { ...f, [key]: v } : f)));
  }

  async function submitAll(e: FormEvent) {
    e.preventDefault();
    setAltaMsg(null);
    if (!puedeEditarAltas) {
      setAltaMsg({ ok: false, text: "SOLO EL PERFIL ADMINISTRADOR PUEDE GUARDAR O ACTUALIZAR DESDE ALTAS." });
      return;
    }
    const noManual = form.noEmpleado1.trim();
    const noFinal = (noManual || siguienteNoSugerido).toUpperCase();
    if (!noFinal || noFinal === "—") {
      setAltaMsg({ ok: false, text: "NO HAY SECUENCIA DE EMPLEADO DISPONIBLE. ESPERE A CARGAR O CAPTURE EL N.º MANUALMENTE." });
      return;
    }
    const reingNorm = normalizarFechaParaInputDate(form.reingreso.trim());
    let expedientePrevioGuardar: ColaboradorCompleto | null = null;
    try {
        expedientePrevioGuardar = await findColaboradorCompletoByNo(noFinal);
        const prev = expedientePrevioGuardar;
        const needReingresoPorNumero = Boolean(prev && colaboradorTieneBaja(prev));
        const needReingresoPorNombre = Boolean(
          coincidenciaNombreBaja &&
            coincidenciaNombreBaja.mejor.noEmpleado.trim().toUpperCase() !== noFinal.trim().toUpperCase(),
        );
        if ((needReingresoPorNumero || needReingresoPorNombre) && !reingNorm) {
          setStep(0);
          const partes: string[] = [];
          if (needReingresoPorNumero) partes.push("ESTE NUMERO YA TIENE EXPEDIENTE CON FECHA DE BAJA");
          if (needReingresoPorNombre) {
            partes.push(
              `HAY OTRO EXPEDIENTE CON EL MISMO NOMBRE Y BAJA (N° ${coincidenciaNombreBaja!.mejor.noEmpleado.trim()}): USA LA FECHA DE REINGRESO`,
            );
          }
          setAltaMsg({
            ok: false,
            text: `${partes.join(". ")}. CAPTURA LA FECHA DE REINGRESO EN PARTE 1 ANTES DE GUARDAR.`,
          });
          return;
        }
    } catch {
      setAltaMsg({ ok: false, text: "NO SE PUDO VERIFICAR SI EL EMPLEADO YA EXISTE. REVISA CONEXION E INTENTA DE NUEVO." });
      return;
    }
    const flatForm = normalizarFormularioAltaMayusculas(
      Object.fromEntries(Object.entries(form).map(([k, v]) => [k, String(v ?? "")])),
    );
    flatForm.noEmpleado1 = noFinal;
    const fnNorm = normalizarFechaParaInputDate(flatForm.fechaNacimiento?.trim() ?? "");
    const edadCalc = fnNorm ? edadAniosAlaFecha(fnNorm) : null;
    if (edadCalc != null) flatForm.edad = String(edadCalc);

    const nombreGuardar =
      flatForm.nombreCompleto.trim() ||
      nombreCompletoDesdePartes(flatForm.apellidoPaterno, flatForm.apellidoMaterno, flatForm.nombres);
    flatForm.nombreCompleto = nombreGuardar;

    const servicioAlta = flatForm.servicio.trim();

    const familiaresNorm = normalizarFamiliaresAltaMayusculas(familiares);

    const formExpediente = expedientePrevioGuardar
      ? { ...expedientePrevioGuardar.form, ...flatForm }
      : { ...flatForm, estatusEmpleado: flatForm.estatusEmpleado ?? "ACTIVO" };

    try {
      await upsertColaboradorCompleto({
        noEmpleado: noFinal,
        nombreCompleto: nombreGuardar,
        fechaIngreso: flatForm.fechaIngreso,
        servicioAsignado: flatForm.servicio,
        ultimoServicio: expedientePrevioGuardar?.ultimoServicio ?? "",
        nss: flatForm.imss,
        posicion: flatForm.posicion,
        puesto: flatForm.puesto,
        moperActual: expedientePrevioGuardar?.moperActual ?? {
          servicio: servicioAlta,
          puesto: flatForm.puesto.trim(),
        },
        registeredAt: expedientePrevioGuardar?.registeredAt ?? new Date().toISOString(),
        form: formExpediente,
        familiares: familiaresNorm.map((f) => ({
          nombreFamiliar: f.nombreFamiliar,
          parentesco: f.parentesco,
          fechaNacimiento: f.fechaNacimiento,
          beneficiarioBancario: f.beneficiarioBancario,
        })),
      });
      listadoColaboradoresCacheRef.current = null;
      invalidateColaboradoresListCache();
      try {
        const list = await listColaboradoresCompletos({ forceRefresh: true });
        listadoColaboradoresCacheRef.current = list;
        const nextNo = calcularSiguienteNoEmpleado(list);
        setSiguienteNoSugerido(nextNo);
        setForm((prev) => ({
          ...prev,
          numeroFolio: calcularSiguienteNumeroFolio(list),
          noEmpleado1: nextNo,
          servicio: "",
          noServicio: "",
          planta: "",
          posicion: "",
        }));
      } catch {
        setSiguienteNoSugerido((prev) => {
          const n = Number.parseInt(prev, 10);
          return Number.isFinite(n) ? String(n + 1) : prev;
        });
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
        errors: [{ row: 0, message: "LA IMPORTACION CSV SOLO LA PUEDE EJECUTAR UN ADMINISTRADOR O AUX RH." }],
      });
      return;
    }
    setImportResultado(null);
    setImportCsvBusy(true);
    try {
      const text = await file.text();
      if (csvModo === "completo") {
        const r = await fetch("/api/colaboradores/import-csv-masivo", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            csvText: text,
            preserveMoper: preserveMoperEnImport,
            mergeExisting: true,
          }),
        });
        const rawBody = await r.text();
        const contentType = r.headers.get("content-type") ?? "";
        if (contentType.includes("text/html")) {
          throw new Error(
            "LA RUTA API NO RESPONDE (404 HTML). REINICIA npm run dev EN LA CARPETA web.",
          );
        }
        let j: {
          error?: string;
          imported?: number;
          skippedEmpty?: number;
          lotes?: number;
          filasCsvValidas?: number;
          duplicateNosMerged?: number;
          resolvedByNombre?: number;
          avisos?: Array<{ row: number; message: string }>;
          errors?: Array<{ row: number; message: string }>;
        } = {};
        try {
          j = JSON.parse(rawBody || "{}") as typeof j;
        } catch {
          j = {};
        }
        if (!r.ok) {
          throw new Error(j.error ?? `Error ${r.status}`);
        }
        listadoColaboradoresCacheRef.current = null;
      invalidateColaboradoresListCache();
        setImportResultado({
          imported: Number(j.imported ?? 0),
          skippedEmpty: Number(j.skippedEmpty ?? 0),
          errors: Array.isArray(j.errors) ? j.errors : [],
          avisos: Array.isArray(j.avisos) ? j.avisos : [],
          lotes: Number(j.lotes ?? 0),
          filasCsvValidas: Number(j.filasCsvValidas ?? 0),
          duplicateNosMerged: Number(j.duplicateNosMerged ?? 0),
          resolvedByNombre: Number(j.resolvedByNombre ?? 0),
          origen: "IMPORTACION TODO-EN-UNO (SERVIDOR, POR LOTES)",
        });
        try {
          const list = await listColaboradoresCompletos({ forceRefresh: true });
          listadoColaboradoresCacheRef.current = list;
          setSiguienteNoSugerido(calcularSiguienteNoEmpleado(list));
        } catch {
          /* listado opcional tras import */
        }
      } else {
        const res = await importColaboradoresDesdeCsvPorParte(text, csvParteNum, {
          preserveMoper: preserveMoperEnImport,
        });
        listadoColaboradoresCacheRef.current = null;
      invalidateColaboradoresListCache();
        setImportResultado({
          imported: res.imported,
          skippedEmpty: res.skippedEmpty,
          errors: res.errors,
          origen: ALTAS_ETIQUETA_PARTE_IMPORT[csvParteNum] ?? `PARTE ${csvParteNum}`,
        });
        try {
          const list = await listColaboradoresCompletos({ forceRefresh: true });
          listadoColaboradoresCacheRef.current = list;
          setSiguienteNoSugerido(calcularSiguienteNoEmpleado(list));
        } catch {
          /* listado opcional */
        }
      }
    } catch (err) {
      setImportResultado({
        imported: 0,
        skippedEmpty: 0,
        errors: [{ row: 0, message: `ERROR AL IMPORTAR: ${err instanceof Error ? err.message : String(err)}` }],
      });
    } finally {
      setImportCsvBusy(false);
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
    setCorreccionCsvOmitidos(null);
    setCorreccionCsvBusy(true);
    try {
      const text = await file.text();
      const r = await fetch("/api/colaboradores/import-correccion-dos-columnas", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ csvText: text }),
      });
      const rawBody = await r.text();
      const contentType = r.headers.get("content-type") ?? "";
      if (contentType.includes("text/html")) {
        throw new Error(
          "LA RUTA API NO RESPONDE (404 HTML). REINICIA npm run dev EN LA CARPETA web.",
        );
      }
      let j: {
        error?: string;
        ok?: boolean;
        fieldKey?: string;
        actualizados?: number;
        sinExpediente?: number;
        omitidosSinExpediente?: string[];
        avisos?: string[];
      } = {};
      try {
        j = JSON.parse(rawBody || "{}") as typeof j;
      } catch {
        j = {};
      }
      if (!r.ok) {
        throw new Error(j.error ?? `Error ${r.status}`);
      }
      listadoColaboradoresCacheRef.current = null;
      invalidateColaboradoresListCache();
      const campo = String(j.fieldKey ?? "");
      const ok = Number(j.actualizados ?? 0);
      const sinExp = Number(j.sinExpediente ?? 0);
      const omitidos = Array.isArray(j.omitidosSinExpediente)
        ? j.omitidosSinExpediente.map((n) => String(n).trim()).filter(Boolean)
        : [];
      setCorreccionCsvOmitidos(omitidos.length > 0 ? omitidos : null);
      const rowErrs = Array.isArray(j.avisos) ? j.avisos : [];
      const base =
        ok > 0
          ? `CAMPO "${campo}": ${ok} EXPEDIENTE(S) ACTUALIZADO(S).${
              sinExp > 0 ? ` ${sinExp} FILA(S) SIN EXPEDIENTE (NO SE MODIFICARON).` : ""
            }`
          : `NINGUN EXPEDIENTE ACTUALIZADO PARA "${campo}".${
              sinExp > 0
                ? ` ${sinExp} N° NO COINCIDEN CON EXPEDIENTE (REVISE CLAVE Y QUE EXCEL NO CAMBIE EL N° A 12345.0).`
                : " REVISE CABECERAS (NO_DE_EMPLEADO + CAMPO) Y QUE HAYA VALOR EN LA SEGUNDA COLUMNA."
            }`;
      if (rowErrs.length === 0) {
        setCorreccionCsvMsg({ ok: ok > 0, text: base });
      } else {
        const slice = rowErrs.slice(0, 15);
        const more = rowErrs.length > 15 ? ` …(+${rowErrs.length - 15} MAS)` : "";
        setCorreccionCsvMsg({
          ok: ok > 0,
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

  async function handleRenumeracionCsv(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (!puedeEditarAltas) {
      setRenumeracionCsvMsg({ ok: false, text: "LA RENUMERACION SOLO LA PUEDE EJECUTAR UN ADMINISTRADOR." });
      return;
    }
    setRenumeracionCsvMsg(null);
    setRenumeracionCsvBusy(true);
    try {
      const text = await file.text();
      const r = await fetch("/api/colaboradores/import-renumeracion-csv", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ csvText: text }),
      });
      const rawBody = await r.text();
      const contentType = r.headers.get("content-type") ?? "";
      if (contentType.includes("text/html")) {
        throw new Error(
          "LA RUTA API NO RESPONDE (404 HTML). REINICIA npm run dev EN LA CARPETA web.",
        );
      }
      let j: { error?: string; ok?: boolean; renumerados?: number; avisos?: string[] } = {};
      try {
        j = JSON.parse(rawBody || "{}") as typeof j;
      } catch {
        j = {};
      }
      if (!r.ok) {
        throw new Error(j.error ?? `Error ${r.status}`);
      }
      listadoColaboradoresCacheRef.current = null;
      invalidateColaboradoresListCache();
      const n = Number(j.renumerados ?? 0);
      const avisos = Array.isArray(j.avisos) ? j.avisos : [];
      const base = `${n} EXPEDIENTE(S) RENUMERADO(S).`;
      if (avisos.length === 0) {
        setRenumeracionCsvMsg({ ok: true, text: base });
      } else {
        const slice = avisos.slice(0, 15);
        const more = avisos.length > 15 ? ` …(+${avisos.length - 15} MAS)` : "";
        setRenumeracionCsvMsg({
          ok: n > 0,
          text: `${base} AVISOS: ${slice.join(" | ")}${more}`,
        });
      }
    } catch (err) {
      setRenumeracionCsvMsg({
        ok: false,
        text: err instanceof Error ? err.message : `ERROR AL LEER EL ARCHIVO: ${String(err)}`,
      });
    } finally {
      setRenumeracionCsvBusy(false);
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
                CSV de correccion (2 columnas) y, aparte, renumeracion por nombre (otro boton).
              </p>
            ) : null}
          </div>
          <span className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700">{progress}</span>
        </div>

        {puedeEditarAltas ? (
          <details className="card mb-4 border-2 border-blue-900/25 bg-gradient-to-br from-blue-50 to-slate-50 open:pb-4">
            <summary className="cursor-pointer list-none px-4 py-4 sm:px-5 [&::-webkit-details-marker]:hidden">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h2 className="text-base font-bold uppercase text-slate-900">Administrador: importaciones CSV rapidas</h2>
                <span className="text-xs font-bold uppercase text-blue-900">Mostrar / ocultar</span>
              </div>
              <p className="mt-2 text-sm font-medium text-slate-800">
                Correccion de un campo o renumeracion por nombre — cada una con su plantilla.
              </p>
            </summary>
            <div className="space-y-4 border-t border-blue-200/80 px-4 pt-4 sm:px-5">
            <h3 className="text-sm font-bold uppercase text-slate-900">1 · Corregir un dato (2 columnas)</h3>
            <p className="text-sm font-medium text-slate-800">
              Columna 1: <code className="rounded bg-white px-1">no_de_empleado</code> (N° actual). Columna 2: el campo a corregir (ej.{" "}
              <code className="rounded bg-white px-1">curp</code>, <code className="rounded bg-white px-1">servicio</code>,{" "}
              <code className="rounded bg-white px-1">planta</code>, <code className="rounded bg-white px-1">estado_civil</code>).{" "}
              <strong>No</strong> sirve para cambiar el numero de empleado. En Excel guarde como CSV UTF-8 (separador{" "}
              <code className="rounded bg-white px-1">;</code> en Mexico); si el N° aparece como <code className="rounded bg-white px-1">12345.0</code>, el
              sistema lo corrige.
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
                {correccionCsvBusy ? "Procesando…" : "Importar correccion (N° + 1 campo)"}
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
            {correccionCsvOmitidos && correccionCsvOmitidos.length > 0 ? (
              <div className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-3 text-sm text-amber-950">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="font-bold uppercase">
                    N° omitidos (sin expediente): {correccionCsvOmitidos.length}
                  </p>
                  <button
                    type="button"
                    className="rounded border border-amber-600 bg-white px-2 py-1 text-xs font-bold uppercase text-amber-900 hover:bg-amber-100"
                    onClick={() =>
                      downloadCsv(
                        "omitidos_sin_expediente.csv",
                        `\uFEFFno_de_empleado\n${correccionCsvOmitidos.join("\n")}\n`,
                      )
                    }
                  >
                    Descargar lista CSV
                  </button>
                </div>
                <pre className="mt-2 max-h-48 overflow-auto rounded border border-amber-200 bg-white p-2 font-mono text-xs leading-relaxed text-slate-800">
                  {correccionCsvOmitidos.slice(0, 150).join("\n")}
                  {correccionCsvOmitidos.length > 150
                    ? `\n… (+${correccionCsvOmitidos.length - 150} más; use Descargar lista CSV)`
                    : ""}
                </pre>
              </div>
            ) : null}
            <div className="border-t border-slate-300 pt-4">
              <h3 className="text-sm font-bold uppercase text-slate-900">2 · Renumerar N° de empleado</h3>
              <p className="mt-1 text-sm font-medium text-slate-800">
                Columna 1: <code className="rounded bg-white px-1">nombre_completo</code> (el sistema busca al colaborador por
                nombre). Columna 2: <code className="rounded bg-white px-1">no_nuevo</code> (numero definitivo). Usa el boton de
                abajo, <strong>no</strong> el de correccion de arriba.
              </p>
              <input
                ref={csvRenumeracionRef}
                type="file"
                accept=".csv,text/csv"
                className="sr-only"
                onChange={handleRenumeracionCsv}
              />
              <div className="mt-3 flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  className="btn-primary uppercase"
                  disabled={renumeracionCsvBusy}
                  onClick={() => csvRenumeracionRef.current?.click()}
                >
                  {renumeracionCsvBusy ? "Procesando…" : "Importar renumeracion (nombre + N° nuevo)"}
                </button>
                <button
                  type="button"
                  className="btn-secondary uppercase"
                  onClick={() =>
                    downloadCsv("plantilla_renumeracion_no_empleado.csv", generarPlantillaRenumeracionCsv())
                  }
                >
                  Descargar plantilla
                </button>
              </div>
              {renumeracionCsvMsg ? (
                <p
                  className={`mt-3 rounded-lg px-3 py-2 text-sm font-bold uppercase ${
                    renumeracionCsvMsg.ok
                      ? "border border-green-200 bg-green-50 text-green-900"
                      : "border border-red-200 bg-red-50 text-red-900"
                  }`}
                >
                  {renumeracionCsvMsg.text}
                </p>
              ) : null}
            </div>
            </div>
          </details>
        ) : null}

        <details
          className={`card mb-4 space-y-3 ${!puedeEditarAltas ? "pointer-events-none opacity-50" : ""}`}
          open={puedeEditarAltas}
        >
          <summary className="cursor-pointer list-none px-4 py-3 sm:px-5 [&::-webkit-details-marker]:hidden">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-sm font-bold uppercase text-slate-800">Importacion masiva CSV</h2>
              <span className="text-xs font-bold uppercase text-slate-500">Mostrar / ocultar</span>
            </div>
          </summary>
          <div className="space-y-3 border-t border-slate-200 px-4 pb-4 pt-3 sm:px-5">
          <p className="rounded-lg border border-sky-200 bg-sky-50 px-3 py-2 text-xs leading-relaxed text-sky-950">
            En <strong>Parte 1</strong>, servicio, planta y posición se capturan de forma manual en el formulario o en el CSV masivo.
          </p>
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
              Un CSV con muchas columnas a la vez (hasta <strong className="text-slate-800">2000 filas</strong>). Se procesa en el{" "}
              <strong className="text-slate-800">servidor por lotes</strong> (no fila por fila en el navegador). Minimo por fila:{" "}
              <strong className="text-slate-800">NO_EMPLEADO</strong> y nombre. Tambien columnas <strong className="text-slate-800">FORM_*</strong> como en
              COLABORADORES. Familiares en formato <strong className="text-slate-800">PADRE, MADRE, PAREJA, HIJO1…</strong> cuando la fila trae datos en esas celdas.
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
              Conservar MOPER (si la fila no trae ULTIMO_SERVICIO / PUESTO operativo, no se cambia la línea MOPER vigente)
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
            <button
              type="button"
              className="btn-primary uppercase disabled:cursor-not-allowed disabled:opacity-60"
              disabled={importCsvBusy}
              onClick={() => csvInputRef.current?.click()}
            >
              {importCsvBusy
                ? "Importando… (no cierres esta pestaña)"
                : csvModo === "parte"
                  ? `Importar archivo PARTE ${csvParteNum}`
                  : "Importar colaboradores desde CSV"}
            </button>
          </div>
          {importCsvBusy ? (
            <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-semibold uppercase text-amber-950">
              Procesando archivo… {csvModo === "completo" ? "puede tardar 1–3 min con cientos de filas." : "guardando por lotes."}
            </p>
          ) : null}
          {importResultado ? (
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm">
              <p className="text-[11px] font-medium uppercase tracking-wide text-slate-600">
                {importResultado.origen ?? ""}
              </p>
              <p className="font-semibold uppercase text-slate-800">
                Resultado: <span className="text-green-800">{importResultado.imported} importado(s)</span>
                {importResultado.filasCsvValidas != null && importResultado.filasCsvValidas > 0 ? (
                  <span className="text-slate-600"> — {importResultado.filasCsvValidas} fila(s) validas en CSV</span>
                ) : null}
                {importResultado.skippedEmpty > 0 ? (
                  <span className="text-slate-600"> — {importResultado.skippedEmpty} fila(s) vacia(s)</span>
                ) : null}
                {importResultado.lotes != null && importResultado.lotes > 0 ? (
                  <span className="text-slate-600"> — {importResultado.lotes} lote(s) en servidor</span>
                ) : null}
                {importResultado.duplicateNosMerged != null && importResultado.duplicateNosMerged > 0 ? (
                  <span className="text-slate-600"> — {importResultado.duplicateNosMerged} duplicado(s) unificados</span>
                ) : null}
              </p>
              {importResultado.avisos && importResultado.avisos.length > 0 ? (
                <div className="mt-2 max-h-32 overflow-auto border-t border-slate-200 pt-2">
                  <p className="text-xs font-bold uppercase text-sky-900">{importResultado.avisos.length} aviso(s):</p>
                  <ul className="mt-1 list-inside list-disc text-xs text-sky-950">
                    {importResultado.avisos.slice(0, 15).map((av, i) => (
                      <li key={i}>
                        Fila {av.row}: {av.message}
                      </li>
                    ))}
                    {importResultado.avisos.length > 15 ? (
                      <li className="font-semibold">…y {importResultado.avisos.length - 15} mas.</li>
                    ) : null}
                  </ul>
                </div>
              ) : null}
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
          </div>
        </details>

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
          {modoReingreso && expedienteReingresoOrigen ? (
            <div className="rounded-lg border-2 border-emerald-600 bg-emerald-50 px-3 py-3 text-sm uppercase leading-snug text-emerald-950">
              <p className="font-bold">Reingreso: datos del expediente anterior cargados</p>
              <p className="mt-2 text-xs font-medium text-emerald-900">
                Origen: expediente <strong>N° {expedienteReingresoOrigen.noEmpleado.trim()}</strong>
                {(expedienteReingresoOrigen.nombreCompleto ?? "").trim() ? (
                  <span>
                    {" "}
                    — <strong>{(expedienteReingresoOrigen.nombreCompleto ?? "").trim()}</strong>
                  </span>
                ) : null}
                . Revise las <strong>partes 1 a 5</strong>; confirme o corrija <strong>REINGRESO</strong> y actualice cualquier dato que
                haya cambiado. El N.º de empleado y folio de este alta siguen siendo los de la nueva captura.
              </p>
            </div>
          ) : null}
          <fieldset disabled={!puedeEditarAltas} className="min-w-0 space-y-6 border-0 p-0">
          {step === 0 && (
            <section className="space-y-4">
              <h2 className="text-lg font-bold uppercase">PARTE 1 - DATOS GENERALES</h2>
              <p className="text-sm font-medium uppercase text-slate-500">
                CLAVE ACTUAL: <span className="font-bold text-slate-800">{empleadoClave}</span>
                {!form.noEmpleado1.trim() && siguienteNoSugerido ? (
                  <span> (SIGUIENTE EN SECUENCIA: {siguienteNoSugerido})</span>
                ) : null}
                {!secuenciasCargadas ? <span className="text-slate-400"> — Cargando secuencias…</span> : null}
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
                        {modoReingreso ? (
                          <p className="mt-1 text-xs font-bold text-amber-950">
                            Los campos de todas las partes se rellenaron con ese expediente; edite lo necesario.
                          </p>
                        ) : null}
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
                <Field
                  label="NO DE EMPLEADO"
                  value={form.noEmpleado1}
                  placeholder={siguienteNoSugerido}
                  hint="Consecutivo del último alta registrado (+1); editable"
                  onChange={(v) => updateField("noEmpleado1", v)}
                />
                <Field
                  label="FECHA DE INGRESO"
                  type="date"
                  value={form.fechaIngreso}
                  onChange={(v) => updateField("fechaIngreso", v, "date")}
                />
                <div className="space-y-1">
                  <Field
                    label="FECHA DE BAJA"
                    type="date"
                    value={form.fechaBaja}
                    onChange={(v) => updateField("fechaBaja", v, "date")}
                  />
                  <p className="text-[10px] font-medium text-slate-600">
                    Si la quitas por error, el estatus en pantalla pasa a <strong>ACTIVO</strong> y se guarda así al confirmar el
                    expediente.
                  </p>
                </div>
                <SelectField
                  label="ENVIO"
                  value={form.envio}
                  options={[...ALTAS_ESTADO_TRAMITE_OPCIONES]}
                  allowEmpty
                  onChange={(v) => updateField("envio", v)}
                />
                <SelectField
                  label="REYNA"
                  value={form.reyna}
                  options={[...ALTAS_ESTADO_TRAMITE_OPCIONES]}
                  allowEmpty
                  onChange={(v) => updateField("reyna", v)}
                />
                <div className="space-y-1">
                  <div className="flex flex-wrap items-end gap-2">
                    <div className="min-w-0 flex-1">
                      <Field
                        label="REINGRESO"
                        type="date"
                        value={form.reingreso}
                        onChange={(v) => updateField("reingreso", v, "date")}
                        inputClassName={reingresoRequerido ? "ring-2 ring-amber-500" : ""}
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
                    {coincidenciaNombreBaja ? (
                      <button
                        type="button"
                        className="btn-secondary mb-[2px] shrink-0 px-2 py-2 text-[10px] font-bold uppercase"
                        onClick={() => {
                          const n = fechaBajaNormalizadaColaborador(coincidenciaNombreBaja.mejor);
                          if (n) updateField("reingreso", n);
                        }}
                      >
                        Baja (coincidencia)
                      </button>
                    ) : null}
                  </div>
                  {reingresoRequerido ? (
                    <p className="text-[10px] font-bold uppercase text-amber-800">
                      {reingresoObligatorioPorBaja ? "Obligatorio: expediente con este numero tiene fecha de baja." : null}
                      {reingresoObligatorioPorNombreDistintoNo ? (
                        <span>
                          {reingresoObligatorioPorBaja ? " " : ""}
                          Obligatorio: mismo nombre que otro expediente con baja (N° de empleado distinto).
                        </span>
                      ) : null}
                    </p>
                  ) : (
                    <p className="text-[10px] font-medium uppercase text-slate-500">Si ya hubo alta y baja, usa la fecha de reingreso laboral.</p>
                  )}
                </div>
                <Field
                  label="NOMBRE COMPLETO"
                  value={form.nombreCompleto}
                  hint="Sugerido: APELLIDO PATERNO APELLIDO MATERNO NOMBRE(S) — sincroniza Parte 2"
                  onChange={(v) => updateField("nombreCompleto", v)}
                />
                {nombreCoincidenciaBuscando ? (
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 md:col-span-2 lg:col-span-3">
                    Buscando coincidencia por nombre en expedientes…
                  </p>
                ) : null}
                {coincidenciaNombreBaja ? (
                  <div className="rounded-lg border-2 border-amber-400 bg-amber-50/95 px-3 py-3 text-sm uppercase leading-snug text-amber-950 md:col-span-2 lg:col-span-3">
                    <p className="font-bold">Coincidencia por nombre (otro expediente con baja)</p>
                    <p className="mt-2 text-xs font-medium text-amber-900">
                      Expediente <strong>N° {coincidenciaNombreBaja.mejor.noEmpleado.trim()}</strong>
                      {coincidenciaNombreBaja.total > 1 ? (
                        <span>
                          {" "}
                          — {coincidenciaNombreBaja.total} registros con el mismo nombre; se toma la <strong>baja mas reciente</strong>.
                        </span>
                      ) : null}
                      . Fecha de baja en ese expediente:{" "}
                      <strong className="font-mono">
                        {fechaBajaNormalizadaColaborador(coincidenciaNombreBaja.mejor) ||
                          String(coincidenciaNombreBaja.mejor.form?.fechaBaja ?? "").trim() ||
                          "—"}
                      </strong>
                      . {modoReingreso ? (
                        <span>
                          Se cargaron los datos de ese expediente en el formulario; revise <strong>REINGRESO</strong> y el resto de partes.
                        </span>
                      ) : (
                        <span>
                          Al confirmar el nombre se cargan los datos previos; <strong>REINGRESO</strong> se sugiere con la fecha de baja si estaba vacio.
                        </span>
                      )}
                    </p>
                  </div>
                ) : null}
                <Field label="PUESTO" value={form.puesto} onChange={(v) => updateField("puesto", v)} />

                <Field label="SERVICIO" value={form.servicio} onChange={(v) => updateField("servicio", v)} />
                <Field label="N.º SERVICIO" value={form.noServicio} onChange={(v) => updateField("noServicio", v)} />
                <Field label="PLANTA" value={form.planta} onChange={(v) => updateField("planta", v)} />
                <Field label="POSICIÓN" value={form.posicion} onChange={(v) => updateField("posicion", v)} />
                <SelectField
                  label="LOCAL/FORANEO"
                  value={form.localForaneo}
                  options={["LOCAL", "FORANEO"]}
                  onChange={(v) => updateField("localForaneo", v)}
                />
                <Field
                  label="NUMERO DE EXPEDIENTE"
                  value={form.numeroFolio}
                  hint="Formato SPT/T-9167/PE — consecutivo al último registrado"
                  onChange={(v) => updateField("numeroFolio", v)}
                />
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
              <p className="text-xs font-medium uppercase text-slate-500">
                Apellidos, nombres y N.º de empleado se sincronizan con la PARTE 1 (nombre completo y clave).
              </p>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                <Field label="NO DE EMPLEADO" value={empleadoClave} onChange={() => undefined} readOnly />
                <Field label="APELLIDO PATERNO" value={form.apellidoPaterno} onChange={(v) => updateField("apellidoPaterno", v)} />
                <Field label="APELLIDO MATERNO" value={form.apellidoMaterno} onChange={(v) => updateField("apellidoMaterno", v)} />
                <Field label="NOMBRE(S)" value={form.nombres} onChange={(v) => updateField("nombres", v)} />
                <Field
                  label="FECHA DE NACIMIENTO"
                  type="date"
                  value={form.fechaNacimiento}
                  onChange={(v) => updateField("fechaNacimiento", v, "date")}
                />
                <Field
                  label="EDAD (AL DÍA DE HOY)"
                  value={textoEdadDesdeExpediente(form.fechaNacimiento, form.edad)}
                  onChange={() => {}}
                  readOnly
                />
                <SelectField
                  label="ESTADO CIVIL"
                  value={form.estadoCivil}
                  options={[...ALTAS_ESTADO_CIVIL_OPCIONES]}
                  allowEmpty
                  onChange={(v) => updateField("estadoCivil", v)}
                />
                <label className="space-y-1">
                  <span className="form-label uppercase">CURP</span>
                  <div className="flex gap-2">
                    <input
                      className="form-control min-w-0 flex-1 uppercase"
                      value={form.curp}
                      onChange={(e) => updateField("curp", e.target.value)}
                      placeholder="18 CARACTERES"
                      readOnly={!puedeEditarAltas}
                    />
                    {puedeEditarAltas ? (
                      <button
                        type="button"
                        className="shrink-0 rounded-lg border border-violet-300 bg-violet-50 px-3 py-2 text-xs font-bold uppercase text-violet-900 hover:bg-violet-100"
                        onClick={() => {
                          setCurpPdfMsg(null);
                          setCurpPdfOpen(true);
                        }}
                        title="Leer PDF de constancia CURP (gob.mx)"
                      >
                        PDF
                      </button>
                    ) : null}
                  </div>
                  {curpPdfMsg ? (
                    <span className="text-[10px] font-medium uppercase text-emerald-700">{curpPdfMsg}</span>
                  ) : (
                    <span className="text-[10px] font-medium uppercase text-slate-500">
                      Suba el PDF oficial de la constancia CURP para llenar CURP y nombre
                    </span>
                  )}
                </label>
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
                <Field
                  label="SUELDO MENSUAL"
                  type="number"
                  value={form.sueldoMensual}
                  onChange={(v) => updateField("sueldoMensual", v, "number")}
                />
                <Field label="FUENTE DE RECLUTAMIENTO" value={form.fuenteReclutamiento} onChange={(v) => updateField("fuenteReclutamiento", v)} />
                <SelectField
                  label="GESTOR DEL PROCESO"
                  value={form.gestorProceso}
                  options={[...ALTAS_GESTORES_PROCESO_OPCIONES]}
                  allowEmpty
                  onChange={(v) => updateField("gestorProceso", v)}
                />
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
                        onChange={(v) => updateFamiliar(index, "fechaNacimiento", v, "date")}
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

      <CurpPdfImportModal
        open={curpPdfOpen}
        onClose={() => setCurpPdfOpen(false)}
        onParsed={aplicarCurpDesdePdf}
      />
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
  placeholder,
  hint,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
  className?: string;
  readOnly?: boolean;
  inputClassName?: string;
  placeholder?: string;
  hint?: string;
}) {
  const mayus = type !== "date" && type !== "number";
  return (
    <label className={`space-y-1 ${className}`}>
      <span className="form-label uppercase">{label}</span>
      <input
        className={`form-control ${mayus ? "uppercase" : ""} ${readOnly ? "bg-slate-100 text-slate-500" : ""} ${inputClassName}`.trim()}
        type={type}
        value={value}
        readOnly={readOnly}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
      />
      {hint ? <span className="text-[10px] font-medium uppercase text-slate-500">{hint}</span> : null}
    </label>
  );
}

function SelectField({
  label,
  value,
  options,
  onChange,
  allowEmpty,
}: {
  label: string;
  value: string;
  options: string[];
  onChange: (value: string) => void;
  allowEmpty?: boolean;
}) {
  return (
    <label className="space-y-1">
      <span className="form-label uppercase">{label}</span>
      <select className="form-control uppercase" value={value} onChange={(e) => onChange(e.target.value)}>
        {allowEmpty ? (
          <option value="">— SELECCIONE —</option>
        ) : null}
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
