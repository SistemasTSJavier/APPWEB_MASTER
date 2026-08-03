import { NextResponse } from "next/server";
import { requireCategorizacionApi } from "@/lib/categorizacion-api-auth";
import {
  deleteCatRecompensa,
  listCatRecompensas,
  upsertCatRecompensa,
} from "@/lib/categorizacion-recompensas-server";
import { isSupabaseServerConfigured, supabaseServerEnvMissing } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const gate = await requireCategorizacionApi();
  if ("error" in gate) return gate.error;
  if (!isSupabaseServerConfigured()) {
    return NextResponse.json({ error: "Supabase no configurado", missingEnv: supabaseServerEnvMissing() }, { status: 503 });
  }
  try {
    const url = new URL(req.url);
    const noEmpleado = url.searchParams.get("no_empleado") ?? undefined;
    const rows = await listCatRecompensas({ noEmpleado });
    return NextResponse.json({ rows });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Error" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  const gate = await requireCategorizacionApi();
  if ("error" in gate) return gate.error;
  if (!isSupabaseServerConfigured()) {
    return NextResponse.json({ error: "Supabase no configurado", missingEnv: supabaseServerEnvMissing() }, { status: 503 });
  }
  try {
    const body = (await req.json()) as {
      id?: string;
      noEmpleado?: string;
      tipo?: string;
      descripcion?: string;
      mes?: string;
    };
    const row = await upsertCatRecompensa({
      id: body.id,
      noEmpleado: String(body.noEmpleado ?? ""),
      tipo: String(body.tipo ?? ""),
      descripcion: body.descripcion,
      mes: String(body.mes ?? ""),
    });
    return NextResponse.json({ row });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Error" }, { status: 400 });
  }
}

export async function DELETE(req: Request) {
  const gate = await requireCategorizacionApi();
  if ("error" in gate) return gate.error;
  if (!isSupabaseServerConfigured()) {
    return NextResponse.json({ error: "Supabase no configurado", missingEnv: supabaseServerEnvMissing() }, { status: 503 });
  }
  try {
    const url = new URL(req.url);
    const id = url.searchParams.get("id") ?? "";
    await deleteCatRecompensa(id);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Error" }, { status: 400 });
  }
}
