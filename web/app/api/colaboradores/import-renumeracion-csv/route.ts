import { NextResponse } from "next/server";
import {
  createSupabaseServiceRoleClient,
  isSupabaseServerConfigured,
  supabaseServerEnvMissing,
} from "@/lib/supabase/admin";
import { getAuthedApiUser, isAuthedApiUser } from "@/lib/auth-api";
import { roleMayWriteExpedienteColaborador } from "@/lib/app-role";
import { ejecutarRenumeracionCsv } from "@/lib/colaboradores-renumeracion-server";
import { fetchAllColaboradoresDbRows } from "@/lib/colaboradores-supabase-fetch-all";

export const dynamic = "force-dynamic";

const MAX_CSV_CHARS = 2 * 1024 * 1024;

/** POST JSON `{ csvText: string }` — CSV no_actual + no_nuevo para cambiar el N° de expediente. */
export async function POST(req: Request) {
  const auth = await getAuthedApiUser();
  if (!isAuthedApiUser(auth)) return auth;
  if (!roleMayWriteExpedienteColaborador(auth.role)) {
    return NextResponse.json({ error: "No autorizado para renumerar expedientes" }, { status: 403 });
  }

  if (!isSupabaseServerConfigured()) {
    return NextResponse.json({ error: "Supabase no configurado", missingEnv: supabaseServerEnvMissing() }, { status: 503 });
  }
  const admin = createSupabaseServiceRoleClient();
  if (!admin) return NextResponse.json({ error: "Cliente no disponible" }, { status: 503 });

  let body: { csvText?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "JSON invalido" }, { status: 400 });
  }

  const csvText = String(body.csvText ?? "");
  if (!csvText.trim()) {
    return NextResponse.json({ error: "csvText vacio" }, { status: 400 });
  }
  if (csvText.length > MAX_CSV_CHARS) {
    return NextResponse.json({ error: `CSV demasiado grande (maximo ${MAX_CSV_CHARS} caracteres)` }, { status: 400 });
  }

  let dbRows: Awaited<ReturnType<typeof fetchAllColaboradoresDbRows>>;
  try {
    dbRows = await fetchAllColaboradoresDbRows(admin);
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Error al leer colaboradores" },
      { status: 500 },
    );
  }

  const result = await ejecutarRenumeracionCsv(admin, csvText, dbRows);
  if (!result.ok) {
    return NextResponse.json({ error: result.errors.join(" ") }, { status: 400 });
  }

  return NextResponse.json({ ok: true, renumerados: result.renumerados, avisos: result.avisos });
}
