import type { SupabaseClient } from "@supabase/supabase-js";
import { activosCategorizacionDesdeColaboradores } from "@/lib/categorizacion-server";
import { servicioClaveFiltroCat, servicioCoincideFiltroCat } from "@/lib/categorizacion-filtros-servicio";
import { fetchAllColaboradoresCompletos } from "@/lib/colaboradores-supabase-fetch-all";
import { fechaIngresoNormalizadaColaborador } from "@/lib/colaboradores-baja";
import { textoTiempoEnEmpresa } from "@/lib/categorizacion-tenure";
import { textoEdadDesdeExpediente } from "@/lib/edad-desde-nacimiento";
import { FICHA_FOTO_FORM_KEY } from "@/lib/ficha-tecnica-keys";
import { hintSupabaseClientError } from "@/lib/supabase/admin";
import {
  evaluacionPeoCoincideServicio,
  mapPeoEvaluacionDb,
  type PeoDashboardPayload,
  type PeoEvaluacion,
} from "@/lib/pruebas-efectividad-operativa";

const EVALUACIONES_MAX = 5000;

export async function listPeoEvaluaciones(
  admin: SupabaseClient,
  opts?: {
    noEmpleado?: string;
    categoria?: string;
    tipo?: string;
    servicioScope?: string | null;
  },
): Promise<PeoEvaluacion[]> {
  let query = admin
    .from("peo_evaluaciones")
    .select("*")
    .order("evaluada_en", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(EVALUACIONES_MAX);

  const no = opts?.noEmpleado?.trim().toUpperCase();
  if (no) query = query.eq("no_empleado", no);
  if (opts?.categoria) query = query.eq("categoria", opts.categoria);
  if (opts?.tipo) query = query.eq("tipo", opts.tipo);

  const { data, error } = await query;
  if (error) throw new Error(hintSupabaseClientError(error.message));
  const headers = (data ?? []) as Record<string, unknown>[];
  if (headers.length === 0) return [];

  const ids = headers.map((r) => String(r.id ?? "")).filter(Boolean);
  const scoreData: Record<string, unknown>[] = [];
  for (let i = 0; i < ids.length; i += 200) {
    const { data: chunk, error: scoreError } = await admin
      .from("peo_evaluacion_puntajes")
      .select("*")
      .in("evaluacion_id", ids.slice(i, i + 200))
      .order("orden", { ascending: true });
    if (scoreError) throw new Error(hintSupabaseClientError(scoreError.message));
    scoreData.push(...((chunk ?? []) as Record<string, unknown>[]));
  }

  const byId = new Map<string, Record<string, unknown>[]>();
  for (const raw of scoreData) {
    const id = String(raw.evaluacion_id ?? "");
    const arr = byId.get(id) ?? [];
    arr.push(raw);
    byId.set(id, arr);
  }

  const evidData: Record<string, unknown>[] = [];
  for (let i = 0; i < ids.length; i += 200) {
    const { data: chunk, error: evidError } = await admin
      .from("peo_evaluacion_evidencias")
      .select("*")
      .in("evaluacion_id", ids.slice(i, i + 200))
      .order("created_at", { ascending: false });
    if (evidError) {
      // Tabla aún no migrada: continuar sin evidencias.
      if (/does not exist|relation|peo_evaluacion_evidencias/i.test(evidError.message)) break;
      throw new Error(hintSupabaseClientError(evidError.message));
    }
    evidData.push(...((chunk ?? []) as Record<string, unknown>[]));
  }

  const evidById = new Map<string, Record<string, unknown>[]>();
  for (const raw of evidData) {
    const id = String(raw.evaluacion_id ?? "");
    const arr = evidById.get(id) ?? [];
    arr.push(raw);
    evidById.set(id, arr);
  }

  return headers
    .map((raw) =>
      mapPeoEvaluacionDb(
        raw,
        byId.get(String(raw.id ?? "")) ?? [],
        evidById.get(String(raw.id ?? "")) ?? [],
      ),
    )
    .filter((e) => evaluacionPeoCoincideServicio(e, opts?.servicioScope ?? null));
}

export async function buildPeoDashboard(
  admin: SupabaseClient,
  servicioScope: string | null,
): Promise<PeoDashboardPayload> {
  const [colaboradoresRaw, evaluaciones] = await Promise.all([
    fetchAllColaboradoresCompletos(admin),
    listPeoEvaluaciones(admin, { servicioScope }),
  ]);
  const activos = activosCategorizacionDesdeColaboradores(colaboradoresRaw, {
    servicio: servicioScope ?? undefined,
    soloCalificables: true,
  });
  const rawByNo = new Map(colaboradoresRaw.map((c) => [c.noEmpleado.trim().toUpperCase(), c]));

  const colaboradores = activos
    .filter((a) => !servicioScope || servicioCoincideFiltroCat(a.servicio, servicioScope))
    .map((a) => {
      const c = rawByNo.get(a.noEmpleado.trim().toUpperCase());
      const form = c?.form ?? {};
      const fechaIngreso = c ? fechaIngresoNormalizadaColaborador(c) : "";
      return {
        noEmpleado: a.noEmpleado,
        nombre: a.nombre,
        servicio: a.servicio,
        planta: a.planta ?? "",
        puesto: a.puesto,
        fechaIngreso,
        tiempoEnEmpresa: textoTiempoEnEmpresa(fechaIngreso),
        edad: textoEdadDesdeExpediente(form.fechaNacimiento ?? "", form.edad ?? ""),
        escolaridad: String(form.escolaridad ?? "").trim(),
        fotoUrl: String(form[FICHA_FOTO_FORM_KEY] ?? "").trim() || null,
      };
    })
    .sort((a, b) => a.nombre.localeCompare(b.nombre, "es", { sensitivity: "base" }));

  const servicios = [
    ...new Set(
      colaboradores
        .map((c) => servicioClaveFiltroCat(c.servicio))
        .filter(Boolean),
    ),
  ].sort((a, b) => a.localeCompare(b, "es", { numeric: true }));

  return {
    colaboradores,
    evaluaciones,
    servicios,
    generadoEn: new Date().toISOString(),
  };
}
