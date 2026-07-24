import { isSgcDepartamentoId, esFormatoDepartamentoId, SGC_DEPARTAMENTOS, type SgcDepartamentoId } from "@/lib/sgc-calidad";

export const IDEAS_ESTADOS = ["pendiente", "aceptado"] as const;
export type IdeaEstado = (typeof IDEAS_ESTADOS)[number];

export type IdeaQueTransforma = {
  id: string;
  nombre: string;
  departamentoAutor: SgcDepartamentoId;
  problema: string;
  solucion: string;
  beneficio: string;
  departamentoAfectado: SgcDepartamentoId;
  estado: IdeaEstado;
  aceptadoAt: string | null;
  aceptadoPorEmail: string;
  createdAt: string;
};

export type IdeaCreateInput = {
  nombre: string;
  departamentoAutor: string;
  problema: string;
  solucion: string;
  beneficio: string;
  departamentoAfectado: string;
};

export function etiquetaDepartamentoIdea(id: string): string {
  return SGC_DEPARTAMENTOS.find((d) => d.id === id)?.label ?? id;
}

export function esIdeaEstado(v: unknown): v is IdeaEstado {
  return typeof v === "string" && (IDEAS_ESTADOS as readonly string[]).includes(v);
}

function limpiaTexto(v: unknown, max: number): string {
  return String(v ?? "")
    .replace(/\r\n/g, "\n")
    .trim()
    .slice(0, max);
}

export function validarIdeaCreate(body: unknown): { ok: true; data: IdeaCreateInput } | { ok: false; error: string } {
  if (!body || typeof body !== "object") return { ok: false, error: "Datos inválidos." };
  const b = body as Record<string, unknown>;

  const nombre = limpiaTexto(b.nombre, 120);
  const departamentoAutor = limpiaTexto(b.departamentoAutor ?? b.departamento_autor, 80);
  const problema = limpiaTexto(b.problema, 4000);
  const solucion = limpiaTexto(b.solucion, 4000);
  const beneficio = limpiaTexto(b.beneficio, 4000);
  const departamentoAfectado = limpiaTexto(b.departamentoAfectado ?? b.departamento_afectado, 80);

  if (nombre.length < 2) return { ok: false, error: "Indique su nombre (mínimo 2 caracteres)." };
  if (!esFormatoDepartamentoId(departamentoAutor)) {
    return { ok: false, error: "Seleccione su departamento." };
  }
  if (problema.length < 10) return { ok: false, error: "Describa el problema con más detalle." };
  if (solucion.length < 10) return { ok: false, error: "Describa la solución con más detalle." };
  if (beneficio.length < 10) return { ok: false, error: "Describa el beneficio con más detalle." };
  if (!esFormatoDepartamentoId(departamentoAfectado)) {
    return { ok: false, error: "Seleccione el departamento afectado." };
  }

  return {
    ok: true,
    data: {
      nombre,
      departamentoAutor,
      problema,
      solucion,
      beneficio,
      departamentoAfectado,
    },
  };
}

export function mapIdeaRow(row: Record<string, unknown>): IdeaQueTransforma {
  const estadoRaw = String(row.estado ?? "pendiente");
  return {
    id: String(row.id ?? ""),
    nombre: String(row.nombre ?? ""),
    departamentoAutor: (isSgcDepartamentoId(String(row.departamento_autor ?? ""))
      ? String(row.departamento_autor)
      : "operaciones") as SgcDepartamentoId,
    problema: String(row.problema ?? ""),
    solucion: String(row.solucion ?? ""),
    beneficio: String(row.beneficio ?? ""),
    departamentoAfectado: (isSgcDepartamentoId(String(row.departamento_afectado ?? ""))
      ? String(row.departamento_afectado)
      : "operaciones") as SgcDepartamentoId,
    estado: esIdeaEstado(estadoRaw) ? estadoRaw : "pendiente",
    aceptadoAt: row.aceptado_at ? String(row.aceptado_at) : null,
    aceptadoPorEmail: String(row.aceptado_por_email ?? ""),
    createdAt: String(row.created_at ?? ""),
  };
}

export function fechaIdeaMx(iso: string): string {
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
