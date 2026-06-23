/** Escala 1–5 y reglas de nivel / paquete de prestaciones. */

export const CAT_ESCALA_MIN = 1;
export const CAT_ESCALA_MAX = 5;

export type CatNivelId = "gamma" | "beta" | "alfa";
export type CatPaqueteId = "basico" | "plus" | "premium";

export const CAT_NIVEL_REGLAS: {
  id: CatNivelId;
  label: string;
  rango: string;
  min: number;
  max: number;
}[] = [
  { id: "gamma", label: "GAMMA", rango: "1.0 – 2.5", min: 1, max: 2.5 },
  { id: "beta", label: "BETA", rango: "2.6 – 4.5", min: 2.6, max: 4.5 },
  { id: "alfa", label: "ALFA", rango: "4.6 – 5.0", min: 4.6, max: 5 },
];

export const CAT_PAQUETE_REGLAS: {
  id: CatPaqueteId;
  label: string;
  rango: string;
  min: number;
  max: number;
  incluye: string;
}[] = [
  {
    id: "basico",
    label: "BÁSICO",
    rango: "1.0 – 2.5",
    min: 1,
    max: 2.5,
    incluye: "Fondo de ahorro y premio de PP",
  },
  {
    id: "plus",
    label: "PLUS",
    rango: "2.6 – 4.5",
    min: 2.6,
    max: 4.5,
    incluye: "Fondo de ahorro, premio de PP, convenio óptica, convenio juguetería",
  },
  {
    id: "premium",
    label: "PREMIUM",
    rango: "4.6 – 5.0",
    min: 4.6,
    max: 5,
    incluye:
      "Fondo de ahorro, premio de PP, convenio óptica, convenio juguetería, premio excelencia",
  },
];

export function promedioEvaluacionModulo(
  scores: Record<string, number> | undefined,
  promedioGuardado: number | null | undefined,
): number | null {
  if (promedioGuardado != null && Number.isFinite(promedioGuardado)) {
    return Math.round(promedioGuardado * 100) / 100;
  }
  return promedioDeScores(scores ?? {});
}

export function promedioDeScores(scores: Record<string, number | null | undefined>): number | null {
  const vals = Object.values(scores)
    .map((v) => (v == null ? NaN : Number(v)))
    .filter((n) => Number.isFinite(n) && n >= CAT_ESCALA_MIN && n <= CAT_ESCALA_MAX);
  if (vals.length === 0) return null;
  const sum = vals.reduce((a, b) => a + b, 0);
  return Math.round((sum / vals.length) * 100) / 100;
}

export function nivelDesdePromedio(promedio: number | null): CatNivelId | null {
  if (promedio == null || !Number.isFinite(promedio)) return null;
  const p = Math.round(promedio * 100) / 100;
  if (p >= 4.6) return "alfa";
  if (p >= 2.6) return "beta";
  if (p >= 1) return "gamma";
  return null;
}

export function paqueteDesdePromedio(promedio: number | null): CatPaqueteId | null {
  return nivelDesdePromedio(promedio) === "alfa"
    ? "premium"
    : nivelDesdePromedio(promedio) === "beta"
      ? "plus"
      : nivelDesdePromedio(promedio) === "gamma"
        ? "basico"
        : null;
}

export function etiquetaNivel(promedio: number | null): string {
  const id = nivelDesdePromedio(promedio);
  if (!id) return "—";
  const r = CAT_NIVEL_REGLAS.find((x) => x.id === id);
  return r ? `${r.label} (${r.rango})` : "—";
}

export function etiquetaPaquete(promedio: number | null): string {
  const id = paqueteDesdePromedio(promedio);
  if (!id) return "—";
  const r = CAT_PAQUETE_REGLAS.find((x) => x.id === id);
  return r ? `${r.label} (${r.rango})` : "—";
}

/** Promedio cuando varios evaluadores califican al mismo colaborador (p. ej. oficiales → JT). */
export function promedioAcumuladoEvaluaciones(promedios: Array<number | null | undefined>): number | null {
  const vals = promedios.filter((p): p is number => p != null && Number.isFinite(p));
  if (vals.length === 0) return null;
  const sum = vals.reduce((a, b) => a + b, 0);
  return Math.round((sum / vals.length) * 100) / 100;
}

export function promedioGeneralCategorizacion(promedios: Array<number | null | undefined>): number | null {
  const vals = promedios.filter((p): p is number => p != null && Number.isFinite(p));
  if (vals.length === 0) return null;
  const sum = vals.reduce((a, b) => a + b, 0);
  return Math.round((sum / vals.length) * 100) / 100;
}
