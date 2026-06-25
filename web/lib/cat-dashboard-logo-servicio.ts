import { normalizarServicioCategorizacion } from "@/lib/categorizacion-servicios-calificables";
import { hintSupabaseClientError, isSupabaseServerConfigured, createSupabaseServiceRoleClient } from "@/lib/supabase/admin";
import type { SupabaseClient } from "@supabase/supabase-js";

export function claveLogoServicioDashboard(servicio: string): string {
  return normalizarServicioCategorizacion(servicio);
}

export async function listLogosServicioDashboard(
  admin?: SupabaseClient | null,
): Promise<Record<string, string>> {
  const client =
    admin ?? (isSupabaseServerConfigured() ? createSupabaseServiceRoleClient() : null);
  if (!client) return {};

  const { data, error } = await client.from("cat_dashboard_logo_servicio").select("servicio, logo_url");
  if (error) {
    if (/relation|does not exist|schema cache/i.test(error.message)) return {};
    throw new Error(hintSupabaseClientError(error.message));
  }

  const out: Record<string, string> = {};
  for (const row of data ?? []) {
    const key = claveLogoServicioDashboard(String((row as { servicio: string }).servicio ?? ""));
    const url = String((row as { logo_url: string }).logo_url ?? "").trim();
    if (key && url) out[key] = url;
  }
  return out;
}

export async function upsertLogoServicioDashboard(
  servicio: string,
  logoUrl: string,
  admin?: SupabaseClient | null,
): Promise<void> {
  const client =
    admin ?? (isSupabaseServerConfigured() ? createSupabaseServiceRoleClient() : null);
  if (!client) throw new Error("Supabase no configurado");

  const key = claveLogoServicioDashboard(servicio);
  if (!key) throw new Error("Servicio requerido");

  const { error } = await client.from("cat_dashboard_logo_servicio").upsert(
    {
      servicio: key,
      logo_url: logoUrl.trim(),
      updated_at: new Date().toISOString(),
    },
    { onConflict: "servicio" },
  );

  if (error) throw new Error(hintSupabaseClientError(error.message));
}

export async function quitarLogoServicioDashboard(
  servicio: string,
  admin?: SupabaseClient | null,
): Promise<void> {
  const client =
    admin ?? (isSupabaseServerConfigured() ? createSupabaseServiceRoleClient() : null);
  if (!client) throw new Error("Supabase no configurado");

  const key = claveLogoServicioDashboard(servicio);
  if (!key) return;

  const { error } = await client.from("cat_dashboard_logo_servicio").delete().eq("servicio", key);
  if (error) throw new Error(hintSupabaseClientError(error.message));
}

export function logoServicioDesdeMapa(
  map: Record<string, string> | undefined,
  servicio: string,
): string | null {
  if (!map || !servicio.trim()) return null;
  const key = claveLogoServicioDashboard(servicio);
  return map[key]?.trim() || null;
}
