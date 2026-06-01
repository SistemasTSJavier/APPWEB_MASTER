import type { CatNivelId, CatPaqueteId } from "@/lib/categorizacion-calificaciones";

export type CatDashboardRhDetalle = {
  ausentismos: number | null;
  rotacionServicios: number | null;
  actasAdministrativas: number | null;
};

export type CatDashboardEmpleado = {
  noEmpleado: string;
  nombre: string;
  servicio: string;
  puesto: string;
  periodoEvaluacion: string;
  fechaIngreso: string;
  tiempoEnEmpresa: string;
  edad: string;
  escolaridad: string;
  promedioRh: number | null;
  promedioCapacitacion: number | null;
  promedioOperaciones: number | null;
  promedioEnfoque: number | null;
  promedioGraficaModulos: number | null;
  promedioGeneral: number | null;
  nivel: string;
  paquete: string;
  nivelId: CatNivelId | null;
  paqueteId: CatPaqueteId | null;
  rh: CatDashboardRhDetalle;
};

export type CatDashboardPayload = {
  empleados: CatDashboardEmpleado[];
  servicios: string[];
  generadoEn: string;
};
