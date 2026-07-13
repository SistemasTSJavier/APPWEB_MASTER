import { NextResponse } from "next/server";
import type { ColaboradorCompleto } from "@/lib/colaboradores-types";
import {
  createSupabaseServiceRoleClient,
  hintSupabaseClientError,
  isSupabaseServerConfigured,
  supabaseServerEnvMissing,
} from "@/lib/supabase/admin";
import { getAuthedApiUser, isAuthedApiUser } from "@/lib/auth-api";
import { roleMayEditColaboradores } from "@/lib/app-role";
import { sincronizarEstadoBajaEnColaborador } from "@/lib/colaboradores-baja";
import { colaboradorCompletoMayusculas } from "@/lib/texto-plataforma-mayusculas";
import {
  mapaColaboradoresPorNo,
  muestraValorCampoColaborador,
  procesarCsvActualizacionUnaColumna,
} from "@/lib/colaboradores-csv-columna-import";
import {
  fetchAllColaboradoresDbRows,
  fetchColaboradoresDbRowsByNos,
} from "@/lib/colaboradores-supabase-fetch-all";
import { normalizeToCompleto } from "@/lib/colaboradores-normalize";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

const MAX_CSV_CHARS = 4 * 1024 * 1024;
const UPSERT_CHUNK = 250;

function normalizePayload(data: ColaboradorCompleto): ColaboradorCompleto {
  return colaboradorCompletoMayusculas(sincronizarEstadoBajaEnColaborador(data));
}

/**
 * POST JSON `{ csvText: string }` — CSV con cabeceras: N° empleado + **una** columna reconocida (ej. SERVICIO).
 * Actualiza solo expedientes existentes; ignora N° que no existan.
 * Tras guardar, relee de BD una muestra para confirmar que el valor quedó persistido.
 */
export async function POST(req: Request) {
  const auth = await getAuthedApiUser();
  if (!isAuthedApiUser(auth)) return auth;
  if (!roleMayEditColaboradores(auth.role)) {
    return NextResponse.json({ error: "No autorizado para importar columnas" }, { status: 403 });
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

  const byNo = mapaColaboradoresPorNo(dbRows);
  const result = procesarCsvActualizacionUnaColumna(csvText, byNo);
  if (!result.ok) {
    return NextResponse.json({ error: result.message }, { status: 400 });
  }

  const antesPorNo = new Map<string, string>();
  for (const c of result.updated) {
    const prev = byNo.get(c.noEmpleado) ?? c;
    antesPorNo.set(c.noEmpleado, muestraValorCampoColaborador(prev, result.dataFieldKey));
  }

  if (result.updated.length === 0) {
    return NextResponse.json({
      ok: true,
      dataFieldKey: result.dataFieldKey,
      dataHeaderLabel: result.dataHeaderLabel,
      actualizados: 0,
      ignoradosNoExiste: result.ignoredUnknownNo,
      omitidosSinExpediente: result.omitidosSinExpediente,
      filasVaciasOsinDato: result.skippedEmptyRow,
      errores: result.errors,
      ejemplos: [],
    });
  }

  const now = new Date().toISOString();
  const items = result.updated.map((raw) => normalizePayload(raw));

  for (let i = 0; i < items.length; i += UPSERT_CHUNK) {
    const chunk = items.slice(i, i + UPSERT_CHUNK);
    const rows = chunk.map((p) => ({
      no_empleado: p.noEmpleado,
      data: p as unknown as Record<string, unknown>,
      updated_at: now,
    }));
    const { error: upErr } = await admin.from("colaboradores").upsert(rows, { onConflict: "no_empleado" });
    if (upErr) {
      return NextResponse.json({ error: hintSupabaseClientError(upErr.message) }, { status: 500 });
    }
  }

  // Relee de BD para confirmar (no confiar solo en el payload en memoria).
  const muestra = items.slice(0, 8);
  let verificados: Array<{
    noEmpleado: string;
    antes: string;
    esperado: string;
    persistido: string;
    ok: boolean;
  }> = [];
  try {
    const reRows = await fetchColaboradoresDbRowsByNos(
      admin,
      muestra.map((c) => c.noEmpleado),
    );
    const reBy = new Map(
      reRows.map((r) => {
        const c = normalizeToCompleto(r.data);
        const no = String(r.no_empleado ?? "").trim().toUpperCase();
        return [no, c] as const;
      }),
    );
    verificados = muestra.map((c) => {
      const esperado = muestraValorCampoColaborador(c, result.dataFieldKey);
      const leido = reBy.get(c.noEmpleado);
      const persistido = leido ? muestraValorCampoColaborador(leido, result.dataFieldKey) : "";
      return {
        noEmpleado: c.noEmpleado,
        antes: antesPorNo.get(c.noEmpleado) ?? "",
        esperado,
        persistido,
        ok: persistido.trim().toUpperCase() === esperado.trim().toUpperCase(),
      };
    });
  } catch {
    verificados = muestra.map((c) => ({
      noEmpleado: c.noEmpleado,
      antes: antesPorNo.get(c.noEmpleado) ?? "",
      esperado: muestraValorCampoColaborador(c, result.dataFieldKey),
      persistido: "(sin verificar)",
      ok: false,
    }));
  }

  const fallosPersistencia = verificados.filter((v) => !v.ok).length;

  return NextResponse.json({
    ok: true,
    dataFieldKey: result.dataFieldKey,
    dataHeaderLabel: result.dataHeaderLabel,
    actualizados: items.length,
    ignoradosNoExiste: result.ignoredUnknownNo,
    omitidosSinExpediente: result.omitidosSinExpediente,
    filasVaciasOsinDato: result.skippedEmptyRow,
    errores: result.errors,
    ejemplos: verificados.map((v) => ({
      noEmpleado: v.noEmpleado,
      antes: v.antes,
      despues: v.persistido || v.esperado,
      ok: v.ok,
    })),
    fallosPersistencia,
    aviso:
      fallosPersistencia > 0
        ? "ALGUNOS VALORES NO COINCIDEN AL RELEER LA BD. Revise N° de empleado duplicados o permisos."
        : undefined,
  });
}
