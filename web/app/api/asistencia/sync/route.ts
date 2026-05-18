import { NextResponse } from "next/server";
import {
  createSupabaseServiceRoleClient,
  hintSupabaseClientError,
  isSupabaseServerConfigured,
  supabaseServerEnvMissing,
} from "@/lib/supabase/admin";
import { getAuthedApiUser, isAuthedApiUser } from "@/lib/auth-api";
import { roleMayWriteCuadriculaAsistencia } from "@/lib/app-role";

export const dynamic = "force-dynamic";

type SyncItem = {
  weekStartIso?: string;
  scopeKey?: string;
  grid?: { savedAt?: string; rows?: unknown[]; version?: number; serviceNo?: string };
  serviceNo?: string;
};

/** POST — sube varias cuadrículas desde localStorage del navegador al servidor. */
export async function POST(req: Request) {
  const auth = await getAuthedApiUser();
  if (!isAuthedApiUser(auth)) return auth;
  if (!roleMayWriteCuadriculaAsistencia(auth.role)) {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
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
  const items = (body as { items?: SyncItem[] })?.items;
  if (!Array.isArray(items) || items.length === 0) {
    return NextResponse.json({ error: "items[] vacío" }, { status: 400 });
  }

  let uploaded = 0;
  let skipped = 0;
  let failed = 0;

  for (const item of items) {
    const weekStartIso = (item.weekStartIso ?? "").trim();
    const scopeKey = (item.scopeKey ?? "").trim();
    const grid = item.grid;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(weekStartIso) || !scopeKey || !grid?.rows) {
      failed++;
      continue;
    }
    const incomingSavedAt =
      typeof grid.savedAt === "string" ? grid.savedAt : new Date().toISOString();
    const serviceNo =
      (typeof item.serviceNo === "string" ? item.serviceNo : grid.serviceNo) ?? "";

    const { data: existing } = await admin
      .from("cuadricula_asistencia")
      .select("payload")
      .eq("week_start_iso", weekStartIso)
      .eq("scope_key", scopeKey)
      .maybeSingle();

    if (existing?.payload) {
      const prev = existing.payload as { savedAt?: string };
      const prevAt = typeof prev.savedAt === "string" ? prev.savedAt : "";
      if (prevAt && prevAt > incomingSavedAt) {
        skipped++;
        continue;
      }
    }

    const payload = {
      ...grid,
      savedAt: incomingSavedAt,
      version: grid.version === 1 ? 1 : 2,
    };

    const { error } = await admin.from("cuadricula_asistencia").upsert(
      {
        week_start_iso: weekStartIso,
        scope_key: scopeKey,
        payload,
        service_no: serviceNo || null,
        saved_at: incomingSavedAt,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "week_start_iso,scope_key" },
    );

    if (error) {
      failed++;
    } else {
      uploaded++;
    }
  }

  return NextResponse.json({ ok: true, uploaded, skipped, failed, total: items.length });
}
