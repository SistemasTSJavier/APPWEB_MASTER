import type { MoperRegistroApi } from "@/lib/moper-registros-types";
import { formatearFechaLegibleMx } from "@/lib/legal-contratos";
import {
  leerResendApiKey,
  leerVariableEntorno,
  mensajeErrorResend,
  mensajeResendApiKeyNoConfigurada,
  resendApiKeyPareceValida,
} from "@/lib/env-resend";
import { moperRegistroUrl } from "@/lib/moper-app-url";
import { CONTABILIDAD_EMAIL } from "@/lib/app-role";

export type EnvioEmailMoperResultado = {
  ok: boolean;
  error?: string;
  modo: "resend" | "sin_configurar";
};

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function fechaMx(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = iso.slice(0, 10);
  return d.length === 10 ? formatearFechaLegibleMx(d) : iso;
}

export function destinatarioContabilidadMoper(): string {
  return leerVariableEntorno(process.env.MOPER_CONTABILIDAD_EMAIL_TO) || CONTABILIDAD_EMAIL;
}

export async function enviarEmailMoperContabilidad(
  registro: MoperRegistroApi,
  opts?: { esReenvio?: boolean; pendienteRecepcion?: boolean },
): Promise<EnvioEmailMoperResultado> {
  const apiKey = leerResendApiKey();
  const from = leerVariableEntorno(process.env.EMAIL_FROM) || "onboarding@resend.dev";
  const to = destinatarioContabilidadMoper();
  const link = moperRegistroUrl(registro.id);
  const folio = registro.folio?.trim() || `ID ${registro.id}`;
  const esReenvio = Boolean(opts?.esReenvio);
  const pendiente = Boolean(opts?.pendienteRecepcion);

  if (!apiKey) {
    console.warn("[moper-email] RESEND_API_KEY no configurada; MOPER", registro.id, "sin notificar a", to);
    return {
      ok: false,
      error: mensajeResendApiKeyNoConfigurada(),
      modo: "sin_configurar",
    };
  }

  if (!resendApiKeyPareceValida(apiKey)) {
    return {
      ok: false,
      error:
        "RESEND_API_KEY con formato incorrecto (debe empezar con re_ y sin comillas). Genera una clave nueva en Resend.",
      modo: "sin_configurar",
    };
  }

  const titulo = pendiente
    ? "MOPER pendiente de recepción en Contabilidad"
    : esReenvio
      ? "Recordatorio: MOPER listo para Contabilidad"
      : "MOPER completado — recepción en Contabilidad";

  const intro = pendiente
    ? "Hay un movimiento de personal (MOPER) completado que aún no ha sido marcado como recibido en el sistema."
    : esReenvio
      ? "Se reenvía la notificación del siguiente MOPER ya firmado por todas las áreas."
      : "Se completaron todas las firmas del siguiente movimiento de personal (MOPER). Revise el documento y confirme recepción en el enlace.";

  const subject = `${pendiente ? "PENDIENTE" : esReenvio ? "REENVÍO" : "NUEVO"} MOPER ${folio} — Contabilidad`;

  const html = `
    <div style="font-family:Segoe UI,Arial,sans-serif;color:#0f172a;max-width:640px">
      <h2 style="color:#1e3a5f;margin:0 0 12px">${escapeHtml(titulo)}</h2>
      <p style="line-height:1.5">${escapeHtml(intro)}</p>
      <table style="border-collapse:collapse;width:100%;font-size:14px;margin:16px 0">
        <tr><td style="padding:6px 8px;border:1px solid #ddd;background:#f8fafc;font-weight:600">Folio</td>
            <td style="padding:6px 8px;border:1px solid #ddd;font-family:monospace">${escapeHtml(folio)}</td></tr>
        <tr><td style="padding:6px 8px;border:1px solid #ddd;background:#f8fafc;font-weight:600">Oficial</td>
            <td style="padding:6px 8px;border:1px solid #ddd">${escapeHtml(registro.oficial_nombre ?? "")}</td></tr>
        <tr><td style="padding:6px 8px;border:1px solid #ddd;background:#f8fafc;font-weight:600">Servicio</td>
            <td style="padding:6px 8px;border:1px solid #ddd">${escapeHtml(registro.servicio_actual_nombre ?? "")} → ${escapeHtml(registro.servicio_nuevo_nombre ?? "")}</td></tr>
        <tr><td style="padding:6px 8px;border:1px solid #ddd;background:#f8fafc;font-weight:600">Puesto</td>
            <td style="padding:6px 8px;border:1px solid #ddd">${escapeHtml(registro.puesto_actual_nombre ?? "")} → ${escapeHtml(registro.puesto_nuevo_nombre ?? "")}</td></tr>
        <tr><td style="padding:6px 8px;border:1px solid #ddd;background:#f8fafc;font-weight:600">Inicio efectivo</td>
            <td style="padding:6px 8px;border:1px solid #ddd">${fechaMx(registro.fecha_inicio_efectiva)}</td></tr>
        <tr><td style="padding:6px 8px;border:1px solid #ddd;background:#f8fafc;font-weight:600">Motivo</td>
            <td style="padding:6px 8px;border:1px solid #ddd">${escapeHtml(registro.motivo ?? "")}</td></tr>
        <tr><td style="padding:6px 8px;border:1px solid #ddd;background:#f8fafc;font-weight:600">Creado</td>
            <td style="padding:6px 8px;border:1px solid #ddd">${fechaMx(registro.created_at)}</td></tr>
      </table>
      <p style="margin:20px 0">
        <a href="${escapeHtml(link)}" style="display:inline-block;background:#1e3a5f;color:#fff;padding:12px 20px;text-decoration:none;border-radius:6px;font-weight:600">
          Ver MOPER y marcar como recibido
        </a>
      </p>
      <p style="font-size:12px;color:#64748b">Enlace directo: <a href="${escapeHtml(link)}">${escapeHtml(link)}</a></p>
      <p style="margin-top:16px;font-size:12px;color:#64748b">Tactical Support Master — Módulo MOPER</p>
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
    let error = mensajeErrorResend(r.status, t);
    if (/recipient not found|mailbox not found|user unknown|doesn't exist/i.test(t)) {
      error = `El correo destino "${to}" no existe o no recibe correo. Revisa MOPER_CONTABILIDAD_EMAIL_TO en .env.local (debe ser un buzón real, no solo el usuario de login en la app). Detalle Resend: ${error}`;
    }
    return { ok: false, error, modo: "resend" };
  }

  return { ok: true, modo: "resend" };
}
