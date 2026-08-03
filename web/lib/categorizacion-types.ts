import type { CatEvalModuloId } from "@/lib/categorizacion-campos";

export type CatPersonalRow = {
  noEmpleado: string;
  periodoEvaluacion: string;
  fechaIngreso: string;
  nombre: string;
  servicio: string;
  puesto: string;
  fechaNacimiento: string;
  edad: string;
  escolaridad: string;
  estatus: string;
  fechaBaja: string;
  updatedAt?: string;
};

/** Colaborador activo desde expedientes (fuente: sección Colaboradores). */
export type CatColaboradorActivoOpcion = {
  noEmpleado: string;
  nombre: string;
  servicio: string;
  puesto: string;
  /** Planta en expediente (relevante para filtro CAT / U-ERRE). */
  planta?: string;
  /** Fecha de ingreso YYYY-MM-DD (para historial por mes). */
  fechaIngreso?: string;
};

export type CatEvaluacionRow = {
  noEmpleado: string;
  modulo: CatEvalModuloId;
  /** En operaciones: oficial | jefe_turno; vacío en otros módulos. */
  submodulo?: string;
  /** N.º del evaluador (JT/JS según el perfil). */
  calificadoPor?: string;
  /** Mes de la calificación YYYY-MM (historial). */
  periodMonth: string;
  scores: Record<string, number>;
  comentarios: string;
  promedio: number | null;
};

export type CatCapacitacionCurso = {
  id: string;
  nombre: string;
  fechaInicio: string;
  fechaVencimiento: string;
  activo: boolean;
};

export type CatCapacitacionRegistro = {
  id: string;
  noEmpleado: string;
  cursoId: string;
  cursoNombre?: string;
  /** Mes YYYY-MM del registro (historial). */
  periodMonth: string;
  asistencia: number | null;
  desempeno: number | null;
  promedio: number | null;
  comentarios: string;
};

export type CatResumenEmpleado = {
  noEmpleado: string;
  nombre: string;
  promedioRh: number | null;
  promedioCapacitacion: number | null;
  promedioOperaciones: number | null;
  promedioEnfoque: number | null;
  promedioGeneral: number | null;
  nivel: string;
  paquete: string;
};
