import { NextResponse } from "next/server";
import {
  createSupabaseServiceRoleClient,
  hintSupabaseClientError,
  isSupabaseServerConfigured,
  supabaseServerEnvMissing,
} from "@/lib/supabase/admin";
import { getAuthedApiUser, isAuthedApiUser } from "@/lib/auth-api";
import { roleMayEditServiciosCatalogo, roleMayReadServiciosCatalogo } from "@/lib/app-role";

export const dynamic = "force-dynamic";

function normNombre(s: string): string {
  return s.trim().replace(/\s+/g, " ").toUpperCase();
}

function error503(message: string, hint?: object) {
  return NextResponse.json({ error: message, ...hint }, { status: 503 });
}

/** GET /api/servicios — catálogo para listas desplegable (nombre ordenado). */
export async function GET() {
  const auth = await getAuthedApiUser();
  if (!isAuthedApiUser(auth)) return auth;
  if (!roleMayReadServiciosCatalogo(auth.role)) {
    return NextResponse.json({ error: "No autorizado para el catalogo de servicios" }, { status: 403 });
  }

  if (!isSupabaseServerConfigured()) {
    return error503("Supabase no configurado en el servidor", {
      missingEnv: supabaseServerEnvMissing(),
      hint:
        "Ejecuta la migracion web/supabase/migrations/004_catalogo_servicios.sql en Supabase SQL Editor y configura .env.local.",
    });
  }
  const admin = createSupabaseServiceRoleClient();
  if (!admin) return error503("Cliente Supabase no disponible");

  const { data, error } = await admin.from("catalogo_servicios").select("id, nombre").order("nombre", { ascending: true });
  if (error) {
    if (/relation ["']public.catalogo_servicios["'] does not exist/i.test(error.message)) {
      return NextResponse.json(
        {
          error: "Tabla catalogo_servicios no existe",
          hint: "Ejecuta web/supabase/migrations/004_catalogo_servicios.sql en el SQL Editor de Supabase.",
        },
        { status: 503 },
      );
    }
    return NextResponse.json({ error: hintSupabaseClientError(error.message) }, { status: 500 });
  }
  return NextResponse.json({ items: data ?? [] });
}

/** POST /api/servicios body: { nombre: string } */
export async function POST(req: Request) {
  const auth = await getAuthedApiUser();
  if (!isAuthedApiUser(auth)) return auth;
  if (!roleMayEditServiciosCatalogo(auth.role)) {
    return NextResponse.json({ error: "No autorizado para editar el catalogo" }, { status: 403 });
  }

  if (!isSupabaseServerConfigured()) {
    return error503("Supabase no configurado", { missingEnv: supabaseServerEnvMissing() });
  }
  const admin = createSupabaseServiceRoleClient();
  if (!admin) return error503("Cliente no disponible");

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "JSON invalido" }, { status: 400 });
  }
  const nombre = normNombre(String((body as { nombre?: string })?.nombre ?? ""));
  if (!nombre) {
    return NextResponse.json({ error: "NOMBRE DE SERVICIO VACIO" }, { status: 400 });
  }

  const { data, error } = await admin
    .from("catalogo_servicios")
    .insert({ nombre, updated_at: new Date().toISOString() })
    .select("id, nombre")
    .single();

  if (error) {
    if (/duplicate key|unique constraint/i.test(error.message)) {
      return NextResponse.json({ error: "ESE SERVICIO YA EXISTE EN EL CATALOGO" }, { status: 409 });
    }
    if (/relation ["']public.catalogo_servicios["'] does not exist/i.test(error.message)) {
      return NextResponse.json(
        { error: "Tabla catalogo_servicios no existe; ejecuta la migracion 004 en Supabase." },
        { status: 503 },
      );
    }
    return NextResponse.json({ error: hintSupabaseClientError(error.message) }, { status: 500 });
  }
  return NextResponse.json({ item: data });
}

/** DELETE /api/servicios?id=<uuid> */
export async function DELETE(req: Request) {
  const auth = await getAuthedApiUser();
  if (!isAuthedApiUser(auth)) return auth;
  if (!roleMayEditServiciosCatalogo(auth.role)) {
    return NextResponse.json({ error: "No autorizado para editar el catalogo" }, { status: 403 });
  }

  if (!isSupabaseServerConfigured()) {
    return error503("Supabase no configurado", { missingEnv: supabaseServerEnvMissing() });
  }
  const admin = createSupabaseServiceRoleClient();
  if (!admin) return error503("Cliente no disponible");

  const id = new URL(req.url).searchParams.get("id")?.trim();
  if (!id) {
    return NextResponse.json({ error: "FALTA id EN LA URL (?id=…)" }, { status: 400 });
  }

  const { error } = await admin.from("catalogo_servicios").delete().eq("id", id);
  if (error) {
    return NextResponse.json({ error: hintSupabaseClientError(error.message) }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
