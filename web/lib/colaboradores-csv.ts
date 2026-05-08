import type { ColaboradorCompleto } from "./colaboradores-store";

function csvCell(value: string): string {
  const s = String(value ?? "").replace(/"/g, '""');
  if (/[",\n\r]/.test(s)) return `"${s}"`;
  return s;
}

function familiaresTexto(c: ColaboradorCompleto): string {
  if (!c.familiares.length) return "";
  return c.familiares
    .map(
      (f) =>
        `${f.nombreFamiliar} (${f.parentesco}) ${f.fechaNacimiento} BEN:${f.beneficiarioBancario}`,
    )
    .join(" | ");
}

/** Genera CSV con BOM UTF-8 para abrir bien en Excel. */
export function colaboradoresToCsv(rows: ColaboradorCompleto[]): string {
  if (rows.length === 0) return "\uFEFF";

  const formKeys = new Set<string>();
  for (const r of rows) {
    for (const k of Object.keys(r.form)) formKeys.add(k);
  }
  const sortedFormKeys = [...formKeys].sort();

  const baseHeaders = [
    "NO_EMPLEADO",
    "NOMBRE_COMPLETO",
    "SERVICIO_ASIGNADO",
    "ULTIMO_SERVICIO",
    "NSS",
    "POSICION",
    "PUESTO",
    "FECHA_INGRESO",
    "REGISTRADO_EN",
    ...sortedFormKeys.map((k) => `FORM_${k}`),
    "FAMILIARES",
  ];

  const lines: string[] = [baseHeaders.map(csvCell).join(",")];

  for (const r of rows) {
    const base = [
      r.noEmpleado,
      r.nombreCompleto,
      r.servicioAsignado,
      r.ultimoServicio,
      r.nss,
      r.posicion,
      r.puesto ?? "",
      r.fechaIngreso,
      r.registeredAt,
    ];
    const formVals = sortedFormKeys.map((k) => r.form[k] ?? "");
    const row = [...base, ...formVals, familiaresTexto(r)].map(csvCell).join(",");
    lines.push(row);
  }

  return "\uFEFF" + lines.join("\r\n");
}

export function downloadCsv(filename: string, csv: string): void {
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
