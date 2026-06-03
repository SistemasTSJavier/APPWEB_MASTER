import { NextResponse } from "next/server";
import { requireCategorizacionApi } from "@/lib/categorizacion-api-auth";
import {
  deleteCatPersonal,
  listCatPersonal,
  syncCatPersonalActivosDesdeColaboradores,
  upsertCatPersonal,
} from "@/lib/categorizacion-server";
import type { CatPersonalRow } from "@/lib/categorizacion-types";
import {
  createSupabaseServiceRoleClient,
  isSupabaseServerConfigured,
  supabaseServerEnvMissing,
} from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

export async function GET() {
  const gate = await requireCategorizacionApi();
  if ("error" in gate) return gate.error;
  if (!isSupabaseServerConfigured()) {
    return NextResponse.json({ error: "Supabase no configurado", missingEnv: supabaseServerEnvMissing() }, { status: 503 });
  }
  try {
    const rows = await listCatPersonal();
    return NextResponse.json({ ok: true, rows });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Error" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  const gate = await requireCategorizacionApi();
  if ("error" in gate) return gate.error;
  if (!isSupabaseServerConfigured()) {
    return NextResponse.json({ error: "Supabase no configurado" }, { status: 503 });
  }
  let body: { action?: string; row?: CatPersonalRow; noEmpleado?: string; periodoEvaluacion?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "JSON invalido" }, { status: 400 });
  }

  try {
    if (body.action === "delete" && body.noEmpleado) {
      await deleteCatPersonal(body.noEmpleado);
      return NextResponse.json({ ok: true });
    }

    if (body.action === "sync_activos") {
      const admin = createSupabaseServiceRoleClient();
      if (!admin) return NextResponse.json({ error: "Cliente no disponible" }, { status: 503 });
      const stats = await syncCatPersonalActivosDesdeColaboradores(
        String(body.periodoEvaluacion ?? ""),
        admin,
      );
      const rows = await listCatPersonal(admin);
      return NextResponse.json({ ok: true, rows, stats });
    }

    if (body.row?.noEmpleado) {
      await upsertCatPersonal(body.row);
      return NextResponse.json({ ok: true, row: body.row });
    }

    return NextResponse.json({ error: "Solicitud invalida" }, { status: 400 });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Error" }, { status: 500 });
  }
}
