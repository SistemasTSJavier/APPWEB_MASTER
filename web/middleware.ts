import { createServerClient } from "@supabase/ssr";
import type { User } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";
import {
  canAccessPath,
  defaultHomeForRole,
  parseAppRole,
  type AppRole,
} from "@/lib/app-role";

function publicApiPath(pathname: string): boolean {
  return pathname === "/api/supabase/status" || pathname === "/api/auth/me";
}

export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();
  if (!url || !key) {
    return supabaseResponse;
  }

  const pathname = request.nextUrl.pathname;

  let user: User | null = null;
  try {
    const supabase = createServerClient(url, key, {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) => supabaseResponse.cookies.set(name, value, options));
        },
      },
    });
    const { data, error } = await supabase.auth.getUser();
    if (error) {
      user = null;
    } else {
      user = data.user ?? null;
    }
  } catch {
    /** Fallo de red / TLS / DNS al llamar a Supabase Auth desde Edge (p. ej. `fetch failed`). */
    if (pathname === "/login" || pathname.startsWith("/auth/callback")) {
      return supabaseResponse;
    }
    if (pathname.startsWith("/api/")) {
      if (publicApiPath(pathname)) return supabaseResponse;
      return NextResponse.json(
        {
          error: "No se pudo contactar Supabase Auth desde el servidor.",
          hint: "Revisa NEXT_PUBLIC_SUPABASE_URL en .env.local, conexion a internet, firewall y que el proyecto Supabase no este pausado.",
        },
        { status: 503 },
      );
    }
    const login = new URL("/login", request.url);
    login.searchParams.set("error", "supabase_auth");
    return NextResponse.redirect(login);
  }

  if (!user) {
    if (pathname.startsWith("/api/")) {
      if (publicApiPath(pathname)) return supabaseResponse;
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }
    if (pathname === "/login" || pathname.startsWith("/auth/callback")) {
      return supabaseResponse;
    }
    const login = new URL("/login", request.url);
    return NextResponse.redirect(login);
  }

  const role: AppRole | null = parseAppRole(user.user_metadata?.app_role ?? user.app_metadata?.app_role);

  if (!role) {
    if (pathname === "/login") return supabaseResponse;
    if (pathname.startsWith("/api/") && publicApiPath(pathname)) return supabaseResponse;
    if (pathname.startsWith("/api/")) {
      return NextResponse.json({ error: "Usuario sin app_role en metadata" }, { status: 403 });
    }
    return NextResponse.redirect(new URL("/login?error=sin_rol", request.url));
  }

  if (pathname.startsWith("/api/") && publicApiPath(pathname)) {
    return supabaseResponse;
  }

  if (pathname === "/login") {
    return NextResponse.redirect(new URL(defaultHomeForRole(role), request.url));
  }

  if (pathname.startsWith("/api/")) {
    return supabaseResponse;
  }

  if (!canAccessPath(role, pathname, user.email)) {
    return NextResponse.redirect(new URL(defaultHomeForRole(role), request.url));
  }

  return supabaseResponse;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
