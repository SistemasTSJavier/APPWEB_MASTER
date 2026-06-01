import { NextResponse } from "next/server";
import { requireCategorizacionApi } from "@/lib/categorizacion-api-auth";
import {
  deleteRegistroCapacitacion,
  listCursosCapacitacion,
  listRegistrosCapacitacion,
  upsertCursoCapacitacion,
  upsertRegistroCapacitacion,
} from "@/lib/categorizacion-server";
import { isSupabaseServerConfigured, supabaseServerEnvMissing } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

export async function GET() {
  const gate = await requireCategorizacionApi();
  if ("error" in gate) return gate.error;
  if (!isSupabaseServerConfigured()) {
    return NextResponse.json({ error: "Supabase no configurado", missingEnv: supabaseServerEnvMissing() }, { status: 503 });
  }
  try {
    const [cursos, registros] = await Promise.all([listCursosCapacitacion(), listRegistrosCapacitacion()]);
    return NextResponse.json({ ok: true, cursos, registros });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Error" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  const gate = await requireCategorizacionApi();
  if ("error" in gate) return gate.error;
  if (!isSupabaseServerConfigured()) {
    return NextResponse.json({ error: "Supabase no configurado" }, { status: 503 });
  }
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "JSON invalido" }, { status: 400 });
  }

  try {
    const action = String(body.action ?? "");

    if (action === "delete_registro" && body.id) {
      await deleteRegistroCapacitacion(String(body.id));
      return NextResponse.json({ ok: true });
    }

    if (action === "save_curso") {
      const curso = await upsertCursoCapacitacion({
        id: body.id ? String(body.id) : undefined,
        nombre: String(body.nombre ?? ""),
        fechaInicio: String(body.fechaInicio ?? ""),
        fechaVencimiento: String(body.fechaVencimiento ?? ""),
        activo: body.activo !== false,
      });
      return NextResponse.json({ ok: true, curso });
    }

    if (action === "save_registro") {
      const reg = await upsertRegistroCapacitacion({
        id: body.id ? String(body.id) : undefined,
        noEmpleado: String(body.noEmpleado ?? ""),
        cursoId: String(body.cursoId ?? ""),
        asistencia: body.asistencia != null ? Number(body.asistencia) : null,
        desempeno: body.desempeno != null ? Number(body.desempeno) : null,
        comentarios: String(body.comentarios ?? ""),
      });
      return NextResponse.json({ ok: true, registro: reg });
    }

    return NextResponse.json({ error: "action invalida" }, { status: 400 });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Error" }, { status: 500 });
  }
}
