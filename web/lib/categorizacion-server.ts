import type { CatEvalModuloId } from "@/lib/categorizacion-campos";
import { camposPorModulo } from "@/lib/categorizacion-campos";
import {
  etiquetaNivel,
  etiquetaPaquete,
  promedioDeScores,
  promedioGeneralCategorizacion,
} from "@/lib/categorizacion-calificaciones";
import type {
  CatCapacitacionCurso,
  CatCapacitacionRegistro,
  CatColaboradorActivoOpcion,
  CatEvaluacionRow,
  CatPersonalRow,
  CatResumenEmpleado,
} from "@/lib/categorizacion-types";
import {
  colaboradorEstaActivoEnOperacion,
  colaboradorTieneBaja,
  fechaIngresoNormalizadaColaborador,
  servicioAsignadoDesdeExpediente,
} from "@/lib/colaboradores-baja";
import { fetchAllColaboradoresCompletos } from "@/lib/colaboradores-supabase-fetch-all";
import { servicioLineaColaborador } from "@/lib/servicio-agrupacion";
import { parseFechaIngresoYmd } from "@/lib/categorizacion-tenure";
import {
  filtrarCatPersonalCalificable,
  servicioCatPersonalEsCalificable,
} from "@/lib/categorizacion-servicios-calificables";
import type { ColaboradorCompleto } from "@/lib/colaboradores-types";
import { textoEdadDesdeExpediente } from "@/lib/edad-desde-nacimiento";
import {
  createSupabaseServiceRoleClient,
  hintSupabaseClientError,
  isSupabaseServerConfigured,
} from "@/lib/supabase/admin";
import type { SupabaseClient } from "@supabase/supabase-js";

function db() {
  if (!isSupabaseServerConfigured()) return null;
  return createSupabaseServiceRoleClient();
}

function normalizarNoEmpleado(no: string): string {
  return no.trim().toUpperCase();
}

function mapPersonal(r: Record<string, unknown>): CatPersonalRow {
  return {
    noEmpleado: normalizarNoEmpleado(String(r.no_empleado ?? "")),
    periodoEvaluacion: String(r.periodo_evaluacion ?? ""),
    fechaIngreso: parseFechaIngresoYmd(String(r.fecha_ingreso ?? "")),
    nombre: String(r.nombre ?? ""),
    servicio: String(r.servicio ?? ""),
    puesto: String(r.puesto ?? ""),
    fechaNacimiento: String(r.fecha_nacimiento ?? ""),
    edad: String(r.edad ?? ""),
    escolaridad: String(r.escolaridad ?? ""),
    estatus: String(r.estatus ?? ""),
    fechaBaja: String(r.fecha_baja ?? ""),
    updatedAt: String(r.updated_at ?? ""),
  };
}

/** Colaborador vigente para catálogo Personal (sin baja ni estatus inactivo). */
export function colaboradorActivoParaCatPersonal(c: ColaboradorCompleto): boolean {
  if (!c.noEmpleado.trim()) return false;
  return colaboradorEstaActivoEnOperacion(c);
}

/** Servicio operativo vigente (MOPER / línea actual) para categorización. */
export function servicioVigenteColaboradorCategorizacion(c: ColaboradorCompleto): string {
  return (
    servicioLineaColaborador(c) ||
    servicioAsignadoDesdeExpediente(c) ||
    String(c.ultimoServicio ?? "").trim()
  );
}

/** Activo en expediente y asignado a un servicio que sí se califica en categorización. */
export function colaboradorCalificableEnCategorizacion(c: ColaboradorCompleto): boolean {
  if (!colaboradorActivoParaCatPersonal(c)) return false;
  return servicioCatPersonalEsCalificable(servicioVigenteColaboradorCategorizacion(c));
}

export function colaboradorToCatPersonal(
  c: ColaboradorCompleto,
  periodoEvaluacion: string,
): CatPersonalRow {
  const f = c.form ?? {};
  const estatus = colaboradorEstaActivoEnOperacion(c)
    ? String(f.estatusEmpleado ?? "ACTIVO").trim() || "ACTIVO"
    : "BAJA";
  return {
    noEmpleado: c.noEmpleado.trim().toUpperCase(),
    periodoEvaluacion: periodoEvaluacion.trim(),
    fechaIngreso: fechaIngresoNormalizadaColaborador(c) || parseFechaIngresoYmd(String(c.fechaIngreso ?? f.fechaIngreso ?? "")),
    nombre: String(c.nombreCompleto ?? f.nombreCompleto ?? "").trim(),
    servicio: servicioVigenteColaboradorCategorizacion(c),
    puesto: String(c.puesto ?? f.puesto ?? "").trim(),
    fechaNacimiento: String(f.fechaNacimiento ?? "").trim(),
    edad: textoEdadDesdeExpediente(f.fechaNacimiento, f.edad) || String(f.edad ?? "").trim(),
    escolaridad: String(f.escolaridad ?? "").trim(),
    estatus,
    fechaBaja: String(f.fechaBaja ?? "").trim(),
  };
}

export function mapColaboradorActivoCategorizacion(c: ColaboradorCompleto): CatColaboradorActivoOpcion {
  const f = c.form ?? {};
  return {
    noEmpleado: c.noEmpleado.trim().toUpperCase(),
    nombre: String(c.nombreCompleto ?? f.nombreCompleto ?? "").trim(),
    servicio: servicioVigenteColaboradorCategorizacion(c),
    puesto: String(c.puesto ?? f.puesto ?? "").trim(),
  };
}

function filtrarColaboradoresActivosPorBusqueda(
  rows: CatColaboradorActivoOpcion[],
  busqueda?: string,
): CatColaboradorActivoOpcion[] {
  const q = busqueda?.trim().toLowerCase();
  if (!q) return rows;
  const tokens = q.split(/\s+/).filter(Boolean);
  return rows.filter((o) => {
    const hay = `${o.noEmpleado} ${o.nombre} ${o.servicio}`.toLowerCase();
    return (
      o.noEmpleado.toLowerCase().includes(q) ||
      o.nombre.toLowerCase().includes(q) ||
      tokens.every((t) => hay.includes(t))
    );
  });
}

/**
 * Lista colaboradores activos en expedientes (misma fuente que la sección Colaboradores).
 * Sin depender de cat_personal sincronizado.
 */
export async function listColaboradoresActivosParaCategorizacion(
  busqueda?: string,
  admin?: SupabaseClient | null,
): Promise<CatColaboradorActivoOpcion[]> {
  const client = admin ?? db();
  if (!client) return [];
  const colaboradores = await fetchAllColaboradoresCompletos(client);
  const activos = colaboradores
    .filter(colaboradorEstaActivoEnOperacion)
    .map(mapColaboradorActivoCategorizacion);
  const filtrados = filtrarColaboradoresActivosPorBusqueda(activos, busqueda);
  filtrados.sort((a, b) => a.nombre.localeCompare(b.nombre, "es", { sensitivity: "base" }));
  return filtrados;
}

export async function listCatPersonal(admin?: SupabaseClient | null): Promise<CatPersonalRow[]> {
  const client = admin ?? db();
  if (!client) return [];
  const { data, error } = await client.from("cat_personal").select("*").order("nombre", { ascending: true });
  if (error) throw new Error(hintSupabaseClientError(error.message));
  const rows = (data ?? []).map((r) => mapPersonal(r as Record<string, unknown>));
  return filtrarCatPersonalCalificable(rows);
}

function personalRowToDb(row: CatPersonalRow, updatedAt: string) {
  return {
    no_empleado: row.noEmpleado.trim().toUpperCase(),
    periodo_evaluacion: row.periodoEvaluacion,
    fecha_ingreso: row.fechaIngreso,
    nombre: row.nombre,
    servicio: row.servicio,
    puesto: row.puesto,
    fecha_nacimiento: row.fechaNacimiento,
    edad: row.edad,
    escolaridad: row.escolaridad,
    estatus: row.estatus,
    fecha_baja: row.fechaBaja,
    updated_at: updatedAt,
  };
}

export async function upsertCatPersonal(row: CatPersonalRow, admin?: SupabaseClient | null): Promise<void> {
  await upsertCatPersonalMany([row], admin);
}

const CAT_PERSONAL_UPSERT_CHUNK = 200;

export async function upsertCatPersonalMany(
  rows: CatPersonalRow[],
  admin?: SupabaseClient | null,
): Promise<void> {
  const client = admin ?? db();
  if (!client) throw new Error("Supabase no configurado");
  if (rows.length === 0) return;
  const now = new Date().toISOString();
  for (let i = 0; i < rows.length; i += CAT_PERSONAL_UPSERT_CHUNK) {
    const chunk = rows.slice(i, i + CAT_PERSONAL_UPSERT_CHUNK).map((row) => personalRowToDb(row, now));
    const { error } = await client.from("cat_personal").upsert(chunk, { onConflict: "no_empleado" });
    if (error) throw new Error(hintSupabaseClientError(error.message));
  }
}

export type SyncCatPersonalActivosResult = {
  sincronizados: number;
  eliminados: number;
  totalActivos: number;
  totalColaboradores: number;
};

/**
 * Sincroniza cat_personal con expedientes activos en Colaboradores.
 * Quita del catálogo quien tiene baja o estatus inactivo; conserva periodo de evaluación ya capturado.
 */
export async function syncCatPersonalActivosDesdeColaboradores(
  periodoEvaluacionDefault = "",
  admin?: SupabaseClient | null,
): Promise<SyncCatPersonalActivosResult> {
  const client = admin ?? db();
  if (!client) throw new Error("Supabase no configurado");

  const [colaboradores, existing] = await Promise.all([
    fetchAllColaboradoresCompletos(client),
    listCatPersonal(client),
  ]);
  const existingByNo = new Map(existing.map((p) => [p.noEmpleado, p]));
  const activos = colaboradores.filter(colaboradorCalificableEnCategorizacion);
  const activoNos = new Set(activos.map((c) => normalizarNoEmpleado(c.noEmpleado)));

  const periodoDef = periodoEvaluacionDefault.trim();
  const toUpsert = activos.map((c) => {
    const no = normalizarNoEmpleado(c.noEmpleado);
    const prev = existingByNo.get(no);
    return colaboradorToCatPersonal(c, prev?.periodoEvaluacion ?? periodoDef);
  });
  await upsertCatPersonalMany(toUpsert, client);

  const nosEliminar = existing.filter((p) => !activoNos.has(p.noEmpleado)).map((p) => p.noEmpleado);
  const DELETE_CHUNK = 200;
  for (let i = 0; i < nosEliminar.length; i += DELETE_CHUNK) {
    const chunk = nosEliminar.slice(i, i + DELETE_CHUNK);
    const { error } = await client.from("cat_personal").delete().in("no_empleado", chunk);
    if (error) throw new Error(hintSupabaseClientError(error.message));
  }

  return {
    sincronizados: toUpsert.length,
    eliminados: nosEliminar.length,
    totalActivos: activos.length,
    totalColaboradores: colaboradores.length,
  };
}

export async function deleteCatPersonal(noEmpleado: string, admin?: SupabaseClient | null): Promise<void> {
  const client = admin ?? db();
  if (!client) throw new Error("Supabase no configurado");
  const { error } = await client.from("cat_personal").delete().eq("no_empleado", noEmpleado.trim().toUpperCase());
  if (error) throw new Error(hintSupabaseClientError(error.message));
}

function parseScores(raw: unknown): Record<string, number> {
  if (!raw || typeof raw !== "object") return {};
  const out: Record<string, number> = {};
  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
    const n = Number(v);
    if (Number.isFinite(n)) out[k] = n;
  }
  return out;
}

export async function getCatEvaluacion(
  noEmpleado: string,
  modulo: CatEvalModuloId,
  admin?: SupabaseClient | null,
): Promise<CatEvaluacionRow | null> {
  const client = admin ?? db();
  if (!client) return null;
  const { data, error } = await client
    .from("cat_evaluacion")
    .select("*")
    .eq("no_empleado", noEmpleado.trim().toUpperCase())
    .eq("modulo", modulo)
    .maybeSingle();
  if (error) throw new Error(hintSupabaseClientError(error.message));
  if (!data) return null;
  const r = data as Record<string, unknown>;
  const scores = parseScores(r.scores);
  return {
    noEmpleado: normalizarNoEmpleado(String(r.no_empleado)),
    modulo,
    scores,
    comentarios: String(r.comentarios ?? ""),
    promedio: r.promedio != null ? Number(r.promedio) : promedioDeScores(scores),
  };
}

export async function listCatEvaluacionesModulo(
  modulo: CatEvalModuloId,
  admin?: SupabaseClient | null,
): Promise<CatEvaluacionRow[]> {
  const client = admin ?? db();
  if (!client) return [];
  const { data, error } = await client.from("cat_evaluacion").select("*").eq("modulo", modulo);
  if (error) throw new Error(hintSupabaseClientError(error.message));
  return (data ?? []).map((row) => {
    const r = row as Record<string, unknown>;
    return {
      noEmpleado: normalizarNoEmpleado(String(r.no_empleado)),
      modulo,
      scores: parseScores(r.scores),
      comentarios: String(r.comentarios ?? ""),
      promedio: r.promedio != null ? Number(r.promedio) : promedioDeScores(parseScores(r.scores)),
    };
  });
}

export async function upsertCatEvaluacion(
  noEmpleado: string,
  modulo: CatEvalModuloId,
  scores: Record<string, number>,
  comentarios: string,
  admin?: SupabaseClient | null,
): Promise<CatEvaluacionRow> {
  const client = admin ?? db();
  if (!client) throw new Error("Supabase no configurado");
  const campos = camposPorModulo(modulo);
  const filtered: Record<string, number> = {};
  for (const c of campos) {
    const v = scores[c.key];
    if (v != null && Number.isFinite(v)) filtered[c.key] = v;
  }
  const promedio = promedioDeScores(filtered);
  const { error } = await client.from("cat_evaluacion").upsert(
    {
      no_empleado: noEmpleado.trim().toUpperCase(),
      modulo,
      scores: filtered,
      comentarios: comentarios.trim(),
      promedio,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "no_empleado,modulo" },
  );
  if (error) throw new Error(hintSupabaseClientError(error.message));
  return {
    noEmpleado: noEmpleado.trim().toUpperCase(),
    modulo,
    scores: filtered,
    comentarios: comentarios.trim(),
    promedio,
  };
}

export async function promedioCapacitacionEmpleado(
  noEmpleado: string,
  admin?: SupabaseClient | null,
): Promise<number | null> {
  const client = admin ?? db();
  if (!client) return null;
  const { data, error } = await client
    .from("cat_capacitacion_registro")
    .select("promedio")
    .eq("no_empleado", noEmpleado.trim().toUpperCase());
  if (error) throw new Error(hintSupabaseClientError(error.message));
  const vals = (data ?? [])
    .map((r) => (r as { promedio: number | null }).promedio)
    .filter((p): p is number => p != null && Number.isFinite(p));
  if (vals.length === 0) return null;
  return Math.round((vals.reduce((a, b) => a + b, 0) / vals.length) * 100) / 100;
}

export async function buildResumenCategorizacion(admin?: SupabaseClient | null): Promise<CatResumenEmpleado[]> {
  const personal = await listCatPersonal(admin);
  const [rhList, opList, enList] = await Promise.all([
    listCatEvaluacionesModulo("recursos_humanos", admin),
    listCatEvaluacionesModulo("operaciones", admin),
    listCatEvaluacionesModulo("enfoque_cliente", admin),
  ]);
  const rhMap = new Map(rhList.map((r) => [r.noEmpleado, r.promedio]));
  const opMap = new Map(opList.map((r) => [r.noEmpleado, r.promedio]));
  const enMap = new Map(enList.map((r) => [r.noEmpleado, r.promedio]));

  const client = admin ?? db();
  const capProms = new Map<string, number | null>();
  if (client) {
    for (const p of personal) {
      capProms.set(p.noEmpleado, await promedioCapacitacionEmpleado(p.noEmpleado, client));
    }
  }

  return personal.map((p) => {
    const promedioRh = rhMap.get(p.noEmpleado) ?? null;
    const promedioCapacitacion = capProms.get(p.noEmpleado) ?? null;
    const promedioOperaciones = opMap.get(p.noEmpleado) ?? null;
    const promedioEnfoque = enMap.get(p.noEmpleado) ?? null;
    const promedioGeneral = promedioGeneralCategorizacion([
      promedioRh,
      promedioCapacitacion,
      promedioOperaciones,
      promedioEnfoque,
    ]);
    return {
      noEmpleado: p.noEmpleado,
      nombre: p.nombre,
      promedioRh,
      promedioCapacitacion,
      promedioOperaciones,
      promedioEnfoque,
      promedioGeneral,
      nivel: etiquetaNivel(promedioGeneral),
      paquete: etiquetaPaquete(promedioGeneral),
    };
  });
}

const CAT_CURSO_COLS_BASE = "id, nombre, fecha_vencimiento, activo, created_at";
const CAT_CURSO_COLS_FULL = "id, nombre, fecha_inicio, fecha_vencimiento, activo, created_at";

function isMissingFechaInicioColumn(message: string): boolean {
  return /fecha_inicio/i.test(message) && /schema cache|could not find|column/i.test(message);
}

export async function listCursosCapacitacion(admin?: SupabaseClient | null): Promise<CatCapacitacionCurso[]> {
  const client = admin ?? db();
  if (!client) return [];
  const full = await client
    .from("cat_capacitacion_curso")
    .select(CAT_CURSO_COLS_FULL)
    .order("fecha_vencimiento", { ascending: true });
  if (!full.error) {
    return (full.data ?? []).map((r) => mapCursoCapacitacion(r as Record<string, unknown>));
  }
  if (isMissingFechaInicioColumn(full.error.message)) {
    const basic = await client
      .from("cat_capacitacion_curso")
      .select(CAT_CURSO_COLS_BASE)
      .order("fecha_vencimiento", { ascending: true });
    if (basic.error) throw new Error(hintSupabaseClientError(basic.error.message));
    return (basic.data ?? []).map((r) => mapCursoCapacitacion(r as Record<string, unknown>));
  }
  throw new Error(hintSupabaseClientError(full.error.message));
}

function mapCursoCapacitacion(row: Record<string, unknown>): CatCapacitacionCurso {
  const inicio = row.fecha_inicio;
  return {
    id: String(row.id),
    nombre: String(row.nombre ?? ""),
    fechaInicio: inicio ? String(inicio).slice(0, 10) : "",
    fechaVencimiento: String(row.fecha_vencimiento ?? "").slice(0, 10),
    activo: Boolean(row.activo),
  };
}

export async function upsertCursoCapacitacion(
  curso: Omit<CatCapacitacionCurso, "id"> & { id?: string },
  admin?: SupabaseClient | null,
): Promise<CatCapacitacionCurso> {
  const client = admin ?? db();
  if (!client) throw new Error("Supabase no configurado");
  const base: Record<string, unknown> = {
    nombre: curso.nombre.trim(),
    fecha_vencimiento: curso.fechaVencimiento,
    activo: curso.activo,
  };
  const inicio = curso.fechaInicio.trim();
  const payloadWithInicio = inicio ? { ...base, fecha_inicio: inicio } : base;

  const writeFull = async (payload: Record<string, unknown>) => {
    if (curso.id) {
      return client
        .from("cat_capacitacion_curso")
        .update(payload)
        .eq("id", curso.id)
        .select(CAT_CURSO_COLS_FULL)
        .single();
    }
    return client.from("cat_capacitacion_curso").insert(payload).select(CAT_CURSO_COLS_FULL).single();
  };

  const writeBase = async (payload: Record<string, unknown>) => {
    if (curso.id) {
      return client
        .from("cat_capacitacion_curso")
        .update(payload)
        .eq("id", curso.id)
        .select(CAT_CURSO_COLS_BASE)
        .single();
    }
    return client.from("cat_capacitacion_curso").insert(payload).select(CAT_CURSO_COLS_BASE).single();
  };

  let { data, error } = inicio ? await writeFull(payloadWithInicio) : await writeBase(base);
  if (error && isMissingFechaInicioColumn(error.message)) {
    if (inicio) {
      throw new Error(
        "Falta la columna fecha_inicio en Supabase. Ejecute web/supabase/migrations/017_cat_capacitacion_fecha_inicio.sql en el SQL Editor.",
      );
    }
    ({ data, error } = await writeBase(base));
  }
  if (error) throw new Error(hintSupabaseClientError(error.message));
  if (!data) throw new Error("Sin respuesta al guardar curso");
  return mapCursoCapacitacion(data as unknown as Record<string, unknown>);
}

export async function listRegistrosCapacitacion(admin?: SupabaseClient | null): Promise<CatCapacitacionRegistro[]> {
  const client = admin ?? db();
  if (!client) return [];
  const { data, error } = await client
    .from("cat_capacitacion_registro")
    .select("*, cat_capacitacion_curso(nombre)")
    .order("updated_at", { ascending: false });
  if (error) throw new Error(hintSupabaseClientError(error.message));
  return (data ?? []).map((row) => {
    const r = row as Record<string, unknown> & { cat_capacitacion_curso?: { nombre?: string } };
    return {
      id: String(r.id),
      noEmpleado: String(r.no_empleado),
      cursoId: String(r.curso_id),
      cursoNombre: r.cat_capacitacion_curso?.nombre,
      asistencia: r.asistencia != null ? Number(r.asistencia) : null,
      desempeno: r.desempeno != null ? Number(r.desempeno) : null,
      promedio: r.promedio != null ? Number(r.promedio) : null,
      comentarios: String(r.comentarios ?? ""),
    };
  });
}

export async function upsertRegistroCapacitacion(
  input: {
    id?: string;
    noEmpleado: string;
    cursoId: string;
    asistencia: number | null;
    desempeno: number | null;
    comentarios: string;
  },
  admin?: SupabaseClient | null,
): Promise<CatCapacitacionRegistro> {
  const client = admin ?? db();
  if (!client) throw new Error("Supabase no configurado");
  const desempeno =
    input.desempeno != null && Number.isFinite(input.desempeno) ? input.desempeno : null;
  const promedio = desempeno != null ? Math.round(desempeno * 100) / 100 : null;
  const payload = {
    no_empleado: input.noEmpleado.trim().toUpperCase(),
    curso_id: input.cursoId,
    asistencia: null,
    desempeno,
    promedio,
    comentarios: input.comentarios.trim(),
    updated_at: new Date().toISOString(),
  };
  if (input.id) {
    const { data, error } = await client
      .from("cat_capacitacion_registro")
      .update(payload)
      .eq("id", input.id)
      .select("*, cat_capacitacion_curso(nombre)")
      .single();
    if (error) throw new Error(hintSupabaseClientError(error.message));
    const r = data as Record<string, unknown> & { cat_capacitacion_curso?: { nombre?: string } };
    return {
      id: String(r.id),
      noEmpleado: String(r.no_empleado),
      cursoId: String(r.curso_id),
      cursoNombre: r.cat_capacitacion_curso?.nombre,
      asistencia: r.asistencia != null ? Number(r.asistencia) : null,
      desempeno: r.desempeno != null ? Number(r.desempeno) : null,
      promedio: r.promedio != null ? Number(r.promedio) : null,
      comentarios: String(r.comentarios),
    };
  }
  const { data, error } = await client
    .from("cat_capacitacion_registro")
    .insert(payload)
    .select("*, cat_capacitacion_curso(nombre)")
    .single();
  if (error) throw new Error(hintSupabaseClientError(error.message));
  const r = data as Record<string, unknown> & { cat_capacitacion_curso?: { nombre?: string } };
  return {
    id: String(r.id),
    noEmpleado: String(r.no_empleado),
    cursoId: String(r.curso_id),
    cursoNombre: r.cat_capacitacion_curso?.nombre,
    asistencia: r.asistencia != null ? Number(r.asistencia) : null,
    desempeno: r.desempeno != null ? Number(r.desempeno) : null,
    promedio: r.promedio != null ? Number(r.promedio) : null,
    comentarios: String(r.comentarios),
  };
}

export async function deleteRegistroCapacitacion(id: string, admin?: SupabaseClient | null): Promise<void> {
  const client = admin ?? db();
  if (!client) throw new Error("Supabase no configurado");
  const { error } = await client.from("cat_capacitacion_registro").delete().eq("id", id);
  if (error) throw new Error(hintSupabaseClientError(error.message));
}
