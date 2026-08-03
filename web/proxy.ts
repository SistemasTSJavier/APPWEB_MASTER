import { createServerClient } from "@supabase/ssr";
import type { User } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";
import {
  canAccessPath,
  defaultHomeForRole,
  modulosHabilitadosDesdeMetadata,
  resolveAppRoleFromUser,
  type AppRole,
} from "@/lib/app-role";
import {
  isMoperFirmaPublicPage,
  isMoperPublicApi,
  MOPER_FIRMA_PUBLIC_PATH,
} from "@/lib/moper-public-paths";
import { isIdeasPublicApi, isIdeasPublicPage } from "@/lib/ideas-que-transforman-public-paths";
import { isSafeLoginRedirect, loginUrlWithNext } from "@/lib/login-redirect";

function publicApiPath(pathname: string, method: string): boolean {
  if (pathname === "/api/supabase/status" || pathname === "/api/auth/me" || pathname === "/api/resend/status") return true;
  if (pathname === "/api/auth/signout" && (method === "POST" || method === "GET")) return true;
  if (pathname === "/api/catalogos/departamentos" && method === "GET") return true;
  if (isIdeasPublicApi(pathname, method)) return true;
  return isMoperPublicApi(pathname, method);
}

function isFeaturePublicPage(pathname: string): boolean {
  return isMoperFirmaPublicPage(pathname) || isIdeasPublicPage(pathname);
}

/** Rutas de auth que no requieren sesión (login, callback OAuth, cerrar sesión). */
function isAuthPublicPath(pathname: string): boolean {
  return (
    pathname === "/login" ||
    pathname === "/login/cliente" ||
    pathname.startsWith("/auth/callback") ||
    pathname.startsWith("/auth/signout")
  );
}

function isLoginPath(pathname: string): boolean {
  return pathname === "/login" || pathname === "/login/cliente";
}

export async function proxy(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();
  if (!url || !key) {
    return supabaseResponse;
  }

  const pathname = request.nextUrl.pathname;
  const method = request.method;

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
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options),
          );
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
    if (isAuthPublicPath(pathname) || isFeaturePublicPage(pathname)) {
      return supabaseResponse;
    }
    if (pathname.startsWith("/api/")) {
      if (publicApiPath(pathname, method)) return supabaseResponse;
      return NextResponse.json(
        {
          error: "No se pudo contactar Supabase Auth desde el servidor.",
          hint: "Revisa NEXT_PUBLIC_SUPABASE_URL en .env.local, conexion a internet, firewall y que el proyecto Supabase no este pausado.",
        },
        { status: 503 },
      );
    }
    const login = loginUrlWithNext(request.url, pathname + request.nextUrl.search, { error: "supabase_auth" });
    return NextResponse.redirect(login);
  }

  if (!user) {
    if (pathname.startsWith("/api/")) {
      if (publicApiPath(pathname, method)) return supabaseResponse;
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }
    if (isAuthPublicPath(pathname) || isFeaturePublicPage(pathname)) {
      return supabaseResponse;
    }
    if (pathname === "/moper" && request.nextUrl.searchParams.has("codigo")) {
      const dest = new URL(MOPER_FIRMA_PUBLIC_PATH, request.url);
      const codigo = request.nextUrl.searchParams.get("codigo");
      if (codigo) dest.searchParams.set("codigo", codigo);
      return NextResponse.redirect(dest);
    }
    const login = loginUrlWithNext(request.url, pathname + request.nextUrl.search);
    return NextResponse.redirect(login);
  }

  const role: AppRole | null = resolveAppRoleFromUser(user);
  const modulos = modulosHabilitadosDesdeMetadata(
    (user.user_metadata ?? null) as Record<string, unknown> | null,
  );

  if (!role) {
    if (isLoginPath(pathname)) return supabaseResponse;
    if (pathname.startsWith("/auth/signout")) return supabaseResponse;
    if (pathname.startsWith("/api/") && publicApiPath(pathname, method)) return supabaseResponse;
    if (pathname.startsWith("/api/")) {
      return NextResponse.json({ error: "Usuario sin app_role en metadata" }, { status: 403 });
    }
    return NextResponse.redirect(new URL("/login?error=sin_rol", request.url));
  }

  if (pathname.startsWith("/api/") && publicApiPath(pathname, method)) {
    return supabaseResponse;
  }

  if (isLoginPath(pathname)) {
    // Tras cerrar sesión, no reenviar al home aunque queden cookies viejas un instante.
    if (request.nextUrl.searchParams.get("logged_out") === "1") {
      return supabaseResponse;
    }
    const nextParam = request.nextUrl.searchParams.get("next");
    if (isSafeLoginRedirect(nextParam)) {
      const nextPath = nextParam.split("?")[0] ?? nextParam;
      if (canAccessPath(role, nextPath, user.email, modulos)) {
        return NextResponse.redirect(new URL(nextParam, request.url));
      }
    }
    return NextResponse.redirect(new URL(defaultHomeForRole(role, modulos), request.url));
  }

  if (pathname.startsWith("/api/")) {
    return supabaseResponse;
  }

  if (isFeaturePublicPage(pathname)) {
    return supabaseResponse;
  }

  if (!canAccessPath(role, pathname, user.email, modulos)) {
    return NextResponse.redirect(new URL(defaultHomeForRole(role, modulos), request.url));
  }

  return supabaseResponse;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|plantillas/|.*\\.(?:svg|png|jpg|jpeg|gif|webp|csv)$).*)",
  ],
};
