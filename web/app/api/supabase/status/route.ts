import { createSupabaseServerClient } from "@/lib/supabase/server";

/**
 * Comprueba que existan variables de entorno y que el proyecto responda.
 * Útil tras pegar URL y anon key en .env y reiniciar `npm run dev`.
 */
export async function GET() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();

  if (!url || !key) {
    return Response.json(
      {
        ok: false,
        configured: false,
        message: "Faltan NEXT_PUBLIC_SUPABASE_URL o NEXT_PUBLIC_SUPABASE_ANON_KEY en .env",
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
      message: "Conexion con Supabase correcta (Auth API alcanzable).",
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return Response.json(
      {
        ok: false,
        configured: true,
        message: "Variables definidas pero fallo al conectar.",
        detail: msg,
      },
      { status: 502 },
    );
  }
}
