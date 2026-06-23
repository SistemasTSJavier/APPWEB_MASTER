/**
 * API: GET/POST /api/asistencia/audit
 * Propósito: Consultar auditoría de cambios y recuperar datos de backups
 */

import { NextResponse } from "next/server";
import {
  createSupabaseServiceRoleClient,
  isSupabaseServerConfigured,
  supabaseServerEnvMissing,
} from "@/lib/supabase/admin";
import { getAuthedApiUser, isAuthedApiUser } from "@/lib/auth-api";
import { roleMayReadCuadriculaAsistencia } from "@/lib/app-role";

export const dynamic = "force-dynamic";

/** GET ?weekStartIso=...&scopeKey=... — obtiene auditoría de cambios */
export async function GET(req: Request) {
  const auth = await getAuthedApiUser();
  if (!isAuthedApiUser(auth)) return auth;
  if (!roleMayReadCuadriculaAsistencia(auth.role)) {
    return NextResponse.json({ error: "No autorizado para consultar auditoría" }, { status: 403 });
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

  const url = new URL(req.url);
  const weekStartIso = (url.searchParams.get("weekStartIso") ?? "").trim();
  const scopeKey = (url.searchParams.get("scopeKey") ?? "").trim();
  const limit = Math.min(Number(url.searchParams.get("limit") ?? "50"), 500);
  const offset = Math.max(Number(url.searchParams.get("offset") ?? "0"), 0);

  let q = admin.from("cuadricula_asistencia_audit").select(
    "id, week_start_iso, scope_key, action, user_id, user_role, timestamp, rows_affected, status, error_message, notes",
    { count: "exact" }
  );

  if (weekStartIso) q = q.eq("week_start_iso", weekStartIso);
  if (scopeKey) q = q.eq("scope_key", scopeKey);

  q = q.order("timestamp", { ascending: false }).range(offset, offset + limit - 1);

  const { data, error, count } = await q;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({
    items: data,
    total: count,
    limit,
    offset,
  });
}

/** POST — recuperar datos de un backup */
export async function POST(req: Request) {
  const auth = await getAuthedApiUser();
  if (!isAuthedApiUser(auth)) return auth;
  // Solo admin puede recuperar datos
  if (auth.role !== "admin") {
    return NextResponse.json({ error: "Solo administrador puede recuperar datos" }, { status: 403 });
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
  const backupId = (typeof o.backupId === "string" ? o.backupId : "").trim();
  const weekStartIso = (typeof o.weekStartIso === "string" ? o.weekStartIso : "").trim();
  const scopeKey = (typeof o.scopeKey === "string" ? o.scopeKey : "").trim();

  if (!backupId && (!weekStartIso || !scopeKey)) {
    return NextResponse.json(
      { error: "Requiere backupId O (weekStartIso + scopeKey)" },
      { status: 400 },
    );
  }

  // 1. Obtener el backup
  let backup;
  if (backupId) {
    const { data } = await admin
      .from("cuadricula_asistencia_backups")
      .select("*")
      .eq("id", backupId)
      .maybeSingle();
    backup = data;
  } else {
    // Obtener el backup más reciente para esa semana/planta
    const { data } = await admin
      .from("cuadricula_asistencia_backups")
      .select("*")
      .eq("week_start_iso", weekStartIso)
      .eq("scope_key", scopeKey)
      .order("backed_up_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    backup = data;
  }

  if (!backup) {
    return NextResponse.json({ error: "Backup no encontrado" }, { status: 404 });
  }

  // 2. Restaurar datos en la tabla principal
  const { error: restoreError } = await admin.from("cuadricula_asistencia").upsert(
    {
      week_start_iso: backup.week_start_iso,
      scope_key: backup.scope_key,
      payload: backup.payload,
      service_no: backup.service_no,
      saved_at: backup.saved_at,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "week_start_iso,scope_key" },
  );

  if (restoreError) {
    return NextResponse.json({ error: restoreError.message }, { status: 500 });
  }

  // 3. Registrar la recuperación en auditoría
  await admin.from("cuadricula_asistencia_audit").insert({
    week_start_iso: backup.week_start_iso,
    scope_key: backup.scope_key,
    action: "restore",
    user_id: auth.user?.id ?? "unknown",
    user_role: auth.role ?? "unknown",
    timestamp: new Date().toISOString(),
    rows_affected: 0,
    new_hash: backup.hash,
    status: "success",
    notes: `Restaurado desde backup ${backupId}`,
  });

  return NextResponse.json({
    ok: true,
    restored: {
      weekStartIso: backup.week_start_iso,
      scopeKey: backup.scope_key,
      rowsCount: Array.isArray(backup.payload?.rows) ? backup.payload.rows.length : 0,
      backedUpAt: backup.backed_up_at,
      message: "Datos restaurados exitosamente",
    },
  });
}
