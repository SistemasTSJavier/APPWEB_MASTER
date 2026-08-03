export function isSafeLoginRedirect(path: string | null | undefined): path is string {
  if (!path) return false;
  const p = path.trim();
  return p.startsWith("/") && !p.startsWith("//") && !p.startsWith("/login");
}

/** Login interno intranet. */
export const LOGIN_PATH = "/login";

/** Login dedicado a clientes temporales. */
export const LOGIN_CLIENTE_PATH = "/login/cliente";

export function loginUrlWithNext(requestUrl: string, returnPath: string, extraParams?: Record<string, string>): URL {
  const login = new URL(LOGIN_PATH, requestUrl);
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
