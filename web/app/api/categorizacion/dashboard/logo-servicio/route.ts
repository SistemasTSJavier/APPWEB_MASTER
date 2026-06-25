import { NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { requireCategorizacionApi } from "@/lib/categorizacion-api-auth";
import { roleEsClienteEnfoque } from "@/lib/app-role";
import {
  claveLogoServicioDashboard,
  quitarLogoServicioDashboard,
  upsertLogoServicioDashboard,
} from "@/lib/cat-dashboard-logo-servicio";
import {
  createSupabaseServiceRoleClient,
  hintSupabaseClientError,
  isSupabaseServerConfigured,
  supabaseServerEnvMissing,
} from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

const BUCKET = "colaboradores-fotos";
const MAX_BYTES = 2 * 1024 * 1024;
const ALLOWED = new Set(["image/jpeg", "image/png", "image/webp"]);

function extFromMime(mime: string): string {
  if (mime === "image/jpeg") return "jpg";
  if (mime === "image/png") return "png";
  if (mime === "image/webp") return "webp";
  return "bin";
}

function storageObjectPathFromPublicUrl(publicUrl: string): string | null {
  const u = publicUrl.trim();
  if (!u) return null;
  const marker = `/storage/v1/object/public/${BUCKET}/`;
  const i = u.indexOf(marker);
  if (i === -1) return null;
  const rest = u.slice(i + marker.length);
  return (rest.split("?")[0] ?? "").split("#")[0] || null;
}

function slugServicioStorage(servicio: string): string {
  return servicio
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

/** POST multipart: servicio, file */
export async function POST(req: Request) {
  const gate = await requireCategorizacionApi();
  if ("error" in gate) return gate.error;
  if (roleEsClienteEnfoque(gate.auth.role)) {
    return NextResponse.json({ error: "No autorizado para subir logo de cliente" }, { status: 403 });
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

  const servicioRaw = String(formData.get("servicio") ?? "").trim();
  const servicioKey = claveLogoServicioDashboard(servicioRaw);
  const file = formData.get("file");
  if (!servicioKey) {
    return NextResponse.json({ error: "servicio requerido" }, { status: 400 });
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

  const slug = slugServicioStorage(servicioKey);
  const path = `logos-servicio/${slug}/${randomUUID()}.${extFromMime(mime)}`;
  const buf = Buffer.from(await file.arrayBuffer());

  const { error: upErr } = await admin.storage.from(BUCKET).upload(path, buf, {
    contentType: mime,
    upsert: false,
    cacheControl: "31536000",
  });
  if (upErr) {
    return NextResponse.json({ error: hintSupabaseClientError(upErr.message) }, { status: 500 });
  }

  const {
    data: { publicUrl },
  } = admin.storage.from(BUCKET).getPublicUrl(path);

  const { data: prevRow } = await admin
    .from("cat_dashboard_logo_servicio")
    .select("logo_url")
    .eq("servicio", servicioKey)
    .maybeSingle();

  const prevUrl = String(prevRow?.logo_url ?? "").trim();
  const prevPath = prevUrl ? storageObjectPathFromPublicUrl(prevUrl) : null;
  if (prevPath && prevPath !== path) {
    await admin.storage.from(BUCKET).remove([prevPath]);
  }

  try {
    await upsertLogoServicioDashboard(servicioKey, publicUrl, admin);
  } catch (e) {
    await admin.storage.from(BUCKET).remove([path]);
    return NextResponse.json({ error: e instanceof Error ? e.message : "Error" }, { status: 500 });
  }

  return NextResponse.json({ ok: true, url: publicUrl, servicio: servicioKey });
}

/** DELETE ?servicio= */
export async function DELETE(req: Request) {
  const gate = await requireCategorizacionApi();
  if ("error" in gate) return gate.error;
  if (roleEsClienteEnfoque(gate.auth.role)) {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }
  if (!isSupabaseServerConfigured()) {
    return NextResponse.json({ error: "Supabase no configurado" }, { status: 503 });
  }
  const admin = createSupabaseServiceRoleClient();
  if (!admin) return NextResponse.json({ error: "Cliente no disponible" }, { status: 503 });

  const servicioKey = claveLogoServicioDashboard(
    new URL(req.url).searchParams.get("servicio") ?? "",
  );
  if (!servicioKey) {
    return NextResponse.json({ error: "servicio requerido" }, { status: 400 });
  }

  const { data: prevRow } = await admin
    .from("cat_dashboard_logo_servicio")
    .select("logo_url")
    .eq("servicio", servicioKey)
    .maybeSingle();

  const prevUrl = String(prevRow?.logo_url ?? "").trim();
  const prevPath = prevUrl ? storageObjectPathFromPublicUrl(prevUrl) : null;
  if (prevPath) {
    await admin.storage.from(BUCKET).remove([prevPath]);
  }

  await quitarLogoServicioDashboard(servicioKey, admin);
  return NextResponse.json({ ok: true });
}
