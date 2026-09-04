import { isSgcDepartamentoId, esFormatoDepartamentoId, SGC_DEPARTAMENTOS, type SgcDepartamentoId } from "@/lib/sgc-calidad";

/** Decisión previa: sin aprobar no hay estatus de seguimiento. */
export const BUZON_APROBACIONES = ["pendiente", "aprobado", "no_aprobado"] as const;
export type BuzonAprobacion = (typeof BUZON_APROBACIONES)[number];

export const BUZON_APROBACION_LABEL: Record<BuzonAprobacion, string> = {
  pendiente: "Pendiente de aprobación",
  aprobado: "Aprobado",
  no_aprobado: "No aprobado",
};

/** Solo aplica cuando aprobacion = 'aprobado'. */
export const BUZON_ESTADOS = [
  "recibido",
  "en_revision",
  "en_proceso",
  "resuelto",
  "cerrado",
] as const;

export type BuzonEstatus = (typeof BUZON_ESTADOS)[number];

export const BUZON_ESTATUS_LABEL: Record<BuzonEstatus, string> = {
  recibido: "Recibido",
  en_revision: "En revisión",
  en_proceso: "En proceso",
  resuelto: "Resuelto",
  cerrado: "Cerrado",
};

export type BuzonNota = {
  at: string;
  by: string;
  tipo: "aprobacion" | "estatus";
  aprobacion?: BuzonAprobacion;
  estatus?: BuzonEstatus;
  nota: string;
};

export type BuzonRegistro = {
  id: string;
  codigoSeguimiento: string;
  departamento: SgcDepartamentoId | string;
  nombreColaborador: string;
  quejaRequerimiento: string;
  evidenciaPath: string;
  evidenciaUrl: string;
  aprobacion: BuzonAprobacion;
  estatus: BuzonEstatus | null;
  notas: BuzonNota[];
  createdAt: string;
  updatedAt: string;
};

/** Vista pública de verificación (sin id interno ni path de storage). */
export type BuzonVerificacionPublica = {
  codigoSeguimiento: string;
  departamento: string;
  departamentoLabel: string;
  nombreColaborador: string;
  quejaRequerimiento: string;
  evidenciaUrl: string;
  aprobacion: BuzonAprobacion;
  aprobacionLabel: string;
  /** Solo si está aprobado; si no, null. */
  estatus: BuzonEstatus | null;
  estatusLabel: string | null;
  notas: Array<{
    at: string;
    tipo: "aprobacion" | "estatus";
    label: string;
    nota: string;
  }>;
  createdAt: string;
  updatedAt: string;
};

export type BuzonCreateFields = {
  departamento: string;
  nombreColaborador: string;
  quejaRequerimiento: string;
};

export const BUZON_EVIDENCIA_BUCKET = "buzon-evidencias";
export const BUZON_EVIDENCIA_MAX_BYTES = 5 * 1024 * 1024;

export function etiquetaDepartamentoBuzon(id: string): string {
  return SGC_DEPARTAMENTOS.find((d) => d.id === id)?.label ?? id;
}

export function esBuzonAprobacion(v: unknown): v is BuzonAprobacion {
  return typeof v === "string" && (BUZON_APROBACIONES as readonly string[]).includes(v);
}

export function esBuzonEstatus(v: unknown): v is BuzonEstatus {
  return typeof v === "string" && (BUZON_ESTADOS as readonly string[]).includes(v);
}

function limpiaTexto(v: unknown, max: number): string {
  return String(v ?? "")
    .replace(/\r\n/g, "\n")
    .trim()
    .slice(0, max);
}

export function normalizarCodigoSeguimiento(raw: string): string {
  return String(raw ?? "")
    .trim()
    .toUpperCase()
    .replace(/\s+/g, "");
}

export function generarCodigoSeguimiento(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let suffix = "";
  for (let i = 0; i < 4; i++) {
    suffix += alphabet[Math.floor(Math.random() * alphabet.length)]!;
  }
  return `BZ-${y}${m}${d}-${suffix}`;
}

export function validarBuzonCreate(
  body: unknown,
): { ok: true; data: BuzonCreateFields } | { ok: false; error: string } {
  if (!body || typeof body !== "object") return { ok: false, error: "Datos inválidos." };
  const b = body as Record<string, unknown>;

  const departamento = limpiaTexto(b.departamento, 80);
  const nombreColaborador = limpiaTexto(b.nombreColaborador ?? b.nombre_colaborador, 120);
  const quejaRequerimiento = limpiaTexto(b.quejaRequerimiento ?? b.queja_requerimiento, 4000);

  if (!esFormatoDepartamentoId(departamento)) {
    return { ok: false, error: "Seleccione el departamento." };
  }
  if (nombreColaborador.length < 2) {
    return { ok: false, error: "Indique el nombre del colaborador (mínimo 2 caracteres)." };
  }
  if (quejaRequerimiento.length < 10) {
    return { ok: false, error: "Describa la queja o requerimiento con más detalle." };
  }

  return {
    ok: true,
    data: { departamento, nombreColaborador, quejaRequerimiento },
  };
}

function parseNotas(raw: unknown): BuzonNota[] {
  if (!Array.isArray(raw)) return [];
  const out: BuzonNota[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const o = item as Record<string, unknown>;
    const tipoRaw = String(o.tipo ?? "");
    const tipo =
      tipoRaw === "aprobacion" || tipoRaw === "estatus"
        ? tipoRaw
        : o.aprobacion != null
          ? "aprobacion"
          : "estatus";
    const aprobacion = esBuzonAprobacion(o.aprobacion) ? o.aprobacion : undefined;
    const estatus = esBuzonEstatus(o.estatus) ? o.estatus : undefined;
    if (tipo === "aprobacion" && !aprobacion) continue;
    if (tipo === "estatus" && !estatus) continue;
    out.push({
      at: String(o.at ?? ""),
      by: String(o.by ?? ""),
      tipo,
      aprobacion,
      estatus,
      nota: limpiaTexto(o.nota, 2000),
    });
  }
  return out;
}

export function mapBuzonRow(row: Record<string, unknown>): BuzonRegistro {
  const aprobacionRaw = String(row.aprobacion ?? "pendiente");
  const estatusRaw = row.estatus == null || row.estatus === "" ? null : String(row.estatus);
  const dept = String(row.departamento ?? "");
  return {
    id: String(row.id ?? ""),
    codigoSeguimiento: String(row.codigo_seguimiento ?? ""),
    departamento: isSgcDepartamentoId(dept) ? dept : dept,
    nombreColaborador: String(row.nombre_colaborador ?? ""),
    quejaRequerimiento: String(row.queja_requerimiento ?? ""),
    evidenciaPath: String(row.evidencia_path ?? ""),
    evidenciaUrl: String(row.evidencia_url ?? ""),
    aprobacion: esBuzonAprobacion(aprobacionRaw) ? aprobacionRaw : "pendiente",
    estatus: estatusRaw && esBuzonEstatus(estatusRaw) ? estatusRaw : null,
    notas: parseNotas(row.notas),
    createdAt: String(row.created_at ?? ""),
    updatedAt: String(row.updated_at ?? ""),
  };
}

export function aVerificacionPublica(reg: BuzonRegistro): BuzonVerificacionPublica {
  const aprobado = reg.aprobacion === "aprobado";
  return {
    codigoSeguimiento: reg.codigoSeguimiento,
    departamento: String(reg.departamento),
    departamentoLabel: etiquetaDepartamentoBuzon(String(reg.departamento)),
    nombreColaborador: reg.nombreColaborador,
    quejaRequerimiento: reg.quejaRequerimiento,
    evidenciaUrl: reg.evidenciaUrl,
    aprobacion: reg.aprobacion,
    aprobacionLabel: BUZON_APROBACION_LABEL[reg.aprobacion],
    estatus: aprobado ? reg.estatus : null,
    estatusLabel: aprobado && reg.estatus ? BUZON_ESTATUS_LABEL[reg.estatus] : null,
    notas: reg.notas.map((n) => {
      if (n.tipo === "aprobacion" && n.aprobacion) {
        return {
          at: n.at,
          tipo: "aprobacion" as const,
          label: BUZON_APROBACION_LABEL[n.aprobacion],
          nota: n.nota,
        };
      }
      // Notas de estatus solo visibles si el registro está aprobado
      if (!aprobado) {
        return {
          at: n.at,
          tipo: "estatus" as const,
          label: "Seguimiento",
          nota: n.nota,
        };
      }
      return {
        at: n.at,
        tipo: "estatus" as const,
        label: n.estatus ? BUZON_ESTATUS_LABEL[n.estatus] : "Estatus",
        nota: n.nota,
      };
    }).filter((n) => {
      if (!aprobado && n.tipo === "estatus") return false;
      return true;
    }),
    createdAt: reg.createdAt,
    updatedAt: reg.updatedAt,
  };
}

export function fechaBuzonMx(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return new Intl.DateTimeFormat("es-MX", {
    timeZone: "America/Mexico_City",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(d);
}
