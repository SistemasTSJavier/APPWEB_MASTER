import { NextResponse } from "next/server";
import type { CatEvalModuloId } from "@/lib/categorizacion-campos";
import { getAuthedApiUser, isAuthedApiUser } from "@/lib/auth-api";
import { roleEsClienteEnfoque, roleMayAccessCategorizacion } from "@/lib/app-role";
import type { CatEnfoqueClienteContext } from "@/lib/categorizacion-enfoque-auth";
import { resolverContextoEnfoqueCliente } from "@/lib/categorizacion-enfoque-auth";

export type CategorizacionApiAuth = {
  user: { id: string; email?: string | null };
  role: import("@/lib/app-role").AppRole;
  enfoqueCliente: CatEnfoqueClienteContext | null;
};

export async function requireCategorizacionApi(): Promise<
  { auth: CategorizacionApiAuth } | { error: NextResponse }
> {
  const auth = await getAuthedApiUser();
  if (!isAuthedApiUser(auth)) return { error: auth };
  if (!roleMayAccessCategorizacion(auth.role, auth.user.email)) {
    return { error: NextResponse.json({ error: "No autorizado para categorización" }, { status: 403 }) };
  }

  let enfoqueCliente: CatEnfoqueClienteContext | null = null;
  if (roleEsClienteEnfoque(auth.role)) {
    enfoqueCliente = await resolverContextoEnfoqueCliente(auth.user);
    if (!enfoqueCliente) {
      return {
        error: NextResponse.json(
          { error: "Acceso de cliente enfoque expirado o no configurado." },
          { status: 403 },
        ),
      };
    }
  }

  return {
    auth: {
      user: { id: auth.user.id, email: auth.user.email },
      role: auth.role,
      enfoqueCliente,
    },
  };
}

export async function requireCategorizacionAdminApi(): Promise<
  { auth: CategorizacionApiAuth } | { error: NextResponse }
> {
  const gate = await requireCategorizacionApi();
  if ("error" in gate) return gate;
  if (gate.auth.role !== "admin") {
    return { error: NextResponse.json({ error: "Solo administrador" }, { status: 403 }) };
  }
  return gate;
}

export function assertModuloPermitidoClienteEnfoque(
  auth: CategorizacionApiAuth,
  modulo: CatEvalModuloId,
): NextResponse | null {
  if (!roleEsClienteEnfoque(auth.role)) return null;
  if (modulo !== "enfoque_cliente") {
    return NextResponse.json({ error: "Solo puede consultar Enfoque al cliente." }, { status: 403 });
  }
  return null;
}

export function servicioScopeCategorizacion(auth: CategorizacionApiAuth): string | null {
  if (auth.enfoqueCliente) return auth.enfoqueCliente.servicio;
  return null;
}
