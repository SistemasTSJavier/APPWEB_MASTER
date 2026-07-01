/** Hitos de bono por antigüedad desde ingreso (15, 30, 60 o 90 días sin F ni PSGS). */
export const BONOS_MILESTONES = [15, 30, 60, 90] as const;

export type BonosMilestone = (typeof BONOS_MILESTONES)[number];

/** Antigüedad máxima (exclusiva) para seguir en ventana del bono de 90 días (90–119 días). */
export const BONOS_ANTIGUEDAD_TOPE_90 = 120;

export type BonosFila = {
  noEmpleado: string;
  nombre: string;
  fechaIngreso: string;
  servicio: string;
  localForaneo: string;
  /** Hito cumplido (15, 30, 60 o 90). */
  bonoDias: BonosMilestone;
  /** Fecha efectiva del bono (= ingreso + N días). */
  fechaCumplimiento: string;
  /** Inicio del periodo evaluado (fecha de ingreso). */
  periodoEvaluadoDesde: string;
  /** Fin del periodo evaluado (= fecha de cumplimiento). */
  periodoEvaluadoHasta: string;
};

export type BonosPayload = {
  filas: BonosFila[];
  servicios: string[];
  generadoEn: string;
  /** Activos LOCAL elegibles (servicio operativo, sin áreas admin). */
  totalActivos: number;
  /** Elegibles con bono cumplido en el filtro actual. */
  totalConBono: number;
  /** Fecha de referencia del cálculo (hoy). */
  fechaReferencia: string;
  /** Semana lun–dom del filtro (cumplimiento dentro del rango). */
  semanaEvaluacion?: {
    lunesYmd: string;
    domingoYmd: string;
    etiqueta: string;
  };
};
