/** Quita comillas y espacios que suelen colarse al copiar desde .env */
export function leerVariableEntorno(raw: string | undefined): string {
  let v = String(raw ?? "").trim();
  if (
    (v.startsWith('"') && v.endsWith('"')) ||
    (v.startsWith("'") && v.endsWith("'"))
  ) {
    v = v.slice(1, -1).trim();
  }
  return v;
}

export function leerResendApiKey(): string {
  return leerVariableEntorno(process.env.RESEND_API_KEY);
}

export function resendApiKeyPareceValida(key: string): boolean {
  return /^re_[A-Za-z0-9_]+$/.test(key);
}

/** Mensaje claro para errores JSON de Resend (401 invalid key, etc.). */
export function mensajeErrorResend(status: number, body: string): string {
  try {
    const j = JSON.parse(body) as { message?: string; name?: string; statusCode?: number };
    const msg = String(j.message ?? j.name ?? body).trim();
    if (status === 401 || /invalid api key/i.test(msg)) {
      return (
        "API KEY DE RESEND INVALIDA. CREA UNA CLAVE NUEVA EN resend.com → API Keys, " +
        "PEGALA EN web/.env.local COMO RESEND_API_KEY=re_... (SIN COMILLAS) Y REINICIA npm run dev."
      );
    }
    if (/domain is not verified|not verified/i.test(msg)) {
      return (
        "EL DOMINIO DEL REMITENTE (EMAIL_FROM) NO ESTA VERIFICADO EN RESEND. " +
        "OPCION A (PRUEBA): EMAIL_FROM=onboarding@resend.dev EN .env.local Y REINICIA npm run dev. " +
        "OPCION B (PRODUCCION): resend.com/domains → AÑADE tacticalsupport.com.mx Y LOS REGISTROS DNS."
      );
    }
    return msg || `Resend HTTP ${status}`;
  } catch {
    return body.trim() || `Resend HTTP ${status}`;
  }
}
