import type { AppRole } from "@/lib/app-role";
import {
  roleMayEditCuadricula,
  roleMayImportCuadriculaAsistenciaCsv,
} from "@/lib/app-role";
import { showCuadriculaDevTools } from "./cuadriculaEnv";

/** Captura en celdas y guardar (admin y editor_cuadricula). */
export function canEditCuadricula(role: AppRole | null | undefined): boolean {
  return role != null && roleMayEditCuadricula(role);
}

/** Importar CSV semana / todas las plantas (admin o editor_cuadricula, también en producción). */
export function canImportCuadriculaSemanaCsv(role: AppRole | null | undefined): boolean {
  return role != null && roleMayImportCuadriculaAsistenciaCsv(role);
}

/** Herramientas de migración local → servidor (solo desarrollo + admin). */
export function showCuadriculaMigrationTools(role: AppRole | null | undefined): boolean {
  return showCuadriculaDevTools() && canEditCuadricula(role);
}
