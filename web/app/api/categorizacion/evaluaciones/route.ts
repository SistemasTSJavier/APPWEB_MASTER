import { NextResponse } from "next/server";
import { roleEsClienteEnfoque } from "@/lib/app-role";
import {
  assertModuloPermitidoClienteEnfoque,
  requireCategorizacionAdminApi,
  requireCategorizacionApi,
  servicioScopeCategorizacion,
} from "@/lib/categorizacion-api-auth";
import type { CatEvalModuloId } from "@/lib/categorizacion-campos";
import { colaboradorPerteneceServicioEnfoque, syncCatPersonalActivosPorServicio } from "@/lib/categorizacion-enfoque-acceso";
import {
  deleteCatEvaluacion,
  getCatEvaluacion,
  listCatEvaluacionesModulo,
  listColaboradoresActivosParaCategorizacion,
  upsertCatEvaluacion,
} from "@/lib/categorizacion-server";
import { isSupabaseServerConfigured, supabaseServerEnvMissing } from "@/lib/supabase/admin";

const MODULOS: CatEvalModuloId[] = ["recursos_humanos", "operaciones", "enfoque_cliente"];

function parseModulo(s: string | null): CatEvalModuloId | null {
  if (s === "recursos_humanos" || s === "operaciones" || s === "enfoque_cliente") return s;
  return null;
}

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const gate = await requireCategorizacionApi();
  if ("error" in gate) return gate.error;
  if (!isSupabaseServerConfigured()) {
    return NextResponse.json({ error: "Supabase no configurado", missingEnv: supabaseServerEnvMissing() }, { status: 503 });
  }
  const url = new URL(req.url);
  const modulo = parseModulo(url.searchParams.get("modulo"));
  const no = url.searchParams.get("no_empleado")?.trim().toUpperCase();
  const submodulo = url.searchParams.get("submodulo")?.trim() || undefined;
  const calificadoPor = url.searchParams.get("calificado_por")?.trim() || undefined;

  try {
    if (modulo && no) {
      const denied = assertModuloPermitidoClienteEnfoque(gate.auth, modulo);
      if (denied) return denied;
      const row = await getCatEvaluacion(no, modulo, null, { submodulo, calificadoPor });
      return NextResponse.json({ ok: true, row });
    }
    if (modulo) {
      const denied = assertModuloPermitidoClienteEnfoque(gate.auth, modulo);
      if (denied) return denied;
      let rows = await listCatEvaluacionesModulo(
        modulo,
        null,
        modulo === "operaciones" ? { submodulo: submodulo ?? "oficial" } : undefined,
      );
      const srv = servicioScopeCategorizacion(gate.auth);
      if (srv && modulo === "enfoque_cliente") {
        const activos = await listColaboradoresActivosParaCategorizacion(undefined, null, {
          servicio: srv,
          soloCalificables: true,
        });
        const permitidos = new Set(activos.map((a) => a.noEmpleado.trim().toUpperCase()));
        rows = rows.filter((r) => permitidos.has(r.noEmpleado.trim().toUpperCase()));
      }
      return NextResponse.json({ ok: true, rows });
    }
    return NextResponse.json({ error: "Parametro modulo requerido" }, { status: 400 });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Error" }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  const gate = await requireCategorizacionAdminApi();
  if ("error" in gate) return gate.error;
  if (!isSupabaseServerConfigured()) {
    return NextResponse.json({ error: "Supabase no configurado", missingEnv: supabaseServerEnvMissing() }, { status: 503 });
  }
  const url = new URL(req.url);
  const modulo = parseModulo(url.searchParams.get("modulo"));
  const no = url.searchParams.get("no_empleado")?.trim().toUpperCase();
  const submodulo = url.searchParams.get("submodulo")?.trim() || undefined;
  const calificadoPor = url.searchParams.get("calificado_por")?.trim() || undefined;

  if (!modulo || !no || !MODULOS.includes(modulo)) {
    return NextResponse.json({ error: "no_empleado y modulo validos requeridos" }, { status: 400 });
  }
  const denied = assertModuloPermitidoClienteEnfoque(gate.auth, modulo);
  if (denied) return denied;

  try {
    await deleteCatEvaluacion(no, modulo, null, { submodulo, calificadoPor });
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Error" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  const gate = await requireCategorizacionApi();
  if ("error" in gate) return gate.error;
  if (roleEsClienteEnfoque(gate.auth.role)) {
    return NextResponse.json({ error: "Acceso de solo consulta; no puede registrar calificaciones." }, { status: 403 });
  }
  if (!isSupabaseServerConfigured()) {
    return NextResponse.json({ error: "Supabase no configurado" }, { status: 503 });
  }
  let body: {
    noEmpleado?: string;
    modulo?: string;
    submodulo?: string;
    calificadoPor?: string;
    scores?: Record<string, number>;
    comentarios?: string;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "JSON invalido" }, { status: 400 });
  }
  const modulo = parseModulo(String(body.modulo ?? ""));
  const no = body.noEmpleado?.trim().toUpperCase();
  if (!modulo || !no || !MODULOS.includes(modulo)) {
    return NextResponse.json({ error: "noEmpleado y modulo validos requeridos" }, { status: 400 });
  }
  const denied = assertModuloPermitidoClienteEnfoque(gate.auth, modulo);
  if (denied) return denied;

  const srv = servicioScopeCategorizacion(gate.auth);
  if (srv && modulo === "enfoque_cliente") {
    const activos = await listColaboradoresActivosParaCategorizacion(undefined, null, {
      servicio: srv,
      soloCalificables: true,
    });
    const col = activos.find((a) => a.noEmpleado.trim().toUpperCase() === no);
    if (!col || !colaboradorPerteneceServicioEnfoque(col.servicio, srv)) {
      return NextResponse.json(
        { error: "El colaborador no pertenece al servicio autorizado o no está activo." },
        { status: 403 },
      );
    }
    await syncCatPersonalActivosPorServicio(srv);
  }

  try {
    const row = await upsertCatEvaluacion(no, modulo, body.scores ?? {}, String(body.comentarios ?? ""), null, {
      submodulo: body.submodulo,
      calificadoPor: body.calificadoPor,
    });
    return NextResponse.json({ ok: true, row });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Error" }, { status: 500 });
  }
}
