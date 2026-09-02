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
import {
  validateAttendanceRows,
  createAuditLog,
  auditLogToDbRow,
  formatIntegrityErrorMessage,
  mergeAttendancePayloadRows,
  type StoredPayload,
} from "@/lib/attendance-integrity";
import {
  backupAsistenciaPayload,
  checkMassRemoval,
  replaceAsistenciaDiasForScope,
} from "@/lib/asistencia-dias-sync";

export const dynamic = "force-dynamic";

function parseWeekIso(raw: string | null): string | null {
  const s = (raw ?? "").trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return null;
  return s;
}

function parseScopeKey(raw: string | null): string | null {
  const s = (raw ?? "").trim();
  return s.length > 0 && s.length <= 200 ? s : null;
}

/** GET ?weekStartIso=YYYY-MM-DD&scopeKey=planta:... — una cuadrícula; sin scopeKey todas las de esa semana. */
export async function GET(req: Request) {
  const auth = await getAuthedApiUser();
  if (!isAuthedApiUser(auth)) return auth;
  if (!roleMayReadCuadriculaAsistencia(auth.role)) {
    return NextResponse.json({ error: "No autorizado para consultar asistencia" }, { status: 403 });
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
  const weekStartIso = parseWeekIso(url.searchParams.get("weekStartIso"));
  const scopeKey = parseScopeKey(url.searchParams.get("scopeKey"));

  if (!weekStartIso) {
    return NextResponse.json({ error: "Indique weekStartIso (YYYY-MM-DD)" }, { status: 400 });
  }

  let q = admin
    .from("cuadricula_asistencia")
    .select("week_start_iso, scope_key, payload, service_no, saved_at")
    .eq("week_start_iso", weekStartIso);

  if (scopeKey) {
    q = q.eq("scope_key", scopeKey);
  }

  const { data, error } = await q;
  if (error) {
    return NextResponse.json({ error: hintSupabaseClientError(error.message) }, { status: 500 });
  }

  const items = (data ?? []).map((row) => ({
    weekStartIso: String(row.week_start_iso),
    scopeKey: String(row.scope_key),
    grid: row.payload as StoredPayload,
    serviceNo: row.service_no ?? "",
    savedAt: row.saved_at ?? "",
  }));

  if (scopeKey && items.length === 1) {
    return NextResponse.json(items[0]);
  }
  if (scopeKey && items.length === 0) {
    return NextResponse.json(null);
  }
  return NextResponse.json({ items });
}

/** POST — guarda una cuadrícula (upsert; merge + dual-write a días). */
export async function POST(req: Request) {
  const auth = await getAuthedApiUser();
  if (!isAuthedApiUser(auth)) return auth;
  if (!roleMayWriteCuadriculaAsistencia(auth.role)) {
    return NextResponse.json({ error: "No autorizado para guardar asistencia" }, { status: 403 });
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
  const weekStartIso = parseWeekIso(typeof o.weekStartIso === "string" ? o.weekStartIso : null);
  const scopeKey = parseScopeKey(typeof o.scopeKey === "string" ? o.scopeKey : null);
  const grid = o.grid as StoredPayload | undefined;
  if (!weekStartIso || !scopeKey || !grid || !Array.isArray(grid.rows)) {
    return NextResponse.json(
      { error: "Requiere weekStartIso, scopeKey y grid.rows" },
      { status: 400 },
    );
  }

  const validation = validateAttendanceRows(grid.rows);
  if (!validation.ok) {
    const errorMsg = formatIntegrityErrorMessage(validation, `${weekStartIso}/${scopeKey}`);
    console.error(`[ASISTENCIA-VALIDACIÓN] Falla de integridad:\n${errorMsg}`);
    return NextResponse.json(
      {
        error: `Datos de asistencia con errores de integridad. ${validation.errors.length} error(es) crítico(s).`,
        details: validation.errors,
        validation,
      },
      { status: 400 },
    );
  }

  const incomingSavedAt = typeof grid.savedAt === "string" ? grid.savedAt : new Date().toISOString();
  const serviceNo = typeof o.serviceNo === "string" ? o.serviceNo : (grid.serviceNo ?? "");
  const confirmReplace = o.confirmReplace === true;
  const confirmMassRemoval = o.confirmMassRemoval === true;
  const forceReplaceRequested = o.forceReplace === true;
  const forceReplace = forceReplaceRequested && confirmReplace && auth.role === "admin";

  if (forceReplaceRequested && !forceReplace) {
    return NextResponse.json(
      {
        error:
          "forceReplace requiere confirmReplace: true y rol administrador. Use merge (por defecto) o confirme el reemplazo total.",
        code: "force_replace_denied",
      },
      { status: 403 },
    );
  }

  let existingPayload: StoredPayload | null = null;

  const { data: existing } = await admin
    .from("cuadricula_asistencia")
    .select("payload, service_no")
    .eq("week_start_iso", weekStartIso)
    .eq("scope_key", scopeKey)
    .maybeSingle();

  if (existing?.payload) {
    existingPayload = existing.payload as StoredPayload;
    if (!forceReplace) {
      const prevAt = typeof existingPayload.savedAt === "string" ? existingPayload.savedAt : "";
      if (prevAt && prevAt > incomingSavedAt) {
        return NextResponse.json({ ok: true, skipped: true, reason: "older_than_server" });
      }
    }
  }

  let payloadToSave: StoredPayload = { ...grid };

  if (!forceReplace && existingPayload?.rows && Array.isArray(payloadToSave.rows)) {
    const mergedRows = mergeAttendancePayloadRows(payloadToSave.rows, existingPayload.rows);
    payloadToSave = {
      ...grid,
      rows: mergedRows,
    };

    console.log(
      `[ASISTENCIA-MERGE] ${weekStartIso}/${scopeKey}: ${existingPayload.rows.length} previas + ${(grid.rows || []).length} nuevas = ${mergedRows.length} totales`,
    );
  }

  const payload2: StoredPayload = {
    ...payloadToSave,
    savedAt: incomingSavedAt,
    version: payloadToSave.version === 1 ? 1 : 2,
  };

  const mass = checkMassRemoval(existingPayload, payload2);
  if (mass.blocked && !confirmMassRemoval && !forceReplace) {
    return NextResponse.json(
      {
        error: `Este guardado eliminaría ${mass.comparison.removedRows} colaborador(es) de la semana/planta (${mass.comparison.summary}). Confirme para continuar.`,
        code: "mass_removal",
        comparison: mass.comparison,
        previousRowsCount: mass.previousRowsCount,
        requireConfirmMassRemoval: true,
      },
      { status: 409 },
    );
  }

  if (existingPayload) {
    await backupAsistenciaPayload(
      admin,
      weekStartIso,
      scopeKey,
      existingPayload,
      typeof existing?.service_no === "string" ? existing.service_no : serviceNo,
      forceReplace ? "pre_replace" : "pre_save",
    );
  }

  const auditLog = createAuditLog(
    weekStartIso,
    scopeKey,
    "manual_edit",
    auth.user?.id ?? "unknown",
    auth.role ?? "unknown",
    validation.rowsCount,
    payload2,
    existingPayload,
    "success",
    undefined,
    mass.comparison.summary,
  );

  try {
    await admin.from("cuadricula_asistencia_audit").insert(auditLogToDbRow(auditLog));
  } catch (e) {
    console.warn(`[ASISTENCIA] Error guardando auditoría:`, (e as Error)?.message || String(e));
  }

  const { error } = await admin.from("cuadricula_asistencia").upsert(
    {
      week_start_iso: weekStartIso,
      scope_key: scopeKey,
      payload: payload2,
      service_no: serviceNo || null,
      saved_at: incomingSavedAt,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "week_start_iso,scope_key" },
  );

  if (error) {
    console.error(`[ASISTENCIA] Error en upsert:`, error.message);
    return NextResponse.json({ error: hintSupabaseClientError(error.message) }, { status: 500 });
  }

  const dias = await replaceAsistenciaDiasForScope(
    admin,
    weekStartIso,
    scopeKey,
    payload2.rows,
    incomingSavedAt,
  );
  if (!dias.ok) {
    console.error(`[ASISTENCIA-DIAS] ${weekStartIso}/${scopeKey}:`, dias.error);
    return NextResponse.json(
      {
        ok: true,
        warning: `Payload guardado, pero falló sync de días: ${dias.error}`,
        validation,
        comparison: mass.comparison,
      },
      { status: 200 },
    );
  }

  if (mass.comparison.changed) {
    console.log(`[ASISTENCIA] ✓ ${weekStartIso}/${scopeKey}: ${mass.comparison.summary}`);
  }

  return NextResponse.json({
    ok: true,
    validation,
    comparison: mass.comparison,
    diasWritten: dias.rowsWritten,
  });
}
