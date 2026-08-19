export type ContratoPorMesFila = {
  noEmpleado: string;
  nombreCompleto: string;
  servicio: string;
  fechaIngreso: string;
  /** Días con asistencia registrada en cuadrícula (≥1 para aparecer en la lista). */
  diasTrabajados: number;
};

export type ContratosPorMesReport = {
  mesYm: string;
  servicio: string;
  rows: ContratoPorMesFila[];
  servicios: string[];
  fuente: "supabase" | "sin_datos";
  generadoEn: string;
};

function csvCell(value: string): string {
  const s = String(value ?? "").replace(/"/g, '""');
  if (/[",\n\r]/.test(s)) return `"${s}"`;
  return s;
}

/** CSV UTF-8 con BOM: N.º, nombre, servicio, fecha ingreso. */
export function contratosPorMesToCsv(rows: ContratoPorMesFila[]): string {
  const headers = ["NO_EMPLEADO", "NOMBRE_COMPLETO", "SERVICIO", "FECHA_INGRESO"];
  const lines = [headers.map(csvCell).join(",")];
  for (const r of rows) {
    lines.push(
      [r.noEmpleado, r.nombreCompleto, r.servicio, r.fechaIngreso].map(csvCell).join(","),
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

export function labelMesYm(mesYm: string): string {
  const [y, m] = mesYm.slice(0, 7).split("-").map(Number);
  if (!y || !m) return mesYm;
  const d = new Date(y, m - 1, 1);
  return d.toLocaleDateString("es-MX", { month: "long", year: "numeric", timeZone: "UTC" });
}

export function mesYmValido(mesYm: string): boolean {
  return /^\d{4}-\d{2}$/.test(String(mesYm ?? "").trim().slice(0, 7));
}
