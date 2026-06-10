import type { AppRole } from "@/lib/app-role";
import { roleMayWriteMoperHistorial } from "@/lib/app-role";

/** Rol mostrado en UI del workflow (compatibilidad con moper-frontend). */
export type MoperWorkflowRol = "admin" | "gerente" | "consulta";

export function moperWorkflowRolFromAppRole(role: AppRole): MoperWorkflowRol {
  if (role === "admin") return "admin";
  if (role === "rh" || role === "gerente_rh" || role === "relaciones_laborales") return "gerente";
  return "consulta";
}

export function moperWorkflowPuedeEditar(role: AppRole): boolean {
  return roleMayWriteMoperHistorial(role);
}

export function moperWorkflowPuedeAjustarFolio(role: AppRole): boolean {
  return role === "admin" || role === "gerente_rh" || role === "relaciones_laborales";
}

export function moperWorkflowPuedeFirmarRh(role: AppRole): boolean {
  return role === "admin" || role === "rh" || role === "gerente_rh" || role === "relaciones_laborales";
}

export function moperWorkflowPuedeFirmarGerente(role: AppRole): boolean {
  return role === "admin" || role === "gerente_rh" || role === "gerente_operaciones";
}

export function moperWorkflowPuedeFirmarControl(role: AppRole): boolean {
  return role === "admin" || role === "editor_cuadricula";
}

export function moperWorkflowPuedeCancelar(email: string | null | undefined, role: AppRole): boolean {
  if (role === "admin") return true;
  const e = (email ?? "").trim().toLowerCase();
  return e === "sistemas@tacticalsupport.com.mx" || e === "gterh@tacticalsupport.com.mx";
}
