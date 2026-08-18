import { NextResponse } from "next/server";
import {
  requireAlertasLegalCancelarApi,
  requireAlertasLegalLlegadaApi,
} from "@/lib/alertas-legal-api-auth";
import { cancelarAlertaLegal, marcarAlertaLegalLlego } from "@/lib/alertas-legal-server";

export const dynamic = "force-dynamic";

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  if (!id?.trim()) return NextResponse.json({ error: "ID requerido." }, { status: 400 });

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido." }, { status: 400 });
  }
  const accion = String((body as { accion?: string })?.accion ?? "").trim().toLowerCase();

  if (accion === "llego") {
    const gate = await requireAlertasLegalLlegadaApi();
    if ("error" in gate) return gate.error;
    const result = await marcarAlertaLegalLlego({
      id: id.trim(),
      recepcionEmail: gate.auth.user.email ?? "",
    });
    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: result.status ?? 500 });
    }
    return NextResponse.json({
      ok: true,
      row: result.row,
      emailOk: result.emailOk,
      emailError: result.emailError,
      emailTo: result.emailTo,
    });
  }

  if (accion === "cancelar") {
    const gate = await requireAlertasLegalCancelarApi();
    if ("error" in gate) return gate.error;
    const result = await cancelarAlertaLegal(id.trim());
    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: result.status ?? 500 });
    }
    return NextResponse.json({ ok: true, row: result.row });
  }

  return NextResponse.json({ error: "Acción no válida (llego | cancelar)." }, { status: 400 });
}
