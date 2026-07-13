import { NextResponse } from "next/server";
import type { ColaboradorCompleto } from "@/lib/colaboradores-types";
import {
  createSupabaseServiceRoleClient,
  hintSupabaseClientError,
  isSupabaseServerConfigured,
  supabaseServerEnvMissing,
} from "@/lib/supabase/admin";
import { getAuthedApiUser, isAuthedApiUser } from "@/lib/auth-api";
import { roleMayWriteExpedienteColaborador } from "@/lib/app-role";
import { sincronizarEstadoBajaEnColaborador } from "@/lib/colaboradores-baja";
import { colaboradorCompletoMayusculas } from "@/lib/texto-plataforma-mayusculas";
import {
  mapaColaboradoresPorNo,
  procesarCorreccionCsvDosColumnasEnMemoria,
} from "@/lib/colaboradores-correccion-dos-columnas-server";
import {
  listarNosCsvUnaColumna,
  muestraValorCampoColaborador,
} from "@/lib/colaboradores-csv-columna-import";
import {
  fetchAllColaboradoresDbRows,
  fetchColaboradoresDbRowsByNos,
} from "@/lib/colaboradores-supabase-fetch-all";

export const dynamic = "force-dynamic";
/** Vercel: corrección de cientos/miles de filas puede tardar. */
export const maxDuration = 120;

const MAX_CSV_CHARS = 8 * 1024 * 1024;
const UPSERT_CHUNK = 250;

function normalizePayload(data: ColaboradorCompleto): ColaboradorCompleto {
  return colaboradorCompletoMayusculas(sincronizarEstadoBajaEnColaborador(data));
}

/** POST JSON `{ csvText: string }` — CSV de exactamente 2 columnas (N° empleado + un campo). */
export async function POST(req: Request) {
  const auth = await getAuthedApiUser();
  if (!isAuthedApiUser(auth)) return auth;
  if (!roleMayWriteExpedienteColaborador(auth.role)) {
    return NextResponse.json({ error: "No autorizado para importar correccion CSV" }, { status: 403 });
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

  const preview = listarNosCsvUnaColumna(csvText);
  if (!preview.ok) {
    return NextResponse.json({ error: preview.message }, { status: 400 });
  }
  if (preview.nos.length === 0) {
    return NextResponse.json({ error: "NINGUNA FILA CON NUMERO DE EMPLEADO VALIDO." }, { status: 400 });
  }

  let dbRows: Awaited<ReturnType<typeof fetchColaboradoresDbRowsByNos>>;
  let cargaCompleta = false;
  try {
    // Primero solo N° del CSV; si excel/CSV quita ceros y BD los conserva, .in() puede fallar → fallback.
    dbRows = await fetchColaboradoresDbRowsByNos(admin, preview.nos);
    const minEsperado = Math.max(1, Math.floor(preview.nos.length * 0.5));
    if (dbRows.length < minEsperado) {
      dbRows = await fetchAllColaboradoresDbRows(admin);
      cargaCompleta = true;
    }
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Error al leer colaboradores" },
      { status: 500 },
    );
  }

  const byNo = mapaColaboradoresPorNo(dbRows);
  const result = procesarCorreccionCsvDosColumnasEnMemoria(csvText, byNo);
  if (!result.ok) {
    return NextResponse.json({ error: result.errors.join(" ") }, { status: 400 });
  }

  if (result.updated.length === 0) {
    return NextResponse.json({
      ok: true,
      fieldKey: result.fieldKey,
      actualizados: 0,
      sinExpediente: result.sinExpediente,
      omitidosSinExpediente: result.omitidosSinExpediente,
      avisos: result.avisos,
      filasCsv: preview.nos.length,
      cargadosBd: dbRows.length,
      cargaCompleta,
    });
  }

  const now = new Date().toISOString();
  const items = result.updated.map((raw) => normalizePayload(raw));

  for (let i = 0; i < items.length; i += UPSERT_CHUNK) {
    const chunk = items.slice(i, i + UPSERT_CHUNK);
    const rows = chunk.map((p) => ({
      // Clave = N° tal cual en el expediente (no canónico Excel).
      no_empleado: p.noEmpleado,
      data: p as unknown as Record<string, unknown>,
      updated_at: now,
    }));
    const { error: upErr } = await admin.from("colaboradores").upsert(rows, { onConflict: "no_empleado" });
    if (upErr) {
      return NextResponse.json(
        {
          error: hintSupabaseClientError(upErr.message),
          parcial: i,
          intentados: items.length,
        },
        { status: 500 },
      );
    }
  }

  const ejemplos = items.slice(0, 5).map((c) => ({
    noEmpleado: c.noEmpleado,
    valor: muestraValorCampoColaborador(c, result.fieldKey),
  }));

  return NextResponse.json({
    ok: true,
    fieldKey: result.fieldKey,
    actualizados: result.actualizados,
    sinExpediente: result.sinExpediente,
    omitidosSinExpediente: result.omitidosSinExpediente,
    avisos: result.avisos,
    filasCsv: preview.nos.length,
    cargadosBd: dbRows.length,
    cargaCompleta,
    ejemplos,
  });
}
