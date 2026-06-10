import { NextResponse } from "next/server";
import type { ColaboradorCompleto } from "@/lib/colaboradores-types";
import {
  createSupabaseServiceRoleClient,
  hintSupabaseClientError,
  isSupabaseServerConfigured,
} from "@/lib/supabase/admin";
import { getAuthedApiUser, isAuthedApiUser } from "@/lib/auth-api";
import { roleMayWriteExpedienteColaborador } from "@/lib/app-role";
import { dedupeColaboradoresUpsertLastWins } from "@/lib/colaboradores-upsert-dedupe";
import { sincronizarEstadoBajaEnColaborador } from "@/lib/colaboradores-baja";

export const dynamic = "force-dynamic";

const MAX_BATCH = 2000;

function normalizePayload(data: ColaboradorCompleto): ColaboradorCompleto {
  const synced = sincronizarEstadoBajaEnColaborador(data);
  const key = synced.noEmpleado.trim().toUpperCase();
  return {
    ...synced,
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

/** POST: importacion masiva { "items": ColaboradorCompleto[] } */
export async function POST(req: Request) {
  const auth = await getAuthedApiUser();
  if (!isAuthedApiUser(auth)) return auth;
  if (!roleMayWriteExpedienteColaborador(auth.role)) {
    return NextResponse.json({ error: "No autorizado para importar expedientes" }, { status: 403 });
  }

  if (!isSupabaseServerConfigured()) {
    return NextResponse.json({ error: "Supabase service role no configurado" }, { status: 503 });
  }
  const admin = createSupabaseServiceRoleClient();
  if (!admin) {
    return NextResponse.json({ error: "Cliente no disponible" }, { status: 503 });
  }

  let body: { items?: ColaboradorCompleto[] };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "JSON invalido" }, { status: 400 });
  }

  const items = Array.isArray(body.items) ? body.items : [];
  if (items.length === 0) {
    return NextResponse.json({ error: "items vacio" }, { status: 400 });
  }
  if (items.length > MAX_BATCH) {
    return NextResponse.json({ error: `Maximo ${MAX_BATCH} filas por lote` }, { status: 400 });
  }

  const now = new Date().toISOString();
  const normalized = items.map((raw) => normalizePayload(raw));
  const { unique, duplicateRowsMerged } = dedupeColaboradoresUpsertLastWins(normalized);
  const rows = unique.map((p) => ({
    no_empleado: p.noEmpleado,
    data: p as unknown as Record<string, unknown>,
    updated_at: now,
  }));

  const { error } = await admin.from("colaboradores").upsert(rows, { onConflict: "no_empleado" });
  if (error) {
    return NextResponse.json({ error: hintSupabaseClientError(error.message) }, { status: 500 });
  }
  return NextResponse.json({ ok: true, count: rows.length, duplicateNosMerged: duplicateRowsMerged });
}
