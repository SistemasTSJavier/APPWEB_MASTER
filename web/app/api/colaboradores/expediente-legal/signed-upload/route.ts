import { NextResponse } from "next/server";
import { randomUUID } from "crypto";
import {
  createSupabaseServiceRoleClient,
  hintSupabaseClientError,
  isSupabaseServerConfigured,
  supabaseServerEnvMissing,
} from "@/lib/supabase/admin";
import { getAuthedApiUser, isAuthedApiUser } from "@/lib/auth-api";
import { roleMayEditColaboradoresLegacyRh } from "@/lib/app-role";
import {
  EXPEDIENTE_LEGAL_BUCKET,
  EXPEDIENTE_LEGAL_MAX_BYTES,
} from "@/lib/expediente-legal-constants";

export const dynamic = "force-dynamic";

async function colaboradorExiste(
  admin: NonNullable<ReturnType<typeof createSupabaseServiceRoleClient>>,
  noRaw: string,
): Promise<boolean> {
  const { data, error } = await admin.from("colaboradores").select("no_empleado").eq("no_empleado", noRaw).maybeSingle();
  if (error) return false;
  return !!data?.no_empleado;
}

/**
 * POST JSON `{ no_empleado, file_size_bytes? }` — devuelve `path`, `token` y `publicUrl`
 * para subir el PDF con el cliente de Storage en el navegador (`uploadToSignedUrl`),
 * sin pasar el binario por la API de Next (evita límites de tamaño del body).
 */
export async function POST(req: Request) {
  const auth = await getAuthedApiUser();
  if (!isAuthedApiUser(auth)) return auth;
  if (!roleMayEditColaboradoresLegacyRh(auth.role)) {
    return NextResponse.json({ error: "No autorizado para subir expedientes legal" }, { status: 403 });
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

  const o = body as { no_empleado?: unknown; file_size_bytes?: unknown };
  const noRaw = String(o.no_empleado ?? "").trim().toUpperCase();
  if (!noRaw) {
    return NextResponse.json({ error: "no_empleado requerido" }, { status: 400 });
  }

  if (o.file_size_bytes != null && o.file_size_bytes !== "") {
    const n = Number(o.file_size_bytes);
    if (!Number.isFinite(n) || n <= 0) {
      return NextResponse.json({ error: "file_size_bytes invalido" }, { status: 400 });
    }
    if (n > EXPEDIENTE_LEGAL_MAX_BYTES) {
      return NextResponse.json(
        {
          error: `El PDF supera el limite permitido (${Math.round(EXPEDIENTE_LEGAL_MAX_BYTES / (1024 * 1024))} MB).`,
          maxBytes: EXPEDIENTE_LEGAL_MAX_BYTES,
        },
        { status: 400 },
      );
    }
  }

  const existe = await colaboradorExiste(admin, noRaw);
  if (!existe) {
    return NextResponse.json({ error: "No existe expediente para ese numero" }, { status: 404 });
  }

  const objectPath = `${noRaw}/${randomUUID()}.pdf`;

  const { data: signData, error: signErr } = await admin.storage
    .from(EXPEDIENTE_LEGAL_BUCKET)
    .createSignedUploadUrl(objectPath, { upsert: false });

  if (signErr) {
    const msg = hintSupabaseClientError(signErr.message);
    if (/bucket|not found|Bucket/i.test(msg)) {
      return NextResponse.json(
        {
          error:
            "Falta el bucket de expedientes legal en Supabase. Ejecuta web/supabase/migrations/006_expedientes_legal_storage.sql (y 007 si ya tenias el bucket con limite bajo).",
          detail: msg,
        },
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
  } = admin.storage.from(EXPEDIENTE_LEGAL_BUCKET).getPublicUrl(objectPath);

  return NextResponse.json({
    path: signData.path,
    token: signData.token,
    publicUrl,
    maxBytes: EXPEDIENTE_LEGAL_MAX_BYTES,
    bucket: EXPEDIENTE_LEGAL_BUCKET,
  });
}
