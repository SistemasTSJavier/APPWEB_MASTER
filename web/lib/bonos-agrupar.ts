import { BONOS_MILESTONES, type BonosFila, type BonosMilestone } from "@/lib/bonos-types";

export const BONOS_MILESTONE_TITULOS: Record<BonosMilestone, string> = {
  15: "Bono 15 días",
  30: "Bono 30 días",
  60: "Bono 60 días",
  90: "Bono 90 días",
};

export type BonosGrupoMilestone = {
  hito: BonosMilestone;
  titulo: string;
  filas: BonosFila[];
};

export function ordenarFilasBonos(filas: BonosFila[]): BonosFila[] {
  return [...filas].sort((a, b) => {
    if (a.bonoDias !== b.bonoDias) return a.bonoDias - b.bonoDias;
    const cmp = a.fechaCumplimiento.localeCompare(b.fechaCumplimiento);
    if (cmp !== 0) return cmp;
    return a.nombre.localeCompare(b.nombre, "es", { sensitivity: "base" });
  });
}

/** Agrupa filas por hito (15 → 30 → 60 → 90); omite grupos vacíos. */
export function agruparFilasPorBono(filas: BonosFila[]): BonosGrupoMilestone[] {
  const map = new Map<BonosMilestone, BonosFila[]>();
  for (const f of filas) {
    const prev = map.get(f.bonoDias) ?? [];
    prev.push(f);
    map.set(f.bonoDias, prev);
  }
  return BONOS_MILESTONES.filter((h) => (map.get(h)?.length ?? 0) > 0).map((hito) => {
    const grupo = map.get(hito)!;
    grupo.sort((a, b) => {
      const cmp = a.fechaCumplimiento.localeCompare(b.fechaCumplimiento);
      if (cmp !== 0) return cmp;
      return a.nombre.localeCompare(b.nombre, "es", { sensitivity: "base" });
    });
    return {
      hito,
      titulo: BONOS_MILESTONE_TITULOS[hito],
      filas: grupo,
    };
  });
}
