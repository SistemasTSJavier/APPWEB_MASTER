import { NextResponse } from "next/server";
import { leerResendApiKey, leerVariableEntorno, resendApiKeyPareceValida } from "@/lib/env-resend";
import { destinatarioContabilidadMoper } from "@/lib/moper-email";

export const dynamic = "force-dynamic";

/** Diagnóstico rápido: http://localhost:3000/api/resend/status */
export async function GET() {
  const apiKey = leerResendApiKey();
  const from = leerVariableEntorno(process.env.EMAIL_FROM) || "(no definido)";
  const moperTo = destinatarioContabilidadMoper();
  const legalTo = leerVariableEntorno(process.env.LEGAL_ALERTAS_EMAIL_TO) || "(no definido)";
  const appUrl =
    leerVariableEntorno(process.env.APP_URL) ||
    leerVariableEntorno(process.env.NEXT_PUBLIC_APP_URL) ||
    leerVariableEntorno(process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "") ||
    "(no definido)";

  return NextResponse.json({
    resendApiKeyConfigured: Boolean(apiKey),
    resendApiKeyFormatOk: apiKey ? resendApiKeyPareceValida(apiKey) : false,
    emailFrom: from,
    moperNotificacionTo: moperTo,
    legalAlertasTo: legalTo,
    appUrl,
    hint: !apiKey
      ? "Falta RESEND_API_KEY en web/.env.local — reinicia npm run dev después de guardar."
      : undefined,
  });
}
