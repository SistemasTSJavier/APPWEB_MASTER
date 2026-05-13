import { NextResponse } from "next/server";
import {
  createSupabaseServiceRoleClient,
  hintSupabaseClientError,
  isSupabaseServerConfigured,
} from "@/lib/supabase/admin";
import type { ColaboradorCompleto } from "@/lib/colaboradores-types";
import { normalizeToCompleto } from "@/lib/colaboradores-normalize";
import { mergeColaboradorConDestinoMoper } from "@/lib/colaboradores-data";
import type { MoperHistorialEntrada } from "@/lib/moper-historial-types";
import { nombreServicioCanonicoDesdeCatalogo } from "@/lib/servicios-catalogo-resolve";
import { getAuthedApiUser, isAuthedApiUser } from "@/lib/auth-api";
import { roleMayEditColaboradores } from "@/lib/app-role";

export const dynamic = "force-dynamic";

const HISTORIAL_PAGE = 8000;
const UPSERT_CHUNK = 400;

function normalizeNo(no: string): string {
  return no.trim().toUpperCase();
}

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

function mismaLineaMoperVisible(a: ColaboradorCompleto, b: ColaboradorCompleto): boolean {
  const au = (a.ultimoServicio ?? "").trim();
  const bu = (b.ultimoServicio ?? "").trim();
  const ap = (a.puesto ?? "").trim();
  const bp = (b.puesto ?? "").trim();
  const ams = (a.moperActual?.servicio ?? "").trim();
  const bms = (b.moperActual?.servicio ?? "").trim();
  const amp = (a.moperActual?.puesto ?? "").trim();
  const bmp = (b.moperActual?.puesto ?? "").trim();
  return au === bu && ap === bp && ams === bms && amp === bmp;
}

/** POST: alinea expedientes en `colaboradores` con el ultimo movimiento por persona en `moper_historial`. */
export async function POST() {
  const auth = await getAuthedApiUser();
  if (!isAuthedApiUser(auth)) return auth;
  if (!roleMayEditColaboradores(auth.role)) {
    return NextResponse.json({ error: "No autorizado para actualizar expedientes" }, { status: 403 });
  }

  if (!isSupabaseServerConfigured()) {
    return NextResponse.json({ error: "Supabase no configurado" }, { status: 503 });
  }
  const admin = createSupabaseServiceRoleClient();
  if (!admin) {
    return NextResponse.json({ error: "Cliente no disponible" }, { status: 503 });
  }

  let catalogoServicios: { nombre: string }[] = [];
  const { data: catData, error: catErr } = await admin.from("catalogo_servicios").select("nombre");
  if (!catErr && Array.isArray(catData)) {
    catalogoServicios = catData as { nombre: string }[];
  }

  const { data: histRows, error: histErr } = await admin
    .from("moper_historial")
    .select("no_empleado, entrada, created_at")
    .order("created_at", { ascending: false })
    .limit(HISTORIAL_PAGE);

  if (histErr) {
    return NextResponse.json({ error: hintSupabaseClientError(histErr.message) }, { status: 500 });
  }

  const ultimoPorNo = new Map<string, MoperHistorialEntrada>();
  for (const row of histRows ?? []) {
    const rawNo = row.no_empleado as string | undefined;
    const no = normalizeNo(String(rawNo ?? ""));
    if (!no) continue;
    const entrada = row.entrada as MoperHistorialEntrada | undefined;
    if (!entrada || typeof entrada !== "object") continue;
    if (!ultimoPorNo.has(no)) {
      ultimoPorNo.set(no, entrada);
    }
  }

  const { data: colRows, error: colErr } = await admin.from("colaboradores").select("no_empleado, data");
  if (colErr) {
    return NextResponse.json({ error: hintSupabaseClientError(colErr.message) }, { status: 500 });
  }

  const expedientePorNo = new Map<string, ColaboradorCompleto>();
  for (const row of colRows ?? []) {
    const c = normalizeToCompleto(row.data);
    if (c) expedientePorNo.set(c.noEmpleado, c);
  }

  let updated = 0;
  let sinCambio = 0;
  let sinExpediente = 0;

  const toUpsert: ColaboradorCompleto[] = [];

  for (const [no, entrada] of ultimoPorNo) {
    const sf = String(entrada.servicioFinal ?? "").trim();
    const pf = String(entrada.puestoFinal ?? "").trim();
    if (!sf && !pf) {
      sinCambio++;
      continue;
    }

    const c = expedientePorNo.get(no);
    if (!c) {
      sinExpediente++;
      continue;
    }

    const servicioParaMerge = nombreServicioCanonicoDesdeCatalogo(sf, catalogoServicios);
    const siguiente = mergeColaboradorConDestinoMoper(c, servicioParaMerge, entrada.puestoFinal ?? "");
    if (mismaLineaMoperVisible(c, siguiente)) {
      sinCambio++;
      continue;
    }

    toUpsert.push(siguiente);
  }

  const now = new Date().toISOString();
  for (let i = 0; i < toUpsert.length; i += UPSERT_CHUNK) {
    const chunk = toUpsert.slice(i, i + UPSERT_CHUNK);
    const rows = chunk.map((raw) => {
      const payload = normalizePayload(raw);
      return {
        no_empleado: payload.noEmpleado,
        data: payload as unknown as Record<string, unknown>,
        updated_at: now,
      };
    });

    const { error } = await admin.from("colaboradores").upsert(rows, { onConflict: "no_empleado" });
    if (error) {
      return NextResponse.json({ error: hintSupabaseClientError(error.message) }, { status: 500 });
    }
    updated += chunk.length;
  }

  return NextResponse.json({
    updated,
    sinCambio,
    sinExpediente,
    personasEnHistorial: ultimoPorNo.size,
  });
}
