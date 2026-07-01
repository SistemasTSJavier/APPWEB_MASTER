import type { BonosFila } from "@/lib/bonos-types";
import { agruparFilasPorBono } from "@/lib/bonos-agrupar";
import { formatoDesdeYyyyMmDd } from "@/lib/fecha-formato-display";
import {
  leerResendApiKey,
  leerVariableEntorno,
  mensajeErrorResend,
  mensajeResendApiKeyNoConfigurada,
  resendApiKeyPareceValida,
} from "@/lib/env-resend";
import type { SemanaLunDom } from "@/lib/semana-lun-dom";
import { PLATFORM_BRAND as C } from "@/lib/platform-brand-colors";

export type EnvioEmailBonosResultado = {
  ok: boolean;
  enviados: number;
  error?: string;
  modo: "resend" | "sin_configurar";
};

const FONT = "Segoe UI, Arial, Helvetica, sans-serif";

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

function celdaTh(texto: string, align: "left" | "center" = "left"): string {
  return `<th align="${align}" bgcolor="${C.tableHeadBg}" style="background-color:${C.tableHeadBg};color:${C.tableHeadText};font-family:${FONT};font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.04em;padding:12px 10px;border:1px solid ${C.borderStrong};text-align:${align};mso-line-height-rule:exactly;line-height:16px;">${escapeHtml(texto)}</th>`;
}

function celdaTd(
  contenido: string,
  opts?: { align?: "left" | "center"; bold?: boolean; mono?: boolean; bg?: string; color?: string },
): string {
  const align = opts?.align ?? "left";
  const bg = opts?.bg ?? C.surface;
  const weight = opts?.bold ? "700" : "400";
  const family = opts?.mono ? "Consolas, Courier New, monospace" : FONT;
  const color = opts?.color ?? C.text;
  return `<td align="${align}" bgcolor="${bg}" style="background-color:${bg};color:${color};font-family:${family};font-size:12px;font-weight:${weight};padding:10px;border:1px solid ${C.borderStrong};text-align:${align};vertical-align:top;mso-line-height-rule:exactly;line-height:18px;">${contenido}</td>`;
}

function subtituloGrupoHtml(titulo: string, cantidad: number): string {
  const texto = `${titulo.toUpperCase()} · ${cantidad} colaborador${cantidad === 1 ? "" : "es"}`;
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="width:100%;margin-top:24px;margin-bottom:10px;border-collapse:collapse;">
    <tr>
      <td bgcolor="${C.brand}" style="background-color:${C.brand};color:#ffffff;font-family:${FONT};font-size:13px;font-weight:700;padding:12px 16px;text-transform:uppercase;letter-spacing:0.06em;mso-line-height-rule:exactly;line-height:18px;border-left:4px solid ${C.brandAccent};">
        ${escapeHtml(texto)}
      </td>
    </tr>
  </table>`;
}

function filasTablaGrupoHtml(filas: BonosFila[]): string {
  const body = filas
    .map((f, i) => {
      const bg = i % 2 === 1 ? C.rowAlt : C.surface;
      const periodo = `${fmtFecha(f.periodoEvaluadoDesde)} &rarr; ${fmtFecha(f.periodoEvaluadoHasta)}`;
      const nombreHtml = f.nombre
        ? `<span style="font-weight:700;color:${C.text};">${escapeHtml(f.nombre)}</span>`
        : "—";

      return `<tr>
        ${celdaTd(escapeHtml(f.noEmpleado), { mono: true, bold: true, bg })}
        ${celdaTd(nombreHtml, { bg })}
        ${celdaTd(fmtFecha(f.fechaIngreso), { bg })}
        ${celdaTd(escapeHtml(f.servicio), { bg })}
        ${celdaTd(escapeHtml(f.localForaneo), { bg })}
        ${celdaTd(periodo, { bg, color: C.textMuted })}
        ${celdaTd(`<strong style="color:${C.brandAccent};">${fmtFecha(f.fechaCumplimiento)}</strong>`, { bg, bold: true })}
      </tr>`;
    })
    .join("");

  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;width:100%;min-width:720px;font-family:${FONT};margin-bottom:4px;">
    <thead>
      <tr>
        ${celdaTh("N° empleado")}
        ${celdaTh("Nombre")}
        ${celdaTh("F. ingreso")}
        ${celdaTh("Servicio")}
        ${celdaTh("Local / foráneo")}
        ${celdaTh("Periodo evaluado")}
        ${celdaTh("Cumplimiento")}
      </tr>
    </thead>
    <tbody>${body}</tbody>
  </table>`;
}

function tablasAgrupadasHtml(filas: BonosFila[]): string {
  const grupos = agruparFilasPorBono(filas);
  if (grupos.length === 0) return "";
  return grupos
    .map((g) => `${subtituloGrupoHtml(g.titulo, g.filas.length)}${filasTablaGrupoHtml(g.filas)}`)
    .join("");
}

function htmlCorreoBonos(opts: { saludo: string; rango: string; filas: BonosFila[] }): string {
  const { saludo, rango, filas } = opts;
  const tabla = tablasAgrupadasHtml(filas);

  return `<!DOCTYPE html>
<html lang="es" xmlns="http://www.w3.org/1999/xhtml" xmlns:v="urn:schemas-microsoft-com:vml" xmlns:o="urn:schemas-microsoft-com:office:office">
<head>
  <meta http-equiv="Content-Type" content="text/html; charset=UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta name="color-scheme" content="light" />
  <meta name="supported-color-schemes" content="light" />
  <!--[if mso]>
  <noscript>
    <xml>
      <o:OfficeDocumentSettings>
        <o:PixelsPerInch>96</o:PixelsPerInch>
      </o:OfficeDocumentSettings>
    </xml>
  </noscript>
  <style type="text/css">
    table { border-collapse: collapse; }
    td, th { font-family: Segoe UI, Arial, sans-serif; }
  </style>
  <![endif]-->
  <title>Bonos a pagar</title>
</head>
<body style="margin:0;padding:0;background-color:${C.background};-webkit-text-size-adjust:100%;-ms-text-size-adjust:100%;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="${C.background}" style="background-color:${C.background};width:100%;margin:0;padding:0;">
    <tr>
      <td align="center" style="padding:24px 12px;">
        <table role="presentation" width="920" cellpadding="0" cellspacing="0" border="0" style="width:100%;max-width:920px;border-collapse:collapse;">
          <!-- Encabezado -->
          <tr>
            <td bgcolor="${C.brand}" style="background-color:${C.brand};padding:28px 32px;border-top:4px solid ${C.brandAccent};">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td style="font-family:${FONT};color:${C.skyOnDark};font-size:11px;font-weight:700;letter-spacing:0.14em;text-transform:uppercase;mso-line-height-rule:exactly;line-height:16px;">
                    TACTICAL SUPPORT MASTER
                  </td>
                </tr>
                <tr>
                  <td style="font-family:${FONT};color:#ffffff;font-size:24px;font-weight:700;padding-top:8px;mso-line-height-rule:exactly;line-height:30px;">
                    Relaci&oacute;n de bonos a pagar
                  </td>
                </tr>
                <tr>
                  <td style="font-family:${FONT};color:${C.headerOnDark};font-size:14px;padding-top:10px;mso-line-height-rule:exactly;line-height:20px;">
                    Semana ${escapeHtml(rango)} &nbsp;&bull;&nbsp; ${filas.length} colaborador(es)
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <!-- Cuerpo -->
          <tr>
            <td bgcolor="${C.surface}" style="background-color:${C.surface};padding:28px 32px;border-left:1px solid ${C.border};border-right:1px solid ${C.border};">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td style="font-family:${FONT};font-size:15px;line-height:24px;color:${C.text};padding-bottom:24px;mso-line-height-rule:exactly;">
                    ${escapeHtml(saludo).replace(/\n/g, "<br />")}
                  </td>
                </tr>
                <tr>
                  <td style="padding-bottom:8px;">
                    <div style="overflow-x:auto;-webkit-overflow-scrolling:touch;">
                      ${tabla}
                    </div>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <!-- Pie -->
          <tr>
            <td bgcolor="${C.rowAlt}" style="background-color:${C.rowAlt};padding:16px 32px;border:1px solid ${C.border};border-top:none;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td style="font-family:${FONT};font-size:11px;color:${C.textMuted};mso-line-height-rule:exactly;line-height:16px;">
                    Generado desde el m&oacute;dulo <strong style="color:${C.brandAccent};">Bonos</strong> &middot; N&oacute;minas / RH
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

function textoPlanoFilas(filas: BonosFila[]): string {
  const header =
    "N° empleado\tNombre\tF. ingreso\tServicio\tLocal/foráneo\tPeriodo evaluado\tCumplimiento";
  return agruparFilasPorBono(filas)
    .map((g) => {
      const rows = g.filas
        .map(
          (f) =>
            `${f.noEmpleado}\t${f.nombre}\t${fmtFecha(f.fechaIngreso)}\t${f.servicio}\t${f.localForaneo}\t${fmtFecha(f.periodoEvaluadoDesde)}-${fmtFecha(f.periodoEvaluadoHasta)}\t${fmtFecha(f.fechaCumplimiento)}`,
        )
        .join("\n");
      return `--- ${g.titulo.toUpperCase()} (${g.filas.length}) ---\n${header}\n${rows}`;
    })
    .join("\n\n");
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

  const html = htmlCorreoBonos({ saludo, rango, filas });
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
