/** Registro MOPER (workflow formulario + firmas). */
export type MoperRegistroRow = {
  id: number;
  folio: string | null;
  estado: "pendiente" | "aprobado" | "cancelado";
  codigo_acceso: string;
  oficial_nombre: string;
  curp: string;
  fecha_ingreso: string | null;
  fecha_inicio_efectiva: string;
  servicio_actual_nombre: string;
  servicio_nuevo_nombre: string;
  puesto_actual_nombre: string;
  puesto_nuevo_nombre: string;
  sueldo_actual: number | null;
  sueldo_nuevo: number;
  motivo: string;
  razon: string;
  creado_por: string | null;
  solicitado_por: string | null;
  firma_conformidad_at: string | null;
  firma_conformidad_nombre: string | null;
  firma_conformidad_imagen: string | null;
  firma_rh_at: string | null;
  firma_rh_nombre: string | null;
  firma_rh_imagen: string | null;
  firma_gerente_at: string | null;
  firma_gerente_nombre: string | null;
  firma_gerente_imagen: string | null;
  firma_control_at: string | null;
  firma_control_nombre: string | null;
  firma_control_imagen: string | null;
  completado: boolean;
  created_at: string;
  updated_at: string;
};

/** Respuesta JSON del frontend moper-frontend (snake_case). */
export type MoperRegistroApi = {
  id: number;
  folio: string | null;
  oficial_nombre?: string;
  curp?: string;
  fecha_ingreso?: string | null;
  fecha_inicio_efectiva?: string | null;
  servicio_actual_nombre?: string;
  servicio_nuevo_nombre?: string;
  puesto_actual_nombre?: string;
  puesto_nuevo_nombre?: string;
  sueldo_actual?: number | null;
  sueldo_nuevo?: number | null;
  motivo?: string;
  razon?: string;
  creado_por?: string | null;
  solicitado_por?: string | null;
  fecha_llenado?: string | null;
  fecha_registro?: string | null;
  created_at?: string | null;
  firma_conformidad_at?: string | null;
  firma_conformidad_nombre?: string | null;
  firma_conformidad_imagen?: string | null;
  firma_rh_at?: string | null;
  firma_rh_nombre?: string | null;
  firma_rh_imagen?: string | null;
  firma_gerente_at?: string | null;
  firma_gerente_nombre?: string | null;
  firma_gerente_imagen?: string | null;
  firma_control_at?: string | null;
  firma_control_nombre?: string | null;
  firma_control_imagen?: string | null;
  completado?: boolean;
  codigo_acceso?: string | null;
  estado?: string;
};

export type MoperResumenApi = {
  pendientes: number;
  aprobados: number;
  registrosPendientes: {
    id: number;
    folio: string | null;
    oficial_nombre: string | null;
    fecha_hora: string | null;
  }[];
  registrosAprobados: {
    id: number;
    folio: string | null;
    oficial_nombre: string | null;
    fecha_hora: string | null;
  }[];
};

export type MoperRegistroCreateBody = {
  oficial_nombre?: string;
  curp?: string;
  fecha_ingreso?: string | null;
  fecha_inicio_efectiva?: string;
  servicio_actual_nombre?: string;
  servicio_nuevo_nombre?: string;
  puesto_actual_nombre?: string;
  puesto_nuevo_nombre?: string;
  sueldo_actual?: number | null;
  sueldo_nuevo?: number;
  motivo?: string;
  razon?: string;
  creado_por?: string;
  solicitado_por?: string;
};

export type MoperFirmaTipo = "conformidad" | "rh" | "gerente" | "control";
