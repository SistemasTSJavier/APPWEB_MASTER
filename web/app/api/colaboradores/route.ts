import { NextResponse } from "next/server";
import type { ColaboradorCompleto } from "@/lib/colaboradores-types";
import {
  createSupabaseServiceRoleClient,
  hintSupabaseClientError,
  isSupabaseServerConfigured,
  supabaseServerEnvMissing,
} from "@/lib/supabase/admin";
import { getAuthedApiUser, isAuthedApiUser } from "@/lib/auth-api";
import {
  colaboradoresConsultaLimitada,
  roleMayReadColaboradoresApi,
  roleMayWriteExpedienteColaborador,
  userMayModulo,
} from "@/lib/app-role";
import { sincronizarEstadoBajaEnColaborador } from "@/lib/colaboradores-baja";
import { colaboradorCompletoMayusculas } from "@/lib/texto-plataforma-mayusculas";
import { fetchAllColaboradoresCompletos } from "@/lib/colaboradores-supabase-fetch-all";

export const dynamic = "force-dynamic";

function normalizePayload(data: ColaboradorCompleto): ColaboradorCompleto {
  return colaboradorCompletoMayusculas(sincronizarEstadoBajaEnColaborador(data));
}

/**
 * Consulta limitada (solo Ver): no. empleado, fecha ingreso, nombre y servicio en UI.
 * Se conservan campos mínimos para que filtros (servicio, zona, ingreso, estatus) funcionen
 * y la Cuadrícula pueda resolver planta/puesto de activos.
 * Sin NSS, familiares ni resto del expediente.
 */
function stripConsultaBasica(c: ColaboradorCompleto): ColaboradorCompleto {
  const form = c.form ?? {};
  return {
    noEmpleado: c.noEmpleado,
    nombreCompleto: c.nombreCompleto,
    fechaIngreso: c.fechaIngreso ?? "",
    servicioAsignado: c.servicioAsignado ?? "",
    ultimoServicio: c.ultimoServicio ?? "",
    nss: "",
    posicion: String(c.posicion ?? form.posicion ?? "").trim(),
    puesto: String(c.puesto ?? form.puesto ?? "").trim(),
    registeredAt: c.registeredAt ?? "",
    form: {
      fechaIngreso: String(form.fechaIngreso ?? "").trim(),
      fechaBaja: String(form.fechaBaja ?? "").trim(),
      estatusEmpleado: String(form.estatusEmpleado ?? "").trim(),
      servicio: String(form.servicio ?? "").trim(),
      servicioFinal: String(form.servicioFinal ?? "").trim(),
      planta: String(form.planta ?? "").trim(),
      posicion: String(form.posicion ?? "").trim(),
      puesto: String(form.puesto ?? "").trim(),
      nombreCompleto: String(form.nombreCompleto ?? c.nombreCompleto ?? "").trim(),
      noEmpleado1: String(form.noEmpleado1 ?? c.noEmpleado ?? "").trim(),
    },
    familiares: [],
    moperActual: c.moperActual?.servicio
      ? { servicio: String(c.moperActual.servicio).trim(), puesto: "" }
      : undefined,
  };
}

/** GET: lista todos los expedientes */
export async function GET() {
  const auth = await getAuthedApiUser();
  if (!isAuthedApiUser(auth)) return auth;
  if (!roleMayReadColaboradoresApi(auth.role)) {
    return NextResponse.json({ error: "No autorizado para consultar colaboradores" }, { status: 403 });
  }
  const meta = (auth.user.user_metadata ?? null) as Record<string, unknown> | null;
  if (!userMayModulo(auth.role, meta, "/colaboradores", "ver") && auth.role !== "admin") {
    // Si hay capacidades explícitas sin ver colaboradores, bloquear aunque el rol permita.
    const caps = meta?.modulos_capacidades;
    if (Array.isArray(caps) && caps.length > 0) {
      return NextResponse.json({ error: "Sin permiso de ver Colaboradores." }, { status: 403 });
    }
  }

  if (!isSupabaseServerConfigured()) {
    const missing = supabaseServerEnvMissing();
    return NextResponse.json(
      {
        error: "Supabase no configurado en el servidor",
        missingEnv: missing,
        hint: "En la carpeta /web crea o edita .env.local con NEXT_PUBLIC_SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY (Project Settings → API). Reinicia npm run dev.",
      },
      { status: 503 },
    );
  }
  const admin = createSupabaseServiceRoleClient();
  if (!admin) {
    return NextResponse.json({ error: "Cliente Supabase no disponible" }, { status: 503 });
  }

  try {
    const rows = await fetchAllColaboradoresCompletos(admin);
    const limitada = colaboradoresConsultaLimitada(auth.role, meta);
    return NextResponse.json(limitada ? rows.map(stripConsultaBasica) : rows);
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Error al listar colaboradores" },
      { status: 500 },
    );
  }
}

/** POST: guardar o actualizar un expediente */
export async function POST(req: Request) {
  const auth = await getAuthedApiUser();
  if (!isAuthedApiUser(auth)) return auth;
  if (!roleMayWriteExpedienteColaborador(auth.role)) {
    return NextResponse.json({ error: "No autorizado para guardar expedientes" }, { status: 403 });
  }
  const meta = (auth.user.user_metadata ?? null) as Record<string, unknown> | null;
  if (
    Array.isArray(meta?.modulos_capacidades) &&
    (meta?.modulos_capacidades as unknown[]).length > 0 &&
    !userMayModulo(auth.role, meta, "/colaboradores", "editar")
  ) {
    return NextResponse.json({ error: "Sin permiso de editar Colaboradores." }, { status: 403 });
  }

  if (!isSupabaseServerConfigured()) {
    return NextResponse.json(
      { error: "Supabase no configurado", missingEnv: supabaseServerEnvMissing() },
      { status: 503 },
    );
  }
  const admin = createSupabaseServiceRoleClient();
  if (!admin) {
    return NextResponse.json({ error: "Cliente no disponible" }, { status: 503 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "JSON invalido" }, { status: 400 });
  }

  const payload = normalizePayload(body as ColaboradorCompleto);

  const { error } = await admin.from("colaboradores").upsert(
    {
      no_empleado: payload.noEmpleado,
      data: payload as unknown as Record<string, unknown>,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "no_empleado" },
  );

  if (error) {
    return NextResponse.json({ error: hintSupabaseClientError(error.message) }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
