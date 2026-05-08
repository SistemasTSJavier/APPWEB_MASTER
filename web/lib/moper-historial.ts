const STORAGE_KEY = "tactical_moper_historial";

function normalizeNo(no: string): string {
  return no.trim().toUpperCase();
}

export type MoperHistorialEntrada = {
  noEmpleado: string;
  servicioInicial: string;
  servicioFinal: string;
  puestoInicial: string;
  puestoFinal: string;
  motivo: string;
  especificacion: string;
  registradoEn: string;
};

export function pushMoperHistorial(entry: MoperHistorialEntrada): void {
  if (typeof window === "undefined") return;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    const list: MoperHistorialEntrada[] = raw ? JSON.parse(raw) : [];
    list.unshift(entry);
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(list.slice(0, 500)));
  } catch {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify([entry]));
  }
}

export function listMoperHistorial(limit = 50): MoperHistorialEntrada[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    const list: MoperHistorialEntrada[] = raw ? JSON.parse(raw) : [];
    return list.slice(0, limit);
  } catch {
    return [];
  }
}

/** Movimientos MOPER del colaborador, mas recientes primero. */
export function listMoperHistorialPorEmpleado(noEmpleado: string): MoperHistorialEntrada[] {
  if (typeof window === "undefined") return [];
  const key = normalizeNo(noEmpleado);
  if (!key) return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    const list: MoperHistorialEntrada[] = raw ? JSON.parse(raw) : [];
    return list
      .filter((e) => e && normalizeNo(String(e.noEmpleado ?? "")) === key)
      .sort((a, b) => String(b.registradoEn ?? "").localeCompare(String(a.registradoEn ?? "")));
  } catch {
    return [];
  }
}
