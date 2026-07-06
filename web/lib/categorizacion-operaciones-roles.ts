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
    hint: "15 criterios operativos. Cada jefe de turno del servicio califica por separado; el promedio operaciones es la media de esas calificaciones.",
  },
  {
    id: "jefe_turno",
    label: "Jefe de turno (JT)",
    hint: "24 criterios de liderazgo. Cada oficial del servicio califica por separado; el promedio operaciones es la media de esas calificaciones.",
  },
];

/** Criterios que los oficiales asignan al jefe de turno (escala 1–5). */
export const CAT_OPERACIONES_JEFE_TURNO_CAMPOS: CatCampoDef[] = [
  {
    key: "explica_funciones_equipo",
    label: "Explica con claridad a su equipo de trabajo las funciones que deben realizar",
  },
  {
    key: "resuelve_dudas_oficiales",
    label: "Resuelve las dudas de los oficiales de manera satisfactoria",
  },
  {
    key: "explica_ideas_equipo",
    label: "Explica con claridad las ideas a su equipo de trabajo",
  },
  {
    key: "comunica_riesgos",
    label: "Comunica oportunamente situaciones de riesgo relevantes",
  },
  { key: "cumplimiento_consignas", label: "Cumplimiento de consignas" },
  { key: "puntualidad", label: "Puntualidad" },
  { key: "actitud_servicio", label: "Actitud de servicio" },
  { key: "imagen_limpieza", label: "Imagen y limpieza" },
  { key: "trabajo_equipo", label: "Trabajo en equipo" },
  {
    key: "conocimiento_procesos_seguridad",
    label: "Conocimiento de procesos y protocolos de seguridad",
  },
  { key: "seguir_instrucciones", label: "Capacidad para seguir instrucciones" },
  {
    key: "identificar_mitigar_riesgos",
    label: "Capacidad para identificar y mitigar riesgos",
  },
  { key: "liderazgo_gestion_equipo", label: "Liderazgo y gestión de equipo" },
  { key: "empatia", label: "Empatía" },
  {
    key: "delegar_tareas",
    label: "Capacidad para delegar tareas y responsabilidades",
  },
  {
    key: "planificacion_organizacion",
    label: "Planificación y organización de actividades diarias",
  },
  {
    key: "gestion_incidencias_conflictos",
    label: "Gestión de incidencias y resolución de conflictos",
  },
  {
    key: "calidad_servicio",
    label: "Calidad de servicio (atención a oficiales/clientes)",
  },
  {
    key: "desarrollo_capacitacion",
    label: "Desarrollo y capacitación / retroalimentación de consignas / actividades",
  },
  {
    key: "equipo_capacitado",
    label: "Se asegura que el equipo esté bien capacitado en las tareas asignadas",
  },
  {
    key: "supervisa_cumplimiento",
    label: "Supervisa que se cumplan las tareas asignadas",
  },
  {
    key: "oficiales_apoyados",
    label: "Los oficiales se sienten apoyados por él cuando lo necesitan",
  },
  {
    key: "facilita_guia_herramientas",
    label: "Les facilita una guía o herramienta necesaria para realizar las funciones",
  },
  {
    key: "trato_amable_respetuoso",
    label: "Su trato es amable, respetuoso y profesional",
  },
];

function normPuesto(puesto: string): string {
  return puesto.trim().replace(/\s+/g, " ").toUpperCase();
}

export function puestoEsJefeTurno(puesto: string): boolean {
  const p = normPuesto(puesto);
  if (!p) return false;
  if (p === "JT" || p === "JEFE TURNO" || p === "JEFE DE TURNO") return true;
  return p.includes("JEFE") && p.includes("TURNO");
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

/** Jefes de turno del mismo servicio que pueden calificar a un oficial. */
export function filtrarJefesTurnoParaCalificarOficial(
  personal: Array<{ noEmpleado: string; nombre: string; puesto: string; servicio: string }>,
  servicio: string,
): Array<{ noEmpleado: string; nombre: string }> {
  const svc = servicio.trim();
  return personal
    .filter((p) => puestoEsJefeTurno(p.puesto) && (!svc || p.servicio.trim() === svc))
    .map((p) => ({ noEmpleado: p.noEmpleado, nombre: p.nombre }))
    .sort((a, b) => a.noEmpleado.localeCompare(b.noEmpleado, "es", { numeric: true }));
}
