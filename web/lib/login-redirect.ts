/** Ruta relativa segura para redirigir tras login (evita open redirect). */
export function isSafeLoginRedirect(path: string | null | undefined): path is string {
  if (!path) return false;
  const p = path.trim();
  return p.startsWith("/") && !p.startsWith("//") && !p.startsWith("/login");
}

export function loginUrlWithNext(requestUrl: string, returnPath: string, extraParams?: Record<string, string>): URL {
  const login = new URL("/login", requestUrl);
  if (isSafeLoginRedirect(returnPath)) {
    login.searchParams.set("next", returnPath);
  }
  if (extraParams) {
    for (const [key, value] of Object.entries(extraParams)) {
      login.searchParams.set(key, value);
    }
  }
  return login;
}
