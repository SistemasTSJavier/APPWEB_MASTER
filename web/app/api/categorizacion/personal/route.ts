import { NextResponse } from "next/server";
import { requireCategorizacionApi } from "@/lib/categorizacion-api-auth";
import {
  colaboradorToCatPersonal,
  deleteCatPersonal,
  listCatPersonal,
  upsertCatPersonal,
} from "@/lib/categorizacion-server";
import type { CatPersonalRow } from "@/lib/categorizacion-types";
import {
  createSupabaseServiceRoleClient,
  isSupabaseServerConfigured,
  supabaseServerEnvMissing,
} from "@/lib/supabase/admin";
import { fetchAllColaboradoresCompletos } from "@/lib/colaboradores-supabase-fetch-all";

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

    if (body.action === "register_from_colaborador" && body.noEmpleado) {
      const admin = createSupabaseServiceRoleClient();
      if (!admin) return NextResponse.json({ error: "Cliente no disponible" }, { status: 503 });
      const all = await fetchAllColaboradoresCompletos(admin);
      const key = body.noEmpleado.trim().toUpperCase();
      const c = all.find((x) => x.noEmpleado === key) ?? null;
      if (!c) {
        return NextResponse.json({ error: "No existe expediente en Colaboradores para ese N°." }, { status: 404 });
      }
      const row = colaboradorToCatPersonal(c, String(body.periodoEvaluacion ?? ""));
      await upsertCatPersonal(row);
      return NextResponse.json({ ok: true, row });
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
