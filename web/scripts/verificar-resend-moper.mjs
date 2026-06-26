/**
 * Prueba envío Resend — notificaciones MOPER.
 *
 * Uso (desde carpeta web):
 *   node --env-file=.env.local scripts/verificar-resend-moper.mjs
 *
 * Con dominio de prueba (onboarding@resend.dev) Resend solo entrega al correo
 * de la cuenta con la que te registraste en resend.com.
 */
const apiKey = (process.env.RESEND_API_KEY ?? "").trim().replace(/^["']|["']$/g, "");
const from = (process.env.EMAIL_FROM ?? "onboarding@resend.dev").trim();
const to = (
  process.env.MOPER_CONTABILIDAD_EMAIL_TO ??
  process.env.MOPER_NOTIFICACION_EMAIL_TO ??
  "nominas@tacticalsupport.com.mx"
).trim();
const appUrl = (process.env.APP_URL ?? process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000").replace(
  /\/$/,
  "",
);

if (!apiKey) {
  console.error("Falta RESEND_API_KEY en web/.env.local");
  process.exit(1);
}
if (!/^re_[A-Za-z0-9_]+$/.test(apiKey)) {
  console.error("RESEND_API_KEY con formato invalido (debe empezar con re_, sin comillas).");
  process.exit(1);
}
if (!to) {
  console.error("Falta MOPER_CONTABILIDAD_EMAIL_TO (correo que recibe avisos de MOPER completados).");
  process.exit(1);
}
if (!from.includes("resend.dev")) {
  console.warn(
    "AVISO: EMAIL_FROM no es onboarding@resend.dev — el dominio debe estar verificado en Resend → Domains.",
  );
}

const link = `${appUrl}/moper?registro=1`;
const html = `
  <div style="font-family:Segoe UI,Arial,sans-serif;color:#0f172a">
    <h2 style="color:#1e3a5f">Prueba MOPER — Resend</h2>
    <p>Si recibes este correo, la configuración de Resend para MOPER es correcta.</p>
    <p><a href="${link}">Ver MOPER de prueba</a></p>
    <p style="font-size:12px;color:#64748b">Tactical Support Master</p>
  </div>`;

console.log("Enviando prueba MOPER…");
console.log("  from:", from);
console.log("  to:  ", to);
console.log("  link:", link);

const r = await fetch("https://api.resend.com/emails", {
  method: "POST",
  headers: {
    Authorization: `Bearer ${apiKey}`,
    "Content-Type": "application/json",
  },
  body: JSON.stringify({
    from,
    to: [to],
    subject: "PRUEBA MOPER — Resend configurado",
    html,
  }),
});

const body = await r.text();
if (!r.ok) {
  console.error("Error Resend HTTP", r.status);
  console.error(body);
  if (/domain is not verified|not verified/i.test(body)) {
    console.error("\n→ Usa EMAIL_FROM=onboarding@resend.dev en pruebas, o verifica tacticalsupport.com.mx en Resend.");
  }
  if (/only send testing emails to your own email/i.test(body)) {
    console.error("\n→ Con onboarding@resend.dev solo puedes enviar al correo de tu cuenta Resend.");
    console.error("  Cambia MOPER_CONTABILIDAD_EMAIL_TO a ese correo para la prueba, o verifica tu dominio.");
  }
  process.exit(1);
}

console.log("OK — correo de prueba MOPER enviado.");
console.log(body);
