import type { ColaboradorCompleto, FamiliarGuardado } from "@/lib/colaboradores-types";
import { colaboradorTieneBaja } from "@/lib/colaboradores-baja";
import { fechaBajaNormalizadaColaborador } from "@/lib/altas-coincidencia-nombre";
import { nombreCompletoDesdePartes, valorCampoAltaMayusculas } from "@/lib/altas-form-catalogo";
import { normalizarFechaParaInputDate } from "@/lib/fecha-input-normalize";
import { edadAniosAlaFecha } from "@/lib/edad-desde-nacimiento";

/** Claves del estado `form` en AltasPageClient (partes 1–4). */
export const ALTAS_FORM_STATE_KEYS = [
  "noEmpleado1",
  "fechaIngreso",
  "fechaBaja",
  "envio",
  "reyna",
  "reingreso",
  "nombreCompleto",
  "puesto",
  "servicio",
  "noServicio",
  "planta",
  "posicion",
  "localForaneo",
  "numeroFolio",
  "creditoInfonavit",
  "escolaridad",
  "licenciaConducir",
  "cartaNoAntecedentes",
  "idiomas",
  "apellidoPaterno",
  "apellidoMaterno",
  "nombres",
  "fechaNacimiento",
  "edad",
  "estadoCivil",
  "curp",
  "rfc",
  "noIfe",
  "imss",
  "codigoPostal",
  "estadoNatal",
  "direccionCompleta",
  "telefonoPersonalCasa",
  "estaturaPeso",
  "tipoSangre",
  "alergicoA",
  "enfermedadTratamiento",
  "diabetico",
  "hipertenso",
  "emergenciaLlamarA",
  "telefonoEmergencia",
  "banco",
  "numeroCuenta",
  "clabeInterbancaria",
  "noTarjeta",
  "sueldoMensual",
  "fuenteReclutamiento",
  "gestorProceso",
  "estudioSocioeconomico",
  "documentacionOriginal",
] as const;

const FECHA_FORM_KEYS = new Set(["fechaIngreso", "fechaBaja", "reingreso", "fechaNacimiento"]);

function fechaCampo(raw: string): string {
  const t = String(raw ?? "").trim();
  if (!t) return "";
  return normalizarFechaParaInputDate(t) || t;
}

function valorDesdeExpediente(c: ColaboradorCompleto, key: string): string {
  const f = c.form ?? {};
  switch (key) {
    case "noEmpleado1":
      return c.noEmpleado;
    case "nombreCompleto":
      return (
        String(f.nombreCompleto ?? "").trim() ||
        c.nombreCompleto.trim() ||
        nombreCompletoDesdePartes(f.apellidoPaterno ?? "", f.apellidoMaterno ?? "", f.nombres ?? "")
      );
    case "fechaIngreso":
      return fechaCampo(String(f.fechaIngreso ?? c.fechaIngreso ?? ""));
    case "servicio":
      return String(f.servicio ?? c.servicioAsignado ?? "").trim();
    case "puesto":
      return String(f.puesto ?? c.puesto ?? "").trim();
    case "posicion":
      return String(f.posicion ?? c.posicion ?? "").trim();
    case "imss":
      return String(f.imss ?? c.nss ?? "").trim();
    case "planta":
      return String(f.planta ?? "").trim();
    case "noServicio":
      return String(f.noServicio ?? "").trim();
    case "localForaneo":
      return String(f.localForaneo ?? "LOCAL").trim() || "LOCAL";
    case "diabetico":
    case "hipertenso":
      return String(f[key] ?? "NO").trim() || "NO";
    default:
      if (FECHA_FORM_KEYS.has(key)) return fechaCampo(String(f[key] ?? ""));
      return String(f[key] ?? "").trim();
  }
}

export type PrefillReingresoOpciones = {
  /** N.º que el usuario ya capturó (no se sustituye si tiene valor). */
  noEmpleadoCapturado?: string;
  /** Folio nuevo de alta; no se copia el del expediente anterior. */
  numeroFolioActual?: string;
};

/**
 * Rellena el formulario de altas con el expediente previo (reingreso).
 * No copia fecha de baja del ciclo anterior; reingreso queda para captura/ajuste.
 */
export function formAltaDesdeColaboradorReingreso(
  c: ColaboradorCompleto,
  opts?: PrefillReingresoOpciones,
): Record<string, string> {
  const out: Record<string, string> = {};
  for (const key of ALTAS_FORM_STATE_KEYS) {
    if (key === "noEmpleado1") continue;
    if (key === "numeroFolio") continue;
    if (key === "fechaBaja" || key === "reingreso") continue;
    const raw = valorDesdeExpediente(c, key);
    if (!raw && key !== "localForaneo") continue;
    out[key] = FECHA_FORM_KEYS.has(key) ? raw : valorCampoAltaMayusculas(key, raw);
  }

  const noCap = (opts?.noEmpleadoCapturado ?? "").trim().toUpperCase();
  if (noCap) out.noEmpleado1 = noCap;

  const folio = (opts?.numeroFolioActual ?? "").trim();
  if (folio) out.numeroFolio = folio;

  out.fechaBaja = "";

  const fn = normalizarFechaParaInputDate(out.fechaNacimiento ?? "");
  const ed = fn ? edadAniosAlaFecha(fn) : null;
  if (ed != null) out.edad = String(ed);

  return out;
}

export type FamiliarAltaForm = {
  nombreFamiliar: string;
  parentesco: string;
  fechaNacimiento: string;
  beneficiarioBancario: "SI" | "NO";
};

export function familiaresDesdeColaboradorReingreso(c: ColaboradorCompleto): FamiliarAltaForm[] {
  const list = c.familiares ?? [];
  if (list.length === 0) {
    return [{ nombreFamiliar: "", parentesco: "", fechaNacimiento: "", beneficiarioBancario: "NO" }];
  }
  return list.map((f) => ({
    nombreFamiliar: valorCampoAltaMayusculas("nombreFamiliar", f.nombreFamiliar),
    parentesco: valorCampoAltaMayusculas("parentesco", f.parentesco),
    fechaNacimiento: fechaCampo(f.fechaNacimiento),
    beneficiarioBancario: (f.beneficiarioBancario === "SI" ? "SI" : "NO") as "SI" | "NO",
  }));
}

export function fechaReingresoSugeridaDesdeExpediente(c: ColaboradorCompleto): string {
  return fechaBajaNormalizadaColaborador(c);
}

/** Expediente con baja a usar como plantilla (mismo N.º o coincidencia por nombre). */
export function resolverExpedientePlantillaReingreso(
  expedientePorNo: ColaboradorCompleto | null,
  coincidenciaNombre: ColaboradorCompleto | null,
  noEmpleadoCapturado: string,
): ColaboradorCompleto | null {
  const no = noEmpleadoCapturado.trim().toUpperCase();
  if (expedientePorNo && colaboradorTieneBaja(expedientePorNo)) {
    return expedientePorNo;
  }
  if (coincidenciaNombre) return coincidenciaNombre;
  return null;
}
