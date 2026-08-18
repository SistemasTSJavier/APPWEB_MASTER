import { NextResponse } from "next/server";
import { getAuthedApiUser, isAuthedApiUser } from "@/lib/auth-api";
import {
  userMayAccessAlertasLegal,
  userMayAgregarAlertasLegal,
  userMayCancelarAlertasLegal,
  userMayConfigurarAlertasLegal,
  userMayMarcarAlertaLegalLlegada,
} from "@/lib/app-role";

function meta(auth: { user: { user_metadata?: Record<string, unknown> | null } }) {
  return (auth.user.user_metadata ?? null) as Record<string, unknown> | null;
}

export async function requireAlertasLegalApi() {
  const auth = await getAuthedApiUser();
  if (!isAuthedApiUser(auth)) return { error: auth } as const;
  if (!userMayAccessAlertasLegal(auth.role, meta(auth))) {
    return {
      error: NextResponse.json({ error: "No autorizado para Alertas Legal." }, { status: 403 }),
    } as const;
  }
  return { auth } as const;
}

export async function requireAlertasLegalGestionApi() {
  const gate = await requireAlertasLegalApi();
  if ("error" in gate) return gate;
  if (!userMayAgregarAlertasLegal(gate.auth.role, meta(gate.auth))) {
    return {
      error: NextResponse.json(
        { error: "No tienes permiso para agregar personas. El Administrador lo asigna en Usuarios (Editar)." },
        { status: 403 },
      ),
    } as const;
  }
  return gate;
}

export async function requireAlertasLegalCancelarApi() {
  const gate = await requireAlertasLegalApi();
  if ("error" in gate) return gate;
  if (!userMayCancelarAlertasLegal(gate.auth.role, meta(gate.auth))) {
    return {
      error: NextResponse.json(
        { error: "No tienes permiso para cancelar. El Administrador lo asigna en Usuarios (Eliminar)." },
        { status: 403 },
      ),
    } as const;
  }
  return gate;
}

export async function requireAlertasLegalLlegadaApi() {
  const gate = await requireAlertasLegalApi();
  if ("error" in gate) return gate;
  if (!userMayMarcarAlertaLegalLlegada(gate.auth.role, meta(gate.auth))) {
    return {
      error: NextResponse.json(
        { error: "No tienes permiso para marcar la llegada. El Administrador lo asigna en Usuarios (Ver)." },
        { status: 403 },
      ),
    } as const;
  }
  return gate;
}

export async function requireAlertasLegalConfigApi() {
  const gate = await requireAlertasLegalApi();
  if ("error" in gate) return gate;
  if (!userMayConfigurarAlertasLegal(gate.auth.role)) {
    return {
      error: NextResponse.json({ error: "Solo el Administrador puede cambiar el correo destinatario." }, { status: 403 }),
    } as const;
  }
  return gate;
}
