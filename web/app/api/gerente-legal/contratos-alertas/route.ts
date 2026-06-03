import { NextResponse } from "next/server";
import { requireGerenteLegalApi } from "@/lib/gerente-legal-api-auth";
import { buildLegalContratosPayload, ejecutarEnvioAutomaticoProgramado } from "@/lib/legal-contratos-server";
import type { LegalContratoVista } from "@/lib/legal-contratos";

export const dynamic = "force-dynamic";

function parseVista(raw: string | null): LegalContratoVista {
  return raw === "historial" ? "historial" : "activas";
}

export async function GET(req: Request) {
  const gate = await requireGerenteLegalApi();
  if ("error" in gate) return gate.error;

  const url = new URL(req.url);
  try {
    await ejecutarEnvioAutomaticoProgramado();

    const payload = await buildLegalContratosPayload({
      vista: parseVista(url.searchParams.get("vista")),
      servicio: url.searchParams.get("servicio") ?? undefined,
      busqueda: url.searchParams.get("q") ?? undefined,
      referencia: url.searchParams.get("referencia") ?? undefined,
    });
    return NextResponse.json({ ok: true, ...payload });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Error" }, { status: 500 });
  }
}
