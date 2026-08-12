import { NextResponse } from "next/server";
import {
  createSupabaseServiceRoleClient,
  hintSupabaseClientError,
  isSupabaseServerConfigured,
  supabaseServerEnvMissing,
} from "@/lib/supabase/admin";
import { getAuthedApiUser, isAuthedApiUser } from "@/lib/auth-api";
import { roleMayWriteCuadriculaAsistencia } from "@/lib/app-role";
import {
  validateAttendanceRows,
  sanitizeAttendanceRows,
  compareAttendancePayloads,
  createAuditLog,
  generateAttendanceHealthReport,
  mergeAttendancePayloadRows,
  type StoredPayload,
} from "@/lib/attendance-integrity";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

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
  const parsed = body as { items?: SyncItem[]; forceReplace?: boolean };
  const items = parsed?.items;
  const forceReplace = parsed?.forceReplace === true;
  if (!Array.isArray(items) || items.length === 0) {
    return NextResponse.json({ error: "items[] vacío" }, { status: 400 });
  }

  type ValidSyncItem = {
    weekStartIso: string;
    scopeKey: string;
    grid: NonNullable<SyncItem["grid"]>;
    incomingSavedAt: string;
    serviceNo: string;
  };

  const valid: ValidSyncItem[] = [];
  let failed = 0;

  for (const item of items) {
    const weekStartIso = (item.weekStartIso ?? "").trim();
    const scopeKey = (item.scopeKey ?? "").trim();
    const grid = item.grid;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(weekStartIso) || !scopeKey || !grid?.rows) {
      failed++;
      continue;
    }

    const sanitized = sanitizeAttendanceRows(Array.isArray(grid.rows) ? grid.rows : []);
    if (sanitized.dropped > 0) {
      console.warn(
        `[ASISTENCIA] ${weekStartIso}/${scopeKey}: omitidas ${sanitized.dropped} fila(s) inválidas de ${grid.rows.length}`,
      );
    }
    if (sanitized.rows.length === 0) {
      console.warn(`[ASISTENCIA] Validación fallida para ${weekStartIso}/${scopeKey}: sin filas válidas`);
      failed++;
      continue;
    }

    const validation = validateAttendanceRows(sanitized.rows);
    if (!validation.ok) {
      console.warn(`[ASISTENCIA] Validación fallida para ${weekStartIso}/${scopeKey}:`, validation.errors);
      failed++;
      continue;
    }

    valid.push({
      weekStartIso,
      scopeKey,
      grid: { ...grid, rows: sanitized.rows },
      incomingSavedAt:
        typeof grid.savedAt === "string" ? grid.savedAt : new Date().toISOString(),
      serviceNo:
        (typeof item.serviceNo === "string" ? item.serviceNo : grid.serviceNo) ?? "",
    });
  }

  const weekKeys = [...new Set(valid.map((v) => v.weekStartIso))];
  const scopeKeys = [...new Set(valid.map((v) => v.scopeKey))];
  const existingMap = new Map<string, StoredPayload | null>();

  if (valid.length > 0) {
    const { data: existingRows } = await admin
      .from("cuadricula_asistencia")
      .select("week_start_iso, scope_key, payload")
      .in("week_start_iso", weekKeys)
      .in("scope_key", scopeKeys);

    for (const row of existingRows ?? []) {
      const payload = row.payload as StoredPayload | null;
      existingMap.set(`${row.week_start_iso}|${row.scope_key}`, payload);
    }
  }

  let uploaded = 0;
  let skipped = 0;

  const upsertResults = await Promise.all(
    valid.map(async (item) => {
      const cacheKey = `${item.weekStartIso}|${item.scopeKey}`;
      const prev = existingMap.get(cacheKey);
      if (!forceReplace) {
        const prevAt = typeof prev?.savedAt === "string" ? prev.savedAt : "";
        if (prevAt && prevAt > item.incomingSavedAt) {
          return "skipped" as const;
        }
      }

      // ✅ MEJORADO: Hacer merge con datos anteriores
      let payloadToSave = {
        ...item.grid,
        savedAt: item.incomingSavedAt,
        version: item.grid.version === 1 ? 1 : 2,
      };

      if (!forceReplace && prev?.rows && Array.isArray(item.grid.rows)) {
        const mergedRows = mergeAttendancePayloadRows(item.grid.rows, prev.rows);
        payloadToSave = {
          ...payloadToSave,
          rows: mergedRows,
        };

        console.log(
          `[ASISTENCIA-SYNC-MERGE] ${item.weekStartIso}/${item.scopeKey}: ${prev.rows.length} previas + ${(item.grid.rows || []).length} nuevas = ${mergedRows.length} totales`
        );
      }

      // ✅ COMPARAR Y REPORTAR CAMBIOS
      const comparison = compareAttendancePayloads(prev as Record<string, unknown> | null, payloadToSave as Record<string, unknown>);
      
      // ✅ CREAR REGISTRO DE AUDITORÍA
      const auditLog = createAuditLog(
        item.weekStartIso,
        item.scopeKey,
        "sync",
        auth.user?.id ?? "unknown",
        auth.role ?? "unknown",
        Array.isArray(payloadToSave.rows) ? payloadToSave.rows.length : 0,
        payloadToSave,
        prev,
        "success",
        undefined,
        comparison.summary
      );

      // ✅ GUARDAR AUDITORÍA EN TABLA SEPARADA
      if (process.env.NODE_ENV === "production") {
        try {
          await admin.from("cuadricula_asistencia_audit").insert(auditLog);
        } catch (e) {
          console.warn(`[ASISTENCIA] Error guardando auditoría:`, (e as any)?.message || String(e));
          // No fallar la sincronización por error en auditoría
        }
      }

      const { error } = await admin.from("cuadricula_asistencia").upsert(
        {
          week_start_iso: item.weekStartIso,
          scope_key: item.scopeKey,
          payload: payloadToSave,
          service_no: item.serviceNo || null,
          saved_at: item.incomingSavedAt,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "week_start_iso,scope_key" },
      );

      if (error) {
        console.error(`[ASISTENCIA] Error en upsert para ${item.weekStartIso}/${item.scopeKey}:`, error.message);
        return "failed" as const;
      }

      // ✅ LOG DETALLADO
      if (comparison.changed) {
        console.log(
          `[ASISTENCIA-SYNC] ✓ ${item.weekStartIso}/${item.scopeKey}: ${comparison.summary}`
        );
      }

      return "uploaded" as const;
    }),
  );

  for (const r of upsertResults) {
    if (r === "uploaded") uploaded++;
    else if (r === "skipped") skipped++;
    else failed++;
  }

  return NextResponse.json({ 
    ok: true, 
    uploaded, 
    skipped, 
    failed, 
    total: items.length,
    message: `✓ ${uploaded} sincronizadas (con merge de datos previos), ${skipped} omitidas, ${failed} fallidas`
  });
}
