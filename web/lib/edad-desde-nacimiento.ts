import { normalizarFechaParaInputDate } from "@/lib/fecha-input-normalize";

/**
 * Edad en años cumplidos a la fecha de referencia (por defecto hoy), según fecha de nacimiento
 * reconocida (ISO YYYY-MM-DD o DD/MM/AAAA vía {@link normalizarFechaParaInputDate}).
 */
export function edadAniosAlaFecha(fechaNacimientoRaw: string, referencia: Date = new Date()): number | null {
  const n = normalizarFechaParaInputDate(String(fechaNacimientoRaw ?? "").trim());
  if (!n) return null;
  const parts = n.split("-").map((x) => Number(x));
  if (parts.length !== 3 || parts.some((x) => !Number.isFinite(x))) return null;
  const [y, mo, d] = parts;
  if (
    y == null ||
    mo == null ||
    d == null ||
    y < 1900 ||
    y > 2100 ||
    mo < 1 ||
    mo > 12 ||
    d < 1 ||
    d > 31
  ) {
    return null;
  }
  const birth = new Date(y, mo - 1, d);
  if (birth.getFullYear() !== y || birth.getMonth() !== mo - 1 || birth.getDate() !== d) return null;
  if (birth.getTime() > referencia.getTime()) return null;
  let age = referencia.getFullYear() - birth.getFullYear();
  const mesDif = referencia.getMonth() - birth.getMonth();
  if (mesDif < 0 || (mesDif === 0 && referencia.getDate() < birth.getDate())) age--;
  if (age < 0 || age > 120) return null;
  return age;
}

/** Prioriza edad calculada; si no hay fecha válida, el valor guardado en expediente. */
export function textoEdadDesdeExpediente(
  fechaNacimientoRaw: string,
  edadGuardadaRaw: string,
  referencia: Date = new Date(),
): string {
  const comp = edadAniosAlaFecha(fechaNacimientoRaw, referencia);
  if (comp != null) return String(comp);
  return String(edadGuardadaRaw ?? "").trim();
}
