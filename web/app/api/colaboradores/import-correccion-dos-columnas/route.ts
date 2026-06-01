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
import { mapaColaboradoresPorNo } from "@/lib/colaboradores-csv-columna-import";
import { procesarCorreccionCsvDosColumnasEnMemoria } from "@/lib/colaboradores-correccion-dos-columnas-server";
import { fetchAllColaboradoresData } from "@/lib/colaboradores-supabase-fetch-all";

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

/** POST JSON `{ csvText: string }` — CSV de exactamente 2 columnas (N° empleado + un campo). */
export async function POST(req: Request) {
  const auth = await getAuthedApiUser();
  if (!isAuthedApiUser(auth)) return auth;
  if (!roleMayEditColaboradores(auth.role)) {
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

  let dbRows: { data: unknown }[];
  try {
    const dataList = await fetchAllColaboradoresData(admin);
    dbRows = dataList.map((data) => ({ data }));
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
      avisos: result.avisos,
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

  return NextResponse.json({
    ok: true,
    fieldKey: result.fieldKey,
    actualizados: result.actualizados,
    sinExpediente: result.sinExpediente,
    avisos: result.avisos,
  });
}
