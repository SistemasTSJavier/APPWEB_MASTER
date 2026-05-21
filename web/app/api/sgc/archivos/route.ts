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
  sgcDepartamentoFijoPorRol,
} from "@/lib/app-role";
import {
  SGC_BUCKET,
  isSgcCategoriaId,
  isSgcDepartamentoId,
  sgcDisplayNameFromObject,
  sgcStoragePrefix,
  type SgcDepartamentoId,
} from "@/lib/sgc-calidad";

export const dynamic = "force-dynamic";

function resolveDepartamento(
  role: import("@/lib/app-role").AppRole,
  requested: string,
): { ok: true; departamento: SgcDepartamentoId } | { ok: false; error: string } {
  const fijo = sgcDepartamentoFijoPorRol(role);
  if (fijo) return { ok: true, departamento: fijo };
  const dep = requested.trim();
  if (!isSgcDepartamentoId(dep)) {
    return { ok: false, error: "departamento invalido" };
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

  const depRes = resolveDepartamento(auth.role, String(searchParams.get("departamento") ?? ""));
  if (!depRes.ok) {
    return NextResponse.json({ error: depRes.error }, { status: 400 });
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
      return {
        name: sgcDisplayNameFromObject(it.name!),
        storageName: it.name,
        path,
        url: publicUrl,
        updatedAt: it.updated_at ?? it.created_at ?? null,
      };
    });

  return NextResponse.json({
    files,
    categoria: catRaw,
    departamento: depRes.departamento,
    canUpload: roleMayUploadSgc(auth.role),
    canDelete: roleMayDeleteSgc(auth.role),
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

  const depRes = resolveDepartamento(auth.role, String(searchParams.get("departamento") ?? ""));
  if (!depRes.ok) {
    return NextResponse.json({ error: depRes.error }, { status: 400 });
  }

  const objectPath = `${sgcStoragePrefix(catRaw, depRes.departamento)}/${storageName}`;
  const { error: rmErr } = await admin.storage.from(SGC_BUCKET).remove([objectPath]);
  if (rmErr) {
    return NextResponse.json({ error: hintSupabaseClientError(rmErr.message) }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
