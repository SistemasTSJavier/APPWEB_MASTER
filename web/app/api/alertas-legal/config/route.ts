import { NextResponse } from "next/server";
import { requireAlertasLegalConfigApi } from "@/lib/alertas-legal-api-auth";
import { guardarEmailDestinoAlertasLegal, leerEmailDestinoAlertasLegal } from "@/lib/alertas-legal-config";

export const dynamic = "force-dynamic";

export async function GET() {
  const gate = await requireAlertasLegalConfigApi();
  if ("error" in gate) return gate.error;
  const emailTo = await leerEmailDestinoAlertasLegal();
  return NextResponse.json({ emailTo });
}

export async function PUT(req: Request) {
  const gate = await requireAlertasLegalConfigApi();
  if ("error" in gate) return gate.error;
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido." }, { status: 400 });
  }
  const emailTo = String((body as { emailTo?: string })?.emailTo ?? "").trim();
  const result = await guardarEmailDestinoAlertasLegal(emailTo, gate.auth.user.email ?? "");
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status ?? 500 });
  return NextResponse.json({ ok: true, emailTo: result.emailTo });
}
