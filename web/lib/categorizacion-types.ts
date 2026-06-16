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
};

export type CatEvaluacionRow = {
  noEmpleado: string;
  modulo: CatEvalModuloId;
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
