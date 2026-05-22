import { NextResponse } from "next/server";
import { registrarFirmaMoper } from "@/lib/moper-registros-server";
import type { MoperFirmaTipo } from "@/lib/moper-registros-types";
import { displayNameFromAuth, parseRegistroId } from "@/lib/moper-api-helper";
import {
  moperWorkflowPuedeFirmarControl,
  moperWorkflowPuedeFirmarGerente,
  moperWorkflowPuedeFirmarRh,
} from "@/lib/moper-workflow-role";
import { getAuthedApiUser, isAuthedApiUser } from "@/lib/auth-api";
import {
  createSupabaseServiceRoleClient,
  isSupabaseServerConfigured,
} from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

const TIPOS: MoperFirmaTipo[] = ["conformidad", "rh", "gerente", "control"];

export async function PATCH(req: Request, { params }: Params) {
  const { id: idRaw } = await params;
  const id = parseRegistroId(idRaw);
  if (!id) return NextResponse.json({ error: "ID invalido" }, { status: 400 });

  if (!isSupabaseServerConfigured()) {
    return NextResponse.json({ error: "Supabase no configurado" }, { status: 503 });
  }
  const admin = createSupabaseServiceRoleClient();
  if (!admin) {
    return NextResponse.json({ error: "Cliente no disponible" }, { status: 503 });
  }

  let body: { tipo?: string; imagen?: string; codigo_acceso?: string };
  try {
    body = (await req.json()) as { tipo?: string; imagen?: string; codigo_acceso?: string };
  } catch {
    return NextResponse.json({ error: "JSON invalido" }, { status: 400 });
  }

  const tipo = String(body.tipo ?? "").trim().toLowerCase() as MoperFirmaTipo;
  if (!TIPOS.includes(tipo)) {
    return NextResponse.json({ error: "Tipo de firma invalido" }, { status: 400 });
  }
  const imagen = String(body.imagen ?? "").trim();
  if (!imagen.startsWith("data:image/")) {
    return NextResponse.json({ error: "Imagen de firma invalida" }, { status: 400 });
  }

  if (tipo === "conformidad") {
    try {
      const registro = await registrarFirmaMoper(admin, id, tipo, imagen, {
        nombreFirmante: "Oficial",
        codigoAcceso: body.codigo_acceso,
      });
      return NextResponse.json(registro);
    } catch (e) {
      return NextResponse.json(
        { error: e instanceof Error ? e.message : "Error al registrar firma" },
        { status: 400 },
      );
    }
  }

  const auth = await getAuthedApiUser();
  if (!isAuthedApiUser(auth)) return auth;

  if (tipo === "rh" && !moperWorkflowPuedeFirmarRh(auth.role)) {
    return NextResponse.json({ error: "No autorizado para firmar como RH" }, { status: 403 });
  }
  if (tipo === "gerente" && !moperWorkflowPuedeFirmarGerente(auth.role)) {
    return NextResponse.json({ error: "No autorizado para firmar como Gerente" }, { status: 403 });
  }
  if (tipo === "control" && !moperWorkflowPuedeFirmarControl(auth.role)) {
    return NextResponse.json({ error: "No autorizado para firmar Centro de Control" }, { status: 403 });
  }

  const nombre = displayNameFromAuth(
    auth.user.email ?? null,
    auth.user.user_metadata ?? auth.user.app_metadata,
  );

  try {
    const registro = await registrarFirmaMoper(admin, id, tipo, imagen, { nombreFirmante: nombre });
    return NextResponse.json(registro);
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Error al registrar firma" },
      { status: 400 },
    );
  }
}
