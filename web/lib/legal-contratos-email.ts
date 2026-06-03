import type { LegalContratoFila } from "@/lib/legal-contratos";
import { LEGAL_CONTRATOS_ALERTA_EMAIL, formatearFechaLegibleMx } from "@/lib/legal-contratos";
import {
  leerResendApiKey,
  leerVariableEntorno,
  mensajeErrorResend,
  resendApiKeyPareceValida,
} from "@/lib/env-resend";

export type EnvioEmailResultado = {
  ok: boolean;
  enviados: number;
  error?: string;
  modo: "resend" | "sin_configurar";
};

function filasHtml(filas: LegalContratoFila[]): string {
  const rows = filas
    .map(
      (f) =>
        `<tr>
          <td style="padding:6px 8px;border:1px solid #ddd;font-family:monospace">${f.noEmpleado}</td>
          <td style="padding:6px 8px;border:1px solid #ddd">${escapeHtml(f.nombre)}</td>
          <td style="padding:6px 8px;border:1px solid #ddd">${escapeHtml(f.servicio)}</td>
          <td style="padding:6px 8px;border:1px solid #ddd">${escapeHtml(f.planta || "—")}</td>
          <td style="padding:6px 8px;border:1px solid #ddd">${formatearFechaLegibleMx(f.fechaVencimientoContrato)}</td>
          <td style="padding:6px 8px;border:1px solid #ddd;font-weight:bold">${escapeHtml(f.textoRestante)}</td>
        </tr>`,
    )
    .join("");
  return `<table style="border-collapse:collapse;width:100%;font-size:13px">
    <thead><tr style="background:#1e3a5f;color:#fff">
      <th style="padding:8px;text-align:left">N°</th>
      <th style="padding:8px;text-align:left">Nombre</th>
      <th style="padding:8px;text-align:left">Servicio</th>
      <th style="padding:8px;text-align:left">Planta</th>
      <th style="padding:8px;text-align:left">Vence contrato</th>
      <th style="padding:8px;text-align:left">Tiempo restante</th>
    </tr></thead>
    <tbody>${rows}</tbody>
  </table>`;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export async function enviarEmailAlertasContratosLegal(filas: LegalContratoFila[]): Promise<EnvioEmailResultado> {
  if (filas.length === 0) {
    return { ok: true, enviados: 0, modo: "sin_configurar" };
  }

  const apiKey = leerResendApiKey();
  const from = leerVariableEntorno(process.env.EMAIL_FROM) || "onboarding@resend.dev";
  const to = leerVariableEntorno(process.env.LEGAL_ALERTAS_EMAIL_TO) || LEGAL_CONTRATOS_ALERTA_EMAIL;

  if (!apiKey) {
    console.warn(
      "[legal-contratos] RESEND_API_KEY no configurada; alertas pendientes:",
      filas.map((f) => `${f.noEmpleado} (${f.textoRestante})`).join(", "),
    );
    return {
      ok: false,
      enviados: 0,
      error: "RESEND_API_KEY no configurada. Usa web/.env.local y reinicia npm run dev.",
      modo: "sin_configurar",
    };
  }

  if (!resendApiKeyPareceValida(apiKey)) {
    return {
      ok: false,
      enviados: 0,
      error:
        "RESEND_API_KEY con formato incorrecto (debe empezar con re_ y sin comillas). Genera una clave nueva en Resend.",
      modo: "sin_configurar",
    };
  }

  const subject = `ALERTA LEGAL: ${filas.length} contrato(s) por vencer (8 días o menos)`;
  const html = `
    <div style="font-family:Segoe UI,Arial,sans-serif;color:#0f172a">
      <h2 style="color:#1e3a5f">Contratos de prueba por vencer</h2>
      <p>Los siguientes colaboradores tienen <strong>8 días o menos</strong> para el vencimiento de su periodo de prueba. Revise qué procede en cada caso.</p>
      ${filasHtml(filas)}
      <p style="margin-top:16px;font-size:12px;color:#64748b">Generado automáticamente por Tactical Support Master — Gerente Legal.</p>
    </div>`;

  const r = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from,
      to: [to],
      subject,
      html,
    }),
  });

  if (!r.ok) {
    const t = await r.text();
    return { ok: false, enviados: 0, error: mensajeErrorResend(r.status, t), modo: "resend" };
  }

  return { ok: true, enviados: filas.length, modo: "resend" };
}
