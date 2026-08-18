import {
  createSupabaseServiceRoleClient,
  hintSupabaseClientError,
  isSupabaseServerConfigured,
} from "@/lib/supabase/admin";
import { LEGAL_CONTRATOS_ALERTA_EMAIL } from "@/lib/legal-contratos";
import { leerVariableEntorno } from "@/lib/env-resend";
import { esEmailDestinoAlertasLegal } from "@/lib/alertas-legal-types";

function admin() {
  if (!isSupabaseServerConfigured()) return null;
  return createSupabaseServiceRoleClient();
}

export function destinatarioAlertasLegalFallback(): string {
  return (
    leerVariableEntorno(process.env.ALERTAS_LEGAL_LLEGADA_EMAIL_TO) ||
    leerVariableEntorno(process.env.LEGAL_ALERTAS_EMAIL_TO) ||
    LEGAL_CONTRATOS_ALERTA_EMAIL
  );
}

/** Correo configurado por el Administrador en la sección (con respaldo de entorno). */
export async function leerEmailDestinoAlertasLegal(): Promise<string> {
  const fallback = destinatarioAlertasLegalFallback();
  const sb = admin();
  if (!sb) return fallback;
  const { data, error } = await sb.from("alertas_legal_config").select("email_to").eq("id", 1).maybeSingle();
  if (error || !data) return fallback;
  const v = String(data.email_to ?? "").trim();
  return v || fallback;
}

export async function guardarEmailDestinoAlertasLegal(
  emailTo: string,
  updatedByEmail: string,
): Promise<{ ok: true; emailTo: string } | { ok: false; error: string; status?: number }> {
  const dest = emailTo.trim().toLowerCase();
  if (!esEmailDestinoAlertasLegal(dest)) {
    return { ok: false, error: "Indica un correo válido.", status: 400 };
  }
  const sb = admin();
  if (!sb) return { ok: false, error: "Supabase no configurado." };
  const { data, error } = await sb
    .from("alertas_legal_config")
    .upsert(
      {
        id: 1,
        email_to: dest,
        updated_at: new Date().toISOString(),
        updated_by_email: updatedByEmail.trim(),
      },
      { onConflict: "id" },
    )
    .select("email_to")
    .single();
  if (error) return { ok: false, error: hintSupabaseClientError(error.message) };
  return { ok: true, emailTo: String(data.email_to ?? dest) };
}
