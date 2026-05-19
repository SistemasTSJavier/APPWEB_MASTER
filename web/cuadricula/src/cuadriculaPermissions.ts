import type { AppRole } from "@/lib/app-role";
import {
  roleMayEditCuadricula,
  roleMayFilterBajasPorFechaBaja,
  roleMayImportCuadriculaAsistenciaCsv,
} from "@/lib/app-role";
/** Captura en celdas y guardar (admin y editor_cuadricula). */
export function canEditCuadricula(role: AppRole | null | undefined): boolean {
  return role != null && roleMayEditCuadricula(role);
}

/** Importar CSV semana / todas las plantas (admin o editor_cuadricula, también en producción). */
export function canImportCuadriculaSemanaCsv(role: AppRole | null | undefined): boolean {
  return role != null && roleMayImportCuadriculaAsistenciaCsv(role);
}

/** Filtro por rango de fecha de baja en módulo Bajas de cuadrícula. */
export function canFilterBajasCuadriculaPorFechaBaja(role: AppRole | null | undefined): boolean {
  return role != null && roleMayFilterBajasPorFechaBaja(role);
}
