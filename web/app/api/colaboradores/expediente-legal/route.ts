import { NextResponse } from "next/server";
import {
  createSupabaseServiceRoleClient,
  hintSupabaseClientError,
  isSupabaseServerConfigured,
  supabaseServerEnvMissing,
} from "@/lib/supabase/admin";
import { getAuthedApiUser, isAuthedApiUser } from "@/lib/auth-api";
import { roleMayEditColaboradores, roleMayAccessExpedientesLegal, roleMayReadColaboradoresApi } from "@/lib/app-role";
import { EXPEDIENTE_LEGAL_BUCKET } from "@/lib/expediente-legal-constants";

export const dynamic = "force-dynamic";

function assertSafeFileName(name: string): string | null {
  const n = name.trim();
  if (!n || n.includes("/") || n.includes("\\") || n.includes("..")) return null;
  if (!n.toLowerCase().endsWith(".pdf")) return null;
  return n;
}

async function colaboradorExiste(admin: ReturnType<typeof createSupabaseServiceRoleClient>, noRaw: string): Promise<boolean> {
  if (!admin) return false;
  const { data, error } = await admin.from("colaboradores").select("no_empleado").eq("no_empleado", noRaw).maybeSingle();
  if (error) return false;
  return !!data?.no_empleado;
}

/** GET ?no_empleado= — lista PDFs en la carpeta del colaborador */
export async function GET(req: Request) {
  const auth = await getAuthedApiUser();
  if (!isAuthedApiUser(auth)) return auth;
  if (!roleMayReadColaboradoresApi(auth.role) || !roleMayAccessExpedientesLegal(auth.role)) {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
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

  const existe = await colaboradorExiste(admin, noRaw);
  if (!existe) {
    return NextResponse.json({ error: "No existe expediente para ese numero" }, { status: 404 });
  }

  const { data: items, error: listErr } = await admin.storage.from(EXPEDIENTE_LEGAL_BUCKET).list(noRaw, {
    limit: 200,
    sortBy: { column: "created_at", order: "desc" },
  });

  if (listErr) {
    const msg = hintSupabaseClientError(listErr.message);
    if (/bucket|not found|Bucket/i.test(msg)) {
      return NextResponse.json(
        {
          error:
            "Falta el bucket de expedientes legal en Supabase. Ejecuta web/supabase/migrations/006_expedientes_legal_storage.sql en el SQL Editor.",
          detail: msg,
        },
        { status: 503 },
      );
    }
    return NextResponse.json({ error: msg }, { status: 500 });
  }

  const files = (items ?? [])
    .filter((it) => it.name && it.name.toLowerCase().endsWith(".pdf"))
    .map((it) => {
      const path = `${noRaw}/${it.name}`;
      const {
        data: { publicUrl },
      } = admin.storage.from(EXPEDIENTE_LEGAL_BUCKET).getPublicUrl(path);
      return {
        name: it.name,
        path,
        url: publicUrl,
        updatedAt: it.updated_at ?? it.created_at ?? null,
      };
    });

  return NextResponse.json({ files });
}

/** DELETE ?no_empleado=&name= — elimina un PDF por nombre dentro de la carpeta del colaborador */
export async function DELETE(req: Request) {
  const auth = await getAuthedApiUser();
  if (!isAuthedApiUser(auth)) return auth;
  if (!roleMayEditColaboradores(auth.role)) {
    return NextResponse.json({ error: "No autorizado para eliminar expedientes legal" }, { status: 403 });
  }

  if (!isSupabaseServerConfigured()) {
    return NextResponse.json({ error: "Supabase no configurado", missingEnv: supabaseServerEnvMissing() }, { status: 503 });
  }
  const admin = createSupabaseServiceRoleClient();
  if (!admin) return NextResponse.json({ error: "Cliente no disponible" }, { status: 503 });

  const { searchParams } = new URL(req.url);
  const noRaw = String(searchParams.get("no_empleado") ?? "").trim().toUpperCase();
  const nameRaw = String(searchParams.get("name") ?? "").trim();
  const safeName = assertSafeFileName(nameRaw);
  if (!noRaw || !safeName) {
    return NextResponse.json({ error: "no_empleado y name (solo archivo .pdf) requeridos" }, { status: 400 });
  }

  const objectPath = `${noRaw}/${safeName}`;
  const existe = await colaboradorExiste(admin, noRaw);
  if (!existe) {
    return NextResponse.json({ error: "No existe expediente para ese numero" }, { status: 404 });
  }

  const { error: rmErr } = await admin.storage.from(EXPEDIENTE_LEGAL_BUCKET).remove([objectPath]);
  if (rmErr) {
    return NextResponse.json({ error: hintSupabaseClientError(rmErr.message) }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
