import type { ColaboradorCompleto, FamiliarGuardado } from "@/lib/colaboradores-types";

const CAMPOS_FECHA = new Set([
  "fechaIngreso",
  "fechaBaja",
  "reingreso",
  "fechaNacimiento",
  "fechaRenuncia",
  "ultimoDiaLaborado",
  "fechaNacimientoFamiliar",
  "registeredAt",
  "registradoAt",
]);

const CAMPOS_NUMERICOS = new Set(["edad", "sueldoMensual"]);

/** Texto de captura en formularios (no fechas ni números puros). */
export function aMayusculasPlataforma(valor: string, campo?: string): string {
  if (campo && (CAMPOS_FECHA.has(campo) || CAMPOS_NUMERICOS.has(campo))) {
    return valor;
  }
  const t = String(valor ?? "");
  if (!t.trim()) return t;
  return t.toUpperCase();
}

function formRecordMayusculas(form: Record<string, string>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(form)) {
    out[k] = aMayusculasPlataforma(String(v ?? ""), k);
  }
  return out;
}

export function familiarMayusculas(f: FamiliarGuardado): FamiliarGuardado {
  return {
    ...f,
    nombreFamiliar: aMayusculasPlataforma(f.nombreFamiliar),
    parentesco: aMayusculasPlataforma(f.parentesco),
    fechaNacimiento: f.fechaNacimiento,
    beneficiarioBancario: f.beneficiarioBancario,
  };
}

export function colaboradorCompletoMayusculas(c: ColaboradorCompleto): ColaboradorCompleto {
  return {
    ...c,
    noEmpleado: String(c.noEmpleado ?? "").trim().toUpperCase(),
    nombreCompleto: aMayusculasPlataforma(c.nombreCompleto),
    fechaIngreso: c.fechaIngreso,
    servicioAsignado: aMayusculasPlataforma(c.servicioAsignado),
    ultimoServicio: aMayusculasPlataforma(c.ultimoServicio),
    nss: String(c.nss ?? "").trim(),
    posicion: aMayusculasPlataforma(c.posicion ?? ""),
    puesto: aMayusculasPlataforma(c.puesto ?? ""),
    form: formRecordMayusculas(c.form ?? {}),
    familiares: (c.familiares ?? []).map(familiarMayusculas),
    moperActual: c.moperActual
      ? {
          servicio: aMayusculasPlataforma(c.moperActual.servicio),
          puesto: aMayusculasPlataforma(c.moperActual.puesto),
        }
      : c.moperActual,
  };
}
