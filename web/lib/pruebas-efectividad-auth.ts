import { NextResponse } from "next/server";
import { getAuthedApiUser, isAuthedApiUser } from "@/lib/auth-api";
import {
  roleEsClienteEnfoque,
  roleMayAccessPruebasEfectividad,
  roleMayCapturePruebasEfectividad,
  type AppRole,
} from "@/lib/app-role";
import { resolverContextoEnfoqueCliente } from "@/lib/categorizacion-enfoque-auth";

export type PeoApiAuth = {
  user: { id: string; email?: string | null };
  role: AppRole;
  servicioScope: string | null;
};

export async function requirePeoApi(): Promise<{ auth: PeoApiAuth } | { error: NextResponse }> {
  const auth = await getAuthedApiUser();
  if (!isAuthedApiUser(auth)) return { error: auth };
  if (!roleMayAccessPruebasEfectividad(auth.role, auth.user.email)) {
    return { error: NextResponse.json({ error: "No autorizado para pruebas operativas" }, { status: 403 }) };
  }

  let servicioScope: string | null = null;
  if (roleEsClienteEnfoque(auth.role)) {
    const contexto = await resolverContextoEnfoqueCliente(auth.user);
    if (!contexto) {
      return {
        error: NextResponse.json(
          { error: "Acceso de cliente expirado o sin servicio configurado." },
          { status: 403 },
        ),
      };
    }
    servicioScope = contexto.servicio;
  }

  return {
    auth: {
      user: { id: auth.user.id, email: auth.user.email },
      role: auth.role,
      servicioScope,
    },
  };
}

export async function requirePeoCaptureApi(): Promise<{ auth: PeoApiAuth } | { error: NextResponse }> {
  const gate = await requirePeoApi();
  if ("error" in gate) return gate;
  if (!roleMayCapturePruebasEfectividad(gate.auth.role, gate.auth.user.email)) {
    return { error: NextResponse.json({ error: "Solo usuarios internos pueden capturar." }, { status: 403 }) };
  }
  return gate;
}

export async function requirePeoAdminApi(): Promise<{ auth: PeoApiAuth } | { error: NextResponse }> {
  const gate = await requirePeoApi();
  if ("error" in gate) return gate;
  if (gate.auth.role !== "admin") {
    return { error: NextResponse.json({ error: "Solo administrador." }, { status: 403 }) };
  }
  return gate;
}
