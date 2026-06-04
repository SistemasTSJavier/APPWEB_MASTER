import { NextResponse } from "next/server";
import {
  createSupabaseServiceRoleClient,
  hintSupabaseClientError,
  isSupabaseServerConfigured,
  supabaseServerEnvMissing,
} from "@/lib/supabase/admin";
import { getAuthedApiUser, isAuthedApiUser } from "@/lib/auth-api";
import { roleMayAccessDs3, roleMayEditDs3 } from "@/lib/app-role";
import { DS3_BUCKET } from "@/lib/ds3-constants";
import { type Ds3ArchivoListado, etiquetaDesdeNombreStorage } from "@/lib/ds3-archivo";

export const dynamic = "force-dynamic";

function mimeDesdeNombre(name: string): string {
  const low = name.toLowerCase();
  if (low.endsWith(".pdf")) return "application/pdf";
  if (low.endsWith(".jpg") || low.endsWith(".jpeg")) return "image/jpeg";
  if (low.endsWith(".png")) return "image/png";
  if (low.endsWith(".webp")) return "image/webp";
  return "application/octet-stream";
}

function assertSafeStorageName(name: string): string | null {
  const n = name.trim();
  if (!n || n.includes("/") || n.includes("\\") || n.includes("..")) return null;
  return n;
}

async function colaboradorExiste(admin: ReturnType<typeof createSupabaseServiceRoleClient>, noRaw: string) {
  if (!admin) return false;
  const { data, error } = await admin.from("colaboradores").select("no_empleado").eq("no_empleado", noRaw).maybeSingle();
  if (error) return false;
  return !!data?.no_empleado;
}

/** GET ?no_empleado= — lista archivos DS3 del colaborador */
export async function GET(req: Request) {
  const auth = await getAuthedApiUser();
  if (!isAuthedApiUser(auth)) return auth;
  if (!roleMayAccessDs3(auth.role)) {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }

  if (!isSupabaseServerConfigured()) {
    return NextResponse.json({ error: "Supabase no configurado", missingEnv: supabaseServerEnvMissing() }, { status: 503 });
  }
  const admin = createSupabaseServiceRoleClient();
  if (!admin) return NextResponse.json({ error: "Cliente no disponible" }, { status: 503 });

  const noRaw = String(new URL(req.url).searchParams.get("no_empleado") ?? "").trim().toUpperCase();
  if (!noRaw) return NextResponse.json({ error: "no_empleado requerido" }, { status: 400 });

  if (!(await colaboradorExiste(admin, noRaw))) {
    return NextResponse.json({ error: "No existe expediente para ese numero" }, { status: 404 });
  }

  const { data: items, error: listErr } = await admin.storage.from(DS3_BUCKET).list(noRaw, {
    limit: 300,
    sortBy: { column: "created_at", order: "desc" },
  });

  if (listErr) {
    const msg = hintSupabaseClientError(listErr.message);
    if (/bucket|not found|Bucket/i.test(msg)) {
      return NextResponse.json(
        {
          error: "Falta el bucket DS3 en Supabase. Ejecuta web/supabase/migrations/020_ds3_storage.sql.",
          detail: msg,
        },
        { status: 503 },
      );
    }
    return NextResponse.json({ error: msg }, { status: 500 });
  }

  const files: Ds3ArchivoListado[] = (items ?? [])
    .filter((it) => it.name && /\.(pdf|jpe?g|png|webp)$/i.test(it.name))
    .map((it) => {
      const name = it.name!;
      const path = `${noRaw}/${name}`;
      const {
        data: { publicUrl },
      } = admin.storage.from(DS3_BUCKET).getPublicUrl(path);
      const meta = it.metadata as { size?: number; mimetype?: string } | undefined;
      return {
        name,
        path,
        url: publicUrl,
        updatedAt: it.updated_at ?? it.created_at ?? null,
        sizeBytes: meta?.size ?? it.metadata?.size ?? null,
        mimeType: meta?.mimetype ?? mimeDesdeNombre(name),
        originalLabel: etiquetaDesdeNombreStorage(name),
      };
    });

  return NextResponse.json({ files });
}

/** DELETE ?no_empleado=&name= */
export async function DELETE(req: Request) {
  const auth = await getAuthedApiUser();
  if (!isAuthedApiUser(auth)) return auth;
  if (!roleMayEditDs3(auth.role)) {
    return NextResponse.json({ error: "No autorizado para eliminar archivos DS3" }, { status: 403 });
  }

  if (!isSupabaseServerConfigured()) {
    return NextResponse.json({ error: "Supabase no configurado" }, { status: 503 });
  }
  const admin = createSupabaseServiceRoleClient();
  if (!admin) return NextResponse.json({ error: "Cliente no disponible" }, { status: 503 });

  const { searchParams } = new URL(req.url);
  const noRaw = String(searchParams.get("no_empleado") ?? "").trim().toUpperCase();
  const safeName = assertSafeStorageName(String(searchParams.get("name") ?? ""));
  if (!noRaw || !safeName) {
    return NextResponse.json({ error: "no_empleado y name requeridos" }, { status: 400 });
  }

  const objectPath = `${noRaw}/${safeName}`;
  const { error: rmErr } = await admin.storage.from(DS3_BUCKET).remove([objectPath]);
  if (rmErr) return NextResponse.json({ error: hintSupabaseClientError(rmErr.message) }, { status: 500 });

  return NextResponse.json({ ok: true });
}
