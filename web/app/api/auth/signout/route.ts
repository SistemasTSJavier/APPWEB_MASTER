import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/** POST/GET: cierra sesión (JSON). El cliente redirige a /login. */
async function clearSession() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();
  const res = NextResponse.json({ ok: true });

  if (!url || !key) {
    return res;
  }

  try {
    const cookieStore = await cookies();
    const supabase = createServerClient(url, key, {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            try {
              cookieStore.set(name, value, options);
            } catch {
              /* ignore */
            }
            res.cookies.set(name, value, options);
          });
        },
      },
    });
    await supabase.auth.signOut({ scope: "global" });
  } catch {
    /* ignore */
  }

  for (const c of (await cookies()).getAll()) {
    if (c.name.includes("auth-token") || c.name.startsWith("sb-")) {
      res.cookies.set(c.name, "", { path: "/", maxAge: 0 });
    }
  }

  return res;
}

export async function POST() {
  return clearSession();
}

export async function GET() {
  return clearSession();
}
