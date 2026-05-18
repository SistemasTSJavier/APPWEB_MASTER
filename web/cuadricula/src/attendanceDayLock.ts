/** Día de columna estrictamente posterior a hoy (local) → no se edita aún. */
export function startOfLocalDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate())
}

export function isAttendanceDayLocked(colDate: Date, today: Date = new Date()): boolean {
  return startOfLocalDay(colDate).getTime() > startOfLocalDay(today).getTime()
}
