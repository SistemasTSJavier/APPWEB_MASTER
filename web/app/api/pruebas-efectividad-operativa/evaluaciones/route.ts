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
  PEO_PLANTILLA_VERSION,
  esPeoCategoriaId,
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
  if (categoria && !esPeoCategoriaId(categoria)) {
    return NextResponse.json({ error: "Categoría no válida." }, { status: 400 });
  }
  try {
    const rows = await listPeoEvaluaciones(client.admin, {
      noEmpleado,
      categoria,
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
  const evaluadaEn = String(body.evaluadaEn ?? "").trim();
  const observaciones = String(body.observaciones ?? "").trim().slice(0, 4000);
  if (!noEmpleado) return NextResponse.json({ error: "Seleccione colaborador." }, { status: 400 });
  if (!fechaValida(evaluadaEn)) {
    return NextResponse.json({ error: "Fecha de aplicación no válida." }, { status: 400 });
  }

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

export async function DELETE(req: Request) {
  const gate = await requirePeoAdminApi();
  if ("error" in gate) return gate.error;
  const client = adminClientOrError();
  if ("error" in client) return client.error;

  const id = new URL(req.url).searchParams.get("id")?.trim();
  if (!id) return NextResponse.json({ error: "ID requerido." }, { status: 400 });
  const { error } = await client.admin.from("peo_evaluaciones").delete().eq("id", id);
  if (error) {
    return NextResponse.json({ error: hintSupabaseClientError(error.message) }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
