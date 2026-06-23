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
  compareAttendancePayloads,
  createAuditLog,
  formatIntegrityErrorMessage,
} from "@/lib/attendance-integrity";

export const dynamic = "force-dynamic";

type StoredPayload = {
  version?: number;
  savedAt?: string;
  rows?: unknown[];
  serviceNo?: string;
};

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

/** POST — guarda una cuadrícula (upsert; solo si savedAt es más reciente o no existía). */
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

  // ✅ VALIDAR INTEGRIDAD ANTES DE GUARDAR
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
  const forceReplace = o.forceReplace === true;

  let existingPayload: StoredPayload | null = null;

  if (!forceReplace) {
    const { data: existing } = await admin
      .from("cuadricula_asistencia")
      .select("payload")
      .eq("week_start_iso", weekStartIso)
      .eq("scope_key", scopeKey)
      .maybeSingle();

    if (existing?.payload) {
      existingPayload = existing.payload as StoredPayload;
      const prev = existingPayload;
      const prevAt = typeof prev.savedAt === "string" ? prev.savedAt : "";
      if (prevAt && prevAt > incomingSavedAt) {
        return NextResponse.json({ ok: true, skipped: true, reason: "older_than_server" });
      }
    }
  }

  // ✅ MEJORADO: Hacer merge con datos anteriores (combinar filas por empleado)
  let payloadToSave: StoredPayload = {
    ...grid,
  };

  if (!forceReplace && existingPayload?.rows && Array.isArray(payloadToSave.rows)) {
    // Combinar filas: datos nuevos prevalecen, datos anteriores se mantienen si no están en nuevos
    const newRowsByEmpNo = new Map<string, unknown>();
    (payloadToSave.rows || []).forEach((r: any) => {
      const key = r?.empNo || r?.noEmpleado || `unknown_${Math.random()}`;
      newRowsByEmpNo.set(String(key), r);
    });

    const mergedRows = [...(payloadToSave.rows || [])];
    (existingPayload.rows || []).forEach((r: any) => {
      const key = r?.empNo || r?.noEmpleado || `unknown_${Math.random()}`;
      if (!newRowsByEmpNo.has(String(key))) {
        // Agregar fila anterior si no está en nuevos datos
        mergedRows.push(r);
      }
    });

    payloadToSave = {
      ...grid,
      rows: mergedRows,
    };

    console.log(
      `[ASISTENCIA-MERGE] ${weekStartIso}/${scopeKey}: ${existingPayload.rows.length} previas + ${(grid.rows || []).length} nuevas = ${mergedRows.length} totales`
    );
  }

  const payload2: StoredPayload = {
    ...payloadToSave,
    savedAt: incomingSavedAt,
    version: payloadToSave.version === 1 ? 1 : 2,
  };

  // ✅ COMPARAR CAMBIOS Y REGISTRAR AUDITORÍA
  const comparison = compareAttendancePayloads(existingPayload || null, payload2);
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
    comparison.summary
  );

  // ✅ GUARDAR AUDITORÍA
  if (process.env.NODE_ENV === "production") {
    await admin.from("cuadricula_asistencia_audit").insert(auditLog).catch((e) => {
      console.warn(`[ASISTENCIA] Error guardando auditoría:`, e.message);
    });
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

  // ✅ LOG DETALLADO
  if (comparison.changed) {
    console.log(`[ASISTENCIA] ✓ ${weekStartIso}/${scopeKey}: ${comparison.summary}`);
  }

  return NextResponse.json({ ok: true, validation, comparison });
}
