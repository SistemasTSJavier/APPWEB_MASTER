export const ALERTAS_LEGAL_MOTIVOS = [
  "renuncia",
  "finiquito",
  "convenio",
  "comparecencia",
  "otro",
] as const;

export type AlertaLegalMotivo = (typeof ALERTAS_LEGAL_MOTIVOS)[number];

export const ALERTAS_LEGAL_ESTADOS = ["pendiente", "llego", "cancelado"] as const;
export type AlertaLegalEstado = (typeof ALERTAS_LEGAL_ESTADOS)[number];

export const ALERTAS_LEGAL_MOTIVO_LABEL: Record<AlertaLegalMotivo, string> = {
  renuncia: "Renuncia",
  finiquito: "Finiquito",
  convenio: "Convenio",
  comparecencia: "Comparecencia",
  otro: "Otro",
};

export const ALERTAS_LEGAL_ESTADO_LABEL: Record<AlertaLegalEstado, string> = {
  pendiente: "Pendiente",
  llego: "Llegó a firmar",
  cancelado: "Cancelado",
};

export type AlertaLegalFila = {
  id: string;
  noEmpleado: string;
  nombre: string;
  servicio: string;
  motivo: AlertaLegalMotivo;
  notas: string;
  estado: AlertaLegalEstado;
  createdByEmail: string;
  createdAt: string;
  llegoAt: string | null;
  llegoByEmail: string | null;
  emailEnviadoAt: string | null;
  emailError: string | null;
};

export type AlertaLegalDetalleCorreo = {
  nombre: string;
  fechaNacimiento: string;
  fechaBaja: string;
  curp: string;
  motivoBaja: string;
};

export function esAlertaLegalMotivo(v: string): v is AlertaLegalMotivo {
  return (ALERTAS_LEGAL_MOTIVOS as readonly string[]).includes(v);
}

export function esAlertaLegalEstado(v: string): v is AlertaLegalEstado {
  return (ALERTAS_LEGAL_ESTADOS as readonly string[]).includes(v);
}

export function esEmailDestinoAlertasLegal(v: string): boolean {
  const s = v.trim();
  if (s.length < 6 || s.length > 120) return false;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s);
}
