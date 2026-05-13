import type { ColaboradorCompleto } from "@/lib/colaboradores-types";
import { servicioLineaColaborador } from "@/lib/servicio-agrupacion";

export function txt(v: unknown): string {
  const s = typeof v === "string" ? v.trim() : v == null ? "" : String(v).trim();
  return s.toUpperCase();
}

export function displayOrDash(v: string): string {
  const t = v.trim();
  return t ? t.toUpperCase() : "—";
}

/** Separa "1.75/70", "170/75" o textos tipo "1.75 - KG 75" en estatura y peso */
export function splitEstaturaPeso(raw: string): { estatura: string; peso: string } {
  const t = raw.trim();
  if (!t) return { estatura: "", peso: "" };
  const i = t.indexOf("/");
  if (i !== -1) {
    return {
      estatura: t.slice(0, i).trim().toUpperCase(),
      peso: t.slice(i + 1).trim().toUpperCase(),
    };
  }
  const kg = /\bKG\s*(\d+)/i.exec(t);
  if (kg) {
    const before = t.slice(0, kg.index).replace(/[-–]\s*$/u, "").trim();
    return {
      estatura: (before || t.replace(/\bKG\s*\d+/i, "").trim()).toUpperCase(),
      peso: kg[1]!.toUpperCase(),
    };
  }
  return { estatura: t.toUpperCase(), peso: "" };
}

export function sueldoFormateado(raw: string): string {
  const t = raw.trim();
  if (!t) return "—";
  const n = Number(String(t).replace(/[^0-9.-]/g, ""));
  if (Number.isFinite(n) && n !== 0) {
    try {
      return new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN", maximumFractionDigits: 2 }).format(
        n,
      );
    } catch {
      return t.toUpperCase();
    }
  }
  return t.toUpperCase();
}

export function servicioAsignadoLinea(c: ColaboradorCompleto): string {
  return txt(servicioLineaColaborador(c)) || txt(c.form?.servicio) || txt(c.servicioAsignado);
}
