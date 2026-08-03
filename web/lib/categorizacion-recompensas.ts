/** Tipos e helpers de Recompensas (datos para dashboard, no calificación 1–5). */

export type CatRecompensaTipo = "bono" | "empleado_del_mes" | "reconocimiento";

export type CatRecompensaRow = {
  id: string;
  noEmpleado: string;
  tipo: CatRecompensaTipo;
  /** Bono: de qué es. Reconocimiento: de qué es. Empleado del mes: nota opcional. */
  descripcion: string;
  /** YYYY-MM */
  mes: string;
  createdAt: string;
  updatedAt: string;
};

export const CAT_RECOMPENSA_TIPOS: {
  id: CatRecompensaTipo;
  label: string;
  descripcionHint: string;
  requiereDescripcion: boolean;
}[] = [
  {
    id: "bono",
    label: "Bono",
    descripcionHint: "¿De qué es el bono? (ej. puntualidad, productividad)",
    requiereDescripcion: true,
  },
  {
    id: "empleado_del_mes",
    label: "Empleado del mes",
    descripcionHint: "Nota opcional (ej. motivo del reconocimiento)",
    requiereDescripcion: false,
  },
  {
    id: "reconocimiento",
    label: "Reconocimiento",
    descripcionHint: "¿De qué es el reconocimiento?",
    requiereDescripcion: true,
  },
];

export function esCatRecompensaTipo(v: string): v is CatRecompensaTipo {
  return v === "bono" || v === "empleado_del_mes" || v === "reconocimiento";
}

/** Valida mes YYYY-MM. */
export function normalizarMesYm(raw: string): string | null {
  const s = String(raw ?? "").trim();
  if (!/^\d{4}-\d{2}$/.test(s)) return null;
  const m = Number(s.slice(5, 7));
  if (m < 1 || m > 12) return null;
  return s;
}

export function etiquetaMesYm(ym: string): string {
  const [y, m] = ym.split("-").map(Number);
  if (!y || !m) return ym;
  try {
    return new Date(y, m - 1, 1).toLocaleDateString("es-MX", { month: "long", year: "numeric" });
  } catch {
    return ym;
  }
}

export function mesCalendarioActualYm(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  return `${y}-${m}`;
}

/** Mes anterior (YYYY-MM) — captura / dashboard en desfase. */
export function mesCalendarioAnteriorYm(hoy = new Date()): string {
  const d = new Date(hoy.getFullYear(), hoy.getMonth() - 1, 1);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  return `${y}-${m}`;
}

/** Item listo para mostrar en indicadores del dashboard. */
export type CatRecompensaDisplayItem = {
  descripcion: string;
  mes: string;
  mesLabel: string;
};

export type CatRecompensasDisplay = {
  bonos: CatRecompensaDisplayItem[];
  empleadoDelMes: CatRecompensaDisplayItem[];
  reconocimientos: CatRecompensaDisplayItem[];
};

export function toRecompensasDisplay(rows: CatRecompensaRow[]): CatRecompensasDisplay {
  const out: CatRecompensasDisplay = { bonos: [], empleadoDelMes: [], reconocimientos: [] };
  for (const r of rows) {
    const item: CatRecompensaDisplayItem = {
      descripcion: r.descripcion,
      mes: r.mes,
      mesLabel: etiquetaMesYm(r.mes),
    };
    if (r.tipo === "bono") out.bonos.push(item);
    else if (r.tipo === "empleado_del_mes") out.empleadoDelMes.push(item);
    else out.reconocimientos.push(item);
  }
  return out;
}
