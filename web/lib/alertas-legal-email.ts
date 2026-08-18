import { leerEmailDestinoAlertasLegal } from "@/lib/alertas-legal-config";
import {
  ALERTAS_LEGAL_MOTIVO_LABEL,
  type AlertaLegalFila,
} from "@/lib/alertas-legal-types";
import {
  leerResendApiKey,
  leerVariableEntorno,
  mensajeErrorResend,
  mensajeResendApiKeyNoConfigurada,
  resendApiKeyPareceValida,
} from "@/lib/env-resend";

export type EnvioAlertaLegalResultado = {
  ok: boolean;
  error?: string;
  modo: "resend" | "sin_configurar";
  to: string;
};

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export async function destinatarioAlertasLegalLlegada(): Promise<string> {
  return leerEmailDestinoAlertasLegal();
}

export async function enviarEmailAlertaLegalLlegada(
  fila: AlertaLegalFila,
  recepcionEmail: string,
): Promise<EnvioAlertaLegalResultado> {
  const apiKey = leerResendApiKey();
  const from = leerVariableEntorno(process.env.EMAIL_FROM) || "onboarding@resend.dev";
  const to = await destinatarioAlertasLegalLlegada();
  const motivo = ALERTAS_LEGAL_MOTIVO_LABEL[fila.motivo];
  const hora = new Date().toLocaleString("es-MX", { timeZone: "America/Mexico_City" });

  if (!apiKey) {
    return { ok: false, error: mensajeResendApiKeyNoConfigurada(), modo: "sin_configurar", to };
  }
  if (!resendApiKeyPareceValida(apiKey)) {
    return {
      ok: false,
      error: "RESEND_API_KEY con formato incorrecto (debe empezar con re_).",
      modo: "sin_configurar",
      to,
    };
  }

  const subject = `URGENTE recepción — ${fila.nombre} (${fila.noEmpleado}) llegó a firmar ${motivo}`;
  const html = `
    <div style="font-family:Segoe UI,Arial,sans-serif;color:#0f172a;max-width:640px">
      <h2 style="color:#7f1d1d;margin:0 0 12px">Persona en lista Legal llegó a firmar</h2>
      <p style="line-height:1.5">
        Recepción acaba de marcar que esta persona <strong>está en sitio para firmar</strong>.
        Atiéndalo de inmediato para evitar una anomalía.
      </p>
      <table style="border-collapse:collapse;width:100%;font-size:14px;margin:16px 0">
        <tr><td style="padding:6px 8px;border:1px solid #ddd;background:#f8fafc;font-weight:600">N.º empleado</td>
            <td style="padding:6px 8px;border:1px solid #ddd;font-family:monospace">${escapeHtml(fila.noEmpleado)}</td></tr>
        <tr><td style="padding:6px 8px;border:1px solid #ddd;background:#f8fafc;font-weight:600">Nombre</td>
            <td style="padding:6px 8px;border:1px solid #ddd">${escapeHtml(fila.nombre)}</td></tr>
        <tr><td style="padding:6px 8px;border:1px solid #ddd;background:#f8fafc;font-weight:600">Servicio</td>
            <td style="padding:6px 8px;border:1px solid #ddd">${escapeHtml(fila.servicio || "—")}</td></tr>
        <tr><td style="padding:6px 8px;border:1px solid #ddd;background:#f8fafc;font-weight:600">Motivo</td>
            <td style="padding:6px 8px;border:1px solid #ddd">${escapeHtml(motivo)}</td></tr>
        <tr><td style="padding:6px 8px;border:1px solid #ddd;background:#f8fafc;font-weight:600">Notas</td>
            <td style="padding:6px 8px;border:1px solid #ddd">${escapeHtml(fila.notas || "—")}</td></tr>
        <tr><td style="padding:6px 8px;border:1px solid #ddd;background:#f8fafc;font-weight:600">Marcado por</td>
            <td style="padding:6px 8px;border:1px solid #ddd">${escapeHtml(recepcionEmail || "—")}</td></tr>
        <tr><td style="padding:6px 8px;border:1px solid #ddd;background:#f8fafc;font-weight:600">Fecha / hora (MX)</td>
            <td style="padding:6px 8px;border:1px solid #ddd">${escapeHtml(hora)}</td></tr>
      </table>
      <p style="margin-top:16px;font-size:12px;color:#64748b">Tactical Support Master — Alertas Legal / Recepción</p>
    </div>`;

  const r = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ from, to: [to], subject, html }),
  });

  if (!r.ok) {
    const t = await r.text();
    return { ok: false, error: mensajeErrorResend(r.status, t), modo: "resend", to };
  }
  return { ok: true, modo: "resend", to };
}
