import { NextResponse } from "next/server";
import { requireGerenteLegalApi } from "@/lib/gerente-legal-api-auth";
import { ejecutarEnvioAutomaticoProgramado } from "@/lib/legal-contratos-server";

export const dynamic = "force-dynamic";

export async function POST() {
  const gate = await requireGerenteLegalApi();
  if ("error" in gate) return gate.error;
  if (gate.auth.role !== "admin" && gate.auth.role !== "gerente_legal") {
    return NextResponse.json({ error: "Solo Gerente Legal o Administrador puede enviar alertas" }, { status: 403 });
  }

  try {
    const result = await ejecutarEnvioAutomaticoProgramado({ forzar: true });
    return NextResponse.json(result);
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Error" }, { status: 500 });
  }
}
