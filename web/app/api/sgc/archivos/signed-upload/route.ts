import { NextResponse } from "next/server";
import { randomUUID } from "crypto";
import {
  createSupabaseServiceRoleClient,
  hintSupabaseClientError,
  isSupabaseServerConfigured,
  supabaseServerEnvMissing,
} from "@/lib/supabase/admin";
import { getAuthedApiUser, isAuthedApiUser } from "@/lib/auth-api";
import { roleMayUploadSgc, sgcDepartamentoFijoPorRol } from "@/lib/app-role";
import {
  SGC_BUCKET,
  SGC_MAX_BYTES,
  assertSafeUploadFileName,
  isSgcCategoriaId,
  isSgcDepartamentoId,
  sgcObjectPath,
} from "@/lib/sgc-calidad";

export const dynamic = "force-dynamic";

/**
 * POST JSON `{ categoria, departamento, file_name, file_size_bytes? }`
 * — URL firmada para subir sin pasar el binario por Next.
 */
export async function POST(req: Request) {
  const auth = await getAuthedApiUser();
  if (!isAuthedApiUser(auth)) return auth;
  if (!roleMayUploadSgc(auth.role)) {
    return NextResponse.json({ error: "No autorizado para subir archivos SGC" }, { status: 403 });
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
    categoria?: unknown;
    departamento?: unknown;
    file_name?: unknown;
    file_size_bytes?: unknown;
  };

  const catRaw = String(o.categoria ?? "").trim();
  if (!isSgcCategoriaId(catRaw)) {
    return NextResponse.json({ error: "categoria invalida" }, { status: 400 });
  }

  const fijo = sgcDepartamentoFijoPorRol(auth.role);
  const depRaw = fijo ?? String(o.departamento ?? "").trim();
  if (!isSgcDepartamentoId(depRaw)) {
    return NextResponse.json({ error: "departamento invalido" }, { status: 400 });
  }

  const fileName = assertSafeUploadFileName(String(o.file_name ?? ""));
  if (!fileName) {
    return NextResponse.json({ error: "file_name invalido (sin rutas ni caracteres especiales)" }, { status: 400 });
  }

  if (o.file_size_bytes != null && o.file_size_bytes !== "") {
    const n = Number(o.file_size_bytes);
    if (!Number.isFinite(n) || n <= 0) {
      return NextResponse.json({ error: "file_size_bytes invalido" }, { status: 400 });
    }
    if (n > SGC_MAX_BYTES) {
      return NextResponse.json(
        {
          error: `El archivo supera el limite (${Math.round(SGC_MAX_BYTES / (1024 * 1024))} MB).`,
          maxBytes: SGC_MAX_BYTES,
        },
        { status: 400 },
      );
    }
  }

  let objectPath: string;
  try {
    objectPath = sgcObjectPath(catRaw, depRaw, fileName, randomUUID());
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Nombre invalido" }, { status: 400 });
  }

  const { data: signData, error: signErr } = await admin.storage
    .from(SGC_BUCKET)
    .createSignedUploadUrl(objectPath, { upsert: false });

  if (signErr) {
    const msg = hintSupabaseClientError(signErr.message);
    if (/bucket|not found|Bucket/i.test(msg)) {
      return NextResponse.json(
        {
          error:
            "Falta el bucket SGC en Supabase. Ejecuta web/supabase/migrations/013_sgc_calidad_storage.sql.",
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
  } = admin.storage.from(SGC_BUCKET).getPublicUrl(objectPath);

  return NextResponse.json({
    path: signData.path,
    token: signData.token,
    publicUrl,
    maxBytes: SGC_MAX_BYTES,
    bucket: SGC_BUCKET,
  });
}
