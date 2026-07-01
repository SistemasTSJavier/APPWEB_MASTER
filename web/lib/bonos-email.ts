import type { BonosFila } from "@/lib/bonos-types";
import { formatoDesdeYyyyMmDd } from "@/lib/fecha-formato-display";
import {
  leerResendApiKey,
  leerVariableEntorno,
  mensajeErrorResend,
  mensajeResendApiKeyNoConfigurada,
  resendApiKeyPareceValida,
} from "@/lib/env-resend";
import type { SemanaLunDom } from "@/lib/semana-lun-dom";

export type EnvioEmailBonosResultado = {
  ok: boolean;
  enviados: number;
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

function fmtFecha(ymd: string): string {
  return formatoDesdeYyyyMmDd(ymd) || ymd || "—";
}

function filasHtml(filas: BonosFila[]): string {
  const rows = filas
    .map(
      (f) =>
        `<tr>
          <td style="padding:8px 10px;border:1px solid #e2e8f0;font-family:Consolas,monospace;font-weight:600">${escapeHtml(f.noEmpleado)}</td>
          <td style="padding:8px 10px;border:1px solid #e2e8f0">${escapeHtml(f.nombre)}</td>
          <td style="padding:8px 10px;border:1px solid #e2e8f0">${fmtFecha(f.fechaIngreso)}</td>
          <td style="padding:8px 10px;border:1px solid #e2e8f0">${escapeHtml(f.servicio)}</td>
          <td style="padding:8px 10px;border:1px solid #e2e8f0">${escapeHtml(f.localForaneo)}</td>
          <td style="padding:8px 10px;border:1px solid #e2e8f0;white-space:nowrap">${fmtFecha(f.periodoEvaluadoDesde)} → ${fmtFecha(f.periodoEvaluadoHasta)}</td>
          <td style="padding:8px 10px;border:1px solid #e2e8f0;text-align:center;font-weight:700">${f.bonoDias}</td>
          <td style="padding:8px 10px;border:1px solid #e2e8f0;font-weight:600">${fmtFecha(f.fechaCumplimiento)}</td>
        </tr>`,
    )
    .join("");

  return `<table style="border-collapse:collapse;width:100%;font-size:13px;font-family:Segoe UI,Arial,sans-serif">
    <thead>
      <tr style="background:linear-gradient(180deg,#312e81 0%,#4338ca 100%);color:#fff">
        <th style="padding:10px;text-align:left">N° empleado</th>
        <th style="padding:10px;text-align:left">Nombre</th>
        <th style="padding:10px;text-align:left">F. ingreso</th>
        <th style="padding:10px;text-align:left">Servicio</th>
        <th style="padding:10px;text-align:left">Local / foráneo</th>
        <th style="padding:10px;text-align:left">Periodo evaluado</th>
        <th style="padding:10px;text-align:center">Bono (días)</th>
        <th style="padding:10px;text-align:left">Cumplimiento</th>
      </tr>
    </thead>
    <tbody>${rows}</tbody>
  </table>`;
}

function textoPlanoFilas(filas: BonosFila[]): string {
  return filas
    .map(
      (f) =>
        `${f.noEmpleado}\t${f.nombre}\t${fmtFecha(f.fechaIngreso)}\t${f.servicio}\t${f.localForaneo}\t${fmtFecha(f.periodoEvaluadoDesde)}-${fmtFecha(f.periodoEvaluadoHasta)}\t${f.bonoDias}\t${fmtFecha(f.fechaCumplimiento)}`,
    )
    .join("\n");
}

export function parseDestinatariosBonos(raw: string): string[] {
  const parts = raw
    .split(/[,;\s]+/)
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
  const seen = new Set<string>();
  const out: string[] = [];
  for (const p of parts) {
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(p)) continue;
    if (seen.has(p)) continue;
    seen.add(p);
    out.push(p);
  }
  return out;
}

export async function enviarEmailBonosSemana(opts: {
  destinatarios: string[];
  filas: BonosFila[];
  semana: SemanaLunDom;
}): Promise<EnvioEmailBonosResultado> {
  const { destinatarios, filas, semana } = opts;

  if (destinatarios.length === 0) {
    return { ok: false, enviados: 0, error: "Indique al menos un correo destinatario válido.", modo: "sin_configurar" };
  }
  if (filas.length === 0) {
    return { ok: false, enviados: 0, error: "Seleccione al menos un colaborador.", modo: "sin_configurar" };
  }

  const apiKey = leerResendApiKey();
  const from = leerVariableEntorno(process.env.EMAIL_FROM) || "onboarding@resend.dev";

  if (!apiKey) {
    return { ok: false, enviados: 0, error: mensajeResendApiKeyNoConfigurada(), modo: "sin_configurar" };
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

  const rango = `${formatoDesdeYyyyMmDd(semana.lunesYmd)} al ${formatoDesdeYyyyMmDd(semana.domingoYmd)}`;
  const saludo = `Buen dia!\nComparto la relacion de bonos a pagar correspondiente a esta semana (${rango}).`;
  const subject = `Bonos a pagar — semana ${rango}`;

  const html = `
    <div style="font-family:Segoe UI,Arial,sans-serif;color:#0f172a;max-width:960px;margin:0 auto">
      <div style="background:linear-gradient(135deg,#312e81 0%,#6366f1 100%);color:#fff;padding:24px 28px;border-radius:12px 12px 0 0">
        <p style="margin:0;font-size:12px;letter-spacing:0.12em;text-transform:uppercase;opacity:0.85">Tactical Support Master</p>
        <h1 style="margin:8px 0 0;font-size:22px;font-weight:700">Relación de bonos a pagar</h1>
        <p style="margin:10px 0 0;font-size:14px;opacity:0.95">Semana ${escapeHtml(rango)} · ${filas.length} colaborador(es)</p>
      </div>
      <div style="padding:24px 28px;background:#f8fafc;border:1px solid #e2e8f0;border-top:none;border-radius:0 0 12px 12px">
        <p style="margin:0 0 20px;font-size:15px;line-height:1.6;white-space:pre-line">${escapeHtml(saludo)}</p>
        ${filasHtml(filas)}
        <p style="margin-top:20px;font-size:11px;color:#64748b">Generado desde el módulo Bonos · Nóminas / RH</p>
      </div>
    </div>`;

  const text = `${saludo}\n\n${textoPlanoFilas(filas)}`;

  const r = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from,
      to: destinatarios,
      subject,
      html,
      text,
    }),
  });

  if (!r.ok) {
    const t = await r.text();
    return { ok: false, enviados: 0, error: mensajeErrorResend(r.status, t), modo: "resend" };
  }

  return { ok: true, enviados: destinatarios.length, modo: "resend" };
}
