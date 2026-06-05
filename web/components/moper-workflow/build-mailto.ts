import type { MoperRegistroApi } from "@/lib/moper-registros-types";
import { moperFirmaPublicUrl } from "@/lib/moper-public-paths";

export function buildMailtoBody(registro: MoperRegistroApi): string {
  const firmaUrl =
    typeof window !== "undefined"
      ? window.location.origin + moperFirmaPublicUrl(registro.codigo_acceso ?? undefined)
      : "";
  const line = (label: string, value: string | number | null | undefined) =>
    value != null && String(value).trim() !== "" ? `${label}: ${String(value).trim()}` : null;
  const sueldoActual =
    registro.sueldo_actual != null ? `$ ${Number(registro.sueldo_actual).toLocaleString("es-MX")}` : "-";
  const sueldoNuevo =
    registro.sueldo_nuevo != null ? `$ ${Number(registro.sueldo_nuevo).toLocaleString("es-MX")}` : "-";
  const lines = [
    "Movimiento de Personal (MOPER)",
    "",
    line("Folio", registro.folio),
    line("Fecha de llenado", registro.fecha_llenado || registro.created_at || null),
    line("Nombre del oficial", registro.oficial_nombre),
    line(
      "Servicio",
      registro.servicio_actual_nombre && registro.servicio_nuevo_nombre
        ? `${registro.servicio_actual_nombre} → ${registro.servicio_nuevo_nombre}`
        : registro.servicio_nuevo_nombre || registro.servicio_actual_nombre || null,
    ),
    line(
      "Puesto",
      registro.puesto_actual_nombre && registro.puesto_nuevo_nombre
        ? `${registro.puesto_actual_nombre} → ${registro.puesto_nuevo_nombre}`
        : registro.puesto_nuevo_nombre || registro.puesto_actual_nombre || null,
    ),
    line("Sueldo", sueldoActual !== "-" || sueldoNuevo !== "-" ? `${sueldoActual} → ${sueldoNuevo}` : null),
    line("Motivo", registro.motivo),
    line("Quien solicita", registro.solicitado_por),
    registro.codigo_acceso ? `\nCodigo de acceso: ${registro.codigo_acceso}` : null,
    firmaUrl ? `\nEnlace para firmar (sin login): ${firmaUrl}` : null,
  ].filter(Boolean);
  return lines.join("\r\n");
}
