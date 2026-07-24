import { NextResponse } from "next/server";
import { randomUUID } from "crypto";
import {
  createSupabaseServiceRoleClient,
  hintSupabaseClientError,
  isSupabaseServerConfigured,
  supabaseServerEnvMissing,
} from "@/lib/supabase/admin";
import { getAuthedApiUser, isAuthedApiUser } from "@/lib/auth-api";
import { departamentoExiste } from "@/lib/app-catalogos";
import { roleMayUploadSgc, sgcDepartamentoDesdeUsuario, userMayModulo } from "@/lib/app-role";
import {
  SGC_BUCKET,
  SGC_MAX_BYTES,
  assertSafeUploadFileName,
  isSgcCategoriaId,
  sgcDisplayNameFromObject,
  sgcObjectPath,
  sgcStoragePrefix,
} from "@/lib/sgc-calidad";

export const dynamic = "force-dynamic";

/**
 * POST JSON `{ categoria, departamento, file_name, file_size_bytes?, replace?, replace_storage_name? }`
 * — URL firmada para subir sin pasar el binario por Next.
 * Si `replace` es true (o hay `replace_storage_name`), elimina la versión anterior: sin historial.
 */
export async function POST(req: Request) {
  const auth = await getAuthedApiUser();
  if (!isAuthedApiUser(auth)) return auth;
  if (!roleMayUploadSgc(auth.role)) {
    return NextResponse.json({ error: "No autorizado para subir archivos SGC" }, { status: 403 });
  }
  if (
    !userMayModulo(
      auth.role,
      auth.user.user_metadata as Record<string, unknown> | null,
      "/sgc",
      "editar",
    )
  ) {
    return NextResponse.json({ error: "Sin permiso de editar SGC." }, { status: 403 });
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
    replace?: unknown;
    replace_storage_name?: unknown;
  };

  const catRaw = String(o.categoria ?? "").trim();
  if (!isSgcCategoriaId(catRaw)) {
    return NextResponse.json({ error: "categoria invalida" }, { status: 400 });
  }

  const fijo = sgcDepartamentoDesdeUsuario(
    auth.role,
    auth.user.user_metadata as Record<string, unknown> | null,
  );
  const depRaw = fijo ?? String(o.departamento ?? "").trim();
  if (!(await departamentoExiste(depRaw))) {
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

  const replace = o.replace === true || o.replace === "true" || o.replace === 1;
  const replaceStorageName = assertSafeUploadFileName(String(o.replace_storage_name ?? "")) ?? "";
  const prefix = sgcStoragePrefix(catRaw, depRaw);
  const removed: string[] = [];

  if (replace || replaceStorageName) {
    const { data: items, error: listErr } = await admin.storage.from(SGC_BUCKET).list(prefix, {
      limit: 500,
      sortBy: { column: "created_at", order: "desc" },
    });
    if (listErr) {
      return NextResponse.json({ error: hintSupabaseClientError(listErr.message) }, { status: 500 });
    }

    const toRemove: string[] = [];
    for (const it of items ?? []) {
      if (!it.name || it.id === null) continue;
      if (replaceStorageName) {
        if (it.name === replaceStorageName) toRemove.push(`${prefix}/${it.name}`);
      } else if (sgcDisplayNameFromObject(it.name).toLowerCase() === fileName.toLowerCase()) {
        toRemove.push(`${prefix}/${it.name}`);
      }
    }

    if (toRemove.length > 0) {
      const { error: rmErr } = await admin.storage.from(SGC_BUCKET).remove(toRemove);
      if (rmErr) {
        return NextResponse.json({ error: hintSupabaseClientError(rmErr.message) }, { status: 500 });
      }
      removed.push(...toRemove);
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
    replaced: removed.length,
    removedPaths: removed,
  });
}
