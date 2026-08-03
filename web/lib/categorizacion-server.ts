import type { CatEvalModuloId } from "@/lib/categorizacion-campos";
import { camposPorModulo } from "@/lib/categorizacion-campos";
import {
  etiquetaNivel,
  etiquetaPaquete,
  promedioAcumuladoEvaluaciones,
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
import { colaboradorVigenteEnMesHistorial, parseFechaIngresoYmd } from "@/lib/categorizacion-tenure";
import {
  normalizarSubmoduloOperaciones,
  rolOperacionesDesdePuesto,
  scoresParecenJefeTurno,
  submoduloOperaciones,
  type CatOperacionesRolId,
} from "@/lib/categorizacion-operaciones-roles";
import {
  filtrarCatPersonalCalificable,
  servicioCatPersonalEsCalificable,
} from "@/lib/categorizacion-servicios-calificables";
import { servicioCoincideFiltroCat } from "@/lib/categorizacion-filtros-servicio";
import { mesCalendarioAnteriorYm } from "@/lib/categorizacion-faltas-cuadricula";
import { normalizarMesYm } from "@/lib/categorizacion-recompensas";
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
    planta: String(f.planta ?? "").trim(),
    fechaIngreso:
      fechaIngresoNormalizadaColaborador(c) ||
      parseFechaIngresoYmd(String(c.fechaIngreso ?? f.fechaIngreso ?? "")),
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

/** Filtra expedientes activos calificables sin volver a leer Supabase. */
export function activosCategorizacionDesdeColaboradores(
  colaboradores: ColaboradorCompleto[],
  opts?: { servicio?: string; soloCalificables?: boolean },
): CatColaboradorActivoOpcion[] {
  const srv = opts?.servicio?.trim() ? opts.servicio.trim() : "";
  return colaboradores
    .filter((c) => {
      if (!colaboradorEstaActivoEnOperacion(c)) return false;
      if (opts?.soloCalificables !== false && !colaboradorCalificableEnCategorizacion(c)) return false;
      if (srv && !servicioCoincideFiltroCat(servicioVigenteColaboradorCategorizacion(c), srv)) return false;
      return true;
    })
    .map(mapColaboradorActivoCategorizacion);
}

/**
 * Lista colaboradores activos en expedientes (misma fuente que la sección Colaboradores).
 * Sin depender de cat_personal sincronizado.
 */
export async function listColaboradoresActivosParaCategorizacion(
  busqueda?: string,
  admin?: SupabaseClient | null,
  opts?: { servicio?: string; soloCalificables?: boolean; colaboradores?: ColaboradorCompleto[] },
): Promise<CatColaboradorActivoOpcion[]> {
  const client = admin ?? db();
  if (!client && !opts?.colaboradores) return [];
  const colaboradores = opts?.colaboradores ?? (client ? await fetchAllColaboradoresCompletos(client) : []);
  const activos = activosCategorizacionDesdeColaboradores(colaboradores, opts);
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
    if (k === CAT_JT_EVALS_SCORES_KEY) continue;
    const n = Number(v);
    if (Number.isFinite(n)) out[k] = n;
  }
  return out;
}

/** Calificaciones JT por oficial cuando PostgREST no expone calificado_por (caché antigua). */
const CAT_JT_EVALS_SCORES_KEY = "__jt_evaluaciones_oficiales__";

type JtOficialEvalJson = {
  scores: Record<string, number>;
  comentarios: string;
  promedio: number | null;
};

function parseJtBucketRaw(raw: unknown): Record<string, JtOficialEvalJson> {
  if (!raw || typeof raw !== "object") return {};
  const bucket = (raw as Record<string, unknown>)[CAT_JT_EVALS_SCORES_KEY];
  if (!bucket || typeof bucket !== "object") return {};
  const out: Record<string, JtOficialEvalJson> = {};
  for (const [oficialNo, entry] of Object.entries(bucket as Record<string, unknown>)) {
    if (!entry || typeof entry !== "object") continue;
    const e = entry as Record<string, unknown>;
    const scores = parseScores(e.scores);
    const prom =
      e.promedio != null && Number.isFinite(Number(e.promedio))
        ? Number(e.promedio)
        : promedioDeScores(scores);
    out[normalizarNoEmpleado(oficialNo)] = {
      scores,
      comentarios: String(e.comentarios ?? ""),
      promedio: prom,
    };
  }
  return out;
}

function debeUsarLegacyJsonCatEvaluacion(message: string): boolean {
  if (errorPareceRpcCatEvaluacionFalta(message)) return true;
  if (errorPareceSchemaCacheColumnas(message)) return true;
  const m = message.toLowerCase();
  if (m.includes("could not find") && (m.includes("calificado_por") || m.includes("submodulo"))) return true;
  return false;
}

async function listCatEvaluacionesModuloLegacyMinimal(
  client: SupabaseClient,
  modulo: CatEvalModuloId,
): Promise<Record<string, unknown>[]> {
  const { data, error } = await client
    .from("cat_evaluacion")
    .select("no_empleado, modulo, scores, comentarios, promedio")
    .eq("modulo", modulo);
  if (error) throw new Error(error.message);
  return (data ?? []) as Record<string, unknown>[];
}

function expandOperacionesLegacyRows(
  rawRows: Record<string, unknown>[],
  subOperaciones: string | null,
): CatEvaluacionRow[] {
  const fallbackMes = mesCalendarioAnteriorYm();
  const out: CatEvaluacionRow[] = [];
  for (const r of rawRows) {
    const noEmpleado = normalizarNoEmpleado(String(r.no_empleado));
    const subRaw = String(r.submodulo ?? "").trim();
    const calificadoPorRow = normalizarNoEmpleado(String(r.calificado_por ?? ""));
    const periodMonth = periodMonthEvaluacion(String(r.period_month ?? "")) || fallbackMes;
    const jtBucket = parseJtBucketRaw(r.scores);
    const jtKeys = Object.keys(jtBucket);

    // Calificaciones oficial→JT guardadas en JSON legacy dentro de scores.
    if (jtKeys.length > 0 && (subOperaciones === "jefe_turno" || subOperaciones == null)) {
      for (const calificadoPor of jtKeys) {
        const e = jtBucket[calificadoPor]!;
        out.push({
          noEmpleado,
          modulo: "operaciones",
          submodulo: "jefe_turno",
          calificadoPor,
          periodMonth,
          scores: e.scores,
          comentarios: e.comentarios,
          promedio: e.promedio,
        });
      }
    }

    // Filas modernas ya tipadas (submodulo + calificado_por).
    if (subRaw === "jefe_turno" && calificadoPorRow) {
      if (subOperaciones === "oficial") continue;
      const scores = parseScores(r.scores);
      if (Object.keys(scores).length === 0 && jtKeys.length > 0) continue;
      out.push({
        noEmpleado,
        modulo: "operaciones",
        submodulo: "jefe_turno",
        calificadoPor: calificadoPorRow,
        periodMonth,
        scores,
        comentarios: String(r.comentarios ?? ""),
        promedio: r.promedio != null ? Number(r.promedio) : promedioDeScores(scores),
      });
      continue;
    }

    if (subOperaciones === "jefe_turno") continue;

    const flatScores = parseScores(r.scores);
    if (Object.keys(flatScores).length === 0) continue;

    // Scores con criterios de JT aunque la fila diga oficial / vacía.
    if (scoresParecenJefeTurno(flatScores)) {
      if (subOperaciones === "oficial") continue;
      out.push({
        noEmpleado,
        modulo: "operaciones",
        submodulo: "jefe_turno",
        calificadoPor: calificadoPorRow,
        periodMonth,
        scores: flatScores,
        comentarios: String(r.comentarios ?? ""),
        promedio: r.promedio != null ? Number(r.promedio) : promedioDeScores(flatScores),
      });
      continue;
    }

    out.push({
      noEmpleado,
      modulo: "operaciones",
      submodulo: "oficial",
      calificadoPor: subRaw === "oficial" || subRaw === "" ? calificadoPorRow : "",
      periodMonth,
      scores: flatScores,
      comentarios: String(r.comentarios ?? ""),
      promedio: r.promedio != null ? Number(r.promedio) : promedioDeScores(flatScores),
    });
  }
  return out;
}

/** Une filas de evaluación; la fuente `primary` gana en duplicados. */
function mergeCatEvalRows(primary: CatEvaluacionRow[], extra: CatEvaluacionRow[]): CatEvaluacionRow[] {
  const keyOf = (r: CatEvaluacionRow) =>
    `${normalizarNoEmpleado(r.noEmpleado)}|${r.submodulo}|${normalizarNoEmpleado(r.calificadoPor ?? "")}|${r.periodMonth}`;
  const map = new Map<string, CatEvaluacionRow>();
  for (const r of extra) map.set(keyOf(r), r);
  for (const r of primary) map.set(keyOf(r), r);
  return [...map.values()];
}

function filtrarOperacionesPorSub(
  rows: CatEvaluacionRow[],
  subOperaciones: string | null,
): CatEvaluacionRow[] {
  if (subOperaciones === "oficial") return rows.filter((r) => r.submodulo === "oficial");
  if (subOperaciones === "jefe_turno") return rows.filter((r) => r.submodulo === "jefe_turno");
  return rows;
}

async function getCatEvaluacionLegacyMinimal(
  client: SupabaseClient,
  noEmpleado: string,
  modulo: CatEvalModuloId,
  sub: string,
  calificadoPor: string,
): Promise<CatEvaluacionRow | null> {
  const no = noEmpleado.trim().toUpperCase();
  const { data, error } = await client
    .from("cat_evaluacion")
    .select("no_empleado, modulo, scores, comentarios, promedio")
    .eq("no_empleado", no)
    .eq("modulo", modulo)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) return null;

  if (modulo === "operaciones" && sub === "jefe_turno") {
    const entry = parseJtBucketRaw(data.scores)[calificadoPor];
    if (!entry) return null;
    return {
      noEmpleado: no,
      modulo,
      submodulo: "jefe_turno",
      calificadoPor,
      periodMonth: periodMonthEvaluacion(String((data as { period_month?: string }).period_month ?? "")),
      scores: entry.scores,
      comentarios: entry.comentarios,
      promedio: entry.promedio,
    };
  }

  const scores = parseScores(data.scores);
  return {
    noEmpleado: no,
    modulo,
    submodulo: modulo === "operaciones" ? "oficial" : "",
    calificadoPor: "",
    periodMonth: periodMonthEvaluacion(String((data as { period_month?: string }).period_month ?? "")),
    scores,
    comentarios: String(data.comentarios ?? ""),
    promedio: data.promedio != null ? Number(data.promedio) : promedioDeScores(scores),
  };
}

async function upsertCatEvaluacionJtLegacyJson(
  client: SupabaseClient,
  noEmpleado: string,
  calificadoPor: string,
  filtered: Record<string, number>,
  comentarios: string,
  promedio: number | null,
): Promise<CatEvaluacionRow> {
  const no = noEmpleado.trim().toUpperCase();
  const { data: existing, error: readErr } = await client
    .from("cat_evaluacion")
    .select("scores")
    .eq("no_empleado", no)
    .eq("modulo", "operaciones")
    .maybeSingle();
  if (readErr) throw new Error(readErr.message);

  const rawScores: Record<string, unknown> =
    existing?.scores && typeof existing.scores === "object"
      ? { ...(existing.scores as Record<string, unknown>) }
      : {};
  const jtBucket = parseJtBucketRaw(rawScores);
  jtBucket[calificadoPor] = {
    scores: filtered,
    comentarios: comentarios.trim(),
    promedio,
  };
  rawScores[CAT_JT_EVALS_SCORES_KEY] = jtBucket;

  const payload = {
    scores: rawScores,
    comentarios: "",
    promedio: null,
    updated_at: new Date().toISOString(),
  };

  if (existing) {
    const { error } = await client
      .from("cat_evaluacion")
      .update(payload)
      .eq("no_empleado", no)
      .eq("modulo", "operaciones");
    if (error) throw new Error(error.message);
  } else {
    const { error } = await client.from("cat_evaluacion").insert({
      no_empleado: no,
      modulo: "operaciones",
      ...payload,
    });
    if (error) throw new Error(error.message);
  }

  return {
    noEmpleado: no,
    modulo: "operaciones",
    submodulo: "jefe_turno",
    calificadoPor,
    periodMonth: mesCalendarioAnteriorYm(),
    scores: filtered,
    comentarios: comentarios.trim(),
    promedio,
  };
}

async function upsertCatEvaluacionLegacyMinimal(
  client: SupabaseClient,
  noEmpleado: string,
  modulo: CatEvalModuloId,
  filtered: Record<string, number>,
  comentarios: string,
  promedio: number | null,
): Promise<CatEvaluacionRow> {
  const no = noEmpleado.trim().toUpperCase();
  const payload = {
    scores: filtered,
    comentarios: comentarios.trim(),
    promedio,
    updated_at: new Date().toISOString(),
  };

  const { data: existing, error: readErr } = await client
    .from("cat_evaluacion")
    .select("no_empleado")
    .eq("no_empleado", no)
    .eq("modulo", modulo)
    .maybeSingle();
  if (readErr) throw new Error(readErr.message);

  if (existing) {
    const { error } = await client
      .from("cat_evaluacion")
      .update(payload)
      .eq("no_empleado", no)
      .eq("modulo", modulo);
    if (error) throw new Error(error.message);
  } else {
    const { error } = await client.from("cat_evaluacion").insert({
      no_empleado: no,
      modulo,
      ...payload,
    });
    if (error) throw new Error(error.message);
  }

  return {
    noEmpleado: no,
    modulo,
    submodulo: modulo === "operaciones" ? "oficial" : "",
    calificadoPor: "",
    periodMonth: mesCalendarioAnteriorYm(),
    scores: filtered,
    comentarios: comentarios.trim(),
    promedio,
  };
}

function submoduloDbParaModulo(modulo: CatEvalModuloId, submodulo?: string): string {
  if (modulo !== "operaciones") return "";
  return submoduloOperaciones(normalizarSubmoduloOperaciones(submodulo));
}

/** Mes YYYY-MM obligatorio; si falta o es inválido, usa mes anterior (desfase). */
export function periodMonthEvaluacion(raw?: string | null): string {
  return normalizarMesYm(String(raw ?? "")) ?? mesCalendarioAnteriorYm();
}

/** Mes de una fila DB: solo YYYY-MM válido; vacío si falta (no inventar mes actual). */
function periodMonthDesdeFila(raw?: string | null): string {
  return normalizarMesYm(String(raw ?? "")) ?? "";
}

function rowToCatEvaluacion(r: Record<string, unknown>, modulo: CatEvalModuloId): CatEvaluacionRow {
  const scores = parseScores(r.scores);
  const subRaw = String(r.submodulo ?? "");
  let submodulo =
    modulo === "operaciones" ? submoduloOperaciones(normalizarSubmoduloOperaciones(subRaw || "oficial")) : "";
  // Filas antiguas de JT mal etiquetadas como "oficial" tras la migración.
  if (modulo === "operaciones" && submodulo === "oficial" && scoresParecenJefeTurno(scores)) {
    submodulo = "jefe_turno";
  }
  return {
    noEmpleado: normalizarNoEmpleado(String(r.no_empleado)),
    modulo,
    submodulo,
    calificadoPor: normalizarNoEmpleado(String(r.calificado_por ?? "")),
    periodMonth: periodMonthDesdeFila(String(r.period_month ?? r.periodMonth ?? "")),
    scores,
    comentarios: String(r.comentarios ?? ""),
    promedio: r.promedio != null ? Number(r.promedio) : promedioDeScores(scores),
  };
}

/** Promedio operaciones oficial = media de los promedios de cada JT evaluador. */
export function mapaPromedioOperacionesOficial(rows: CatEvaluacionRow[]): Map<string, number | null> {
  const porOficial = new Map<string, number[]>();
  for (const r of rows) {
    if (r.submodulo !== "oficial" || r.promedio == null || !Number.isFinite(r.promedio)) continue;
    const list = porOficial.get(r.noEmpleado) ?? [];
    list.push(r.promedio);
    porOficial.set(r.noEmpleado, list);
  }
  const out = new Map<string, number | null>();
  for (const [no, proms] of porOficial) {
    out.set(no, promedioAcumuladoEvaluaciones(proms));
  }
  return out;
}

/** Promedio operaciones JT = media de los promedios de cada JS (o calificador) evaluador. */
export function mapaPromedioOperacionesJefeTurno(rows: CatEvaluacionRow[]): Map<string, number | null> {
  const porJefe = new Map<string, number[]>();
  for (const r of rows) {
    if (r.submodulo !== "jefe_turno" || r.promedio == null || !Number.isFinite(r.promedio)) continue;
    const list = porJefe.get(r.noEmpleado) ?? [];
    list.push(r.promedio);
    porJefe.set(r.noEmpleado, list);
  }
  const out = new Map<string, number | null>();
  for (const [no, proms] of porJefe) {
    out.set(no, promedioAcumuladoEvaluaciones(proms));
  }
  return out;
}

async function deleteCatEvaluacionModern(
  client: SupabaseClient,
  no: string,
  modulo: CatEvalModuloId,
  sub: string,
  calificadoPor: string,
  periodMonth: string,
): Promise<boolean> {
  let q = client
    .from("cat_evaluacion")
    .delete()
    .eq("no_empleado", no)
    .eq("modulo", modulo)
    .eq("period_month", periodMonth);
  if (modulo === "operaciones") {
    q = q.eq("submodulo", sub).eq("calificado_por", calificadoPor);
  }
  const { data, error } = await q.select("no_empleado");
  if (error) throw new Error(error.message);
  return (data?.length ?? 0) > 0;
}

async function deleteCatEvaluacionLegacyJtJson(
  client: SupabaseClient,
  noEmpleado: string,
  calificadoPor: string,
): Promise<boolean> {
  const no = noEmpleado.trim().toUpperCase();
  const { data: existing, error: readErr } = await client
    .from("cat_evaluacion")
    .select("scores")
    .eq("no_empleado", no)
    .eq("modulo", "operaciones")
    .maybeSingle();
  if (readErr) throw new Error(readErr.message);
  if (!existing?.scores || typeof existing.scores !== "object") return false;

  const rawScores = { ...(existing.scores as Record<string, unknown>) };
  const jtBucket = parseJtBucketRaw(rawScores);
  if (!jtBucket[calificadoPor]) return false;
  delete jtBucket[calificadoPor];

  if (Object.keys(jtBucket).length === 0) {
    delete rawScores[CAT_JT_EVALS_SCORES_KEY];
  } else {
    rawScores[CAT_JT_EVALS_SCORES_KEY] = jtBucket;
  }

  const flatScores = parseScores(rawScores);
  const sinDatos = Object.keys(flatScores).length === 0 && !rawScores[CAT_JT_EVALS_SCORES_KEY];
  if (sinDatos) {
    const { error } = await client.from("cat_evaluacion").delete().eq("no_empleado", no).eq("modulo", "operaciones");
    if (error) throw new Error(error.message);
    return true;
  }

  const { error } = await client
    .from("cat_evaluacion")
    .update({ scores: rawScores, updated_at: new Date().toISOString() })
    .eq("no_empleado", no)
    .eq("modulo", "operaciones");
  if (error) throw new Error(error.message);
  return true;
}

async function deleteCatEvaluacionLegacyMinimal(
  client: SupabaseClient,
  no: string,
  modulo: CatEvalModuloId,
): Promise<boolean> {
  const { data, error } = await client
    .from("cat_evaluacion")
    .delete()
    .eq("no_empleado", no)
    .eq("modulo", modulo)
    .select("no_empleado");
  if (error) throw new Error(error.message);
  return (data?.length ?? 0) > 0;
}

/** Elimina una calificación (admin). Operaciones: por submodulo + calificado_por + mes; RH/Enfoque: fila del mes. */
export async function deleteCatEvaluacion(
  noEmpleado: string,
  modulo: CatEvalModuloId,
  admin?: SupabaseClient | null,
  opts?: { submodulo?: string; calificadoPor?: string; periodMonth?: string },
): Promise<void> {
  const client = admin ?? db();
  if (!client) throw new Error("Supabase no configurado");
  const no = normalizarNoEmpleado(noEmpleado);
  if (!no) throw new Error("Número de empleado requerido.");
  const sub = submoduloDbParaModulo(modulo, opts?.submodulo);
  const calificadoPor = normalizarNoEmpleado(String(opts?.calificadoPor ?? ""));
  const periodMonth = periodMonthEvaluacion(opts?.periodMonth);

  try {
    const deleted = await deleteCatEvaluacionModern(client, no, modulo, sub, calificadoPor, periodMonth);
    if (deleted) return;
    // Esquema moderno OK: no hay fila en ese mes — no borrar otros meses vía legacy.
    throw new Error("No se encontró la calificación a eliminar.");
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg.includes("No se encontró la calificación")) throw e;
    if (!debeUsarLegacyJsonCatEvaluacion(msg)) {
      throw new Error(mensajeErrorCatEvaluacionSchema(msg, no));
    }
  }

  if (modulo === "operaciones" && sub === "jefe_turno" && calificadoPor) {
    if (await deleteCatEvaluacionLegacyJtJson(client, no, calificadoPor)) return;
  }

  if (modulo !== "operaciones" || sub === "oficial") {
    if (await deleteCatEvaluacionLegacyMinimal(client, no, modulo)) return;
  }

  throw new Error("No se encontró la calificación a eliminar.");
}

export async function getCatEvaluacion(
  noEmpleado: string,
  modulo: CatEvalModuloId,
  admin?: SupabaseClient | null,
  opts?: { submodulo?: string; calificadoPor?: string; periodMonth?: string },
): Promise<CatEvaluacionRow | null> {
  const client = admin ?? db();
  if (!client) return null;
  const sub = submoduloDbParaModulo(modulo, opts?.submodulo);
  const calificadoPor = normalizarNoEmpleado(String(opts?.calificadoPor ?? ""));
  const periodMonth = periodMonthEvaluacion(opts?.periodMonth);

  try {
    const viaRpc = await getCatEvaluacionViaRpc(client, noEmpleado, modulo, sub, calificadoPor, periodMonth);
    // RPC respondió: null = no hay calificación en ese mes (no rellenar con otro mes).
    return viaRpc;
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (!debeUsarLegacyJsonCatEvaluacion(msg)) {
      throw new Error(mensajeErrorCatEvaluacionSchema(msg));
    }
  }

  // Solo esquema legacy (sin period_month / RPC).
  if (modulo === "operaciones" && sub === "jefe_turno" && calificadoPor) {
    const legacy = await getCatEvaluacionLegacyMinimal(client, noEmpleado, modulo, sub, calificadoPor);
    if (legacy) return { ...legacy, periodMonth };
    return null;
  }

  try {
    const legacy = await getCatEvaluacionLegacyMinimal(client, noEmpleado, modulo, sub, calificadoPor);
    if (legacy) return { ...legacy, periodMonth };
    return null;
  } catch {
    return null;
  }
}

function errorPareceEsquemaEvaluacionLegacy(message: string): boolean {
  const m = message.toLowerCase();
  return (
    m.includes("submodulo") ||
    m.includes("calificado_por") ||
    m.includes("does not exist") ||
    m.includes("column")
  );
}

function errorPareceSchemaCacheColumnas(message: string): boolean {
  const m = message.toLowerCase();
  return errorPareceEsquemaEvaluacionLegacy(message) && m.includes("schema cache");
}

function errorPareceRpcCatEvaluacionFalta(message: string): boolean {
  const m = message.toLowerCase();
  return m.includes("could not find the function") && m.includes("cat_");
}

function errorPareceFkCatPersonal(message: string): boolean {
  const m = message.toLowerCase();
  return m.includes("cat_evaluacion_no_empleado_fkey") || (m.includes("foreign key") && m.includes("cat_personal"));
}

function mensajeErrorFkCatPersonal(noEmpleado: string): string {
  const no = normalizarNoEmpleado(noEmpleado);
  return (
    `El colaborador ${no} no está en el catálogo Personal de categorización. ` +
    "Verifique que exista en Colaboradores, esté activo y use «Sincronizar personal» en el módulo Personal si aplica."
  );
}

/**
 * cat_evaluacion.no_empleado referencia cat_personal. Si falta la fila, la crea desde expedientes.
 */
async function ensureCatPersonalForEvaluacion(
  client: SupabaseClient,
  noEmpleado: string,
): Promise<void> {
  const no = normalizarNoEmpleado(noEmpleado);
  if (!no) throw new Error("Número de empleado requerido.");

  const { data, error } = await client.from("cat_personal").select("no_empleado").eq("no_empleado", no).maybeSingle();
  if (error) throw new Error(hintSupabaseClientError(error.message));
  if (data) return;

  const colaboradores = await fetchAllColaboradoresCompletos(client);
  const col = colaboradores.find((c) => normalizarNoEmpleado(c.noEmpleado) === no);
  if (!col) {
    throw new Error(
      `El N.º ${no} no está en Colaboradores. Regístrelo en expedientes antes de calificar en categorización.`,
    );
  }
  if (!colaboradorEstaActivoEnOperacion(col)) {
    throw new Error(`El colaborador ${no} tiene baja o estatus inactivo; no se puede calificar.`);
  }

  await upsertCatPersonal(colaboradorToCatPersonal(col, ""), client);
}

function mensajeErrorCatEvaluacionSchema(message: string, noEmpleado?: string): string {
  if (noEmpleado && errorPareceFkCatPersonal(message)) {
    return mensajeErrorFkCatPersonal(noEmpleado);
  }
  if (errorPareceSchemaCacheColumnas(message) || errorPareceRpcCatEvaluacionFalta(message)) {
    return `${message} — Ejecuta en Supabase SQL Editor: web/supabase/migrations/059_cat_evaluacion_period_month.sql (mes/historial + RPC). Espera 20 s y guarda de nuevo.`;
  }
  return hintSupabaseClientError(message);
}

function rpcRowFromJson(data: unknown, modulo: CatEvalModuloId): CatEvaluacionRow {
  if (!data || typeof data !== "object") throw new Error("Respuesta RPC vacía");
  return rowToCatEvaluacion(data as Record<string, unknown>, modulo);
}

async function upsertCatEvaluacionViaRpc(
  client: SupabaseClient,
  noEmpleado: string,
  modulo: CatEvalModuloId,
  sub: string,
  calificadoPor: string,
  filtered: Record<string, number>,
  comentarios: string,
  promedio: number | null,
  periodMonth: string,
): Promise<CatEvaluacionRow> {
  const { data, error } = await client.rpc("cat_upsert_evaluacion", {
    p_no_empleado: noEmpleado.trim().toUpperCase(),
    p_modulo: modulo,
    p_submodulo: sub,
    p_calificado_por: calificadoPor,
    p_scores: filtered,
    p_comentarios: comentarios.trim(),
    p_promedio: promedio,
    p_period_month: periodMonth,
  });
  if (error) throw new Error(error.message);
  return rpcRowFromJson(data, modulo);
}

async function listCatEvaluacionesModuloViaRpc(
  client: SupabaseClient,
  modulo: CatEvalModuloId,
  subOperaciones: string | null,
  periodMonth: string | null,
): Promise<CatEvaluacionRow[]> {
  // Siempre enviar los 3 args para evitar ambigüedad de overloads en Postgres.
  const { data, error } = await client.rpc("cat_list_evaluaciones_modulo", {
    p_modulo: modulo,
    p_submodulo: subOperaciones ?? "",
    p_period_month: periodMonth ?? "",
  });
  if (error) throw new Error(error.message);
  const rows = Array.isArray(data) ? data : [];
  return rows.map((row) => rpcRowFromJson(row, modulo));
}

async function getCatEvaluacionViaRpc(
  client: SupabaseClient,
  noEmpleado: string,
  modulo: CatEvalModuloId,
  sub: string,
  calificadoPor: string,
  periodMonth: string,
): Promise<CatEvaluacionRow | null> {
  const { data, error } = await client.rpc("cat_get_evaluacion", {
    p_no_empleado: noEmpleado.trim().toUpperCase(),
    p_modulo: modulo,
    p_submodulo: sub,
    p_calificado_por: calificadoPor,
    p_period_month: periodMonth || "",
  });
  if (error) throw new Error(error.message);
  if (!data) return null;
  return rpcRowFromJson(data, modulo);
}

export async function listCatEvaluacionesModulo(
  modulo: CatEvalModuloId,
  admin?: SupabaseClient | null,
  opts?: { submodulo?: string; periodMonth?: string },
): Promise<CatEvaluacionRow[]> {
  const client = admin ?? db();
  if (!client) return [];
  const periodMonth = opts?.periodMonth ? periodMonthEvaluacion(opts.periodMonth) : null;
  const subOperaciones =
    modulo === "operaciones" && opts?.submodulo != null
      ? submoduloDbParaModulo(modulo, opts.submodulo)
      : null;

  let rows: CatEvaluacionRow[] = [];
  let rpcOk = false;

  try {
    const subRpc = modulo === "operaciones" ? "" : subOperaciones;
    rows = await listCatEvaluacionesModuloViaRpc(client, modulo, subRpc, periodMonth);
    rpcOk = true;
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    try {
      let q = client.from("cat_evaluacion").select("*").eq("modulo", modulo);
      if (periodMonth) q = q.eq("period_month", periodMonth);
      const { data, error } = await q;
      if (error) throw new Error(error.message);
      rows = (data ?? []).map((r) => rowToCatEvaluacion(r as Record<string, unknown>, modulo));
      rpcOk = true;
    } catch {
      if (!debeUsarLegacyJsonCatEvaluacion(msg)) {
        throw new Error(mensajeErrorCatEvaluacionSchema(msg));
      }
    }
  }

  if (periodMonth) {
    rows = rows.filter((r) => r.periodMonth === periodMonth);
  }

  if (modulo === "operaciones") {
    // Si el listado moderno/RPC ya respondió, no mezclar filas legacy (contaminan otros meses).
    if (!rpcOk) {
      try {
        const rawRows = await listCatEvaluacionesModuloLegacyMinimal(client, modulo);
        const fromLegacy = expandOperacionesLegacyRows(rawRows, subOperaciones).map((r) => ({
          ...r,
          periodMonth: r.periodMonth || periodMonth || mesCalendarioAnteriorYm(),
        }));
        const legacyFiltered = periodMonth
          ? fromLegacy.filter((r) => r.periodMonth === periodMonth)
          : fromLegacy;
        rows = mergeCatEvalRows(rows, legacyFiltered);
      } catch {
        /* sin datos */
      }
    }
    return filtrarOperacionesPorSub(rows, subOperaciones);
  }

  if (rpcOk) return rows;

  const rawRows = await listCatEvaluacionesModuloLegacyMinimal(client, modulo);
  return rawRows
    .map((row) => rowToCatEvaluacion(row, modulo))
    .filter((r) => !periodMonth || r.periodMonth === periodMonth);
}

export async function listCatEvaluacionPeriodMonths(
  admin?: SupabaseClient | null,
): Promise<string[]> {
  const client = admin ?? db();
  if (!client) return [];
  try {
    const { data, error } = await client.rpc("cat_list_period_months");
    if (!error && Array.isArray(data)) {
      return data.map((x) => String(x)).filter((m) => /^\d{4}-\d{2}$/.test(m));
    }
  } catch {
    /* fallback tabla */
  }
  const set = new Set<string>();
  try {
    const { data: evalData } = await client.from("cat_evaluacion").select("period_month");
    for (const row of evalData ?? []) {
      const m = String((row as { period_month?: string }).period_month ?? "");
      if (/^\d{4}-\d{2}$/.test(m)) set.add(m);
    }
  } catch {
    /* ignore */
  }
  try {
    const { data: capData } = await client.from("cat_capacitacion_registro").select("period_month");
    for (const row of capData ?? []) {
      const m = String((row as { period_month?: string }).period_month ?? "");
      if (/^\d{4}-\d{2}$/.test(m)) set.add(m);
    }
  } catch {
    /* columna ausente u otro error */
  }
  const prev = mesCalendarioAnteriorYm();
  set.add(prev);
  return [...set].sort((a, b) => b.localeCompare(a));
}

export type MapasPromedioOperaciones = {
  oficial: Map<string, number | null>;
  jefeTurno: Map<string, number | null>;
};

export async function loadMapasPromedioOperaciones(
  admin?: SupabaseClient | null,
  opts?: { periodMonth?: string },
): Promise<MapasPromedioOperaciones> {
  const periodMonth = opts?.periodMonth ? periodMonthEvaluacion(opts.periodMonth) : undefined;
  const [opOficialList, opJefeList] = await Promise.all([
    listCatEvaluacionesModulo("operaciones", admin, { submodulo: "oficial", periodMonth }),
    listCatEvaluacionesModulo("operaciones", admin, { submodulo: "jefe_turno", periodMonth }),
  ]);
  return {
    oficial: mapaPromedioOperacionesOficial(opOficialList),
    jefeTurno: mapaPromedioOperacionesJefeTurno(opJefeList),
  };
}

/** Oficial: media de JT/JS calificadores. JT/JS: media de los oficiales que los calificaron. */
export function promedioOperacionesParaEmpleado(
  noEmpleado: string,
  puesto: string,
  mapas: MapasPromedioOperaciones,
): number | null {
  const key = normalizarNoEmpleado(noEmpleado);
  const rol = rolOperacionesDesdePuesto(puesto);
  const map = rol === "jefe_turno" ? mapas.jefeTurno : mapas.oficial;
  return map.get(key) ?? null;
}

function mergePersonalConActivos(
  personalCat: CatPersonalRow[],
  activos: CatColaboradorActivoOpcion[],
): CatPersonalRow[] {
  const map = new Map<string, CatPersonalRow>();
  for (const p of personalCat) {
    map.set(normalizarNoEmpleado(p.noEmpleado), p);
  }
  for (const a of activos) {
    const no = normalizarNoEmpleado(a.noEmpleado);
    const prev = map.get(no);
    if (prev) {
      map.set(no, {
        ...prev,
        nombre: prev.nombre || a.nombre,
        servicio: prev.servicio || a.servicio,
        puesto: prev.puesto || a.puesto,
        fechaIngreso: prev.fechaIngreso || a.fechaIngreso || "",
      });
    } else {
      map.set(no, {
        noEmpleado: no,
        periodoEvaluacion: "",
        fechaIngreso: a.fechaIngreso || "",
        nombre: a.nombre,
        servicio: a.servicio,
        puesto: a.puesto,
        fechaNacimiento: "",
        edad: "",
        escolaridad: "",
        estatus: "ACTIVO",
        fechaBaja: "",
      });
    }
  }
  return [...map.values()].sort((a, b) => a.nombre.localeCompare(b.nombre, "es", { sensitivity: "base" }));
}

async function upsertCatEvaluacionModernTable(
  client: SupabaseClient,
  noEmpleado: string,
  modulo: CatEvalModuloId,
  sub: string,
  calificadoPor: string,
  filtered: Record<string, number>,
  comentarios: string,
  promedio: number | null,
  periodMonth: string,
): Promise<CatEvaluacionRow> {
  const no = noEmpleado.trim().toUpperCase();
  const cal = normalizarNoEmpleado(calificadoPor);
  const payload = {
    no_empleado: no,
    modulo,
    submodulo: sub,
    calificado_por: cal,
    period_month: periodMonth,
    scores: filtered,
    comentarios: comentarios.trim(),
    promedio,
    updated_at: new Date().toISOString(),
  };
  const { data, error } = await client
    .from("cat_evaluacion")
    .upsert(payload, { onConflict: "no_empleado,modulo,submodulo,calificado_por,period_month" })
    .select("no_empleado, modulo, submodulo, calificado_por, period_month, scores, comentarios, promedio")
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (data) return rowToCatEvaluacion(data as Record<string, unknown>, modulo);
  return {
    noEmpleado: no,
    modulo,
    submodulo: sub,
    calificadoPor: cal,
    periodMonth,
    scores: filtered,
    comentarios: comentarios.trim(),
    promedio,
  };
}

export async function upsertCatEvaluacion(
  noEmpleado: string,
  modulo: CatEvalModuloId,
  scores: Record<string, number>,
  comentarios: string,
  admin?: SupabaseClient | null,
  opts?: {
    submodulo?: string;
    rolOperaciones?: CatOperacionesRolId;
    calificadoPor?: string;
    periodMonth?: string;
  },
): Promise<CatEvaluacionRow> {
  const client = admin ?? db();
  if (!client) throw new Error("Supabase no configurado");
  const rolOp = opts?.rolOperaciones ?? normalizarSubmoduloOperaciones(opts?.submodulo);
  const sub = submoduloDbParaModulo(modulo, opts?.submodulo ?? rolOp);
  const calificadoPor = normalizarNoEmpleado(String(opts?.calificadoPor ?? ""));
  const periodMonth = periodMonthEvaluacion(opts?.periodMonth);
  if (sub === "jefe_turno" && !calificadoPor) {
    throw new Error("Indique el N.º del jefe de servicio / JS (calificado por) para jefe de turno.");
  }
  if (sub === "oficial" && !calificadoPor) {
    throw new Error("Indique el N.º del jefe de turno (calificado por) para oficial.");
  }
  const campos = camposPorModulo(modulo, modulo === "operaciones" ? { rolOperaciones: rolOp } : undefined);
  const filtered: Record<string, number> = {};
  for (const c of campos) {
    const v = scores[c.key];
    if (v != null && Number.isFinite(v)) filtered[c.key] = v;
  }
  const promedio = promedioDeScores(filtered);

  await ensureCatPersonalForEvaluacion(client, noEmpleado);

  // 1) RPC (preferido)
  try {
    return await upsertCatEvaluacionViaRpc(
      client,
      noEmpleado,
      modulo,
      sub,
      calificadoPor,
      filtered,
      comentarios,
      promedio,
      periodMonth,
    );
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (!debeUsarLegacyJsonCatEvaluacion(msg)) {
      throw new Error(mensajeErrorCatEvaluacionSchema(msg, noEmpleado));
    }
  }

  // 2) Upsert directo con period_month (+ submodulo/calificado_por en operaciones)
  try {
    return await upsertCatEvaluacionModernTable(
      client,
      noEmpleado,
      modulo,
      sub,
      calificadoPor,
      filtered,
      comentarios,
      promedio,
      periodMonth,
    );
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (!debeUsarLegacyJsonCatEvaluacion(msg)) {
      throw new Error(mensajeErrorCatEvaluacionSchema(msg, noEmpleado));
    }
  }

  // 3) Solo JT: JSON legacy (último recurso; sin historial real por mes)
  if (modulo === "operaciones" && sub === "jefe_turno" && calificadoPor) {
    const row = await upsertCatEvaluacionJtLegacyJson(
      client,
      noEmpleado,
      calificadoPor,
      filtered,
      comentarios,
      promedio,
    );
    return { ...row, periodMonth };
  }

  if (modulo === "operaciones" && calificadoPor) {
    throw new Error(
      "No se pudo guardar la calificación de operaciones. Ejecuta en Supabase: web/supabase/migrations/059_cat_evaluacion_period_month.sql",
    );
  }

  try {
    const row = await upsertCatEvaluacionLegacyMinimal(
      client,
      noEmpleado,
      modulo,
      filtered,
      comentarios,
      promedio,
    );
    return { ...row, periodMonth };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    throw new Error(mensajeErrorCatEvaluacionSchema(msg, noEmpleado));
  }
}

export async function promedioCapacitacionEmpleado(
  noEmpleado: string,
  admin?: SupabaseClient | null,
  opts?: { periodMonth?: string },
): Promise<number | null> {
  const map = await promediosCapacitacionPorEmpleados(admin, opts);
  return map.get(normalizarNoEmpleado(noEmpleado)) ?? null;
}

/** Una sola consulta para promedios de capacitación (opcionalmente filtrados por mes). */
export async function promediosCapacitacionPorEmpleados(
  admin?: SupabaseClient | null,
  opts?: { periodMonth?: string },
): Promise<Map<string, number | null>> {
  const client = admin ?? db();
  const out = new Map<string, number | null>();
  if (!client) return out;

  const periodMonth = opts?.periodMonth ? periodMonthEvaluacion(opts.periodMonth) : null;
  let q = client.from("cat_capacitacion_registro").select("no_empleado, promedio, period_month");
  if (periodMonth) q = q.eq("period_month", periodMonth);
  const { data, error } = await q;
  if (error) {
    // Fallback si aún no existe period_month: no atribuir todos los meses al mes pedido.
    if (/period_month/i.test(error.message)) {
      if (periodMonth) return out;
      const legacy = await client.from("cat_capacitacion_registro").select("no_empleado, promedio");
      if (legacy.error) throw new Error(hintSupabaseClientError(legacy.error.message));
      const accLegacy = new Map<string, number[]>();
      for (const row of legacy.data ?? []) {
        const r = row as { no_empleado?: string; promedio?: number | null };
        const no = normalizarNoEmpleado(String(r.no_empleado ?? ""));
        const p = r.promedio;
        if (!no || p == null || !Number.isFinite(p)) continue;
        const list = accLegacy.get(no) ?? [];
        list.push(p);
        accLegacy.set(no, list);
      }
      for (const [no, vals] of accLegacy) {
        out.set(no, Math.round((vals.reduce((a, b) => a + b, 0) / vals.length) * 100) / 100);
      }
      return out;
    }
    throw new Error(hintSupabaseClientError(error.message));
  }

  const acc = new Map<string, number[]>();
  for (const row of data ?? []) {
    const r = row as { no_empleado?: string; promedio?: number | null; period_month?: string };
    if (periodMonth && String(r.period_month ?? "") !== periodMonth) continue;
    const no = normalizarNoEmpleado(String(r.no_empleado ?? ""));
    const p = r.promedio;
    if (!no || p == null || !Number.isFinite(p)) continue;
    const list = acc.get(no) ?? [];
    list.push(p);
    acc.set(no, list);
  }
  for (const [no, vals] of acc) {
    out.set(no, Math.round((vals.reduce((a, b) => a + b, 0) / vals.length) * 100) / 100);
  }
  return out;
}

export type BuildResumenCategorizacionOpts = {
  opMapas?: MapasPromedioOperaciones;
  activos?: CatColaboradorActivoOpcion[];
  personalCat?: CatPersonalRow[];
  rhList?: CatEvaluacionRow[];
  enList?: CatEvaluacionRow[];
  capProms?: Map<string, number | null>;
  periodMonth?: string;
};

export async function buildResumenCategorizacion(
  admin?: SupabaseClient | null,
  opts?: BuildResumenCategorizacionOpts,
): Promise<CatResumenEmpleado[]> {
  const periodMonth = periodMonthEvaluacion(opts?.periodMonth);
  const [personalCat, activos, rhList, opMapas, enList, capProms] = await Promise.all([
    opts?.personalCat != null ? Promise.resolve(opts.personalCat) : listCatPersonal(admin),
    opts?.activos != null
      ? Promise.resolve(opts.activos)
      : listColaboradoresActivosParaCategorizacion(undefined, admin),
    opts?.rhList != null
      ? Promise.resolve(opts.rhList)
      : listCatEvaluacionesModulo("recursos_humanos", admin, { periodMonth }),
    opts?.opMapas != null
      ? Promise.resolve(opts.opMapas)
      : loadMapasPromedioOperaciones(admin, { periodMonth }),
    opts?.enList != null
      ? Promise.resolve(opts.enList)
      : listCatEvaluacionesModulo("enfoque_cliente", admin, { periodMonth }),
    opts?.capProms != null
      ? Promise.resolve(opts.capProms)
      : promediosCapacitacionPorEmpleados(admin, { periodMonth }),
  ]);
  const personal = mergePersonalConActivos(personalCat, activos).filter((p) =>
    colaboradorVigenteEnMesHistorial(p.fechaIngreso, periodMonth),
  );
  const rhMap = new Map(rhList.map((r) => [r.noEmpleado, r.promedio]));
  const enMap = new Map(enList.map((r) => [r.noEmpleado, r.promedio]));

  return personal.map((p) => {
    const promedioRh = rhMap.get(p.noEmpleado) ?? null;
    const promedioCapacitacion = capProms.get(p.noEmpleado) ?? null;
    const promedioOperaciones = promedioOperacionesParaEmpleado(p.noEmpleado, p.puesto, opMapas);
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
/** Valor técnico para cumplir NOT NULL en BD; la UI ya no usa vencimiento. */
const FECHA_VENCIMIENTO_SIN_LIMITE = "9999-12-31";

function isMissingFechaInicioColumn(message: string): boolean {
  return /fecha_inicio/i.test(message) && /schema cache|could not find|column/i.test(message);
}

export async function listCursosCapacitacion(admin?: SupabaseClient | null): Promise<CatCapacitacionCurso[]> {
  const client = admin ?? db();
  if (!client) return [];
  const full = await client
    .from("cat_capacitacion_curso")
    .select(CAT_CURSO_COLS_FULL)
    .order("nombre", { ascending: true });
  if (!full.error) {
    return (full.data ?? []).map((r) => mapCursoCapacitacion(r as Record<string, unknown>));
  }
  if (isMissingFechaInicioColumn(full.error.message)) {
    const basic = await client
      .from("cat_capacitacion_curso")
      .select(CAT_CURSO_COLS_BASE)
      .order("nombre", { ascending: true });
    if (basic.error) throw new Error(hintSupabaseClientError(basic.error.message));
    return (basic.data ?? []).map((r) => mapCursoCapacitacion(r as Record<string, unknown>));
  }
  throw new Error(hintSupabaseClientError(full.error.message));
}

function mapCursoCapacitacion(row: Record<string, unknown>): CatCapacitacionCurso {
  const inicio = row.fecha_inicio;
  const vence = String(row.fecha_vencimiento ?? "").slice(0, 10);
  return {
    id: String(row.id),
    nombre: String(row.nombre ?? ""),
    fechaInicio: inicio ? String(inicio).slice(0, 10) : "",
    fechaVencimiento: vence === FECHA_VENCIMIENTO_SIN_LIMITE ? "" : vence,
    activo: Boolean(row.activo),
  };
}

export async function upsertCursoCapacitacion(
  curso: Partial<Omit<CatCapacitacionCurso, "id">> & { id?: string; nombre: string; activo?: boolean },
  admin?: SupabaseClient | null,
): Promise<CatCapacitacionCurso> {
  const client = admin ?? db();
  if (!client) throw new Error("Supabase no configurado");
  const nombre = curso.nombre.trim();
  if (!nombre) throw new Error("El nombre de la capacitación es obligatorio");
  const fechaVencimientoRaw = String(curso.fechaVencimiento ?? "").trim().slice(0, 10);
  const fechaVencimiento =
    fechaVencimientoRaw && /^\d{4}-\d{2}-\d{2}$/.test(fechaVencimientoRaw)
      ? fechaVencimientoRaw
      : FECHA_VENCIMIENTO_SIN_LIMITE;
  const base: Record<string, unknown> = {
    nombre,
    fecha_vencimiento: fechaVencimiento,
    activo: curso.activo !== false,
  };
  const inicio = String(curso.fechaInicio ?? "").trim();
  const payloadWithInicio = inicio ? { ...base, fecha_inicio: inicio } : { ...base, fecha_inicio: null };

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
    const { fecha_inicio: _fi, ...withoutInicio } = payload;
    if (curso.id) {
      return client
        .from("cat_capacitacion_curso")
        .update(withoutInicio)
        .eq("id", curso.id)
        .select(CAT_CURSO_COLS_BASE)
        .single();
    }
    return client.from("cat_capacitacion_curso").insert(withoutInicio).select(CAT_CURSO_COLS_BASE).single();
  };

  let data: unknown = null;
  let error: { message: string } | null = null;
  {
    const full = await writeFull(payloadWithInicio);
    data = full.data;
    error = full.error;
  }
  if (error && isMissingFechaInicioColumn(error.message)) {
    const basic = await writeBase(base);
    data = basic.data;
    error = basic.error;
  }
  if (error) throw new Error(hintSupabaseClientError(error.message));
  if (!data) throw new Error("Sin respuesta al guardar curso");
  return mapCursoCapacitacion(data as Record<string, unknown>);
}

export async function deleteCursoCapacitacion(id: string, admin?: SupabaseClient | null): Promise<void> {
  const client = admin ?? db();
  if (!client) throw new Error("Supabase no configurado");
  const { error } = await client.from("cat_capacitacion_curso").delete().eq("id", id);
  if (error) {
    if (/foreign key|violates|restrict/i.test(error.message)) {
      throw new Error(
        "No se puede eliminar: hay colaboradores registrados en esta capacitación. Elimina esos registros primero.",
      );
    }
    throw new Error(hintSupabaseClientError(error.message));
  }
}

export async function listRegistrosCapacitacion(
  admin?: SupabaseClient | null,
  opts?: { periodMonth?: string },
): Promise<CatCapacitacionRegistro[]> {
  const client = admin ?? db();
  if (!client) return [];
  const periodMonth = opts?.periodMonth ? periodMonthEvaluacion(opts.periodMonth) : null;
  let q = client
    .from("cat_capacitacion_registro")
    .select("*, cat_capacitacion_curso(nombre)")
    .order("updated_at", { ascending: false });
  if (periodMonth) q = q.eq("period_month", periodMonth);
  const { data, error } = await q;
  if (error) {
    if (/period_month/i.test(error.message)) {
      // Sin columna period_month: no inventar el mes pedido con todo el historial.
      if (periodMonth) return [];
      const legacy = await client
        .from("cat_capacitacion_registro")
        .select("*, cat_capacitacion_curso(nombre)")
        .order("updated_at", { ascending: false });
      if (legacy.error) throw new Error(hintSupabaseClientError(legacy.error.message));
      return (legacy.data ?? []).map((row) => {
        const r = row as Record<string, unknown> & { cat_capacitacion_curso?: { nombre?: string } };
        return {
          id: String(r.id),
          noEmpleado: String(r.no_empleado),
          cursoId: String(r.curso_id),
          cursoNombre: r.cat_capacitacion_curso?.nombre,
          periodMonth: mesCalendarioAnteriorYm(),
          asistencia: r.asistencia != null ? Number(r.asistencia) : null,
          desempeno: r.desempeno != null ? Number(r.desempeno) : null,
          promedio: r.promedio != null ? Number(r.promedio) : null,
          comentarios: String(r.comentarios ?? ""),
        };
      });
    }
    throw new Error(hintSupabaseClientError(error.message));
  }
  return (data ?? []).map((row) => {
    const r = row as Record<string, unknown> & { cat_capacitacion_curso?: { nombre?: string } };
    return {
      id: String(r.id),
      noEmpleado: String(r.no_empleado),
      cursoId: String(r.curso_id),
      cursoNombre: r.cat_capacitacion_curso?.nombre,
      periodMonth: periodMonthDesdeFila(String(r.period_month ?? "")) || periodMonth || "",
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
    /** Si se envía, se guarda tal cual en `promedio` (permite decimales; `desempeno` sigue siendo entero). */
    promedio?: number | null;
    comentarios: string;
    periodMonth?: string;
  },
  admin?: SupabaseClient | null,
): Promise<CatCapacitacionRegistro> {
  const client = admin ?? db();
  if (!client) throw new Error("Supabase no configurado");
  const periodMonth = periodMonthEvaluacion(input.periodMonth);
  const desempenoRaw =
    input.desempeno != null && Number.isFinite(input.desempeno) ? Number(input.desempeno) : null;
  // Columna smallint: solo enteros 1–5
  const desempeno =
    desempenoRaw != null
      ? Math.max(1, Math.min(5, Math.round(desempenoRaw)))
      : null;
  const promedioOverride =
    input.promedio != null && Number.isFinite(input.promedio) ? Number(input.promedio) : null;
  const promedio =
    promedioOverride != null
      ? Math.round(Math.max(1, Math.min(5, promedioOverride)) * 100) / 100
      : desempeno != null
        ? Math.round(desempeno * 100) / 100
        : null;
  const payload = {
    no_empleado: input.noEmpleado.trim().toUpperCase(),
    curso_id: input.cursoId,
    asistencia: null,
    desempeno,
    promedio,
    comentarios: input.comentarios.trim(),
    period_month: periodMonth,
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
      periodMonth: periodMonthEvaluacion(String(r.period_month ?? periodMonth)),
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
    periodMonth: periodMonthEvaluacion(String(r.period_month ?? periodMonth)),
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
