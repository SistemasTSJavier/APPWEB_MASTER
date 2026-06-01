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
import { mapaColaboradoresPorNo, procesarCsvActualizacionUnaColumna } from "@/lib/colaboradores-csv-columna-import";
import { fetchAllColaboradoresDbRows } from "@/lib/colaboradores-supabase-fetch-all";

export const dynamic = "force-dynamic";

const MAX_CSV_CHARS = 4 * 1024 * 1024;
const UPSERT_CHUNK = 500;

function normalizePayload(data: ColaboradorCompleto): ColaboradorCompleto {
  const key = data.noEmpleado.trim().toUpperCase();
  return {
    ...data,
    noEmpleado: key,
    nombreCompleto: data.nombreCompleto.trim(),
    servicioAsignado: data.servicioAsignado.trim(),
    ultimoServicio: data.ultimoServicio.trim(),
    nss: data.nss.trim(),
    posicion: data.posicion.trim(),
    puesto: data.puesto.trim(),
    form: data.form,
    familiares: data.familiares,
    registeredAt: data.registeredAt,
    ...(data.moperActual
      ? {
          moperActual: {
            servicio: data.moperActual.servicio.trim(),
            puesto: data.moperActual.puesto.trim(),
          },
        }
      : {}),
  };
}

/**
 * POST JSON `{ csvText: string }` — CSV con cabeceras: N° empleado + **una** columna reconocida (ej. ESTADO CIVIL).
 * Actualiza solo expedientes existentes; ignora N° que no existan.
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

  return NextResponse.json({
    ok: true,
    dataFieldKey: result.dataFieldKey,
    dataHeaderLabel: result.dataHeaderLabel,
    actualizados: items.length,
    ignoradosNoExiste: result.ignoredUnknownNo,
    omitidosSinExpediente: result.omitidosSinExpediente,
    filasVaciasOsinDato: result.skippedEmptyRow,
    errores: result.errors,
  });
}
