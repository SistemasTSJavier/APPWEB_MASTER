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

export type CatEvaluacionRow = {
  noEmpleado: string;
  modulo: CatEvalModuloId;
  /** En operaciones: oficial | jefe_turno. Vacío en RH y enfoque al cliente. */
  submodulo: string;
  /** Jefe de turno: N.º del oficial que califica. Vacío en los demás casos. */
  calificadoPor: string;
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
