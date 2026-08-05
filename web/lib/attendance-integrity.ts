/**
 * Helpers para validación de integridad y auditoría de datos de asistencia.
 * Previene pérdida de datos durante importaciones y cambios.
 */

import { empNoClaveGridRow } from "@/lib/attendance-emp-no";

/** N.º de empleado desde celda JSON (string, número Excel o null). */
function empFieldAsString(v: unknown): string | null {
  if (typeof v === "string") {
    const t = v.trim();
    return t ? t : null;
  }
  if (typeof v === "number" && Number.isFinite(v)) return String(Math.trunc(v));
  return null;
}

/** Clave canónica de fila persistida (cuadrícula usa employeeNo; legado empNo/noEmpleado). */
export function attendanceRowEmpKey(row: Record<string, unknown>): string {
  return empNoClaveGridRow({
    employeeNo:
      empFieldAsString(row.employeeNo) ??
      empFieldAsString(row.empNo) ??
      empFieldAsString(row.noEmpleado),
    id: empFieldAsString(row.id) ?? undefined,
  });
}

/** Etiqueta legible del N.º de empleado en mensajes de error. */
function attendanceRowEmpLabel(row: Record<string, unknown>): string {
  return (
    attendanceRowEmpKey(row) ||
    String(row.employeeNo ?? row.empNo ?? row.noEmpleado ?? row.id ?? "?")
  );
}

/**
 * Combina filas de asistencia por N.º de empleado; las filas nuevas prevalecen.
 * Mantiene filas anteriores que no aparecen en el payload entrante.
 */
export function mergeAttendancePayloadRows(
  incomingRows: unknown[],
  previousRows: unknown[] | undefined | null,
): unknown[] {
  const rowByKey = new Map<string, unknown>();
  for (const r of previousRows ?? []) {
    if (!r || typeof r !== "object") continue;
    const key = attendanceRowEmpKey(r as Record<string, unknown>);
    if (key) rowByKey.set(key, r);
  }
  for (const r of incomingRows) {
    if (!r || typeof r !== "object") continue;
    const key = attendanceRowEmpKey(r as Record<string, unknown>);
    if (key) rowByKey.set(key, r);
  }
  return [...rowByKey.values()];
}

export type AttendanceValidationResult = {
  ok: boolean;
  rowsCount: number;
  errors: string[];
  warnings: string[];
};

export type AttendanceAuditLog = {
  weekStartIso: string;
  scopeKey: string;
  action: "import" | "manual_edit" | "sync" | "restore";
  userId: string;
  userRole: string;
  timestamp: string;
  rowsAffected: number;
  previousHash: string | null;
  newHash: string;
  status: "success" | "failed" | "partial";
  errorMessage?: string;
  notes?: string;
};

/** Payload persistido en cuadricula_asistencia (Supabase). */
export type StoredPayload = {
  version?: number;
  savedAt?: string;
  rows?: unknown[];
  serviceNo?: string;
};

/**
 * Valida estructura de filas de asistencia.
 * Retorna lista de errores si hay problemas.
 */
export function validateAttendanceRows(rows: unknown[]): AttendanceValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!Array.isArray(rows)) {
    return { ok: false, rowsCount: 0, errors: ["rows no es un array"], warnings };
  }

  if (rows.length === 0) {
    warnings.push("rows está vacío");
  }

  let validRowCount = 0;

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    if (!row || typeof row !== "object") {
      errors.push(`Fila ${i}: no es un objeto válido`);
      continue;
    }

    const r = row as Record<string, unknown>;
    const empLabel = attendanceRowEmpLabel(r);

    if (!attendanceRowEmpKey(r)) {
      errors.push(`Fila ${i}: falta número de empleado (employeeNo/empNo/noEmpleado/id)`);
      continue;
    }

    if (!Array.isArray(r.shifts)) {
      errors.push(`Fila ${i} (${empLabel}): shifts no es array o falta`);
      continue;
    }

    if (r.shifts.length !== 7) {
      warnings.push(
        `Fila ${i} (${empLabel}): shifts tiene ${r.shifts.length} elementos (esperado 7)`
      );
    }

    validRowCount++;
  }

  return {
    ok: errors.length === 0,
    rowsCount: validRowCount,
    errors,
    warnings,
  };
}

/**
 * Calcula hash SHA256 simple de los datos para detectar cambios.
 * No es criptográfico, pero suficiente para detectar corrupción.
 */
export function hashAttendancePayload(payload: unknown): string {
  const json = JSON.stringify(payload);
  let hash = 0;
  for (let i = 0; i < json.length; i++) {
    const char = json.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash; // Convertir a 32-bit
  }
  return Math.abs(hash).toString(16).padStart(8, "0");
}

/**
 * Compara dos payloads y retorna qué cambió.
 */
export function compareAttendancePayloads(
  oldPayload: Record<string, unknown> | null,
  newPayload: Record<string, unknown>
): {
  changed: boolean;
  addedRows: number;
  modifiedRows: number;
  removedRows: number;
  summary: string;
} {
  if (!oldPayload) {
    return {
      changed: true,
      addedRows: Array.isArray(newPayload.rows) ? newPayload.rows.length : 0,
      modifiedRows: 0,
      removedRows: 0,
      summary: "Registro nuevo (sin datos previos)",
    };
  }

  const oldRows = Array.isArray(oldPayload.rows) ? oldPayload.rows : [];
  const newRows = Array.isArray(newPayload.rows) ? newPayload.rows : [];

  const oldMap = new Map(
    oldRows
      .filter((r) => r && typeof r === "object")
      .map((r: Record<string, unknown>) => [
        attendanceRowEmpKey(r) || "unknown",
        JSON.stringify(r),
      ])
  );

  const newMap = new Map(
    newRows
      .filter((r) => r && typeof r === "object")
      .map((r: Record<string, unknown>) => [
        attendanceRowEmpKey(r) || "unknown",
        JSON.stringify(r),
      ])
  );

  let addedRows = 0;
  let modifiedRows = 0;
  let removedRows = 0;

  // Detectar agregados y modificados
  for (const [key, newJson] of newMap.entries()) {
    if (!oldMap.has(key)) {
      addedRows++;
    } else if (oldMap.get(key) !== newJson) {
      modifiedRows++;
    }
  }

  // Detectar eliminados
  for (const key of oldMap.keys()) {
    if (!newMap.has(key)) {
      removedRows++;
    }
  }

  const changed = addedRows + modifiedRows + removedRows > 0;
  const summary = changed
    ? `${addedRows} agregados, ${modifiedRows} modificados, ${removedRows} removidos`
    : "Sin cambios detectados";

  return { changed, addedRows, modifiedRows, removedRows, summary };
}

/**
 * Prepara un registro de auditoría para guardar en la base de datos.
 */
export function createAuditLog(
  weekStartIso: string,
  scopeKey: string,
  action: AttendanceAuditLog["action"],
  userId: string,
  userRole: string,
  rowsAffected: number,
  newPayload: unknown,
  previousPayload: unknown = null,
  status: "success" | "failed" | "partial" = "success",
  errorMessage?: string,
  notes?: string
): AttendanceAuditLog {
  return {
    weekStartIso,
    scopeKey,
    action,
    userId,
    userRole,
    timestamp: new Date().toISOString(),
    rowsAffected,
    previousHash: previousPayload ? hashAttendancePayload(previousPayload) : null,
    newHash: hashAttendancePayload(newPayload),
    status,
    errorMessage,
    notes,
  };
}

/**
 * Formatea mensaje de error detallado para problemas de integridad.
 */
export function formatIntegrityErrorMessage(
  validation: AttendanceValidationResult,
  context: string
): string {
  const parts: string[] = [];

  if (validation.errors.length > 0) {
    parts.push(`ERRORES [${context}]:`);
    validation.errors.slice(0, 5).forEach((e) => parts.push(`  - ${e}`));
    if (validation.errors.length > 5) {
      parts.push(`  ... y ${validation.errors.length - 5} más`);
    }
  }

  if (validation.warnings.length > 0) {
    parts.push(`ADVERTENCIAS:`);
    validation.warnings.slice(0, 3).forEach((w) => parts.push(`  ⚠ ${w}`));
  }

  return parts.join("\n");
}

/**
 * Genera reporte de salud de datos para debugging.
 */
export function generateAttendanceHealthReport(
  rowsCount: number,
  validation: AttendanceValidationResult,
  comparison?: ReturnType<typeof compareAttendancePayloads>
): string {
  const lines: string[] = [
    "=== REPORTE DE SALUD DE ASISTENCIA ===",
    `Filas cargadas: ${rowsCount}`,
    `Filas válidas: ${validation.rowsCount}`,
    `Errores: ${validation.errors.length}`,
    `Advertencias: ${validation.warnings.length}`,
  ];

  if (comparison) {
    lines.push("");
    lines.push(`Cambios detectados: ${comparison.changed ? "SÍ" : "NO"}`);
    lines.push(`Filas agregadas: ${comparison.addedRows}`);
    lines.push(`Filas modificadas: ${comparison.modifiedRows}`);
    lines.push(`Filas removidas: ${comparison.removedRows}`);
    lines.push(`Resumen: ${comparison.summary}`);
  }

  if (validation.errors.length > 0) {
    lines.push("");
    lines.push("ERRORES CRÍTICOS:");
    validation.errors.forEach((e) => lines.push(`  ✗ ${e}`));
  }

  if (validation.warnings.length > 0) {
    lines.push("");
    lines.push("ADVERTENCIAS:");
    validation.warnings.forEach((w) => lines.push(`  ⚠ ${w}`));
  }

  return lines.join("\n");
}
