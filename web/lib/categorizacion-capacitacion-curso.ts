import type { CatCapacitacionCurso } from "@/lib/categorizacion-types";

export function hoyIso(): string {
  return new Date().toISOString().slice(0, 10);
}

export type CatCursoEstado = "vigente" | "vencida" | "programada" | "inactiva";

export function estadoCursoCapacitacion(c: CatCapacitacionCurso, hoy = hoyIso()): CatCursoEstado {
  if (!c.activo) return "inactiva";
  if (c.fechaVencimiento && c.fechaVencimiento < hoy) return "vencida";
  if (c.fechaInicio && c.fechaInicio > hoy) return "programada";
  return "vigente";
}

export function etiquetaEstadoCurso(estado: CatCursoEstado): string {
  if (estado === "vigente") return "Vigente";
  if (estado === "vencida") return "Vencida";
  if (estado === "programada") return "Programada";
  return "Inactiva";
}

export function cursoDisponibleParaRegistro(c: CatCapacitacionCurso, hoy = hoyIso()): boolean {
  return estadoCursoCapacitacion(c, hoy) === "vigente";
}

export function filtrarCursosPorNombre(cursos: CatCapacitacionCurso[], q: string): CatCapacitacionCurso[] {
  const n = q.trim().toLowerCase();
  if (!n) return cursos;
  return cursos.filter((c) => c.nombre.toLowerCase().includes(n));
}
