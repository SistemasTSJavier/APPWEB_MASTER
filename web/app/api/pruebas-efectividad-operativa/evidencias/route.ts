import { NextResponse } from "next/server";
import {
  createSupabaseServiceRoleClient,
  hintSupabaseClientError,
  isSupabaseServerConfigured,
  supabaseServerEnvMissing,
} from "@/lib/supabase/admin";
import { requirePeoApi, requirePeoCaptureApi } from "@/lib/pruebas-efectividad-auth";
import {
  PEO_EVIDENCIAS_BUCKET,
  mapPeoEvidenciaDb,
  publicUrlPeoEvidencia,
} from "@/lib/pruebas-efectividad-operativa";

export const dynamic = "force-dynamic";

const MAX_BYTES = 10 * 1024 * 1024;
const MAX_POR_EVALUACION = 8;
const MIME_OK = new Set(["image/jpeg", "image/png", "image/webp", "application/pdf"]);

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

function extDesdeMime(mime: string): string {
  if (mime === "image/jpeg") return "jpg";
  if (mime === "image/png") return "png";
  if (mime === "image/webp") return "webp";
  if (mime === "application/pdf") return "pdf";
  return "bin";
}

function sanitizeNombre(name: string): string {
  return name
    .trim()
    .replace(/[\\/]+/g, "_")
    .replace(/[^\w.\- ()áéíóúÁÉÍÓÚñÑ]+/gi, "_")
    .slice(0, 120);
}

/** GET ?evaluacion_id= — lista evidencias de una evaluación */
export async function GET(req: Request) {
  const gate = await requirePeoApi();
  if ("error" in gate) return gate.error;
  const client = adminClientOrError();
  if ("error" in client) return client.error;

  const evaluacionId = new URL(req.url).searchParams.get("evaluacion_id")?.trim();
  if (!evaluacionId) {
    return NextResponse.json({ error: "evaluacion_id requerido." }, { status: 400 });
  }

  const { data, error } = await client.admin
    .from("peo_evaluacion_evidencias")
    .select("*")
    .eq("evaluacion_id", evaluacionId)
    .order("created_at", { ascending: false });
  if (error) {
    return NextResponse.json({ error: hintSupabaseClientError(error.message) }, { status: 500 });
  }

  const files = ((data ?? []) as Record<string, unknown>[]).map(mapPeoEvidenciaDb);
  return NextResponse.json({ ok: true, files });
}

/** POST multipart: evaluacion_id + file */
export async function POST(req: Request) {
  const gate = await requirePeoCaptureApi();
  if ("error" in gate) return gate.error;
  const client = adminClientOrError();
  if ("error" in client) return client.error;

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ error: "FormData inválido." }, { status: 400 });
  }

  const evaluacionId = String(form.get("evaluacion_id") ?? "").trim();
  const file = form.get("file");
  if (!evaluacionId) return NextResponse.json({ error: "evaluacion_id requerido." }, { status: 400 });
  if (!(file instanceof File)) return NextResponse.json({ error: "Archivo requerido." }, { status: 400 });
  if (file.size <= 0 || file.size > MAX_BYTES) {
    return NextResponse.json({ error: "Archivo vacío o mayor a 10 MB." }, { status: 400 });
  }
  const mime = (file.type || "application/octet-stream").toLowerCase();
  if (!MIME_OK.has(mime)) {
    return NextResponse.json({ error: "Solo JPG, PNG, WEBP o PDF." }, { status: 400 });
  }

  const { data: evalRow, error: evalErr } = await client.admin
    .from("peo_evaluaciones")
    .select("id")
    .eq("id", evaluacionId)
    .maybeSingle();
  if (evalErr) return NextResponse.json({ error: hintSupabaseClientError(evalErr.message) }, { status: 500 });
  if (!evalRow) return NextResponse.json({ error: "Evaluación no encontrada." }, { status: 404 });

  const { count, error: countErr } = await client.admin
    .from("peo_evaluacion_evidencias")
    .select("id", { count: "exact", head: true })
    .eq("evaluacion_id", evaluacionId);
  if (countErr) return NextResponse.json({ error: hintSupabaseClientError(countErr.message) }, { status: 500 });
  if ((count ?? 0) >= MAX_POR_EVALUACION) {
    return NextResponse.json({ error: `Máximo ${MAX_POR_EVALUACION} evidencias por evaluación.` }, { status: 400 });
  }

  const original = sanitizeNombre(file.name || `evidencia.${extDesdeMime(mime)}`);
  const storagePath = `${evaluacionId}/${crypto.randomUUID()}_${original}`;
  const buf = Buffer.from(await file.arrayBuffer());

  const { error: upErr } = await client.admin.storage.from(PEO_EVIDENCIAS_BUCKET).upload(storagePath, buf, {
    contentType: mime,
    upsert: false,
  });
  if (upErr) {
    const msg = hintSupabaseClientError(upErr.message);
    if (/bucket|not found|Bucket/i.test(msg)) {
      return NextResponse.json(
        {
          error: "Falta el bucket peo-evidencias. Ejecuta web/supabase/migrations/056_peo_informe_ejecutivo.sql.",
          detail: msg,
        },
        { status: 503 },
      );
    }
    return NextResponse.json({ error: msg }, { status: 500 });
  }

  const { data: inserted, error: insertErr } = await client.admin
    .from("peo_evaluacion_evidencias")
    .insert({
      evaluacion_id: evaluacionId,
      storage_path: storagePath,
      nombre_archivo: original,
      mime,
    })
    .select("*")
    .single();
  if (insertErr || !inserted) {
    await client.admin.storage.from(PEO_EVIDENCIAS_BUCKET).remove([storagePath]);
    return NextResponse.json(
      { error: hintSupabaseClientError(insertErr?.message ?? "No se registró la evidencia.") },
      { status: 500 },
    );
  }

  const row = mapPeoEvidenciaDb(inserted as Record<string, unknown>);
  if (!row.url) row.url = publicUrlPeoEvidencia(storagePath);
  return NextResponse.json({ ok: true, file: row }, { status: 201 });
}

/** DELETE ?id= — elimina metadato + objeto storage */
export async function DELETE(req: Request) {
  const gate = await requirePeoCaptureApi();
  if ("error" in gate) return gate.error;
  const client = adminClientOrError();
  if ("error" in client) return client.error;

  const id = new URL(req.url).searchParams.get("id")?.trim();
  if (!id) return NextResponse.json({ error: "id requerido." }, { status: 400 });

  const { data: row, error: findErr } = await client.admin
    .from("peo_evaluacion_evidencias")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (findErr) return NextResponse.json({ error: hintSupabaseClientError(findErr.message) }, { status: 500 });
  if (!row) return NextResponse.json({ error: "Evidencia no encontrada." }, { status: 404 });

  const storagePath = String((row as { storage_path?: string }).storage_path ?? "");
  const { error: delErr } = await client.admin.from("peo_evaluacion_evidencias").delete().eq("id", id);
  if (delErr) return NextResponse.json({ error: hintSupabaseClientError(delErr.message) }, { status: 500 });

  if (storagePath) {
    await client.admin.storage.from(PEO_EVIDENCIAS_BUCKET).remove([storagePath]);
  }
  return NextResponse.json({ ok: true });
}
