import { NextResponse } from "next/server";
import { normalizeToCompleto } from "@/lib/colaboradores-normalize";
import type { ColaboradorCompleto } from "@/lib/colaboradores-types";
import {
  createSupabaseServiceRoleClient,
  hintSupabaseClientError,
  isSupabaseServerConfigured,
  supabaseServerEnvMissing,
} from "@/lib/supabase/admin";
import { getAuthedApiUser, isAuthedApiUser } from "@/lib/auth-api";
import { roleMayEditColaboradores, roleMayReadColaboradoresApi } from "@/lib/app-role";

export const dynamic = "force-dynamic";

function normalizePayload(data: ColaboradorCompleto): ColaboradorCompleto {
  const key = data.noEmpleado.trim().toUpperCase();
  return {
    ...data,
    noEmpleado: key,
    nombreCompleto: data.nombreCompleto.trim(),
    servicioAsignado: data.servicioAsignado.trim(),
    ultimoServicio: data.ultimoServicio.trim(),
    nss: data.nss.trim(),
    posicion: data.posicion.trim(),
    puesto: data.puesto.trim(),
    form: data.form,
    familiares: data.familiares,
    registeredAt: data.registeredAt,
    ...(data.moperActual
      ? {
          moperActual: {
            servicio: data.moperActual.servicio.trim(),
            puesto: data.moperActual.puesto.trim(),
          },
        }
      : {}),
  };
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

  const { data, error } = await admin.from("colaboradores").select("data").order("no_empleado", { ascending: true });
  if (error) {
    return NextResponse.json({ error: hintSupabaseClientError(error.message) }, { status: 500 });
  }
  const rows = (data ?? [])
    .map((r: { data: unknown }) => normalizeToCompleto(r.data))
    .filter((c): c is ColaboradorCompleto => c !== null);
  return NextResponse.json(rows);
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
