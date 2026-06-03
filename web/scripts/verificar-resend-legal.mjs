/**
 * Prueba envío con dominio de prueba Resend (onboarding@resend.dev).
 *
 * Uso (desde carpeta web):
 *   node --env-file=.env.local scripts/verificar-resend-legal.mjs
 */
const apiKey = (process.env.RESEND_API_KEY ?? "").trim().replace(/^["']|["']$/g, "");
const from = (process.env.EMAIL_FROM ?? "onboarding@resend.dev").trim();
const to = (process.env.LEGAL_ALERTAS_EMAIL_TO ?? "").trim();

if (!apiKey) {
  console.error("Falta RESEND_API_KEY en .env.local");
  process.exit(1);
}
if (!to) {
  console.error("Falta LEGAL_ALERTAS_EMAIL_TO (usa el correo de tu cuenta Resend para pruebas).");
  process.exit(1);
}
if (!from.includes("resend.dev")) {
  console.warn("AVISO: EMAIL_FROM no es onboarding@resend.dev — puede fallar si el dominio no está verificado.");
}

const r = await fetch("https://api.resend.com/emails", {
  method: "POST",
  headers: {
    Authorization: `Bearer ${apiKey}`,
    "Content-Type": "application/json",
  },
  body: JSON.stringify({
    from,
    to: [to],
    subject: "Prueba Tactical Support — alertas legal",
    html: "<p>Si recibes esto, Resend está bien configurado con dominio de prueba.</p>",
  }),
});

const body = await r.text();
if (!r.ok) {
  console.error("Error Resend", r.status, body);
  process.exit(1);
}
console.log("OK — correo de prueba enviado a", to, "desde", from);
console.log(body);
