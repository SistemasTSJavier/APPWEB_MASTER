import {
  fetchAttendanceWeekRemote,
  type RemoteAttendanceFetchMeta,
} from "./attendanceRemote";
import type { RemoteAttendanceEntry } from "./attendanceRemote";
import type { AttendanceWeekPrefetch } from "./attendanceStorage";

const cache = new Map<string, Promise<AttendanceWeekPrefetch>>();

/** Una sola petición HTTP por semana (compartida entre plantas e importación). */
export function getAttendanceWeekPrefetch(weekStartIso: string): Promise<AttendanceWeekPrefetch> {
  const key = weekStartIso.trim();
  if (!key) {
    return Promise.resolve({ items: [], meta: { status: "empty" } });
  }
  let pending = cache.get(key);
  if (!pending) {
    pending = fetchAttendanceWeekRemote(key).then((r) => ({
      items: r.items,
      meta: r.meta,
    }));
    cache.set(key, pending);
  }
  return pending;
}

export function invalidateAttendanceWeekPrefetch(weekStartIso?: string): void {
  if (weekStartIso?.trim()) {
    cache.delete(weekStartIso.trim());
    return;
  }
  cache.clear();
}
