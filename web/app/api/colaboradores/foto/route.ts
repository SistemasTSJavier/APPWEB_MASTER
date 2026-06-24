import { NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { normalizeToCompleto } from "@/lib/colaboradores-normalize";
import type { ColaboradorCompleto } from "@/lib/colaboradores-types";
import {
  createSupabaseServiceRoleClient,
  hintSupabaseClientError,
  isSupabaseServerConfigured,
  supabaseServerEnvMissing,
} from "@/lib/supabase/admin";
import { getAuthedApiUser, isAuthedApiUser } from "@/lib/auth-api";
import { mayAccessFichaTecnica, roleMayWriteExpedienteColaborador } from "@/lib/app-role";
import { FICHA_FOTO_FORM_KEY } from "@/lib/ficha-tecnica-keys";

export const dynamic = "force-dynamic";

const BUCKET = "colaboradores-fotos";
const MAX_BYTES = 2 * 1024 * 1024; // 2 MB
const ALLOWED = new Set(["image/jpeg", "image/png", "image/webp"]);

/** Ruta dentro del bucket a partir de la URL pública de Supabase Storage. */
function storageObjectPathFromFichaFotoPublicUrl(publicUrl: string): string | null {
  const u = publicUrl.trim();
  if (!u) return null;
  const marker = `/storage/v1/object/public/${BUCKET}/`;
  const i = u.indexOf(marker);
  if (i === -1) return null;
  const rest = u.slice(i + marker.length);
  const path = (rest.split("?")[0] ?? "").split("#")[0] ?? "";
  return path || null;
}

function extFromMime(mime: string): string {
  if (mime === "image/jpeg") return "jpg";
  if (mime === "image/png") return "png";
  if (mime === "image/webp") return "webp";
  return "bin";
}

/** POST multipart: no_empleado, archivo `file` — guarda en Storage y actualiza data.form.fichaFotoUrl */
export async function POST(req: Request) {
  const auth = await getAuthedApiUser();
  if (!isAuthedApiUser(auth)) return auth;
  if (!roleMayWriteExpedienteColaborador(auth.role)) {
    return NextResponse.json({ error: "No autorizado para actualizar foto de ficha" }, { status: 403 });
  }

  if (!isSupabaseServerConfigured()) {
    return NextResponse.json({ error: "Supabase no configurado", missingEnv: supabaseServerEnvMissing() }, { status: 503 });
  }
  const admin = createSupabaseServiceRoleClient();
  if (!admin) return NextResponse.json({ error: "Cliente no disponible" }, { status: 503 });

  let formData: FormData;
  try {
    formData = await req.formData();
  } catch {
    return NextResponse.json({ error: "FormData invalido" }, { status: 400 });
  }

  const noRaw = String(formData.get("no_empleado") ?? "").trim().toUpperCase();
  const file = formData.get("file");
  if (!noRaw) {
    return NextResponse.json({ error: "no_empleado requerido" }, { status: 400 });
  }
  if (!(file instanceof Blob) || file.size === 0) {
    return NextResponse.json({ error: "Archivo de imagen requerido" }, { status: 400 });
  }
  const mime = file.type || "application/octet-stream";
  if (!ALLOWED.has(mime)) {
    return NextResponse.json({ error: "Solo JPEG, PNG o WebP" }, { status: 400 });
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: "La imagen supera 2 MB" }, { status: 400 });
  }

  const buf = Buffer.from(await file.arrayBuffer());
  const path = `${noRaw}/${randomUUID()}.${extFromMime(mime)}`;

  const { error: upErr } = await admin.storage.from(BUCKET).upload(path, buf, {
    contentType: mime,
    upsert: false,
    cacheControl: "3600",
  });

  if (upErr) {
    const msg = hintSupabaseClientError(upErr.message);
    if (/bucket|not found|Bucket/i.test(msg)) {
      return NextResponse.json(
        {
          error:
            "Falta el bucket de fotos en Supabase. En el proyecto: SQL → New query → pega el archivo web/supabase/migrations/005_ficha_fotos_storage.sql completo → Run. O Storage → New bucket: nombre colaboradores-fotos, publico.",
          detail: msg,
        },
        { status: 503 },
      );
    }
    return NextResponse.json({ error: msg }, { status: 500 });
  }

  const {
    data: { publicUrl },
  } = admin.storage.from(BUCKET).getPublicUrl(path);

  const { data: row, error: selErr } = await admin
    .from("colaboradores")
    .select("data")
    .eq("no_empleado", noRaw)
    .maybeSingle();

  if (selErr) {
    return NextResponse.json({ error: hintSupabaseClientError(selErr.message) }, { status: 500 });
  }
  const current = row?.data ? normalizeToCompleto(row.data) : null;
  if (!current) {
    await admin.storage.from(BUCKET).remove([path]);
    return NextResponse.json({ error: "No existe expediente para ese numero" }, { status: 404 });
  }

  const prevUrl = String(current.form?.[FICHA_FOTO_FORM_KEY] ?? "").trim();
  const prevPath = prevUrl ? storageObjectPathFromFichaFotoPublicUrl(prevUrl) : null;
  if (prevPath && prevPath !== path) {
    await admin.storage.from(BUCKET).remove([prevPath]);
  }

  const next: ColaboradorCompleto = {
    ...current,
    form: {
      ...current.form,
      [FICHA_FOTO_FORM_KEY]: publicUrl,
    },
  };

  const { error: saveErr } = await admin.from("colaboradores").upsert(
    {
      no_empleado: noRaw,
      data: next as unknown as Record<string, unknown>,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "no_empleado" },
  );

  if (saveErr) {
    await admin.storage.from(BUCKET).remove([path]);
    return NextResponse.json({ error: hintSupabaseClientError(saveErr.message) }, { status: 500 });
  }

  return NextResponse.json({ ok: true, url: publicUrl });
}

/**
 * DELETE ?no_empleado= — quita la foto de ficha del bucket y limpia `form.fichaFotoUrl`
 * (uso tras imprimir / PDF para no ocupar storage).
 */
export async function DELETE(req: Request) {
  const auth = await getAuthedApiUser();
  if (!isAuthedApiUser(auth)) return auth;
  if (!mayAccessFichaTecnica(auth.role, auth.user.email)) {
    return NextResponse.json({ error: "No autorizado para gestionar foto de ficha" }, { status: 403 });
  }

  if (!isSupabaseServerConfigured()) {
    return NextResponse.json({ error: "Supabase no configurado", missingEnv: supabaseServerEnvMissing() }, { status: 503 });
  }
  const admin = createSupabaseServiceRoleClient();
  if (!admin) return NextResponse.json({ error: "Cliente no disponible" }, { status: 503 });

  const { searchParams } = new URL(req.url);
  const noRaw = String(searchParams.get("no_empleado") ?? "").trim().toUpperCase();
  if (!noRaw) {
    return NextResponse.json({ error: "no_empleado requerido" }, { status: 400 });
  }

  const { data: row, error: selErr } = await admin
    .from("colaboradores")
    .select("data")
    .eq("no_empleado", noRaw)
    .maybeSingle();

  if (selErr) {
    return NextResponse.json({ error: hintSupabaseClientError(selErr.message) }, { status: 500 });
  }
  const current = row?.data ? normalizeToCompleto(row.data) : null;
  if (!current) {
    return NextResponse.json({ error: "No existe expediente para ese numero" }, { status: 404 });
  }

  const prevUrl = String(current.form?.[FICHA_FOTO_FORM_KEY] ?? "").trim();
  if (!prevUrl) {
    return NextResponse.json({ ok: true, removed: false });
  }

  const prevPath = storageObjectPathFromFichaFotoPublicUrl(prevUrl);
  if (prevPath) {
    await admin.storage.from(BUCKET).remove([prevPath]);
  }

  const { form, ...rest } = current;
  const nextForm = { ...form };
  delete nextForm[FICHA_FOTO_FORM_KEY];

  const next: ColaboradorCompleto = {
    ...rest,
    form: nextForm,
  };

  const { error: saveErr } = await admin.from("colaboradores").upsert(
    {
      no_empleado: noRaw,
      data: next as unknown as Record<string, unknown>,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "no_empleado" },
  );

  if (saveErr) {
    return NextResponse.json({ error: hintSupabaseClientError(saveErr.message) }, { status: 500 });
  }

  return NextResponse.json({ ok: true, removed: true });
}
