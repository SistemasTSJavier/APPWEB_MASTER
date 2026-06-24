import type { User } from "@supabase/supabase-js";
import type { AppRole } from "@/lib/app-role";
import { CAPACITACION_EMAIL } from "@/lib/app-role";
import {
  accesoDesdeAuthUser,
  accesoEnfoqueClienteVigente,
  getCatEnfoqueAccesoPorUserId,
  type CatEnfoqueAccesoCliente,
} from "@/lib/categorizacion-enfoque-acceso";
import { normalizarServicioCategorizacion } from "@/lib/categorizacion-servicios-calificables";

export type CatEnfoqueClienteContext = {
  servicio: string;
  acceso: CatEnfoqueAccesoCliente;
};

export function servicioEnfoqueDesdeMetadata(user: User): string {
  const meta = user.user_metadata ?? {};
  return normalizarServicioCategorizacion(String(meta.cat_enfoque_servicio ?? ""));
}

export async function resolverContextoEnfoqueCliente(
  user: User,
): Promise<CatEnfoqueClienteContext | null> {
  let acceso = accesoDesdeAuthUser(user);

  if ((!acceso?.fechaInicio || !acceso.fechaFin) && user.id) {
    const refrescado = await getCatEnfoqueAccesoPorUserId(user.id);
    if (refrescado) acceso = refrescado;
  }

  if (!acceso || !accesoEnfoqueClienteVigente(acceso)) return null;
  const servicio = normalizarServicioCategorizacion(acceso.servicio);
  if (!servicio) return null;
  return { servicio, acceso };
}

export function puedeAdministrarAccesosEnfoque(role: AppRole): boolean {
  return role === "admin";
}

export function puedeGestionarCategorizacionCompleta(role: AppRole, email?: string | null): boolean {
  if (role === "admin" || role === "gerente_rh" || role === "capacitacion") return true;
  const e = (email ?? "").trim().toLowerCase();
  return e === CAPACITACION_EMAIL.toLowerCase();
}
