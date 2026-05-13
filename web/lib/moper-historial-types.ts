export type MoperHistorialEntrada = {
  noEmpleado: string;
  servicioInicial: string;
  servicioFinal: string;
  puestoInicial: string;
  puestoFinal: string;
  motivo: string;
  especificacion: string;
  registradoEn: string;
  /** Presente cuando el registro viene del API GET (fila en `moper_historial`). */
  historialId?: string;
};
