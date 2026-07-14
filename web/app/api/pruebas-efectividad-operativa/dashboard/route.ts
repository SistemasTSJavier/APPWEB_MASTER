import { NextResponse } from "next/server";
import { requirePeoApi } from "@/lib/pruebas-efectividad-auth";
import { buildPeoDashboard } from "@/lib/pruebas-efectividad-server";
import {
  createSupabaseServiceRoleClient,
  isSupabaseServerConfigured,
  supabaseServerEnvMissing,
} from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

export async function GET() {
  const gate = await requirePeoApi();
  if ("error" in gate) return gate.error;
  if (!isSupabaseServerConfigured()) {
    return NextResponse.json(
      { error: "Supabase no configurado", missingEnv: supabaseServerEnvMissing() },
      { status: 503 },
    );
  }
  const admin = createSupabaseServiceRoleClient();
  if (!admin) return NextResponse.json({ error: "Cliente no disponible" }, { status: 503 });

  try {
    const payload = await buildPeoDashboard(admin, gate.auth.servicioScope);
    return NextResponse.json(payload, {
      headers: { "Cache-Control": "private, no-store, max-age=0" },
    });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Error al construir dashboard." },
      { status: 500 },
    );
  }
}
