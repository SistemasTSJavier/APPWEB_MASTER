export type ContratoPorMesFila = {
  noEmpleado: string;
  nombreCompleto: string;
  servicio: string;
  fechaIngreso: string;
  /** Días con asistencia registrada en cuadrícula (≥1 para aparecer en la lista). */
  diasTrabajados: number;
  /** Fechas con falta en el periodo (dd/mm/aaaa). */
  fechasFaltas: string[];
  /** Activo según expediente; inactivos con asistencia también se listan. */
  activo: boolean;
};

export type ContratosPorMesPeriodo = "mes" | "anio";

export type ContratosPorMesReport = {
  periodo: ContratosPorMesPeriodo;
  mesYm: string;
  anio: number | null;
  periodoLabel: string;
  servicio: string;
  /** Variante de servicio (CAT SANTA, U-ERRE …) cuando aplica. */
  variante: string;
  rows: ContratoPorMesFila[];
  servicios: string[];
  /** Variantes disponibles si el servicio agrupado es CAT o U-ERRE. */
  variantesServicio: string[];
  fuente: "supabase" | "sin_datos";
  generadoEn: string;
};

function csvCell(value: string): string {
  const s = String(value ?? "").replace(/"/g, '""');
  if (/[",\n\r]/.test(s)) return `"${s}"`;
  return s;
}

/** CSV UTF-8 con BOM. */
export function contratosPorMesToCsv(rows: ContratoPorMesFila[]): string {
  const headers = [
    "NO_EMPLEADO",
    "NOMBRE_COMPLETO",
    "SERVICIO",
    "FECHA_INGRESO",
    "DIAS_LABORADOS",
    "FECHAS_FALTAS",
    "ESTATUS",
  ];
  const lines = [headers.map(csvCell).join(",")];
  for (const r of rows) {
    lines.push(
      [
        r.noEmpleado,
        r.nombreCompleto,
        r.servicio,
        r.fechaIngreso,
        String(r.diasTrabajados),
        r.fechasFaltas.join("; "),
        r.activo ? "ACTIVO" : "INACTIVO",
      ]
        .map(csvCell)
        .join(","),
    );
  }
  return "\uFEFF" + lines.join("\r\n");
}

export function mesActualMx(): string {
  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Mexico_City",
    year: "numeric",
    month: "2-digit",
  });
  const parts = fmt.formatToParts(new Date());
  const y = parts.find((p) => p.type === "year")?.value ?? "0000";
  const m = parts.find((p) => p.type === "month")?.value ?? "01";
  return `${y}-${m}`;
}

export function anioActualMx(): number {
  return Number(mesActualMx().slice(0, 4)) || new Date().getFullYear();
}

export function labelMesYm(mesYm: string): string {
  const [y, m] = mesYm.slice(0, 7).split("-").map(Number);
  if (!y || !m) return mesYm;
  const d = new Date(y, m - 1, 1);
  return d.toLocaleDateString("es-MX", { month: "long", year: "numeric", timeZone: "UTC" });
}

export function mesYmValido(mesYm: string): boolean {
  return /^\d{4}-\d{2}$/.test(String(mesYm ?? "").trim().slice(0, 7));
}

export function anioValido(anio: number): boolean {
  return Number.isInteger(anio) && anio >= 2000 && anio <= 2100;
}

export function labelAnio(anio: number): string {
  return `Año ${anio}`;
}
