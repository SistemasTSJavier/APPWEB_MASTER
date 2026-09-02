/**
 * Dual-write: aplanar payload de cuadrícula → filas diarias + sync a Supabase.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  attendanceRowEmpKey,
  compareAttendancePayloads,
  hashAttendancePayload,
  type StoredPayload,
} from "@/lib/attendance-integrity";

export type AsistenciaDiaRow = {
  week_start_iso: string;
  scope_key: string;
  employee_no: string;
  fecha: string;
  codigo_d: string;
  codigo_t: string;
  codigo_n: string;
  nombre: string | null;
  servicio: string | null;
  planta: string | null;
  updated_at: string;
};

/** Umbral absoluto o relativo (20%) para exigir confirmación de borrado masivo. */
export const MASS_REMOVAL_ABS = 10;
export const MASS_REMOVAL_RATIO = 0.2;

export function isMassRemovalBlocked(
  previousRowsCount: number,
  removedRows: number,
): boolean {
  if (removedRows <= 0 || previousRowsCount <= 0) return false;
  if (removedRows >= MASS_REMOVAL_ABS) return true;
  return removedRows / previousRowsCount >= MASS_REMOVAL_RATIO;
}

function addDaysIso(weekStartIso: string, dayIndex: number): string {
  const [y, m, d] = weekStartIso.split("-").map(Number);
  const dt = new Date(y || 1970, (m || 1) - 1, (d || 1) + dayIndex);
  const yy = dt.getFullYear();
  const mm = String(dt.getMonth() + 1).padStart(2, "0");
  const dd = String(dt.getDate()).padStart(2, "0");
  return `${yy}-${mm}-${dd}`;
}

function strField(v: unknown): string {
  if (typeof v === "string") return v.trim();
  if (typeof v === "number" && Number.isFinite(v)) return String(Math.trunc(v));
  return "";
}

function codigoCelda(day: unknown, turn: "D" | "T" | "N"): string {
  if (!day || typeof day !== "object") return "";
  const v = (day as Record<string, unknown>)[turn];
  return typeof v === "string" ? v.trim() : v == null ? "" : String(v).trim();
}

/** Expande filas de payload (shifts[0..6]) a filas diarias. */
export function payloadRowsToDiaRows(
  weekStartIso: string,
  scopeKey: string,
  rows: unknown[] | undefined | null,
  updatedAt = new Date().toISOString(),
): AsistenciaDiaRow[] {
  const out: AsistenciaDiaRow[] = [];
  if (!Array.isArray(rows)) return out;

  for (const raw of rows) {
    if (!raw || typeof raw !== "object") continue;
    const o = raw as Record<string, unknown>;
    const employeeNo = attendanceRowEmpKey(o);
    if (!employeeNo) continue;

    const nombre =
      strField(o.name) ||
      strField(o.nombre) ||
      strField(o.nombreCompleto) ||
      null;
    const servicio =
      strField(o.servicioLinea) ||
      strField(o.rowServiceNo) ||
      strField(o.serviceNo) ||
      null;
    const planta = strField(o.plantaLinea) || strField(o.planta) || null;
    const shifts = Array.isArray(o.shifts) ? o.shifts : [];

    for (let i = 0; i < 7; i++) {
      const day = shifts[i];
      out.push({
        week_start_iso: weekStartIso,
        scope_key: scopeKey,
        employee_no: employeeNo,
        fecha: addDaysIso(weekStartIso, i),
        codigo_d: codigoCelda(day, "D"),
        codigo_t: codigoCelda(day, "T"),
        codigo_n: codigoCelda(day, "N"),
        nombre,
        servicio,
        planta,
        updated_at: updatedAt,
      });
    }
  }

  return out;
}

const INSERT_CHUNK = 400;

/** Reemplaza los días de una semana+planta con el contenido del payload. */
export async function replaceAsistenciaDiasForScope(
  admin: SupabaseClient,
  weekStartIso: string,
  scopeKey: string,
  rows: unknown[] | undefined | null,
  updatedAt = new Date().toISOString(),
): Promise<{ ok: boolean; error?: string; rowsWritten: number }> {
  const diaRows = payloadRowsToDiaRows(weekStartIso, scopeKey, rows, updatedAt);

  const { error: delError } = await admin
    .from("cuadricula_asistencia_dias")
    .delete()
    .eq("week_start_iso", weekStartIso)
    .eq("scope_key", scopeKey);

  if (delError) {
    return { ok: false, error: delError.message, rowsWritten: 0 };
  }

  if (diaRows.length === 0) {
    return { ok: true, rowsWritten: 0 };
  }

  for (let i = 0; i < diaRows.length; i += INSERT_CHUNK) {
    const chunk = diaRows.slice(i, i + INSERT_CHUNK);
    const { error: insError } = await admin.from("cuadricula_asistencia_dias").insert(chunk);
    if (insError) {
      return { ok: false, error: insError.message, rowsWritten: i };
    }
  }

  return { ok: true, rowsWritten: diaRows.length };
}

/** Snapshot previo antes de sobrescribir payload. */
export async function backupAsistenciaPayload(
  admin: SupabaseClient,
  weekStartIso: string,
  scopeKey: string,
  payload: StoredPayload,
  serviceNo: string | null | undefined,
  reason: string,
): Promise<void> {
  try {
    await admin.from("cuadricula_asistencia_backups").insert({
      week_start_iso: weekStartIso,
      scope_key: scopeKey,
      payload,
      service_no: serviceNo || null,
      saved_at:
        typeof payload.savedAt === "string" ? payload.savedAt : new Date().toISOString(),
      backup_reason: reason,
      hash: hashAttendancePayload(payload),
    });
  } catch (e) {
    console.warn(
      `[ASISTENCIA-BACKUP] ${weekStartIso}/${scopeKey}:`,
      e instanceof Error ? e.message : String(e),
    );
  }
}

export type MassRemovalCheck = {
  blocked: boolean;
  comparison: ReturnType<typeof compareAttendancePayloads>;
  previousRowsCount: number;
};

export function checkMassRemoval(
  previous: StoredPayload | null,
  next: StoredPayload,
): MassRemovalCheck {
  const comparison = compareAttendancePayloads(
    previous as Record<string, unknown> | null,
    next as Record<string, unknown>,
  );
  const previousRowsCount = Array.isArray(previous?.rows) ? previous!.rows!.length : 0;
  return {
    blocked: isMassRemovalBlocked(previousRowsCount, comparison.removedRows),
    comparison,
    previousRowsCount,
  };
}
