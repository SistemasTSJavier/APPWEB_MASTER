import { NextResponse } from "next/server";
import { requireCategorizacionApi } from "@/lib/categorizacion-api-auth";
import { contarFaltasMesDesdeCuadricula, mesCalendarioActualYm } from "@/lib/categorizacion-faltas-cuadricula";
import {
  createSupabaseServiceRoleClient,
  isSupabaseServerConfigured,
  supabaseServerEnvMissing,
} from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const gate = await requireCategorizacionApi();
  if ("error" in gate) return gate.error;
  if (!isSupabaseServerConfigured()) {
    return NextResponse.json({ error: "Supabase no configurado", missingEnv: supabaseServerEnvMissing() }, { status: 503 });
  }
  const admin = createSupabaseServiceRoleClient();
  if (!admin) {
    return NextResponse.json({ error: "Cliente Supabase no disponible" }, { status: 503 });
  }

  const url = new URL(req.url);
  const mes = url.searchParams.get("mes")?.trim() || mesCalendarioActualYm();

  try {
    const { mesYm, faltas } = await contarFaltasMesDesdeCuadricula(admin, mes);
    return NextResponse.json({ ok: true, mesYm, faltas });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Error" }, { status: 500 });
  }
}
