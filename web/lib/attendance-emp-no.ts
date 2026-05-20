/** Clave canónica de N.º de empleado (Excel, expediente, CSV). */
export function canonicalEmpNoAttendance(raw: string): string {
  let s = String(raw ?? "").trim().replace(/\u00a0/g, " ");
  if (/^'(.*)'$/.test(s)) s = s.slice(1, -1).trim();
  if (/^\d+\.0+$/.test(s)) s = s.replace(/\.0+$/, "");
  if (/^\d+$/.test(s)) return String(Number.parseInt(s, 10));
  return s.trim().toUpperCase();
}

/** Identificador de fila en asistencia: solo N.º de empleado (no posición ni servicio). */
export function empNoClaveGridRow(row: {
  employeeNo?: string | null;
  id?: string;
}): string {
  const fromEmp = canonicalEmpNoAttendance(String(row.employeeNo ?? ""));
  if (fromEmp) return fromEmp;
  return canonicalEmpNoAttendance(String(row.id ?? ""));
}

export function indexGridRowsByEmpNo<T extends { employeeNo?: string | null; id?: string }>(
  rows: T[],
): Map<string, T> {
  const map = new Map<string, T>();
  for (const r of rows) {
    const k = empNoClaveGridRow(r);
    if (!k) continue;
    map.set(k, r);
  }
  return map;
}
