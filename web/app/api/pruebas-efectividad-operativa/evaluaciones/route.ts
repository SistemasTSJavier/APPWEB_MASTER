import { NextResponse } from "next/server";
import {
  createSupabaseServiceRoleClient,
  hintSupabaseClientError,
  isSupabaseServerConfigured,
  supabaseServerEnvMissing,
} from "@/lib/supabase/admin";
import {
  requirePeoAdminApi,
  requirePeoApi,
  requirePeoCaptureApi,
} from "@/lib/pruebas-efectividad-auth";
import {
  PEO_EVIDENCIAS_BUCKET,
  PEO_PLANTILLA_VERSION,
  accionesSeguimientoParaDb,
  esPeoCategoriaId,
  esPeoTipoId,
  validarAccionesCorrectivas,
  validarAccionesSeguimiento,
  validarPuntajesPeo,
} from "@/lib/pruebas-efectividad-operativa";
import { listPeoEvaluaciones } from "@/lib/pruebas-efectividad-server";
import { listColaboradoresActivosParaCategorizacion } from "@/lib/categorizacion-server";

export const dynamic = "force-dynamic";

function adminClientOrError() {
  if (!isSupabaseServerConfigured()) {
    return {
      error: NextResponse.json(
        { error: "Supabase no configurado", missingEnv: supabaseServerEnvMissing() },
        { status: 503 },
      ),
    };
  }
  const admin = createSupabaseServiceRoleClient();
  if (!admin) return { error: NextResponse.json({ error: "Cliente no disponible" }, { status: 503 }) };
  return { admin };
}

function fechaValida(raw: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(raw)) return false;
  const d = new Date(`${raw}T12:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === raw;
}

export async function GET(req: Request) {
  const gate = await requirePeoApi();
  if ("error" in gate) return gate.error;
  const client = adminClientOrError();
  if ("error" in client) return client.error;

  const url = new URL(req.url);
  const noEmpleado = url.searchParams.get("no_empleado")?.trim() || undefined;
  const categoria = url.searchParams.get("categoria")?.trim() || undefined;
  const tipo = url.searchParams.get("tipo")?.trim() || undefined;
  if (categoria && !esPeoCategoriaId(categoria)) {
    return NextResponse.json({ error: "Categoría no válida." }, { status: 400 });
  }
  if (tipo && !esPeoTipoId(tipo)) {
    return NextResponse.json({ error: "Tipo no válido (use simulacion o real)." }, { status: 400 });
  }
  try {
    const rows = await listPeoEvaluaciones(client.admin, {
      noEmpleado,
      categoria,
      tipo,
      servicioScope: gate.auth.servicioScope,
    });
    return NextResponse.json({ ok: true, rows });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Error al consultar evaluaciones." },
      { status: 500 },
    );
  }
}

export async function POST(req: Request) {
  const gate = await requirePeoCaptureApi();
  if ("error" in gate) return gate.error;
  const client = adminClientOrError();
  if ("error" in client) return client.error;

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "JSON inválido." }, { status: 400 });
  }

  const noEmpleado = String(body.noEmpleado ?? "").trim().toUpperCase();
  const categoriaId = String(body.categoria ?? "").trim();
  const tipoRaw = String(body.tipo ?? "").trim().toLowerCase();
  const evaluadaEn = String(body.evaluadaEn ?? "").trim();
  const observaciones = String(body.observaciones ?? "").trim().slice(0, 4000);
  if (!noEmpleado) return NextResponse.json({ error: "Seleccione colaborador." }, { status: 400 });
  if (!esPeoTipoId(tipoRaw)) {
    return NextResponse.json({ error: "Seleccione tipo: simulación o real." }, { status: 400 });
  }
  if (!fechaValida(evaluadaEn)) {
    return NextResponse.json({ error: "Fecha de aplicación no válida." }, { status: 400 });
  }

  const correctivas = validarAccionesCorrectivas(body.accionesCorrectivas);
  if (!correctivas.ok) return NextResponse.json({ error: correctivas.error }, { status: 400 });
  const seguimiento = validarAccionesSeguimiento(body.accionesSeguimiento);
  if (!seguimiento.ok) return NextResponse.json({ error: seguimiento.error }, { status: 400 });

  const validacion = validarPuntajesPeo(categoriaId, body.puntajes);
  if (!validacion.ok) return NextResponse.json({ error: validacion.error }, { status: 400 });

  try {
    const activos = await listColaboradoresActivosParaCategorizacion(noEmpleado, client.admin, {
      soloCalificables: true,
    });
    const colaborador = activos.find((c) => c.noEmpleado.trim().toUpperCase() === noEmpleado);
    if (!colaborador) {
      return NextResponse.json(
        { error: "El colaborador no existe, está dado de baja o no pertenece a un servicio calificable." },
        { status: 404 },
      );
    }

    const { data: inserted, error: insertError } = await client.admin
      .from("peo_evaluaciones")
      .insert({
        categoria: validacion.categoria.id,
        tipo: tipoRaw,
        plantilla_version: PEO_PLANTILLA_VERSION,
        no_empleado: colaborador.noEmpleado.trim().toUpperCase(),
        nombre_snapshot: colaborador.nombre.trim(),
        servicio_snapshot: colaborador.servicio.trim(),
        planta_snapshot: String(colaborador.planta ?? "").trim(),
        puesto_snapshot: colaborador.puesto.trim(),
        evaluador_user_id: gate.auth.user.id,
        evaluador_email: String(gate.auth.user.email ?? "").trim().toLowerCase(),
        evaluada_en: evaluadaEn,
        observaciones,
        acciones_correctivas: correctivas.value,
        acciones_seguimiento: accionesSeguimientoParaDb(seguimiento.value),
        total: validacion.total,
      })
      .select("*")
      .single();
    if (insertError || !inserted) {
      throw new Error(hintSupabaseClientError(insertError?.message ?? "No se creó la evaluación."));
    }

    const evaluacionId = String(inserted.id);
    const scoreRows = validacion.puntajes.map((p) => ({
      evaluacion_id: evaluacionId,
      criterio: p.id,
      etiqueta_snapshot: p.etiqueta,
      orden: p.orden,
      maximo: p.maximo,
      obtenido: p.obtenido,
    }));
    const { error: scoreError } = await client.admin.from("peo_evaluacion_puntajes").insert(scoreRows);
    if (scoreError) {
      await client.admin.from("peo_evaluaciones").delete().eq("id", evaluacionId);
      throw new Error(hintSupabaseClientError(scoreError.message));
    }

    const rows = await listPeoEvaluaciones(client.admin, { noEmpleado: colaborador.noEmpleado });
    const row = rows.find((r) => r.id === evaluacionId) ?? null;
    return NextResponse.json({ ok: true, row }, { status: 201 });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Error al guardar evaluación." },
      { status: 500 },
    );
  }
}

/** Edita fecha, tipo, observaciones y puntajes sin alterar colaborador, categoría ni autor original. */
export async function PUT(req: Request) {
  const gate = await requirePeoCaptureApi();
  if ("error" in gate) return gate.error;
  const client = adminClientOrError();
  if ("error" in client) return client.error;

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "JSON inválido." }, { status: 400 });
  }

  const id = String(body.id ?? "").trim();
  const tipoRaw = String(body.tipo ?? "").trim().toLowerCase();
  const evaluadaEn = String(body.evaluadaEn ?? "").trim();
  const observaciones = String(body.observaciones ?? "").trim().slice(0, 4000);
  if (!id) return NextResponse.json({ error: "ID requerido." }, { status: 400 });
  if (!esPeoTipoId(tipoRaw)) {
    return NextResponse.json({ error: "Seleccione tipo: simulación o real." }, { status: 400 });
  }
  if (!fechaValida(evaluadaEn)) {
    return NextResponse.json({ error: "Fecha de aplicación no válida." }, { status: 400 });
  }

  const correctivas = validarAccionesCorrectivas(body.accionesCorrectivas);
  if (!correctivas.ok) return NextResponse.json({ error: correctivas.error }, { status: 400 });
  const seguimiento = validarAccionesSeguimiento(body.accionesSeguimiento);
  if (!seguimiento.ok) return NextResponse.json({ error: seguimiento.error }, { status: 400 });

  try {
    const { data: actual, error: actualError } = await client.admin
      .from("peo_evaluaciones")
      .select("id, no_empleado, categoria")
      .eq("id", id)
      .maybeSingle();
    if (actualError) throw new Error(hintSupabaseClientError(actualError.message));
    if (!actual) return NextResponse.json({ error: "Evaluación no encontrada." }, { status: 404 });

    const categoriaId = String(actual.categoria ?? "");
    const categoriaSolicitada = String(body.categoria ?? categoriaId);
    if (categoriaSolicitada !== categoriaId) {
      return NextResponse.json(
        { error: "La categoría no puede cambiarse; cree un intento nuevo." },
        { status: 400 },
      );
    }
    const validacion = validarPuntajesPeo(categoriaId, body.puntajes);
    if (!validacion.ok) return NextResponse.json({ error: validacion.error }, { status: 400 });

    const { error: updateError } = await client.admin
      .from("peo_evaluaciones")
      .update({
        tipo: tipoRaw,
        evaluada_en: evaluadaEn,
        observaciones,
        acciones_correctivas: correctivas.value,
        acciones_seguimiento: accionesSeguimientoParaDb(seguimiento.value),
        total: validacion.total,
      })
      .eq("id", id);
    if (updateError) throw new Error(hintSupabaseClientError(updateError.message));

    const scoreRows = validacion.puntajes.map((p) => ({
      evaluacion_id: id,
      criterio: p.id,
      etiqueta_snapshot: p.etiqueta,
      orden: p.orden,
      maximo: p.maximo,
      obtenido: p.obtenido,
    }));
    const { error: scoreError } = await client.admin
      .from("peo_evaluacion_puntajes")
      .upsert(scoreRows, { onConflict: "evaluacion_id,criterio" });
    if (scoreError) throw new Error(hintSupabaseClientError(scoreError.message));

    const noEmpleado = String(actual.no_empleado ?? "").trim().toUpperCase();
    const rows = await listPeoEvaluaciones(client.admin, { noEmpleado });
    const row = rows.find((r) => r.id === id) ?? null;
    return NextResponse.json({ ok: true, row });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Error al actualizar evaluación." },
      { status: 500 },
    );
  }
}

export async function DELETE(req: Request) {
  const gate = await requirePeoAdminApi();
  if ("error" in gate) return gate.error;
  const client = adminClientOrError();
  if ("error" in client) return client.error;

  const id = new URL(req.url).searchParams.get("id")?.trim();
  if (!id) return NextResponse.json({ error: "ID requerido." }, { status: 400 });

  const { data: evidencias } = await client.admin
    .from("peo_evaluacion_evidencias")
    .select("storage_path")
    .eq("evaluacion_id", id);
  const paths = ((evidencias ?? []) as { storage_path?: string }[])
    .map((e) => String(e.storage_path ?? "").trim())
    .filter(Boolean);

  const { error } = await client.admin.from("peo_evaluaciones").delete().eq("id", id);
  if (error) {
    return NextResponse.json({ error: hintSupabaseClientError(error.message) }, { status: 500 });
  }
  if (paths.length > 0) {
    await client.admin.storage.from(PEO_EVIDENCIAS_BUCKET).remove(paths);
  }
  return NextResponse.json({ ok: true });
}
