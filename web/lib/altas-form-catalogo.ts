import { fechaIngresoNormalizadaColaborador } from "@/lib/colaboradores-baja";
import type { ColaboradorCompleto } from "@/lib/colaboradores-types";

/** Envío / Reyna — mismo catálogo. */
export const ALTAS_ESTADO_TRAMITE_OPCIONES = [
  "SOLICITADO",
  "PENDIENTE",
  "NO APLICA",
  "ENVIADA",
  "RECIBIDA",
] as const;

export const ALTAS_ESTADO_CIVIL_OPCIONES = [
  "SOLTERO",
  "VIUDO",
  "SEPARADO",
  "DIVORCIADO",
  "UNION LIBRE",
  "CASADO",
] as const;

export const ALTAS_GESTORES_PROCESO_OPCIONES = [
  "BERTHA KARINA TIRADO SANCHEZ",
  "MARIA YESSENIA GUERRA MUÑIZ",
  "JUAN EDUARD TREJO RODRIGUEZ",
  "ELIEZER ELIUD VARGAS ESQUIVEL",
  "MARGARITA MUÑIZ VERDIN",
  "BEATRIZ ROSALES PEREZ",
  "JOSE ALEJANDRO RODRIGUEZ VALDEZ",
  "RUTH ESTEFANI ROBLES LOPEZ",
  "VALESKA MARISOL ZUÑIGA SANCHEZ",
] as const;

/** Campos que no se convierten a mayúsculas (fechas y numéricos puros). */
export const ALTAS_CAMPOS_SIN_MAYUSCULAS = new Set([
  "fechaIngreso",
  "fechaBaja",
  "reingreso",
  "fechaNacimiento",
  "edad",
  "sueldoMensual",
]);

export function valorCampoAltaMayusculas(campo: string, valor: string, inputType?: string): string {
  if (inputType === "date" || inputType === "number" || ALTAS_CAMPOS_SIN_MAYUSCULAS.has(campo)) {
    return valor;
  }
  return valor.toUpperCase();
}

export function partesNombreDesdeCompleto(completo: string): {
  apellidoPaterno: string;
  apellidoMaterno: string;
  nombres: string;
} {
  const parts = completo.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) {
    return { apellidoPaterno: "", apellidoMaterno: "", nombres: "" };
  }
  if (parts.length === 1) {
    return { apellidoPaterno: "", apellidoMaterno: "", nombres: parts[0]! };
  }
  if (parts.length === 2) {
    return { apellidoPaterno: parts[0]!, apellidoMaterno: "", nombres: parts[1]! };
  }
  return {
    apellidoPaterno: parts[0]!,
    apellidoMaterno: parts[1]!,
    nombres: parts.slice(2).join(" "),
  };
}

/** Mismo criterio que el importador de altas: nombres + apellidos. */
export function nombreCompletoDesdePartes(
  apellidoPaterno: string,
  apellidoMaterno: string,
  nombres: string,
): string {
  return [nombres, apellidoPaterno, apellidoMaterno].filter((s) => String(s ?? "").trim()).join(" ").trim();
}

function numeroDesdeTexto(raw: string): number | null {
  const t = String(raw ?? "").trim();
  if (!t) return null;
  if (/^\d+$/.test(t)) return Number.parseInt(t, 10);
  const pte = /^PTE-(\d+)$/i.exec(t);
  if (pte) return Number.parseInt(pte[1]!, 10);
  const digits = t.replace(/\D/g, "");
  if (digits.length >= 1) {
    const n = Number.parseInt(digits, 10);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

/** N.º de empleado canónico (snapshot o PARTE 1 del expediente). */
export function noEmpleadoEfectivoDesdeColaborador(c: ColaboradorCompleto): string {
  return String(c.noEmpleado ?? "").trim() || String(c.form?.noEmpleado1 ?? "").trim();
}

/** Solo consecutivos puros (dígitos); excluye PTE y folios alfanuméricos. */
function numeroConsecutivoAlta(raw: string): number | null {
  const t = String(raw ?? "").trim();
  if (!/^\d+$/.test(t)) return null;
  const n = Number.parseInt(t, 10);
  return Number.isFinite(n) && n > 0 ? n : null;
}

function instanteUltimoIngresoRegistrado(c: ColaboradorCompleto): number {
  for (const raw of [String(c.registeredAt ?? "").trim(), String(c.form?.registeredAt ?? "").trim()]) {
    if (!raw) continue;
    const t = Date.parse(raw);
    if (Number.isFinite(t)) return t;
  }
  const fi = fechaIngresoNormalizadaColaborador(c);
  if (fi) {
    const t = Date.parse(`${fi}T23:59:59`);
    if (Number.isFinite(t)) return t;
  }
  return 0;
}

/**
 * Siguiente N.º de empleado: +1 respecto al último alta registrado
 * (por `registeredAt`, o fecha de ingreso si no hay registro).
 */
export function calcularSiguienteNoEmpleado(list: ColaboradorCompleto[]): string {
  let ultimoInstante = -1;
  let ultimoNo: number | null = null;

  for (const c of list) {
    const n = numeroConsecutivoAlta(noEmpleadoEfectivoDesdeColaborador(c));
    if (n == null) continue;
    const instante = instanteUltimoIngresoRegistrado(c);
    if (instante > ultimoInstante || (instante === ultimoInstante && (ultimoNo == null || n > ultimoNo))) {
      ultimoInstante = instante;
      ultimoNo = n;
    }
  }

  if (ultimoNo != null) return String(ultimoNo + 1);
  return "1";
}

/** Formato expediente: SPT/T-9167/PE (prefijo / T-consecutivo / sufijo). */
export const FOLIO_EXPEDIENTE_PREFIJO_DEFAULT = "SPT";
export const FOLIO_EXPEDIENTE_SUFIJO_DEFAULT = "PE";

const FOLIO_EXPEDIENTE_REGEX = /^([A-Z0-9]+)\/T-(\d+)\/([A-Z]{2,6})$/i;

export type FolioExpedientePartes = {
  prefijo: string;
  consecutivo: number;
  sufijo: string;
};

export function parseNumeroFolioExpediente(raw: string): FolioExpedientePartes | null {
  const t = String(raw ?? "").trim().toUpperCase();
  const m = FOLIO_EXPEDIENTE_REGEX.exec(t);
  if (!m) return null;
  const consecutivo = Number.parseInt(m[2]!, 10);
  if (!Number.isFinite(consecutivo)) return null;
  return {
    prefijo: m[1]!.toUpperCase(),
    consecutivo,
    sufijo: m[3]!.toUpperCase(),
  };
}

export function formatearNumeroFolioExpediente(partes: FolioExpedientePartes): string {
  return `${partes.prefijo}/T-${partes.consecutivo}/${partes.sufijo}`;
}

/** Suma 1 al consecutivo de un folio con formato SPT/T-9167/PE. */
export function incrementarNumeroFolioExpediente(raw: string): string | null {
  const parsed = parseNumeroFolioExpediente(raw);
  if (!parsed) return null;
  return formatearNumeroFolioExpediente({
    prefijo: parsed.prefijo,
    consecutivo: parsed.consecutivo + 1,
    sufijo: parsed.sufijo,
  });
}

function mayorFolioEnLista(list: ColaboradorCompleto[]): FolioExpedientePartes | null {
  let mejor: FolioExpedientePartes | null = null;
  let maxSuelto = 0;

  for (const c of list) {
    const f = String(c.form?.numeroFolio ?? "").trim();
    if (!f) continue;
    const parsed = parseNumeroFolioExpediente(f);
    if (parsed) {
      if (!mejor || parsed.consecutivo > mejor.consecutivo) {
        mejor = parsed;
      }
      continue;
    }
    const n = numeroDesdeTexto(f);
    if (n != null && n > maxSuelto) maxSuelto = n;
  }

  if (mejor) return mejor;
  if (maxSuelto > 0) {
    return {
      prefijo: FOLIO_EXPEDIENTE_PREFIJO_DEFAULT,
      consecutivo: maxSuelto,
      sufijo: FOLIO_EXPEDIENTE_SUFIJO_DEFAULT,
    };
  }
  return null;
}

function folioUltimoRegistro(list: ColaboradorCompleto[]): FolioExpedientePartes | null {
  let ultimoInstante = -1;
  let folioUltimo: FolioExpedientePartes | null = null;

  for (const c of list) {
    const f = String(c.form?.numeroFolio ?? "").trim();
    if (!f) continue;
    const parsed = parseNumeroFolioExpediente(f);
    if (!parsed) continue;
    const instante = instanteUltimoIngresoRegistrado(c);
    if (instante > ultimoInstante) {
      ultimoInstante = instante;
      folioUltimo = parsed;
    }
  }

  return folioUltimo;
}

/**
 * Siguiente folio completo (ej. SPT/T-9168/PE).
 * Prioriza el folio del último alta registrado (+1); si no hay, el mayor consecutivo en expedientes.
 */
export function calcularSiguienteNumeroFolio(list: ColaboradorCompleto[]): string {
  const desdeUltimo = folioUltimoRegistro(list);
  const mayorGlobal = mayorFolioEnLista(list);

  const base = desdeUltimo ?? mayorGlobal;
  if (base) {
    const consecutivoDesdeUltimo = (desdeUltimo?.consecutivo ?? 0) + 1;
    const consecutivoDesdeMax = (mayorGlobal?.consecutivo ?? 0) + 1;
    const prefijo = desdeUltimo?.prefijo ?? mayorGlobal?.prefijo ?? FOLIO_EXPEDIENTE_PREFIJO_DEFAULT;
    const sufijo = desdeUltimo?.sufijo ?? mayorGlobal?.sufijo ?? FOLIO_EXPEDIENTE_SUFIJO_DEFAULT;
    return formatearNumeroFolioExpediente({
      prefijo,
      consecutivo: Math.max(consecutivoDesdeUltimo, consecutivoDesdeMax),
      sufijo,
    });
  }

  return formatearNumeroFolioExpediente({
    prefijo: FOLIO_EXPEDIENTE_PREFIJO_DEFAULT,
    consecutivo: 1,
    sufijo: FOLIO_EXPEDIENTE_SUFIJO_DEFAULT,
  });
}

export type FamiliarAltaForm = {
  nombreFamiliar: string;
  parentesco: string;
  fechaNacimiento: string;
  beneficiarioBancario: "SI" | "NO";
};

export function normalizarFamiliaresAltaMayusculas(familiares: FamiliarAltaForm[]): FamiliarAltaForm[] {
  return familiares.map((f) => ({
    ...f,
    nombreFamiliar: f.nombreFamiliar.toUpperCase(),
    parentesco: f.parentesco.toUpperCase(),
    fechaNacimiento: f.fechaNacimiento,
    beneficiarioBancario: f.beneficiarioBancario,
  }));
}

export function normalizarFormularioAltaMayusculas(
  form: Record<string, string>,
): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(form)) {
    out[k] = valorCampoAltaMayusculas(k, String(v ?? ""));
  }
  return out;
}
