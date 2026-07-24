import { NextResponse } from "next/server";
import {
  createSupabaseServiceRoleClient,
  hintSupabaseClientError,
  isSupabaseServerConfigured,
  supabaseServerEnvMissing,
} from "@/lib/supabase/admin";
import { getAuthedApiUser, isAuthedApiUser } from "@/lib/auth-api";
import {
  roleMayAccessSgc,
  roleMayDeleteSgc,
  roleMayPickSgcDepartamento,
  roleMayUploadSgc,
  sgcDepartamentoDesdeUsuario,
  userMayModulo,
  type AppRole,
} from "@/lib/app-role";
import { departamentoExiste } from "@/lib/app-catalogos";
import {
  SGC_BUCKET,
  isSgcCategoriaId,
  sgcDisplayNameFromObject,
  sgcStoragePrefix,
  type SgcDepartamentoId,
} from "@/lib/sgc-calidad";

export const dynamic = "force-dynamic";

async function resolveDepartamento(
  role: AppRole,
  requested: string,
  userMetadata?: Record<string, unknown> | null,
): Promise<{ ok: true; departamento: SgcDepartamentoId } | { ok: false; error: string; status?: number }> {
  const fijo = sgcDepartamentoDesdeUsuario(role, userMetadata);
  if (fijo) {
    const dep = requested.trim();
    if (dep && (await departamentoExiste(dep)) && dep !== fijo) {
      return { ok: false, error: "Solo puede consultar archivos de su departamento.", status: 403 };
    }
    return { ok: true, departamento: fijo };
  }
  if (!roleMayPickSgcDepartamento(role)) {
    return { ok: false, error: "No autorizado", status: 403 };
  }
  const dep = requested.trim();
  if (!(await departamentoExiste(dep))) {
    return { ok: false, error: "departamento invalido", status: 400 };
  }
  return { ok: true, departamento: dep };
}

/** GET ?categoria=&departamento= — lista archivos del departamento en la subcarpeta */
export async function GET(req: Request) {
  const auth = await getAuthedApiUser();
  if (!isAuthedApiUser(auth)) return auth;
  if (!roleMayAccessSgc(auth.role)) {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }

  if (!isSupabaseServerConfigured()) {
    return NextResponse.json({ error: "Supabase no configurado", missingEnv: supabaseServerEnvMissing() }, { status: 503 });
  }
  const admin = createSupabaseServiceRoleClient();
  if (!admin) return NextResponse.json({ error: "Cliente no disponible" }, { status: 503 });

  const { searchParams } = new URL(req.url);
  const catRaw = String(searchParams.get("categoria") ?? "").trim();
  if (!isSgcCategoriaId(catRaw)) {
    return NextResponse.json({ error: "categoria invalida" }, { status: 400 });
  }

  const depRes = await resolveDepartamento(
    auth.role,
    String(searchParams.get("departamento") ?? ""),
    auth.user.user_metadata as Record<string, unknown> | null,
  );
  if (!depRes.ok) {
    return NextResponse.json({ error: depRes.error }, { status: depRes.status ?? 400 });
  }

  const prefix = sgcStoragePrefix(catRaw, depRes.departamento);

  const { data: items, error: listErr } = await admin.storage.from(SGC_BUCKET).list(prefix, {
    limit: 500,
    sortBy: { column: "created_at", order: "desc" },
  });

  if (listErr) {
    const msg = hintSupabaseClientError(listErr.message);
    if (/bucket|not found|Bucket/i.test(msg)) {
      return NextResponse.json(
        {
          error:
            "Falta el bucket SGC en Supabase. Ejecuta web/supabase/migrations/013_sgc_calidad_storage.sql en el SQL Editor.",
          detail: msg,
        },
        { status: 503 },
      );
    }
    return NextResponse.json({ error: msg }, { status: 500 });
  }

  const files = (items ?? [])
    .filter((it) => it.name && it.id !== null)
    .map((it) => {
      const path = `${prefix}/${it.name}`;
      const {
        data: { publicUrl },
      } = admin.storage.from(SGC_BUCKET).getPublicUrl(path);
      const meta = it.metadata as { size?: number } | undefined;
      return {
        name: sgcDisplayNameFromObject(it.name!),
        storageName: it.name,
        path,
        url: publicUrl,
        updatedAt: it.updated_at ?? it.created_at ?? null,
        sizeBytes: typeof meta?.size === "number" ? meta.size : null,
      };
    });

  const meta = auth.user.user_metadata as Record<string, unknown> | null;
  return NextResponse.json({
    files,
    categoria: catRaw,
    departamento: depRes.departamento,
    canUpload: roleMayUploadSgc(auth.role) && userMayModulo(auth.role, meta, "/sgc", "editar"),
    canDelete: roleMayDeleteSgc(auth.role) && userMayModulo(auth.role, meta, "/sgc", "eliminar"),
    canPickDepartamento: roleMayPickSgcDepartamento(auth.role),
  });
}

/** DELETE ?categoria=&departamento=&storage_name= */
export async function DELETE(req: Request) {
  const auth = await getAuthedApiUser();
  if (!isAuthedApiUser(auth)) return auth;
  if (!roleMayDeleteSgc(auth.role)) {
    return NextResponse.json({ error: "No autorizado para eliminar archivos SGC" }, { status: 403 });
  }
  if (
    !userMayModulo(
      auth.role,
      auth.user.user_metadata as Record<string, unknown> | null,
      "/sgc",
      "eliminar",
    )
  ) {
    return NextResponse.json({ error: "Sin permiso de eliminar SGC." }, { status: 403 });
  }

  if (!isSupabaseServerConfigured()) {
    return NextResponse.json({ error: "Supabase no configurado", missingEnv: supabaseServerEnvMissing() }, { status: 503 });
  }
  const admin = createSupabaseServiceRoleClient();
  if (!admin) return NextResponse.json({ error: "Cliente no disponible" }, { status: 503 });

  const { searchParams } = new URL(req.url);
  const catRaw = String(searchParams.get("categoria") ?? "").trim();
  const storageName = String(searchParams.get("storage_name") ?? "").trim();
  if (!isSgcCategoriaId(catRaw) || !storageName || storageName.includes("/") || storageName.includes("..")) {
    return NextResponse.json({ error: "categoria y storage_name requeridos" }, { status: 400 });
  }

  const depRes = await resolveDepartamento(
    auth.role,
    String(searchParams.get("departamento") ?? ""),
    auth.user.user_metadata as Record<string, unknown> | null,
  );
  if (!depRes.ok) {
    return NextResponse.json({ error: depRes.error }, { status: depRes.status ?? 400 });
  }

  const objectPath = `${sgcStoragePrefix(catRaw, depRes.departamento)}/${storageName}`;
  const { error: rmErr } = await admin.storage.from(SGC_BUCKET).remove([objectPath]);
  if (rmErr) {
    return NextResponse.json({ error: hintSupabaseClientError(rmErr.message) }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
