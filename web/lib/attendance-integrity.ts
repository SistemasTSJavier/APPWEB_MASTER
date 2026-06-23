/**
 * Helpers para validación de integridad y auditoría de datos de asistencia.
 * Previene pérdida de datos durante importaciones y cambios.
 */

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
    
    // Validaciones básicas
    if (!r.empNo && !r.noEmpleado) {
      errors.push(`Fila ${i}: falta empNo/noEmpleado`);
      continue;
    }

    // Validar que tenga shifts (la asistencia)
    if (!Array.isArray(r.shifts)) {
      errors.push(`Fila ${i} (${r.empNo || r.noEmpleado}): shifts no es array o falta`);
      continue;
    }

    // Validar longitud de shifts (debería ser 7 para una semana)
    if (r.shifts.length !== 7) {
      warnings.push(
        `Fila ${i} (${r.empNo || r.noEmpleado}): shifts tiene ${r.shifts.length} elementos (esperado 7)`
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
        r.empNo || r.noEmpleado || "unknown",
        JSON.stringify(r),
      ])
  );

  const newMap = new Map(
    newRows
      .filter((r) => r && typeof r === "object")
      .map((r: Record<string, unknown>) => [
        r.empNo || r.noEmpleado || "unknown",
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
