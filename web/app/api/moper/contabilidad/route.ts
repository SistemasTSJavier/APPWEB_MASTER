import { NextResponse } from "next/server";
import { listarHistorialContabilidadMoper } from "@/lib/moper-registros-server";
import { requireMoperApiRead } from "@/lib/moper-api-helper";

export const dynamic = "force-dynamic";

function parseRecibido(raw: string | null): "si" | "no" | "todos" {
  const v = (raw ?? "").trim().toLowerCase();
  if (v === "si" || v === "sí") return "si";
  if (v === "no") return "no";
  return "todos";
}

export async function GET(req: Request) {
  const ctx = await requireMoperApiRead();
  if (ctx instanceof NextResponse) return ctx;

  const url = new URL(req.url);
  const desde = url.searchParams.get("desde")?.trim() || undefined;
  const hasta = url.searchParams.get("hasta")?.trim() || undefined;
  const recibido = parseRecibido(url.searchParams.get("recibido"));

  try {
    const items = await listarHistorialContabilidadMoper(ctx.admin, { desde, hasta, recibido });
    return NextResponse.json({ items });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Error al listar historial";
    const needs051 = /email_contabilidad_enviado_at|recibido_contabilidad|schema cache|does not exist/i.test(msg);
    const hint = needs051
      ? `${msg} — Ejecute 051_moper_contabilidad_recibido.sql en Supabase SQL Editor.`
      : msg;
    return NextResponse.json({ error: "Error al cargar historial de contabilidad", detail: hint }, { status: 500 });
  }
}
