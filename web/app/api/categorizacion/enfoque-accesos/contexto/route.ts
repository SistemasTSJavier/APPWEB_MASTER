import { NextResponse } from "next/server";
import { requireCategorizacionApi } from "@/lib/categorizacion-api-auth";
import { roleEsClienteEnfoque } from "@/lib/app-role";

export const dynamic = "force-dynamic";

/** GET: contexto de acceso del cliente enfoque (servicio y vigencia). */
export async function GET() {
  const gate = await requireCategorizacionApi();
  if ("error" in gate) return gate.error;
  if (!roleEsClienteEnfoque(gate.auth.role) || !gate.auth.enfoqueCliente) {
    return NextResponse.json({ error: "No aplica" }, { status: 403 });
  }
  const { servicio, acceso } = gate.auth.enfoqueCliente;
  return NextResponse.json({
    ok: true,
    servicio,
    fechaInicio: acceso.fechaInicio,
    fechaFin: acceso.fechaFin,
    vigente: acceso.vigente,
  });
}
