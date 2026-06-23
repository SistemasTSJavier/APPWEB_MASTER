import { createClient } from "@supabase/supabase-js";

/**
 * Cliente Supabase con **service role**: solo importar en código que ejecuta en el servidor
 * (Route Handlers, Server Actions). Omite RLS; no exponer al cliente ni usar NEXT_PUBLIC_*.
 */
export function createSupabaseServiceRoleClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!url || !key) {
    return null;
  }
  return createClient(url, key, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

export function isSupabaseServerConfigured(): boolean {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() &&
      process.env.SUPABASE_SERVICE_ROLE_KEY?.trim(),
  );
}

/** Nombres de variables vacías en el proceso del servidor (sin exponer valores). */
export function supabaseServerEnvMissing(): string[] {
  const missing: string[] = [];
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL?.trim()) missing.push("NEXT_PUBLIC_SUPABASE_URL");
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()) missing.push("SUPABASE_SERVICE_ROLE_KEY");
  return missing;
}

/**
 * PostgREST puede devolver "permission denied for table …" por:
 * - Clave equivocada (anon en lugar de service_role), o
 * - Falta GRANT al rol `service_role` en PostgreSQL (ejecutar migración 003 en SQL Editor).
 */
export function hintSupabaseTablePermissionError(message: string): string {
  if (!message || !/permission denied/i.test(message)) return message;
  const seqHint = /sequence/i.test(message)
    ? " Incluye GRANT USAGE, SELECT ON SEQUENCE public.moper_registros_id_seq (ver 015_moper_registros_grants.sql)."
    : "";
  return `${message} — Si ya usas SUPABASE_SERVICE_ROLE_KEY correcta, ejecuta en Supabase → SQL Editor web/supabase/migrations/003_grants_service_role.sql y, para MOPER, 015_moper_registros_grants.sql.${seqHint} Si la clave fuera anon, usa service_role y reinicia el servidor.`;
}

/**
 * Mensaje legible cuando el cliente Supabase no puede abrir la petición HTTP (antes de PostgREST).
 * Suele aparecer como `TypeError: fetch failed` en Node.
 */
export function hintSupabaseClientError(message: string): string {
  const m = String(message ?? "");
  if (/calificado_por|submodulo/i.test(m) && /schema cache|could not find.*column/i.test(m)) {
    return `${m} — Ejecuta en Supabase SQL Editor: web/supabase/migrations/025_cat_evaluacion_rpc.sql. Espera 20 s o reinicia el proyecto en Supabase.`;
  }
  if (
    /fetch failed/i.test(m) ||
    /ECONNREFUSED|ENOTFOUND|ETIMEDOUT|EAI_AGAIN/i.test(m) ||
    /getaddrinfo|network|socket|certificate|SSL|TLS|UNABLE_TO_VERIFY/i.test(m)
  ) {
    return `${m} — No hubo conexion de red con Supabase desde el servidor. Revisa: URL en NEXT_PUBLIC_SUPABASE_URL (https://<ref>.supabase.co, sin espacios ni barra final), internet/VPN/firewall o proxy corporativo, proyecto Supabase activo (no pausado), y reinicia npm run dev tras cambiar .env.local.`;
  }
  return hintSupabaseTablePermissionError(m);
}
