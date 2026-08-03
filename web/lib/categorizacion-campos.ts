/** Definición de criterios calificables (1–5) por módulo. */

import {
  CAT_OPERACIONES_JEFE_TURNO_CAMPOS,
  type CatOperacionesRolId,
} from "@/lib/categorizacion-operaciones-roles";

export type CatEvalModuloId =
  | "recursos_humanos"
  | "operaciones"
  | "enfoque_cliente";

export type CatCampoDef = { key: string; label: string };

/** Ausentismos = faltas del mes en desfase (mes anterior) en cuadrícula (solo lectura; no se califica 1–5). */
export const CAT_RH_AUSENTISMOS_LABEL = "Ausentismos (faltas mes anterior)";

export const CAT_RH_CAMPOS: CatCampoDef[] = [
  { key: "rotacion_servicios", label: "Rotación dentro de los servicios" },
  { key: "actas_administrativas", label: "Actas administrativas" },
];

export const CAT_OPERACIONES_CAMPOS: CatCampoDef[] = [
  { key: "cumplimiento_consignas", label: "Cumplimiento de consignas" },
  { key: "manejo_herramientas", label: "Manejo de herramientas" },
  { key: "desempeno_funciones", label: "Desempeño en funciones" },
  { key: "conocimiento_procesos", label: "Conocimiento de procesos y protocolos" },
  { key: "uso_uniforme", label: "Uso correcto del uniforme" },
  { key: "comparte_informacion", label: "Comparte información de manera clara" },
  { key: "expresa_ideas", label: "Expresa sus ideas con claridad" },
  { key: "escucha_indicaciones", label: "Escucha y ejecuta las indicaciones" },
  { key: "miembro_activo", label: "Se desempeña como miembro activo del equipo" },
  { key: "comparte_conocimientos", label: "Comparte conocimientos en asuntos clave" },
  { key: "conserva_calma", label: "Conserva la calma en situaciones complicadas" },
  { key: "adapta_procesos", label: "Se adapta a trabajar con nuevos procesos" },
  { key: "innovacion", label: "Se esfuerza por innovar y aportar ideas" },
  {
    key: "refuerzo_habilidades",
    label: "Busca reforzar habilidades y trabajar áreas de oportunidad",
  },
];

export const CAT_ENFOQUE_CAMPOS: CatCampoDef[] = [
  { key: "entiende_necesidades", label: "Entiende las necesidades del cliente" },
  { key: "valor_agregado", label: "Busca nuevas maneras de brindar valor agregado" },
  { key: "satisfaccion_cliente", label: "Procura la satisfacción del cliente (servicio de calidad)" },
  { key: "confiable_cliente", label: "Es percibido por el cliente como persona confiable" },
];

export function camposOperacionesPorRol(rol: CatOperacionesRolId): CatCampoDef[] {
  return rol === "jefe_turno" ? CAT_OPERACIONES_JEFE_TURNO_CAMPOS : CAT_OPERACIONES_CAMPOS;
}

export function camposPorModulo(
  modulo: CatEvalModuloId,
  opts?: { rolOperaciones?: CatOperacionesRolId },
): CatCampoDef[] {
  if (modulo === "recursos_humanos") return CAT_RH_CAMPOS;
  if (modulo === "operaciones") return camposOperacionesPorRol(opts?.rolOperaciones ?? "oficial");
  return CAT_ENFOQUE_CAMPOS;
}

export function labelModuloEval(modulo: CatEvalModuloId): string {
  if (modulo === "recursos_humanos") return "Recursos Humanos";
  if (modulo === "operaciones") return "Operaciones";
  return "Enfoque al cliente";
}
