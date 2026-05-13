/**
 * Normaliza JSON (Supabase `data` o cuerpos API) a ColaboradorCompleto.
 * Sin persistencia: solo transformación.
 */
import type { ColaboradorCompleto, ColaboradorSnapshot, FamiliarGuardado, MoperEstadoLinea } from "@/lib/colaboradores-types";

export function normalizeNoEmpleado(no: string): string {
  return no.trim().toUpperCase();
}

function normalizeSnapshot(raw: unknown): ColaboradorSnapshot | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const no = typeof r.noEmpleado === "string" ? r.noEmpleado : "";
  if (!no) return null;
  const legacyServicio = typeof r.servicio === "string" ? r.servicio : "";
  return {
    noEmpleado: no,
    nombreCompleto: typeof r.nombreCompleto === "string" ? r.nombreCompleto : "",
    fechaIngreso: typeof r.fechaIngreso === "string" ? r.fechaIngreso : "",
    servicioAsignado:
      typeof r.servicioAsignado === "string" ? r.servicioAsignado : legacyServicio,
    ultimoServicio: typeof r.ultimoServicio === "string" ? r.ultimoServicio : "",
    nss: typeof r.nss === "string" ? r.nss : "",
    posicion: typeof r.posicion === "string" ? r.posicion : "",
    puesto: typeof r.puesto === "string" ? r.puesto : "",
  };
}

export function normalizeToCompleto(raw: unknown): ColaboradorCompleto | null {
  const snap = normalizeSnapshot(raw);
  if (!snap) return null;
  const r = raw as Record<string, unknown>;
  let form: Record<string, string> = {};
  if (r.form && typeof r.form === "object" && !Array.isArray(r.form)) {
    form = Object.fromEntries(
      Object.entries(r.form as Record<string, unknown>).map(([k, v]) => [k, String(v ?? "")]),
    );
  }
  let familiares: FamiliarGuardado[] = [];
  if (Array.isArray(r.familiares)) {
    familiares = r.familiares.map((item) => {
      const f = item as Record<string, unknown>;
      return {
        nombreFamiliar: String(f.nombreFamiliar ?? ""),
        parentesco: String(f.parentesco ?? ""),
        fechaNacimiento: String(f.fechaNacimiento ?? ""),
        beneficiarioBancario: String(f.beneficiarioBancario ?? ""),
      };
    });
  }
  let moperActual: MoperEstadoLinea | undefined;
  const ma = r.moperActual;
  if (ma && typeof ma === "object" && !Array.isArray(ma)) {
    const o = ma as Record<string, unknown>;
    moperActual = {
      servicio: String(o.servicio ?? ""),
      puesto: String(o.puesto ?? ""),
    };
  }

  return {
    ...snap,
    registeredAt: typeof r.registeredAt === "string" ? r.registeredAt : new Date().toISOString(),
    form,
    familiares,
    moperActual,
  };
}
