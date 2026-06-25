/** URL base de la aplicación (enlaces en correos MOPER). */
export function moperAppBaseUrl(): string {
  const explicit =
    process.env.APP_URL?.trim() ||
    process.env.NEXT_PUBLIC_APP_URL?.trim() ||
    process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (explicit) return explicit.replace(/\/$/, "");
  const vercel = process.env.VERCEL_URL?.trim();
  if (vercel) return `https://${vercel.replace(/\/$/, "")}`;
  return "http://localhost:3000";
}

export function moperRegistroUrl(registroId: number): string {
  return `${moperAppBaseUrl()}/moper?registro=${registroId}`;
}
