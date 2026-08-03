import type { CatCapacitacionCurso } from "@/lib/categorizacion-types";

/** Disponible para asignar colaboradores: solo cursos activos (sin fechas de vigencia). */
export function cursoDisponibleParaRegistro(c: CatCapacitacionCurso): boolean {
  return Boolean(c.activo);
}

export function filtrarCursosPorNombre(cursos: CatCapacitacionCurso[], q: string): CatCapacitacionCurso[] {
  const n = q.trim().toLowerCase();
  if (!n) return cursos;
  return cursos.filter((c) => c.nombre.toLowerCase().includes(n));
}
