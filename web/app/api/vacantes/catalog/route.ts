import { NextResponse } from "next/server";
import {
  createSupabaseServiceRoleClient,
  hintSupabaseClientError,
  isSupabaseServerConfigured,
  supabaseServerEnvMissing,
} from "@/lib/supabase/admin";
import { getAuthedApiUser, isAuthedApiUser } from "@/lib/auth-api";
import {
  roleMayReadCuadriculaAsistencia,
  roleMayWriteCuadriculaAsistencia,
} from "@/lib/app-role";
import type { VacanteRegistro } from "@/lib/vacantes-catalog";

export const dynamic = "force-dynamic";

const CATALOG_KEY = "default";

type CatalogPayload = {
  items?: VacanteRegistro[];
  savedAt?: string;
};

function normalizeItems(raw: unknown): VacanteRegistro[] {
  if (!Array.isArray(raw)) return [];
  const out: VacanteRegistro[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const o = item as Record<string, unknown>;
    const planta = String(o.planta ?? "").trim().toUpperCase();
    const posicion = String(o.posicion ?? "").trim().toUpperCase();
    if (!planta || !posicion) continue;
    out.push({
      id: String(o.id ?? `vacant:${planta}:${posicion}`),
      planta,
      posicion,
      puesto: String(o.puesto ?? "").trim().toUpperCase() || undefined,
      servicioLinea: String(o.servicioLinea ?? "").trim().toUpperCase() || undefined,
      rowServiceNo: String(o.rowServiceNo ?? "").trim() || undefined,
      notas: String(o.notas ?? "").trim() || undefined,
      updatedAt: String(o.updatedAt ?? new Date().toISOString()),
    });
  }
  return out;
}

/** GET — catálogo de vacantes en servidor. */
export async function GET() {
  const auth = await getAuthedApiUser();
  if (!isAuthedApiUser(auth)) return auth;
  if (!roleMayReadCuadriculaAsistencia(auth.role)) {
    return NextResponse.json({ error: "No autorizado para consultar vacantes" }, { status: 403 });
  }
  if (!isSupabaseServerConfigured()) {
    return NextResponse.json(
      { error: "Supabase no configurado", missingEnv: supabaseServerEnvMissing() },
      { status: 503 },
    );
  }
  const admin = createSupabaseServiceRoleClient();
  if (!admin) {
    return NextResponse.json({ error: "Cliente Supabase no disponible" }, { status: 503 });
  }

  const { data, error } = await admin
    .from("cuadricula_vacantes_catalog")
    .select("payload, saved_at")
    .eq("catalog_key", CATALOG_KEY)
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: hintSupabaseClientError(error.message) }, { status: 500 });
  }
  if (!data?.payload) {
    return NextResponse.json({ items: [], savedAt: null });
  }

  const payload = data.payload as CatalogPayload;
  return NextResponse.json({
    items: normalizeItems(payload.items),
    savedAt: payload.savedAt ?? data.saved_at ?? null,
  });
}

/** POST — reemplaza el catálogo en servidor (subida desde local). */
export async function POST(req: Request) {
  const auth = await getAuthedApiUser();
  if (!isAuthedApiUser(auth)) return auth;
  if (!roleMayWriteCuadriculaAsistencia(auth.role)) {
    return NextResponse.json({ error: "No autorizado para guardar vacantes" }, { status: 403 });
  }
  if (!isSupabaseServerConfigured()) {
    return NextResponse.json(
      { error: "Supabase no configurado", missingEnv: supabaseServerEnvMissing() },
      { status: 503 },
    );
  }
  const admin = createSupabaseServiceRoleClient();
  if (!admin) {
    return NextResponse.json({ error: "Cliente Supabase no disponible" }, { status: 503 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }

  const o = body as Record<string, unknown>;
  const items = normalizeItems(o.items);
  const savedAt =
    typeof o.savedAt === "string" && o.savedAt.trim()
      ? o.savedAt.trim()
      : new Date().toISOString();

  const payload: CatalogPayload = { items, savedAt };

  const { error } = await admin.from("cuadricula_vacantes_catalog").upsert(
    {
      catalog_key: CATALOG_KEY,
      payload,
      saved_at: savedAt,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "catalog_key" },
  );

  if (error) {
    return NextResponse.json({ error: hintSupabaseClientError(error.message) }, { status: 500 });
  }

  return NextResponse.json({ ok: true, uploaded: items.length, savedAt });
}
