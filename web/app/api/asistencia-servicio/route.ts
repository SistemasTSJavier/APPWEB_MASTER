import { NextResponse } from "next/server";
import { getAuthedApiUser, isAuthedApiUser } from "@/lib/auth-api";
import {
  modulosHabilitadosDesdeMetadata,
  roleEsClienteEnfoque,
  roleMayAccessAsistenciaServicio,
} from "@/lib/app-role";
import { buildAsistenciaServicioMes } from "@/lib/asistencia-servicio";
import { resolverContextoEnfoqueCliente } from "@/lib/categorizacion-enfoque-auth";
import { activosCategorizacionDesdeColaboradores } from "@/lib/categorizacion-server";
import { fetchAllColaboradoresCompletos } from "@/lib/colaboradores-supabase-fetch-all";
import {
  createSupabaseServiceRoleClient,
  isSupabaseServerConfigured,
  supabaseServerEnvMissing,
} from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const auth = await getAuthedApiUser();
  if (!isAuthedApiUser(auth)) return auth;
  if (!roleMayAccessAsistenciaServicio(auth.role)) {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }

  if (roleEsClienteEnfoque(auth.role)) {
    const mods = modulosHabilitadosDesdeMetadata(
      (auth.user.user_metadata ?? null) as Record<string, unknown> | null,
    );
    // Con lista explícita: exige /asistencia-servicio. Sin lista (legado): denegar.
    if (mods.length > 0 && !mods.includes("/asistencia-servicio")) {
      return NextResponse.json({ error: "Módulo de asistencia no habilitado para este acceso." }, { status: 403 });
    }
    if (mods.length === 0) {
      return NextResponse.json({ error: "Módulo de asistencia no habilitado para este acceso." }, { status: 403 });
    }
  }

  if (!isSupabaseServerConfigured()) {
    return NextResponse.json(
      { error: "Supabase no configurado", missingEnv: supabaseServerEnvMissing() },
      { status: 503 },
    );
  }
  const admin = createSupabaseServiceRoleClient();
  if (!admin) return NextResponse.json({ error: "Cliente no disponible" }, { status: 503 });

  const url = new URL(req.url);
  const mesYm = url.searchParams.get("mes")?.trim() || undefined;
  const semana = url.searchParams.get("semana")?.trim() || undefined;
  let servicio = url.searchParams.get("servicio")?.trim() || "";

  if (roleEsClienteEnfoque(auth.role)) {
    const ctx = await resolverContextoEnfoqueCliente(auth.user);
    if (!ctx) {
      return NextResponse.json({ error: "Acceso de cliente expirado o sin servicio." }, { status: 403 });
    }
    servicio = ctx.servicio;
  }

  if (!servicio) {
    return NextResponse.json({ error: "Indique el servicio." }, { status: 400 });
  }

  try {
    const raw = await fetchAllColaboradoresCompletos(admin);
    const activos = activosCategorizacionDesdeColaboradores(raw, {
      servicio,
      soloCalificables: true,
    });
    const payload = await buildAsistenciaServicioMes(admin, {
      servicio,
      mesYm,
      semana,
      colaboradores: activos.map((a) => ({
        noEmpleado: a.noEmpleado,
        nombre: a.nombre,
        puesto: a.puesto,
        planta: a.planta ?? "",
        servicio: a.servicio,
      })),
    });
    return NextResponse.json(payload, {
      headers: { "Cache-Control": "private, no-store, max-age=0" },
    });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Error al consultar asistencia." },
      { status: 500 },
    );
  }
}
