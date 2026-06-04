import { NextResponse } from "next/server";
import { randomUUID } from "crypto";
import {
  createSupabaseServiceRoleClient,
  hintSupabaseClientError,
  isSupabaseServerConfigured,
  supabaseServerEnvMissing,
} from "@/lib/supabase/admin";
import { getAuthedApiUser, isAuthedApiUser } from "@/lib/auth-api";
import { roleMayEditDs3 } from "@/lib/app-role";
import { DS3_BUCKET, DS3_MAX_BYTES } from "@/lib/ds3-constants";
import { extensionPorMime, mimeDs3Permitido, sanitizarNombreOriginal } from "@/lib/ds3-archivo";

export const dynamic = "force-dynamic";

async function colaboradorExiste(
  admin: NonNullable<ReturnType<typeof createSupabaseServiceRoleClient>>,
  noRaw: string,
) {
  const { data, error } = await admin.from("colaboradores").select("no_empleado").eq("no_empleado", noRaw).maybeSingle();
  if (error) return false;
  return !!data?.no_empleado;
}

export async function POST(req: Request) {
  const auth = await getAuthedApiUser();
  if (!isAuthedApiUser(auth)) return auth;
  if (!roleMayEditDs3(auth.role)) {
    return NextResponse.json({ error: "No autorizado para subir archivos DS3" }, { status: 403 });
  }

  if (!isSupabaseServerConfigured()) {
    return NextResponse.json({ error: "Supabase no configurado", missingEnv: supabaseServerEnvMissing() }, { status: 503 });
  }
  const admin = createSupabaseServiceRoleClient();
  if (!admin) return NextResponse.json({ error: "Cliente no disponible" }, { status: 503 });

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "JSON invalido" }, { status: 400 });
  }

  const o = body as {
    no_empleado?: unknown;
    file_size_bytes?: unknown;
    content_type?: unknown;
    original_name?: unknown;
  };
  const noRaw = String(o.no_empleado ?? "").trim().toUpperCase();
  if (!noRaw) return NextResponse.json({ error: "no_empleado requerido" }, { status: 400 });

  const mime = String(o.content_type ?? "").trim().toLowerCase();
  if (!mimeDs3Permitido(mime)) {
    return NextResponse.json({ error: "Tipo de archivo no permitido" }, { status: 400 });
  }

  const size = Number(o.file_size_bytes ?? 0);
  if (!Number.isFinite(size) || size <= 0) {
    return NextResponse.json({ error: "file_size_bytes invalido" }, { status: 400 });
  }
  if (size > DS3_MAX_BYTES) {
    return NextResponse.json(
      { error: `El archivo supera ${DS3_MAX_BYTES / (1024 * 1024)} MB tras optimizar.`, maxBytes: DS3_MAX_BYTES },
      { status: 400 },
    );
  }

  if (!(await colaboradorExiste(admin, noRaw))) {
    return NextResponse.json({ error: "No existe expediente para ese numero" }, { status: 404 });
  }

  const ext = extensionPorMime(mime);
  const etiqueta = sanitizarNombreOriginal(String(o.original_name ?? "archivo"));
  const objectPath = `${noRaw}/${randomUUID()}_${etiqueta}${ext}`;

  const { data: signData, error: signErr } = await admin.storage
    .from(DS3_BUCKET)
    .createSignedUploadUrl(objectPath, { upsert: false });

  if (signErr) {
    const msg = hintSupabaseClientError(signErr.message);
    if (/bucket|not found|Bucket/i.test(msg)) {
      return NextResponse.json(
        { error: "Falta el bucket DS3. Ejecuta web/supabase/migrations/020_ds3_storage.sql.", detail: msg },
        { status: 503 },
      );
    }
    return NextResponse.json({ error: msg }, { status: 500 });
  }

  if (!signData?.token || !signData.path) {
    return NextResponse.json({ error: "No se pudo generar la URL de subida" }, { status: 500 });
  }

  const {
    data: { publicUrl },
  } = admin.storage.from(DS3_BUCKET).getPublicUrl(objectPath);

  return NextResponse.json({
    path: signData.path,
    token: signData.token,
    publicUrl,
    maxBytes: DS3_MAX_BYTES,
    bucket: DS3_BUCKET,
    contentType: mime,
  });
}
