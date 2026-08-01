import { servicioCoincideFiltroCat } from "@/lib/categorizacion-filtros-servicio";

export const PEO_PLANTILLA_VERSION = 1;

export const PEO_CATEGORIAS = [
  {
    id: "extorsion_simulada",
    nombre: "Llamada de extorsión simulada",
    objetivo: "Evaluar la respuesta al protocolo",
    criterios: [
      { id: "identifico_extorsion", etiqueta: "Identificó que era intento de extorsión", maximo: 25 },
      { id: "conservo_calma", etiqueta: "Conservó la calma", maximo: 15 },
      { id: "siguio_protocolo", etiqueta: "Siguió el protocolo", maximo: 30 },
      { id: "notifico_supervisor", etiqueta: "Notificó al supervisor", maximo: 20 },
      { id: "documento_incidente", etiqueta: "Documentó el incidente", maximo: 10 },
    ],
  },
  {
    id: "paquete_sospechoso_ctpat",
    nombre: "CTPAT / OEA",
    objetivo: "Evaluar la inspección física",
    criterios: [
      { id: "inspeccion_completa", etiqueta: "Realizó inspección completa", maximo: 20 },
      { id: "detecto_paquete", etiqueta: "Detectó el paquete", maximo: 30 },
      { id: "no_manipulo_evidencia", etiqueta: "No manipuló evidencia", maximo: 15 },
      { id: "aviso_inmediatamente", etiqueta: "Avisó inmediatamente", maximo: 20 },
      { id: "aplico_protocolo_completo", etiqueta: "Aplicó el protocolo completo", maximo: 15 },
    ],
  },
  {
    id: "identificacion_falsa",
    nombre: "INTRUSION POR DETECCION E IDENTIFICACION DE PERSONAS SOSPECHOSAS",
    objetivo: "Evaluar el control de acceso ante una identificación incorrecta",
    criterios: [
      {
        id: "detecto_conductas_inusuales",
        etiqueta: "Detectó conductas inusuales o sospechosas del visitante",
        maximo: 25,
      },
      {
        id: "aplico_protocolo_identificacion",
        etiqueta: "Aplicó correctamente el protocolo de identificación y control de acceso",
        maximo: 25,
      },
      {
        id: "actitud_profesional",
        etiqueta: "Mantuvo una actitud profesional, preventiva y sin confrontaciones",
        maximo: 15,
      },
      {
        id: "notifico_oportunamente",
        etiqueta: "Notificó oportunamente al supervisor o al personal correspondiente",
        maximo: 20,
      },
      {
        id: "documento_reporte",
        etiqueta: "Documentó el incidente o generó el reporte correspondiente",
        maximo: 15,
      },
    ],
  },
  {
    id: "visitante_sospechoso",
    nombre: "Simulación de visitante sospechoso",
    objetivo: "Evaluar la observación y reacción",
    criterios: [
      {
        id: "detecto_conductas_inusuales",
        etiqueta: "Detectó conductas inusuales o sospechosas del visitante",
        maximo: 25,
      },
      {
        id: "aplico_protocolo_identificacion",
        etiqueta: "Aplicó correctamente el protocolo de identificación y control de acceso",
        maximo: 25,
      },
      {
        id: "actitud_profesional",
        etiqueta: "Mantuvo una actitud profesional, preventiva y sin confrontaciones",
        maximo: 15,
      },
      {
        id: "notifico_oportunamente",
        etiqueta: "Notificó oportunamente al supervisor o al personal correspondiente",
        maximo: 20,
      },
      {
        id: "documento_reporte",
        etiqueta: "Documentó el incidente o generó el reporte correspondiente",
        maximo: 15,
      },
    ],
  },
] as const;

export type PeoCategoriaId = (typeof PEO_CATEGORIAS)[number]["id"];

/** Simulación controlada vs incidente/operación real. */
export const PEO_TIPOS = [
  { id: "simulacion", nombre: "Simulación", descripcion: "Ejercicio controlado de protocolo" },
  { id: "real", nombre: "Real", descripcion: "Incidente u operación real" },
] as const;

export type PeoTipoId = (typeof PEO_TIPOS)[number]["id"];

export type PeoCriterioDef = {
  id: string;
  etiqueta: string;
  maximo: number;
};

export type PeoPuntaje = PeoCriterioDef & {
  orden: number;
  obtenido: number;
};

export type PeoAccionSeguimiento = {
  accion: string;
  responsable: string;
  fechaCompromiso: string;
};

export type PeoEvidencia = {
  id: string;
  storagePath: string;
  nombreArchivo: string;
  mime: string;
  url: string;
  createdAt: string;
};

export type PeoResultadoId = "aprobada" | "fallida";
export type PeoNivelRiesgoId = "bajo" | "medio" | "alto";

/** Umbral de aprobación del informe ejecutivo (sobre 100). */
export const PEO_UMBRAL_APROBADA = 75;

export type PeoEvaluacion = {
  id: string;
  categoria: PeoCategoriaId;
  tipo: PeoTipoId;
  plantillaVersion: number;
  noEmpleado: string;
  nombre: string;
  servicio: string;
  planta: string;
  puesto: string;
  evaluadorEmail: string;
  evaluadaEn: string;
  observaciones: string;
  accionesCorrectivas: string[];
  accionesSeguimiento: PeoAccionSeguimiento[];
  evidencias: PeoEvidencia[];
  total: number;
  createdAt: string;
  puntajes: PeoPuntaje[];
};

export type PeoColaboradorDashboard = {
  noEmpleado: string;
  nombre: string;
  servicio: string;
  planta: string;
  puesto: string;
  fechaIngreso: string;
  tiempoEnEmpresa: string;
  edad: string;
  escolaridad: string;
  fotoUrl: string | null;
};

export type PeoDashboardPayload = {
  colaboradores: PeoColaboradorDashboard[];
  evaluaciones: PeoEvaluacion[];
  servicios: string[];
  generadoEn: string;
};

export function peoCategoria(id: string | null | undefined) {
  return PEO_CATEGORIAS.find((c) => c.id === id) ?? null;
}

export function esPeoCategoriaId(id: string): id is PeoCategoriaId {
  return peoCategoria(id) !== null;
}

export function peoTipo(id: string | null | undefined) {
  return PEO_TIPOS.find((t) => t.id === id) ?? null;
}

export function esPeoTipoId(id: string): id is PeoTipoId {
  return peoTipo(id) !== null;
}

export function etiquetaPeoTipo(id: string | null | undefined): string {
  return peoTipo(id)?.nombre ?? "Simulación";
}

export function peoResultado(total: number): PeoResultadoId {
  return total >= PEO_UMBRAL_APROBADA ? "aprobada" : "fallida";
}

export function etiquetaPeoResultado(total: number): string {
  return peoResultado(total) === "aprobada"
    ? "APROBADA (Cumplimiento del procedimiento)"
    : "FALLIDA (Incumplimiento del procedimiento)";
}

export function peoNivelRiesgo(total: number): PeoNivelRiesgoId {
  if (total >= 85) return "bajo";
  if (total >= 60) return "medio";
  return "alto";
}

export function etiquetaPeoNivelRiesgo(total: number): string {
  const n = peoNivelRiesgo(total);
  if (n === "bajo") return "BAJO";
  if (n === "medio") return "MEDIO";
  return "ALTO";
}

export function tituloInformePeo(tipo: PeoTipoId | string | null | undefined): string {
  return tipo === "real"
    ? "INFORME EJECUTIVO – INCIDENTE / OPERACIÓN REAL"
    : "INFORME EJECUTIVO – PRUEBA CONTROLADA";
}

export const PEO_ACCIONES_CORRECTIVAS_MAX = 12;
export const PEO_ACCION_CORRECTIVA_MAX_LEN = 500;
export const PEO_ACCIONES_SEGUIMIENTO_MAX = 12;
export const PEO_SEGUIMIENTO_CAMPO_MAX_LEN = 300;

export function validarAccionesCorrectivas(
  raw: unknown,
): { ok: true; value: string[] } | { ok: false; error: string } {
  if (raw == null) return { ok: true, value: [] };
  if (!Array.isArray(raw)) return { ok: false, error: "Acciones correctivas inválidas." };
  if (raw.length > PEO_ACCIONES_CORRECTIVAS_MAX) {
    return { ok: false, error: `Máximo ${PEO_ACCIONES_CORRECTIVAS_MAX} acciones correctivas.` };
  }
  const value: string[] = [];
  for (const item of raw) {
    const t = String(item ?? "").trim().slice(0, PEO_ACCION_CORRECTIVA_MAX_LEN);
    if (t) value.push(t);
  }
  return { ok: true, value };
}

function fechaCompromisoValida(raw: string): boolean {
  if (!raw) return true;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(raw)) return false;
  const d = new Date(`${raw}T12:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === raw;
}

export function validarAccionesSeguimiento(
  raw: unknown,
): { ok: true; value: PeoAccionSeguimiento[] } | { ok: false; error: string } {
  if (raw == null) return { ok: true, value: [] };
  if (!Array.isArray(raw)) return { ok: false, error: "Acciones de seguimiento inválidas." };
  if (raw.length > PEO_ACCIONES_SEGUIMIENTO_MAX) {
    return { ok: false, error: `Máximo ${PEO_ACCIONES_SEGUIMIENTO_MAX} acciones de seguimiento.` };
  }
  const value: PeoAccionSeguimiento[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object" || Array.isArray(item)) {
      return { ok: false, error: "Cada seguimiento debe ser un objeto." };
    }
    const row = item as Record<string, unknown>;
    const accion = String(row.accion ?? "").trim().slice(0, PEO_SEGUIMIENTO_CAMPO_MAX_LEN);
    const responsable = String(row.responsable ?? "").trim().slice(0, PEO_SEGUIMIENTO_CAMPO_MAX_LEN);
    const fechaCompromiso = String(row.fechaCompromiso ?? row.fecha_compromiso ?? "").trim();
    if (!accion && !responsable && !fechaCompromiso) continue;
    if (!accion) return { ok: false, error: "Cada seguimiento requiere la acción." };
    if (!fechaCompromisoValida(fechaCompromiso)) {
      return { ok: false, error: `Fecha de compromiso no válida: ${fechaCompromiso}.` };
    }
    value.push({ accion, responsable, fechaCompromiso });
  }
  return { ok: true, value };
}

export function totalMaximoCategoria(id: PeoCategoriaId): number {
  return peoCategoria(id)?.criterios.reduce((sum, c) => sum + c.maximo, 0) ?? 0;
}

export const PEO_EVIDENCIAS_BUCKET = "peo-evidencias";

export function publicUrlPeoEvidencia(storagePath: string, baseUrl?: string | null): string {
  const path = storagePath.replace(/^\/+/, "");
  const root = (baseUrl ?? process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").replace(/\/+$/, "");
  if (!root || !path) return "";
  return `${root}/storage/v1/object/public/${PEO_EVIDENCIAS_BUCKET}/${path}`;
}

export function promedioPeo(valores: Array<number | null | undefined>): number | null {
  const validos = valores.filter((v): v is number => typeof v === "number" && Number.isFinite(v));
  if (validos.length === 0) return null;
  return Math.round((validos.reduce((sum, v) => sum + v, 0) / validos.length) * 100) / 100;
}

export function validarPuntajesPeo(
  categoriaId: string,
  raw: unknown,
): { ok: true; categoria: NonNullable<ReturnType<typeof peoCategoria>>; puntajes: PeoPuntaje[]; total: number } | {
  ok: false;
  error: string;
} {
  const categoria = peoCategoria(categoriaId);
  if (!categoria) return { ok: false, error: "Categoría no válida." };
  const maximoPlantilla = categoria.criterios.reduce((sum, c) => sum + c.maximo, 0);
  if (maximoPlantilla !== 100) {
    return { ok: false, error: `La plantilla ${categoria.nombre} no suma 100 puntos.` };
  }
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return { ok: false, error: "Puntajes requeridos." };
  }
  const scores = raw as Record<string, unknown>;
  const permitidos = new Set<string>(categoria.criterios.map((c) => c.id));
  const extras = Object.keys(scores).filter((key) => !permitidos.has(key));
  if (extras.length > 0) return { ok: false, error: `Criterios no permitidos: ${extras.join(", ")}.` };

  const puntajes: PeoPuntaje[] = [];
  for (const [index, criterio] of categoria.criterios.entries()) {
    const valor = Number(scores[criterio.id]);
    if (!Number.isFinite(valor) || valor < 0 || valor > criterio.maximo) {
      return {
        ok: false,
        error: `${criterio.etiqueta}: capture un valor de 0 a ${criterio.maximo}.`,
      };
    }
    puntajes.push({ ...criterio, orden: index + 1, obtenido: Math.round(valor * 100) / 100 });
  }
  const total = Math.round(puntajes.reduce((sum, p) => sum + p.obtenido, 0) * 100) / 100;
  return { ok: true, categoria, puntajes, total };
}

export function evaluacionPeoCoincideServicio(e: PeoEvaluacion, servicioScope: string | null): boolean {
  return !servicioScope || servicioCoincideFiltroCat(e.servicio, servicioScope);
}

function mapAccionesCorrectivasDb(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  return raw.map((x) => String(x ?? "").trim()).filter(Boolean);
}

function mapAccionesSeguimientoDb(raw: unknown): PeoAccionSeguimiento[] {
  if (!Array.isArray(raw)) return [];
  const out: PeoAccionSeguimiento[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object" || Array.isArray(item)) continue;
    const row = item as Record<string, unknown>;
    const accion = String(row.accion ?? "").trim();
    if (!accion) continue;
    out.push({
      accion,
      responsable: String(row.responsable ?? "").trim(),
      fechaCompromiso: String(row.fechaCompromiso ?? row.fecha_compromiso ?? "").trim(),
    });
  }
  return out;
}

export function mapPeoEvidenciaDb(raw: Record<string, unknown>): PeoEvidencia {
  const storagePath = String(raw.storage_path ?? "").trim();
  return {
    id: String(raw.id ?? ""),
    storagePath,
    nombreArchivo: String(raw.nombre_archivo ?? "").trim() || storagePath.split("/").pop() || "evidencia",
    mime: String(raw.mime ?? "application/octet-stream"),
    url: publicUrlPeoEvidencia(storagePath),
    createdAt: String(raw.created_at ?? ""),
  };
}

export function mapPeoEvaluacionDb(
  raw: Record<string, unknown>,
  puntajes: Record<string, unknown>[] = [],
  evidencias: Record<string, unknown>[] = [],
): PeoEvaluacion {
  const tipoRaw = String(raw.tipo ?? "simulacion").trim().toLowerCase();
  return {
    id: String(raw.id ?? ""),
    categoria: String(raw.categoria ?? "") as PeoCategoriaId,
    tipo: esPeoTipoId(tipoRaw) ? tipoRaw : "simulacion",
    plantillaVersion: Number(raw.plantilla_version ?? 1),
    noEmpleado: String(raw.no_empleado ?? "").trim().toUpperCase(),
    nombre: String(raw.nombre_snapshot ?? ""),
    servicio: String(raw.servicio_snapshot ?? ""),
    planta: String(raw.planta_snapshot ?? ""),
    puesto: String(raw.puesto_snapshot ?? ""),
    evaluadorEmail: String(raw.evaluador_email ?? ""),
    evaluadaEn: String(raw.evaluada_en ?? ""),
    observaciones: String(raw.observaciones ?? ""),
    accionesCorrectivas: mapAccionesCorrectivasDb(raw.acciones_correctivas),
    accionesSeguimiento: mapAccionesSeguimientoDb(raw.acciones_seguimiento),
    evidencias: evidencias.map(mapPeoEvidenciaDb),
    total: Number(raw.total ?? 0),
    createdAt: String(raw.created_at ?? ""),
    puntajes: puntajes
      .map((p) => ({
        id: String(p.criterio ?? ""),
        etiqueta: String(p.etiqueta_snapshot ?? ""),
        orden: Number(p.orden ?? 0),
        maximo: Number(p.maximo ?? 0),
        obtenido: Number(p.obtenido ?? 0),
      }))
      .sort((a, b) => a.orden - b.orden),
  };
}

/** Serializa seguimiento para columna jsonb (snake_case estable en DB). */
export function accionesSeguimientoParaDb(rows: PeoAccionSeguimiento[]) {
  return rows.map((r) => ({
    accion: r.accion,
    responsable: r.responsable,
    fecha_compromiso: r.fechaCompromiso,
  }));
}
