export type ColaboradorSnapshot = {
  noEmpleado: string;
  nombreCompleto: string;
  fechaIngreso: string;
  servicioAsignado: string;
  ultimoServicio: string;
  nss: string;
  posicion: string;
  puesto: string;
};

export type FamiliarGuardado = {
  nombreFamiliar: string;
  parentesco: string;
  fechaNacimiento: string;
  beneficiarioBancario: string;
};

export type MoperEstadoLinea = {
  servicio: string;
  puesto: string;
};

export type ColaboradorCompleto = ColaboradorSnapshot & {
  registeredAt: string;
  form: Record<string, string>;
  familiares: FamiliarGuardado[];
  moperActual?: MoperEstadoLinea;
};
