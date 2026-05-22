import { NextResponse } from "next/server";
import { obtenerRegistroPorCodigo } from "@/lib/moper-registros-server";
import {
  createSupabaseServiceRoleClient,
  isSupabaseServerConfigured,
} from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ codigo: string }> };

/** Acceso publico por codigo (firma de conformidad del oficial). */
export async function GET(_req: Request, { params }: Params) {
  const { codigo } = await params;
  const c = decodeURIComponent(codigo ?? "").trim().toUpperCase();
  if (!c || c.length < 4) {
    return NextResponse.json({ error: "Codigo invalido" }, { status: 400 });
  }
  if (!isSupabaseServerConfigured()) {
    return NextResponse.json({ error: "Supabase no configurado" }, { status: 503 });
  }
  const admin = createSupabaseServiceRoleClient();
  if (!admin) {
    return NextResponse.json({ error: "Cliente no disponible" }, { status: 503 });
  }
  try {
    const registro = await obtenerRegistroPorCodigo(admin, c);
    if (!registro) return NextResponse.json({ error: "Codigo no valido" }, { status: 404 });
    return NextResponse.json(registro);
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Error al buscar codigo" },
      { status: 500 },
    );
  }
}
