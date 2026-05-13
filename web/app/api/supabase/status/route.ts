import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isSupabaseServerConfigured } from "@/lib/supabase/admin";

/**
 * Comprueba que existan variables de entorno y que el proyecto responda.
 * Útil tras pegar URL y anon key en .env y reiniciar `npm run dev`.
 * Incluye si hay `SUPABASE_SERVICE_ROLE_KEY` (solo servidor) para las APIs de datos.
 */
export async function GET() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();
  const serverDataConfigured = isSupabaseServerConfigured();

  if (!url || !key) {
    return Response.json(
      {
        ok: false,
        configured: false,
        serverDataConfigured,
        message: "Faltan NEXT_PUBLIC_SUPABASE_URL o NEXT_PUBLIC_SUPABASE_ANON_KEY en .env",
        hint:
          !serverDataConfigured &&
          url &&
          "Para persistencia en Supabase desde el servidor, agrega SUPABASE_SERVICE_ROLE_KEY (nunca como NEXT_PUBLIC_).",
      },
      { status: 200 },
    );
  }

  try {
    const supabase = await createSupabaseServerClient();
    await supabase.auth.getSession();
    return Response.json({
      ok: true,
      configured: true,
      serverDataConfigured,
      message: serverDataConfigured
        ? "Conexion con Supabase correcta (Auth API alcanzable). APIs de colaboradores habilitadas."
        : "Conexion con Supabase correcta (Auth API alcanzable). Sin service role: las rutas /api/colaboradores y /api/moper-historial devuelven 503; la app requiere configuracion completa.",
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return Response.json(
      {
        ok: false,
        configured: true,
        serverDataConfigured,
        message: "Variables definidas pero fallo al conectar.",
        detail: msg,
      },
      { status: 502 },
    );
  }
}
