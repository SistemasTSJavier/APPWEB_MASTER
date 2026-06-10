import type { CatCampoDef } from "@/lib/categorizacion-campos";

/** Perfil de calificación dentro del módulo Operaciones. */
export type CatOperacionesRolId = "oficial" | "jefe_turno";

export const CAT_OPERACIONES_ROLES: {
  id: CatOperacionesRolId;
  label: string;
  hint: string;
}[] = [
  {
    id: "oficial",
    label: "Oficial",
    hint: "15 criterios operativos. El colaborador con puesto de oficial se califica en capacitación / RH operativo.",
  },
  {
    id: "jefe_turno",
    label: "Jefe de turno",
    hint: "Cada oficial del servicio califica por separado. El promedio operaciones es la media de esas calificaciones.",
  },
];

/** Criterios que el oficial asigna al jefe de turno (escala 1–5). */
export const CAT_OPERACIONES_JEFE_TURNO_CAMPOS: CatCampoDef[] = [
  { key: "liderazgo_turno", label: "Liderazgo y coordinación del turno" },
  { key: "cumplimiento_consignas", label: "Cumplimiento de consignas del servicio" },
  { key: "supervision_personal", label: "Supervisión y apoyo al personal" },
  { key: "reporte_incidencias", label: "Reporte oportuno de incidencias" },
  { key: "comunicacion_oficial", label: "Comunicación efectiva con oficiales" },
  { key: "disciplina_operativa", label: "Disciplina operativa del turno" },
  { key: "manejo_situaciones", label: "Manejo de situaciones imprevistas" },
  { key: "entrega_turno", label: "Entrega de turno documentada y clara" },
];

function normPuesto(puesto: string): string {
  return puesto.trim().replace(/\s+/g, " ").toUpperCase();
}

export function puestoEsJefeTurno(puesto: string): boolean {
  const p = normPuesto(puesto);
  if (!p) return false;
  return (p.includes("JEFE") && p.includes("TURNO")) || p === "JEFE TURNO";
}

export function puestoEsOficialOperaciones(puesto: string): boolean {
  if (puestoEsJefeTurno(puesto)) return false;
  const p = normPuesto(puesto);
  if (!p) return true;
  return p.includes("OFICIAL");
}

export function rolOperacionesDesdePuesto(puesto: string): CatOperacionesRolId {
  return puestoEsJefeTurno(puesto) ? "jefe_turno" : "oficial";
}

export function personalCoincideRolOperaciones(puesto: string, rol: CatOperacionesRolId): boolean {
  if (rol === "jefe_turno") return puestoEsJefeTurno(puesto);
  return !puestoEsJefeTurno(puesto);
}

export function submoduloOperaciones(rol: CatOperacionesRolId): string {
  return rol;
}

export function normalizarSubmoduloOperaciones(raw: string | null | undefined): CatOperacionesRolId {
  const s = String(raw ?? "").trim().toLowerCase();
  if (s === "jefe_turno" || s === "jefe-turno") return "jefe_turno";
  return "oficial";
}

export function etiquetaRolOperaciones(rol: CatOperacionesRolId): string {
  return CAT_OPERACIONES_ROLES.find((r) => r.id === rol)?.label ?? rol;
}

export function normalizarNoEmpleadoCat(no: string): string {
  return no.trim().toUpperCase();
}

/** Oficiales del mismo servicio que pueden calificar a un jefe de turno. */
export function filtrarOficialesParaCalificarJefe(
  personal: Array<{ noEmpleado: string; nombre: string; puesto: string; servicio: string }>,
  servicio: string,
): Array<{ noEmpleado: string; nombre: string }> {
  const svc = servicio.trim();
  return personal
    .filter(
      (p) =>
        puestoEsOficialOperaciones(p.puesto) &&
        (!svc || p.servicio.trim() === svc),
    )
    .map((p) => ({ noEmpleado: p.noEmpleado, nombre: p.nombre }))
    .sort((a, b) => a.noEmpleado.localeCompare(b.noEmpleado, "es", { numeric: true }));
}
