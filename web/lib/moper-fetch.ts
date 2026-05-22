/** Peticiones al API MOPER integrado en Next.js (misma sesion Supabase). */
export function moperFetch(input: string, init?: RequestInit): Promise<Response> {
  const url = input.startsWith("http") ? input : input;
  return fetch(url, { ...init, credentials: init?.credentials ?? "include" });
}
