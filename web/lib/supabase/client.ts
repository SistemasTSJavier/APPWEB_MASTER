import { createBrowserClient } from "@supabase/ssr";

/**
 * Cliente Supabase para **Client Components** y hooks en el navegador.
 * Usa la anon key (pública); las políticas RLS protegen los datos en el proyecto.
 */
export function createSupabaseBrowserClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url?.trim() || !key?.trim()) {
    throw new Error(
      "Configura NEXT_PUBLIC_SUPABASE_URL y NEXT_PUBLIC_SUPABASE_ANON_KEY (Supabase → Project Settings → API).",
    );
  }
  return createBrowserClient(url, key);
}
