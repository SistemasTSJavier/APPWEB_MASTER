import { NextResponse } from "next/server";
import {
  actualizarCatEnfoqueAccesoCliente,
  crearCatEnfoqueAccesoCliente,
  listCatEnfoqueAccesosCliente,
  revocarCatEnfoqueAccesoCliente,
} from "@/lib/categorizacion-enfoque-acceso";
import { requireCategorizacionAdminApi } from "@/lib/categorizacion-api-auth";
import { isSupabaseServerConfigured, supabaseServerEnvMissing } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

export async function GET() {
  const gate = await requireCategorizacionAdminApi();
  if ("error" in gate) return gate.error;
  if (!isSupabaseServerConfigured()) {
    return NextResponse.json({ error: "Supabase no configurado", missingEnv: supabaseServerEnvMissing() }, { status: 503 });
  }
  try {
    const rows = await listCatEnfoqueAccesosCliente();
    return NextResponse.json({ ok: true, rows });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Error" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  const gate = await requireCategorizacionAdminApi();
  if ("error" in gate) return gate.error;
  if (!isSupabaseServerConfigured()) {
    return NextResponse.json({ error: "Supabase no configurado" }, { status: 503 });
  }
  let body: {
    servicio?: string;
    fechaInicio?: string;
    fechaFin?: string;
    nota?: string;
    modulos?: unknown;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }
  try {
    const row = await crearCatEnfoqueAccesoCliente({
      servicio: String(body.servicio ?? ""),
      fechaInicio: String(body.fechaInicio ?? ""),
      fechaFin: String(body.fechaFin ?? ""),
      nota: String(body.nota ?? ""),
      modulos: body.modulos,
      creadoPor: gate.auth.user.email ?? gate.auth.user.id,
    });
    return NextResponse.json({ ok: true, row });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Error" }, { status: 500 });
  }
}

export async function PATCH(req: Request) {
  const gate = await requireCategorizacionAdminApi();
  if ("error" in gate) return gate.error;
  if (!isSupabaseServerConfigured()) {
    return NextResponse.json({ error: "Supabase no configurado" }, { status: 503 });
  }
  let body: {
    id?: string;
    accion?: string;
    servicio?: string;
    fechaInicio?: string;
    fechaFin?: string;
    nota?: string;
    modulos?: unknown;
    activo?: boolean;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }
  const id = String(body.id ?? "").trim();
  if (!id) return NextResponse.json({ error: "id requerido" }, { status: 400 });

  try {
    if (body.accion === "revocar") {
      await revocarCatEnfoqueAccesoCliente(id);
      return NextResponse.json({ ok: true });
    }

    const row = await actualizarCatEnfoqueAccesoCliente({
      id,
      servicio: body.servicio,
      fechaInicio: body.fechaInicio,
      fechaFin: body.fechaFin,
      nota: body.nota,
      modulos: body.modulos,
      activo: body.activo,
    });
    return NextResponse.json({ ok: true, row });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Error" }, { status: 500 });
  }
}

/** Contexto del cliente enfoque autenticado (no admin). */
export async function OPTIONS() {
  return new NextResponse(null, { status: 204 });
}
