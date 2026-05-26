import { NextResponse } from "next/server";
import type { ColaboradorCompleto } from "@/lib/colaboradores-types";
import {
  createSupabaseServiceRoleClient,
  hintSupabaseClientError,
  isSupabaseServerConfigured,
  supabaseServerEnvMissing,
} from "@/lib/supabase/admin";
import { getAuthedApiUser, isAuthedApiUser } from "@/lib/auth-api";
import { roleMayEditColaboradores, roleMayReadColaboradoresApi } from "@/lib/app-role";
import { colaboradorCompletoMayusculas } from "@/lib/texto-plataforma-mayusculas";
import { fetchAllColaboradoresCompletos } from "@/lib/colaboradores-supabase-fetch-all";

export const dynamic = "force-dynamic";

function normalizePayload(data: ColaboradorCompleto): ColaboradorCompleto {
  return colaboradorCompletoMayusculas(data);
}

/** GET: lista todos los expedientes */
export async function GET() {
  const auth = await getAuthedApiUser();
  if (!isAuthedApiUser(auth)) return auth;
  if (!roleMayReadColaboradoresApi(auth.role)) {
    return NextResponse.json({ error: "No autorizado para consultar colaboradores" }, { status: 403 });
  }

  if (!isSupabaseServerConfigured()) {
    const missing = supabaseServerEnvMissing();
    return NextResponse.json(
      {
        error: "Supabase no configurado en el servidor",
        missingEnv: missing,
        hint: "En la carpeta /web crea o edita .env.local con NEXT_PUBLIC_SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY (Project Settings → API). Reinicia npm run dev.",
      },
      { status: 503 },
    );
  }
  const admin = createSupabaseServiceRoleClient();
  if (!admin) {
    return NextResponse.json({ error: "Cliente Supabase no disponible" }, { status: 503 });
  }

  try {
    const rows = await fetchAllColaboradoresCompletos(admin);
    return NextResponse.json(rows);
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Error al listar colaboradores" },
      { status: 500 },
    );
  }
}

/** POST: guardar o actualizar un expediente */
export async function POST(req: Request) {
  const auth = await getAuthedApiUser();
  if (!isAuthedApiUser(auth)) return auth;
  if (!roleMayEditColaboradores(auth.role)) {
    return NextResponse.json({ error: "No autorizado para guardar expedientes" }, { status: 403 });
  }

  if (!isSupabaseServerConfigured()) {
    return NextResponse.json(
      { error: "Supabase no configurado", missingEnv: supabaseServerEnvMissing() },
      { status: 503 },
    );
  }
  const admin = createSupabaseServiceRoleClient();
  if (!admin) {
    return NextResponse.json({ error: "Cliente no disponible" }, { status: 503 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "JSON invalido" }, { status: 400 });
  }

  const payload = normalizePayload(body as ColaboradorCompleto);

  const { error } = await admin.from("colaboradores").upsert(
    {
      no_empleado: payload.noEmpleado,
      data: payload as unknown as Record<string, unknown>,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "no_empleado" },
  );

  if (error) {
    return NextResponse.json({ error: hintSupabaseClientError(error.message) }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
