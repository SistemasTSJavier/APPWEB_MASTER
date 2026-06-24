import { NextResponse } from "next/server";
import {
  crearCatEnfoqueAccesoCliente,
  listCatEnfoqueAccesosCliente,
  revocarCatEnfoqueAccesoCliente,
} from "@/lib/categorizacion-enfoque-acceso";
import { requireCategorizacionAdminApi, requireCategorizacionApi } from "@/lib/categorizacion-api-auth";
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
  let body: { servicio?: string; fechaInicio?: string; fechaFin?: string; nota?: string };
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
  let body: { id?: string; accion?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }
  const id = String(body.id ?? "").trim();
  if (!id || body.accion !== "revocar") {
    return NextResponse.json({ error: "id y accion=revocar requeridos" }, { status: 400 });
  }
  try {
    await revocarCatEnfoqueAccesoCliente(id);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Error" }, { status: 500 });
  }
}

/** Contexto del cliente enfoque autenticado (no admin). */
export async function OPTIONS() {
  return new NextResponse(null, { status: 204 });
}
