import type { MoperRegistroApi } from "@/lib/moper-registros-types";
import {
  moperFirmaPublicUrl,
  moperRegistroInternoUrl,
  type MoperFirmaInternaTipo,
} from "@/lib/moper-public-paths";

function resolveOrigin(origin?: string): string {
  const o = (origin ?? (typeof window !== "undefined" ? window.location.origin : "")).trim();
  return o.replace(/\/$/, "");
}

const FIRMAS_INTERNAS: { tipo: MoperFirmaInternaTipo; label: string }[] = [
  { tipo: "rh", label: "Gerente RH" },
  { tipo: "gerente", label: "Gerente de Operaciones" },
  { tipo: "control", label: "Centro de Control" },
];

export function buildMailtoBody(registro: MoperRegistroApi, origin?: string): string {
  const base = resolveOrigin(origin);
  const firmaOficialUrl =
    base && registro.codigo_acceso ? base + moperFirmaPublicUrl(registro.codigo_acceso) : "";
  const line = (label: string, value: string | number | null | undefined) =>
    value != null && String(value).trim() !== "" ? `${label}: ${String(value).trim()}` : null;
  const sueldoActual =
    registro.sueldo_actual != null ? `$ ${Number(registro.sueldo_actual).toLocaleString("es-MX")}` : "-";
  const sueldoNuevo =
    registro.sueldo_nuevo != null ? `$ ${Number(registro.sueldo_nuevo).toLocaleString("es-MX")}` : "-";
  const enlacesInternos =
    base && registro.id
      ? FIRMAS_INTERNAS.map(
          ({ tipo, label }) =>
            `\nEnlace para ${label} (iniciar sesion): ${base + moperRegistroInternoUrl(registro.id, tipo)}`,
        ).join("")
      : "";
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
    line("Razon", registro.razon),
    line("Quien solicita", registro.solicitado_por),
    registro.codigo_acceso ? `\nCodigo de acceso (oficial): ${registro.codigo_acceso}` : null,
    firmaOficialUrl ? `\nEnlace para el oficial (sin login): ${firmaOficialUrl}` : null,
    enlacesInternos || null,
  ].filter(Boolean);
  return lines.join("\r\n");
}
