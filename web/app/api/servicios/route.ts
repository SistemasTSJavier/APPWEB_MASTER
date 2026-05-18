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

function normNumeroServicio(raw: unknown): string | null {
  const t = String(raw ?? "").trim();
  return t ? t : null;
}

function normPlanta(raw: unknown): string | null {
  const t = String(raw ?? "").trim();
  return t ? t : null;
}

function error503(message: string, hint?: object) {
  return NextResponse.json({ error: message, ...hint }, { status: 503 });
}

/** GET /api/servicios — catálogo (nombre, número opcional). */
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

  const { data, error } = await admin
    .from("catalogo_servicios")
    .select("id, nombre, numero_servicio, planta")
    .order("nombre", { ascending: true });
  if (error) {
    if (/column .*planta.*does not exist/i.test(error.message)) {
      const { data: dPl, error: ePl } = await admin
        .from("catalogo_servicios")
        .select("id, nombre, numero_servicio")
        .order("nombre", { ascending: true });
      if (ePl) {
        if (/column .*numero_servicio.*does not exist/i.test(ePl.message)) {
          const { data: d2, error: e2 } = await admin.from("catalogo_servicios").select("id, nombre").order("nombre", { ascending: true });
          if (e2) {
            return NextResponse.json({ error: hintSupabaseClientError(e2.message) }, { status: 500 });
          }
          return NextResponse.json({
            items: (d2 ?? []).map((r: { id: string; nombre: string }) => ({ ...r, numero_servicio: null, planta: null })),
            hint: "Ejecuta web/supabase/migrations/008_catalogo_servicios_numero.sql y 010_catalogo_servicios_planta.sql.",
          });
        }
        return NextResponse.json({ error: hintSupabaseClientError(ePl.message) }, { status: 500 });
      }
      return NextResponse.json({
        items: (dPl ?? []).map((r: { id: string; nombre: string; numero_servicio?: string | null }) => ({
          ...r,
          planta: null,
        })),
        hint: "Ejecuta web/supabase/migrations/010_catalogo_servicios_planta.sql para habilitar Planta.",
      });
    }
    if (/column .*numero_servicio.*does not exist/i.test(error.message)) {
      const { data: d2, error: e2 } = await admin.from("catalogo_servicios").select("id, nombre").order("nombre", { ascending: true });
      if (e2) {
        return NextResponse.json({ error: hintSupabaseClientError(e2.message) }, { status: 500 });
      }
      return NextResponse.json({
        items: (d2 ?? []).map((r: { id: string; nombre: string }) => ({ ...r, numero_servicio: null, planta: null })),
        hint: "Ejecuta web/supabase/migrations/008_catalogo_servicios_numero.sql para habilitar N.º de servicio.",
      });
    }
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

/** POST /api/servicios body: { nombre: string, numero_servicio?: string | null } */
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
  const numeroServicio = normNumeroServicio((body as { numero_servicio?: string | null })?.numero_servicio);
  const planta = normPlanta((body as { planta?: string | null })?.planta);

  const insertRow: Record<string, unknown> = { nombre, updated_at: new Date().toISOString() };
  if (numeroServicio !== null) insertRow.numero_servicio = numeroServicio;
  if (planta !== null) insertRow.planta = planta;

  const { data, error } = await admin.from("catalogo_servicios").insert(insertRow).select("id, nombre, numero_servicio, planta").single();

  if (error) {
    if (/column .*planta.*does not exist/i.test(error.message) && planta !== null) {
      const rowSinPlanta = { ...insertRow };
      delete rowSinPlanta.planta;
      const { data: dPl, error: ePl } = await admin
        .from("catalogo_servicios")
        .insert(rowSinPlanta)
        .select("id, nombre, numero_servicio")
        .single();
      if (ePl) {
        return NextResponse.json({ error: hintSupabaseClientError(ePl.message) }, { status: 500 });
      }
      return NextResponse.json({
        item: { ...dPl, planta: null },
        hint: "Ejecuta 010_catalogo_servicios_planta.sql para guardar tambien la Planta.",
      });
    }
    if (/column .*numero_servicio.*does not exist/i.test(error.message)) {
      const { data: d2, error: e2 } = await admin
        .from("catalogo_servicios")
        .insert({ nombre, updated_at: new Date().toISOString(), ...(planta !== null ? { planta } : {}) })
        .select("id, nombre, planta")
        .single();
      if (e2) {
        const { data: d3, error: e3 } = await admin
          .from("catalogo_servicios")
          .insert({ nombre, updated_at: new Date().toISOString() })
          .select("id, nombre")
          .single();
        if (e3) {
          if (/duplicate key|unique constraint/i.test(e3.message)) {
            return NextResponse.json({ error: "ESE SERVICIO YA EXISTE EN EL CATALOGO" }, { status: 409 });
          }
          return NextResponse.json({ error: hintSupabaseClientError(e3.message) }, { status: 500 });
        }
        return NextResponse.json({
          item: { ...d3, numero_servicio: null, planta: null },
          hint: "Ejecuta 008_catalogo_servicios_numero.sql para guardar tambien el N.º de servicio.",
        });
      }
      return NextResponse.json({
        item: { ...d2, numero_servicio: null },
        hint: "Ejecuta 008_catalogo_servicios_numero.sql para guardar tambien el N.º de servicio.",
      });
    }
    if (/duplicate key|unique constraint/i.test(error.message)) {
      return NextResponse.json({ error: "ESE SERVICIO YA EXISTE EN EL CATALOGO (NOMBRE DUPLICADO)" }, { status: 409 });
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

/** PATCH /api/servicios body: { id: string, nombre?: string, numero_servicio?: string | null } */
export async function PATCH(req: Request) {
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
  const id = String((body as { id?: string })?.id ?? "").trim();
  if (!id) {
    return NextResponse.json({ error: "FALTA id EN EL CUERPO JSON" }, { status: 400 });
  }

  const nombreRaw = (body as { nombre?: string }).nombre;
  const hasNombre = nombreRaw !== undefined;
  const hasNumero = Object.prototype.hasOwnProperty.call(body as object, "numero_servicio");
  const hasPlanta = Object.prototype.hasOwnProperty.call(body as object, "planta");
  if (!hasNombre && !hasNumero && !hasPlanta) {
    return NextResponse.json({ error: "NADA QUE ACTUALIZAR (ENVIA nombre, numero_servicio Y/O planta)" }, { status: 400 });
  }

  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (hasNombre) {
    const nombre = normNombre(String(nombreRaw));
    if (!nombre) return NextResponse.json({ error: "NOMBRE DE SERVICIO VACIO" }, { status: 400 });
    patch.nombre = nombre;
  }
  if (hasNumero) {
    patch.numero_servicio = normNumeroServicio((body as { numero_servicio?: string | null }).numero_servicio);
  }
  if (hasPlanta) {
    patch.planta = normPlanta((body as { planta?: string | null }).planta);
  }

  const { data, error } = await admin.from("catalogo_servicios").update(patch).eq("id", id).select("id, nombre, numero_servicio, planta").single();

  if (error) {
    if (/column .*planta.*does not exist/i.test(error.message) && hasPlanta) {
      const patchSinPlanta = { ...patch };
      delete patchSinPlanta.planta;
      const { data: dPl, error: ePl } = await admin
        .from("catalogo_servicios")
        .update(patchSinPlanta)
        .eq("id", id)
        .select("id, nombre, numero_servicio")
        .single();
      if (ePl) {
        return NextResponse.json({ error: hintSupabaseClientError(ePl.message) }, { status: 500 });
      }
      return NextResponse.json({
        item: { ...dPl, planta: null },
        hint: "Ejecuta web/supabase/migrations/010_catalogo_servicios_planta.sql",
      });
    }
    if (/column .*numero_servicio.*does not exist/i.test(error.message)) {
      return NextResponse.json(
        {
          error: "Columna numero_servicio no existe",
          hint: "Ejecuta web/supabase/migrations/008_catalogo_servicios_numero.sql",
        },
        { status: 503 },
      );
    }
    if (/duplicate key|unique constraint/i.test(error.message)) {
      return NextResponse.json({ error: hintSupabaseClientError(error.message) }, { status: 409 });
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
