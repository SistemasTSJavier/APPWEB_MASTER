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
    hint: "Criterios operativos. Cada JT o JS del servicio califica por separado; el promedio operaciones es la media de esas calificaciones.",
  },
  {
    id: "jefe_turno",
    label: "JT / JS",
    hint: "Criterios de liderazgo. Elija un JT o JS; cada oficial del servicio lo califica por separado y el promedio es la media de esas calificaciones.",
  },
];

/** Criterios de liderazgo que los oficiales asignan al JT/JS (escala 1–5). */
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
  return puesto
    .trim()
    .replace(/\s+/g, " ")
    .toUpperCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "");
}

/** Jefe de servicio: JS, J.S., JEFE/JEFA SERVICIO, JEFE DE SERVICIO, etc. */
export function puestoEsJefeServicio(puesto: string): boolean {
  const p = normPuesto(puesto);
  if (!p) return false;
  // JS / J.S. / J S (evitar falsos positivos de palabras sueltas)
  if (/(^|[^A-Z])J\.?\s*S\.?([^A-Z]|$)/.test(` ${p} `)) return true;
  if (
    p === "JS" ||
    p === "JEFE SERVICIO" ||
    p === "JEFE DE SERVICIO" ||
    p === "JEFA SERVICIO" ||
    p === "JEFA DE SERVICIO"
  ) {
    return true;
  }
  // JEFE(A) / JEFA + SERVICIO, sin TURNO
  if (/\bJEF[EA]\b/.test(p) && p.includes("SERVICIO") && !p.includes("TURNO")) return true;
  return false;
}

export function puestoEsJefeTurno(puesto: string): boolean {
  if (puestoEsJefeServicio(puesto)) return false;
  const p = normPuesto(puesto);
  if (!p) return false;
  // JT, J.T., J T, JEFE/JEFA TURNO, JEFE DE TURNO, etc.
  if (/(^|[^A-Z])J\.?\s*T\.?([^A-Z]|$)/.test(` ${p} `)) return true;
  if (
    p === "JT" ||
    p === "JEFE TURNO" ||
    p === "JEFE DE TURNO" ||
    p === "JEFA TURNO" ||
    p === "JEFA DE TURNO"
  ) {
    return true;
  }
  if (/\bJEF[EA]\b/.test(p) && p.includes("TURNO")) return true;
  return false;
}

/** JT o JS: perfil de liderazgo en Operaciones. */
export function puestoEsLiderazgoOperaciones(puesto: string): boolean {
  return puestoEsJefeServicio(puesto) || puestoEsJefeTurno(puesto);
}

export function puestoEsOficialOperaciones(puesto: string): boolean {
  if (puestoEsLiderazgoOperaciones(puesto)) return false;
  const p = normPuesto(puesto);
  if (!p) return true;
  return p.includes("OFICIAL");
}

export function rolOperacionesDesdePuesto(puesto: string): CatOperacionesRolId {
  // JT y JS comparten mapa / criterios de liderazgo (submodulo jefe_turno).
  return puestoEsLiderazgoOperaciones(puesto) ? "jefe_turno" : "oficial";
}

export function personalCoincideRolOperaciones(puesto: string, rol: CatOperacionesRolId): boolean {
  if (rol === "jefe_turno") return puestoEsLiderazgoOperaciones(puesto);
  // Solo oficiales reales (excluye JT y JS)
  return puestoEsOficialOperaciones(puesto);
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

/** Oficiales del mismo servicio (legado / compatibilidad). */
export function filtrarOficialesParaCalificarJefe(
  personal: Array<{ noEmpleado: string; nombre: string; puesto: string; servicio: string }>,
  servicio: string,
  serviciosCoinciden?: (a: string, b: string) => boolean,
): Array<{ noEmpleado: string; nombre: string }> {
  const svc = servicio.trim();
  const coincide = serviciosCoinciden ?? ((a: string, b: string) => a.trim() === b.trim());
  return personal
    .filter(
      (p) =>
        puestoEsOficialOperaciones(p.puesto) &&
        (!svc || coincide(p.servicio, svc)),
    )
    .map((p) => ({ noEmpleado: p.noEmpleado, nombre: p.nombre }))
    .sort((a, b) => a.noEmpleado.localeCompare(b.noEmpleado, "es", { numeric: true }));
}

/** Jefes de servicio (JS) del mismo servicio que pueden calificar a un jefe de turno. */
export function filtrarJefesServicioParaCalificarJefeTurno(
  personal: Array<{ noEmpleado: string; nombre: string; puesto: string; servicio: string }>,
  servicio: string,
  serviciosCoinciden?: (a: string, b: string) => boolean,
): Array<{ noEmpleado: string; nombre: string }> {
  const svc = servicio.trim();
  const coincide = serviciosCoinciden ?? ((a: string, b: string) => a.trim() === b.trim());
  return personal
    .filter((p) => puestoEsJefeServicio(p.puesto) && (!svc || coincide(p.servicio, svc)))
    .map((p) => ({ noEmpleado: p.noEmpleado, nombre: p.nombre }))
    .sort((a, b) => a.noEmpleado.localeCompare(b.noEmpleado, "es", { numeric: true }));
}

/** Jefes de turno del mismo servicio que pueden calificar a un oficial. */
export function filtrarJefesTurnoParaCalificarOficial(
  personal: Array<{ noEmpleado: string; nombre: string; puesto: string; servicio: string }>,
  servicio: string,
  serviciosCoinciden?: (a: string, b: string) => boolean,
): Array<{ noEmpleado: string; nombre: string }> {
  const svc = servicio.trim();
  const coincide = serviciosCoinciden ?? ((a: string, b: string) => a.trim() === b.trim());
  return personal
    .filter((p) => puestoEsJefeTurno(p.puesto) && (!svc || coincide(p.servicio, svc)))
    .map((p) => ({ noEmpleado: p.noEmpleado, nombre: p.nombre }))
    .sort((a, b) => a.noEmpleado.localeCompare(b.noEmpleado, "es", { numeric: true }));
}

/** JT + JS del servicio (califican oficiales; también se califican entre sí en perfil liderazgo). */
export function filtrarLiderazgoParaCalificar(
  personal: Array<{ noEmpleado: string; nombre: string; puesto: string; servicio: string }>,
  servicio: string,
  serviciosCoinciden?: (a: string, b: string) => boolean,
  opts?: { excluirNoEmpleado?: string },
): Array<{ noEmpleado: string; nombre: string }> {
  const svc = servicio.trim();
  const coincide = serviciosCoinciden ?? ((a: string, b: string) => a.trim() === b.trim());
  const excluir = String(opts?.excluirNoEmpleado ?? "")
    .trim()
    .toUpperCase();
  return personal
    .filter(
      (p) =>
        puestoEsLiderazgoOperaciones(p.puesto) &&
        (!svc || coincide(p.servicio, svc)) &&
        (!excluir || p.noEmpleado.trim().toUpperCase() !== excluir),
    )
    .map((p) => ({ noEmpleado: p.noEmpleado, nombre: p.nombre }))
    .sort((a, b) => a.noEmpleado.localeCompare(b.noEmpleado, "es", { numeric: true }));
}

/** Claves típicas solo del perfil JT (no del oficial). */
const JT_SCORE_KEYS_UNICOS = new Set([
  "explica_funciones_equipo",
  "resuelve_dudas_oficiales",
  "explica_ideas_equipo",
  "comunica_riesgos",
  "liderazgo_gestion_equipo",
  "delegar_tareas",
  "planificacion_organizacion",
  "gestion_incidencias_conflictos",
  "equipo_capacitado",
  "supervisa_cumplimiento",
  "oficiales_apoyados",
  "facilita_guia_herramientas",
  "trato_amable_respetuoso",
  "conocimiento_procesos_seguridad",
  "identificar_mitigar_riesgos",
  "desarrollo_capacitacion",
]);

/** true si los scores parecen una calificación de liderazgo al JT. */
export function scoresParecenJefeTurno(scores: Record<string, number> | null | undefined): boolean {
  if (!scores) return false;
  for (const k of Object.keys(scores)) {
    if (JT_SCORE_KEYS_UNICOS.has(k)) return true;
  }
  return false;
}
