import type { ColaboradorCompleto } from "@/lib/colaboradores-types";

export function normalizeNoEmpleadoKey(no: string): string {
  return no.trim().toUpperCase();
}

export function findColaboradorEnLista(
  lista: ColaboradorCompleto[],
  noEmpleado: string,
): ColaboradorCompleto | null {
  const key = normalizeNoEmpleadoKey(noEmpleado);
  if (!key) return null;
  return lista.find((c) => c.noEmpleado === key) ?? null;
}

export function buildColaboradoresPorNoMap(
  lista: ColaboradorCompleto[],
): Map<string, ColaboradorCompleto> {
  const m = new Map<string, ColaboradorCompleto>();
  for (const c of lista) {
    const k = normalizeNoEmpleadoKey(c.noEmpleado);
    if (k) m.set(k, c);
  }
  return m;
}

/** Actualiza o agrega un expediente en la lista en memoria (sin volver a pedir GET completo). */
export function mergeColaboradorEnLista(
  lista: ColaboradorCompleto[],
  actualizado: ColaboradorCompleto,
): ColaboradorCompleto[] {
  const key = normalizeNoEmpleadoKey(actualizado.noEmpleado);
  const idx = lista.findIndex((c) => c.noEmpleado === key);
  if (idx < 0) return [...lista, actualizado];
  const next = [...lista];
  next[idx] = actualizado;
  return next;
}
