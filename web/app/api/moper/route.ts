import { NextResponse } from "next/server";
import { listarResumenMoper, crearRegistroMoper } from "@/lib/moper-registros-server";
import type { MoperRegistroCreateBody } from "@/lib/moper-registros-types";
import { requireMoperApiRead, requireMoperApiWrite } from "@/lib/moper-api-helper";
import { hintSupabaseClientError } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

export async function GET() {
  const ctx = await requireMoperApiRead();
  if (ctx instanceof NextResponse) return ctx;
  try {
    const resumen = await listarResumenMoper(ctx.admin);
    return NextResponse.json(resumen);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Error al listar MOPER";
    const needs014 = /moper_registros|moper_folio_seq|schema cache|does not exist/i.test(msg);
    const needsGrants = /permission denied/i.test(msg);
    const needsSeq = /sequence/i.test(msg);
    let hint = msg;
    if (needs014) hint = `${msg} — Ejecute 014_moper_registros.sql en Supabase SQL Editor.`;
    else if (needsGrants) {
      hint = `${msg} — Ejecute 015_moper_registros_grants.sql (tablas y secuencia moper_registros_id_seq).`;
      if (needsSeq) hint += " Falta: grant usage, select on sequence public.moper_registros_id_seq to service_role;";
    }
    return NextResponse.json({ error: "Error al cargar registros", detail: hint }, { status: 500 });
  }
}

export async function POST(req: Request) {
  const ctx = await requireMoperApiWrite();
  if (ctx instanceof NextResponse) return ctx;
  let body: MoperRegistroCreateBody;
  try {
    body = (await req.json()) as MoperRegistroCreateBody;
  } catch {
    return NextResponse.json({ error: "JSON invalido" }, { status: 400 });
  }
  try {
    const registro = await crearRegistroMoper(ctx.admin, body);
    return NextResponse.json({ ...registro, id: registro.id });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Error al guardar" },
      { status: 400 },
    );
  }
}
