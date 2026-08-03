import { NextResponse } from "next/server";
import { requireCategorizacionAdminApi } from "@/lib/categorizacion-api-auth";
import {
  guardarPromediosRapidos,
  leerPromediosRapidosEmpleado,
} from "@/lib/categorizacion-promedios-rapidos";
import { periodMonthEvaluacion } from "@/lib/categorizacion-server";
import { isSupabaseServerConfigured, supabaseServerEnvMissing } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const gate = await requireCategorizacionAdminApi();
  if ("error" in gate) return gate.error;
  if (!isSupabaseServerConfigured()) {
    return NextResponse.json(
      { error: "Supabase no configurado", missingEnv: supabaseServerEnvMissing() },
      { status: 503 },
    );
  }
  const url = new URL(req.url);
  const no = url.searchParams.get("no_empleado")?.trim().toUpperCase();
  const periodMonth = url.searchParams.get("mes") ?? url.searchParams.get("period_month") ?? undefined;
  const puesto = url.searchParams.get("puesto") ?? "";
  if (!no) {
    return NextResponse.json({ error: "no_empleado requerido" }, { status: 400 });
  }
  try {
    const data = await leerPromediosRapidosEmpleado(no, periodMonth, undefined, { puesto });
    return NextResponse.json({ ok: true, ...data });
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
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "JSON invalido" }, { status: 400 });
  }
  try {
    const result = await guardarPromediosRapidos({
      noEmpleado: String(body.noEmpleado ?? ""),
      periodMonth: periodMonthEvaluacion(
        body.periodMonth != null ? String(body.periodMonth) : body.mes != null ? String(body.mes) : undefined,
      ),
      puesto: body.puesto != null ? String(body.puesto) : "",
      fechaIngreso: body.fechaIngreso != null ? String(body.fechaIngreso) : "",
      rh: body.rh as number | null | undefined,
      capacitacion: body.capacitacion as number | null | undefined,
      operaciones: body.operaciones as number | null | undefined,
      enfoque: body.enfoque as number | null | undefined,
    });
    return NextResponse.json({ ok: true, ...result });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Error" }, { status: 500 });
  }
}
